/**
 * Table and meetup lifecycle on the emulator with the REAL rules:
 *   - the real client only receives tables / meetups that are still live (query filter, so expired ones are not read)
 *   - the real client's publish writes an expiry the rules accept
 *   - the cleanup job (Admin SDK, same code as the deployed function) deletes what is due and nothing else
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

const PROJECT = 'demo-budmo-lifecycle';
const current: { db: any; uid: string } = { db: null, uid: "" };
vi.mock('@/services/firebase', () => ({
  get db() {
    return current.db;
  },
  functions: {},
  auth: {},
  firebaseApp: {},
}));
vi.mock('expo-crypto', () => ({ getRandomValues: (buffer: Uint8Array) => { buffer.set(randomBytes(buffer.length)); return buffer; } }));

import { firestoreSyncService as svc } from '@/services/firestoreSyncService';
import { buildMeetup } from '@/logic/meetups';
import { publicGeohash } from '@/logic/nearby';
import { coarseCoordinate } from '@/logic/privacy';
import { adminFirestoreFor, createCleanupDeps } from '../../functions/src/deps';
import { discoverPeople, getPublicProfile } from '../../functions/src/discovery';
vi.mock('firebase/functions', () => ({ httpsCallable: () => async (input: { lat: number; lng: number }) => ({ data: await discoverPeople(adminDb, current.uid, input.lat, input.lng) }) }));

import { cleanupExpired } from '../../functions/src/lifecycle';
import type { GroupMeetup, HangoutAlert } from '@/types';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

let env: RulesTestEnvironment;
let adminDb: ReturnType<typeof adminFirestoreFor>['db'];
let closeAdmin: () => Promise<void>;

const as = (uid: string) => {
  current.uid = uid;
  current.db = env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true, age_21: true }).firestore();
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  ({ db: adminDb, close: closeAdmin } = adminFirestoreFor(PROJECT));
});
afterAll(async () => {
  await closeAdmin();
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const table = (id: string, expiresAt: number | undefined) => ({
  id, userId: 'host', userName: 'Host', userAvatar: '', barName: 'Squat', locationArea: 'Київ', drinkPreference: '', description: '',
  createdAt: 'x', createdAtTimestamp: 1, slotsAvailable: 2, participantsCount: 1, lat: 50.4, lng: 30.5, status: 'active', joinedUsers: ['host'],
  ...(expiresAt === undefined ? {} : { expiresAt }),
});
const meetupDoc = (id: string, endsAt: number | undefined) => ({
  id, title: id, description: '', venueName: '', venueAddress: '', scheduledDate: '', scheduledTime: '', maxParticipants: 6,
  participants: { host: { userId: 'host', userName: 'Host', userAvatar: '', role: 'host', status: 'going' } },
  creatorId: 'host', creatorName: 'Host', creatorAvatar: '', status: 'upcoming', createdAt: 'x',
  ...(endsAt === undefined ? {} : { endsAt }),
});

const firstSnapshot = <T,>(subscribe: (cb: (items: T[]) => void) => () => void): Promise<T[]> =>
  new Promise((resolve) => {
    const stop = subscribe((items) => {
      stop();
      resolve(items);
    });
  });

describe('what the client receives', () => {
  it('only tables that are still live (expired and pre-expiry-era tables are never read)', async () => {
    await adminDb.doc('hangouts/live').set(table('live', Date.now() + 2 * HOUR));
    await adminDb.doc('hangouts/over').set(table('over', Date.now() - 1000));
    await adminDb.doc('hangouts/legacy').set(table('legacy', undefined));
    as('bob');

    const items = await firstSnapshot<HangoutAlert>((cb) =>
      svc.subscribeToLiveHangouts({ lat: 50.45, lng: 30.52 } as never, cb)
    );
    expect(items.map((h) => h.id)).toEqual(['live']);
    expect(items[0].expiresAt).toBeGreaterThan(Date.now());
  });

  it('only meetups that have not been archived yet', async () => {
    await adminDb.doc('group_meetups/tonight').set(meetupDoc('tonight', Date.now() + 3 * HOUR));
    await adminDb.doc('group_meetups/archived').set(meetupDoc('archived', Date.now() - 2 * HOUR));
    await adminDb.doc('group_meetups/legacy').set(meetupDoc('legacy', undefined));
    as('bob');

    const items = await firstSnapshot<GroupMeetup>((cb) => svc.subscribeToMeetups(cb));
    expect(items.map((m) => m.id)).toEqual(['tonight']);
  });
});

describe('what the client writes', () => {
  it('a published table carries an expiry the rules accept, about 4 hours ahead', async () => {
    as('host');
    const before = Date.now();
    await svc.publishHangout({
      id: 'h1', userId: 'host', userName: 'Host', userAvatar: '', barName: 'Squat', locationArea: 'Київ', drinkPreference: '', description: '',
      createdAt: 'x', slotsAvailable: 2, participantsCount: 1, joinedUsers: ['host'],
    } as HangoutAlert);
    const stored = (await adminDb.doc('hangouts/h1').get()).data()!;
    expect(stored.expiresAt).toBeGreaterThanOrEqual(before + 4 * HOUR);
    expect(stored.expiresAt).toBeLessThanOrEqual(Date.now() + 4 * HOUR);
  });

  it('a created meetup carries endsAt = start + 24 h and the rules accept it', async () => {
    as('host');
    const start = Date.now() + 2 * DAY;
    const m = buildMeetup({
      title: 'Настілки', description: '', venueName: 'Squat', venueAddress: '', scheduledDate: '', scheduledTime: '',
      dateTimeIso: new Date(start).toISOString(), maxParticipants: 6, creatorId: 'host', creatorName: 'Host', creatorAvatar: '',
    });
    await svc.saveMeetup(m);
    expect((await adminDb.doc(`group_meetups/${m.id}`).get()).data()!.endsAt).toBe(start + DAY);
  });
});

describe('renewing a table through the real client', () => {
  it('the host brings an ended table back: same document, guests keep their seats', async () => {
    await adminDb.doc('hangouts/h1').set({ ...table('h1', Date.now() - HOUR), participantsCount: 2, joinedUsers: ['host', 'guest'] });
    as('host');
    const expiresAt = await svc.renewHangout({ ...table('h1', Date.now() - HOUR), joinedUsers: ['host', 'guest'] } as unknown as HangoutAlert);
    const stored = (await adminDb.doc('hangouts/h1').get()).data()!;
    expect(stored.expiresAt).toBe(expiresAt);
    expect(expiresAt).toBeGreaterThan(Date.now() + 3 * HOUR);
    expect(stored.joinedUsers).toEqual(['host', 'guest']);
  });

  it('after the cleanup removed it, the host posts a fresh table without guests', async () => {
    as('host');
    const expiresAt = await svc.renewHangout({ ...table('gone', Date.now() - HOUR), participantsCount: 2, joinedUsers: ['host', 'guest'] } as unknown as HangoutAlert);
    const stored = (await adminDb.doc('hangouts/gone').get()).data()!;
    expect(stored.expiresAt).toBe(expiresAt);
    expect(stored.joinedUsers).toEqual(['host']);
    expect(stored.participantsCount).toBe(1);
  });

  it('someone else cannot renew the table', async () => {
    await adminDb.doc('hangouts/h1').set(table('h1', Date.now() - HOUR));
    as('mallory');
    await expect(svc.renewHangout({ ...table('h1', Date.now() - HOUR), userId: 'host' } as unknown as HangoutAlert)).rejects.toThrow();
    expect((await adminDb.doc('hangouts/h1').get()).data()!.expiresAt).toBeLessThan(Date.now());
  });
});

describe('people nearby, through the real client', () => {
  const KYIV = { lat: 50.45, lng: 30.52 };
  const km = (north: number, east = 0) => ({ lat: KYIV.lat + north / 111.19, lng: KYIV.lng + east / (111.19 * Math.cos((KYIV.lat * Math.PI) / 180)) });
  const person = (uid: string, at: { lat: number; lng: number } | null, extra: Record<string, unknown> = {}) => ({
    id: uid, name: uid, avatar: '', shareLocation: true, age: 27, updatedAt: '2026-10-10T10:00:00.000Z',
    ...(at ? { lat: coarseCoordinate(at.lat), lng: coarseCoordinate(at.lng), geohash: publicGeohash(coarseCoordinate(at.lat), coarseCoordinate(at.lng)) } : {}),
    ...extra,
  });
  const seedPeople = async (people: Array<ReturnType<typeof person>>) => {
    for (const p of people) await adminDb.doc(`users/${p.id}`).set(p);
  };
  /** Waits until the merged result stops changing: every range has reported */
  const nearby = async (centre = KYIV, me = 'me') => {
    as(me);
    let latest: any[] = [];
    const stop = svc.subscribeToPublicBuddies(me, centre, (items) => (latest = items));
    await vi.waitFor(() => expect(latest.length).toBeGreaterThan(0), { timeout: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 800));
    stop();
    return latest;
  };

  it('returns people within 3 km, nearest first, and leaves out far away ones and people without a location', async () => {
    await seedPeople([
      person('close', km(0.4)),
      person('mid', km(1.5, 1.5)),
      person('edge', km(2.8)),
      person('far', km(8)),
      person('lviv', { lat: 49.84, lng: 24.03 }),
      person('nowhere', null),
    ]);
    const found = await nearby();
    expect(found.map((b) => b.id)).toEqual(['close', 'mid']); // the rounded edge is outside the 3 km radius
    expect(found[0].distanceKm).toBeLessThan(1.5);
  });

  it('never includes the signed-in user', async () => {
    await seedPeople([person('me', km(0.1)), person('friend', km(0.2))]);
    expect((await nearby()).map((b) => b.id)).toEqual(['friend']);
  });

  it('marks people who have not been around for a week as inactive instead of hiding them', async () => {
    const now = Date.now();
    await seedPeople([
      person('here', km(0.2), { lastSeenAt: new Date(now - 60_000).toISOString() }),
      person('away', km(0.4), { lastSeenAt: new Date(now - 10 * DAY).toISOString() }),
      person('never', km(0.6)),
    ]);
    const found = await nearby();
    const by = (id: string) => found.find((b) => b.id === id)!;
    expect(found.map((b) => b.id).sort()).toEqual(['away', 'here', 'never']);
    expect(by('here').online).toBe(false);
    expect(by('here').lastSeenAt).toBeUndefined();
    expect(by('away').online).toBe(false);
    expect(by('away').lastSeenAt).toBeUndefined();
    expect(by('never').lastSeenAt).toBeUndefined();
  });

  it('returns at most 50, the nearest ones', async () => {
    await seedPeople(Array.from({ length: 70 }, (_, i) => person(`p${String(i).padStart(2, '0')}`, km(0.03 * (i + 1)))));
    const found = await nearby();
    expect(found).toHaveLength(50);
    expect(found[0].id).toBe('p00');
    expect(found.map((b) => b.id)).not.toContain('p69');
  });

  it('the profile the real client writes is found by the query (the geohash comes from the published coordinates)', async () => {
    as('alice');
    await adminDb.doc('users/alice').set({ id: 'alice', name: 'Alice' });
    await svc.saveUserProfile({ id: 'alice', name: 'Alice', shareLocation: true, lat: 50.45123, lng: 30.52456 });
    const stored = (await adminDb.doc('users/alice').get()).data()!;
    expect(stored.lat).toBe(coarseCoordinate(50.45123));
    expect(stored.geohash).toBe(publicGeohash(stored.lat, stored.lng));
    expect((await nearby(KYIV, 'bob')).map((b) => b.id)).toContain('alice');
  });

  it('touchPresence records the visit', async () => {
    as('alice');
    await adminDb.doc('users/alice').set({ id: 'alice', name: 'Alice' });
    await svc.touchPresence('alice');
    const seen = (await adminDb.doc('users/alice').get()).data()!.lastSeenAt as string;
    expect(Date.now() - Date.parse(seen)).toBeLessThan(10_000);
  });
});

describe('the cleanup job on a real Firestore', () => {
  it('deletes expired tables and meetups archived more than 30 days ago, and nothing else', async () => {
    const now = Date.now();
    await adminDb.doc('hangouts/live').set(table('live', now + HOUR));
    await adminDb.doc('hangouts/over').set(table('over', now - HOUR));
    await adminDb.doc('group_meetups/tonight').set(meetupDoc('tonight', now + HOUR));
    await adminDb.doc('group_meetups/archived-recent').set(meetupDoc('archived-recent', now - 5 * DAY));
    await adminDb.doc('group_meetups/archived-old').set(meetupDoc('archived-old', now - 31 * DAY));

    const result = await cleanupExpired(createCleanupDeps(adminDb), now);
    expect(result).toEqual({ hangouts: 1, meetups: 1 });

    const ids = async (c: string) => (await adminDb.collection(c).get()).docs.map((d) => d.id).sort();
    expect(await ids('hangouts')).toEqual(['live']);
    expect(await ids('group_meetups')).toEqual(['archived-recent', 'tonight']);
  });

  it('is safe to run again and on an empty database', async () => {
    const now = Date.now();
    await adminDb.doc('hangouts/over').set(table('over', now - HOUR));
    await cleanupExpired(createCleanupDeps(adminDb), now);
    expect(await cleanupExpired(createCleanupDeps(adminDb), now)).toEqual({ hangouts: 0, meetups: 0 });
  });
});

describe('server discovery privacy', () => {
  it('filters both block directions and bans before the 50-person cap', async () => {
    const batch = adminDb.batch();
    for (let i = 0; i < 55; i++) {
      const id = `near-${String(i).padStart(2, '0')}`;
      batch.set(adminDb.doc(`users/${id}`), { id, name: id, age: 30, shareLocation: true, lat: 50.46, lng: 30.52, geohash: publicGeohash(50.46, 30.52), lastSeenAt: new Date().toISOString(), locationName: 'Private home label' });
    }
    batch.set(adminDb.doc('users/near-00/blocks/alice'), { userId: 'alice' });
    batch.set(adminDb.doc('users/alice/blocks/near-01'), { userId: 'near-01' });
    batch.set(adminDb.doc('bannedUsers/near-02'), { reportId: 'test' });
    await batch.commit();
    const found = await discoverPeople(adminDb, 'alice', 50.46, 30.52);
    expect(found).toHaveLength(50);
    expect(found.map((p) => p.id)).not.toContain('near-00');
    expect(found.map((p) => p.id)).not.toContain('near-01');
    expect(found.map((p) => p.id)).not.toContain('near-02');
    expect(found[0]).not.toHaveProperty('geohash');
    expect(found[0]).not.toHaveProperty('lastSeenAt');
    expect(found[0]).not.toHaveProperty('locationName');
    expect(await getPublicProfile(adminDb, 'alice', 'near-00')).toBeNull();
    expect(await getPublicProfile(adminDb, 'alice', 'near-01')).toBeNull();
    expect(await getPublicProfile(adminDb, 'alice', 'near-02')).toBeNull();
    expect(await getPublicProfile(adminDb, 'alice', 'near-03')).toHaveProperty('id', 'near-03');
  });
});
