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
import { backfillFeedCells, tagFeedCell } from '../../functions/src/feedArea';
import { feedCell, feedCells } from '@/logic/feedArea';
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
  createdAt: 'x', createdAtTimestamp: 1, slotsAvailable: 2, participantsCount: 1, lat: 50.4, lng: 30.5, geo: feedCell(50.4, 30.5), status: 'active', joinedUsers: ['host'],
  ...(expiresAt === undefined ? {} : { expiresAt }),
});
const meetupDoc = (id: string, endsAt: number | undefined) => ({
  id, title: id, description: '', venueName: '', venueAddress: '', scheduledDate: '', scheduledTime: '', maxParticipants: 6,
  participants: { host: { userId: 'host', userName: 'Host', userAvatar: '', role: 'host', status: 'going' } },
  creatorId: 'host', creatorName: 'Host', creatorAvatar: '', status: 'upcoming', createdAt: 'x', geo: feedCell(50.4, 30.5),
  ...(endsAt === undefined ? {} : { endsAt }),
});
const KYIV_AREA = feedCells(feedCell(50.45, 30.52));
const LVIV = { lat: 49.84, lng: 24.03, geo: feedCell(49.84, 24.03) };

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
      svc.subscribeToLiveHangouts('bob', { lat: 50.45, lng: 30.52 } as never, KYIV_AREA, cb)
    );
    expect(items.map((h) => h.id)).toEqual(['live']);
    expect(items[0].expiresAt).toBeGreaterThan(Date.now());
  });

  it('only meetups that have not been archived yet', async () => {
    await adminDb.doc('group_meetups/tonight').set(meetupDoc('tonight', Date.now() + 3 * HOUR));
    await adminDb.doc('group_meetups/archived').set(meetupDoc('archived', Date.now() - 2 * HOUR));
    await adminDb.doc('group_meetups/legacy').set(meetupDoc('legacy', undefined));
    as('bob');

    const items = await firstSnapshot<GroupMeetup>((cb) => svc.subscribeToMeetups('bob', KYIV_AREA, cb));
    expect(items.map((m) => m.id)).toEqual(['tonight']);
  });

  it('tables from the area around the person, and their own ones wherever they are', async () => {
    const later = Date.now() + 2 * HOUR;
    await adminDb.doc('hangouts/kyiv').set(table('kyiv', later));
    await adminDb.doc('hangouts/lviv').set({ ...table('lviv', later), ...LVIV });
    await adminDb.doc('hangouts/lviv-seat').set({ ...table('lviv-seat', later), ...LVIV, participantsCount: 2, joinedUsers: ['host', 'bob'] });
    await adminDb.doc('hangouts/lviv-host').set({ ...table('lviv-host', later), ...LVIV, userId: 'bob', joinedUsers: ['bob'] });
    as('bob');

    const items = await firstSnapshot<HangoutAlert>((cb) => svc.subscribeToLiveHangouts('bob', { lat: 50.45, lng: 30.52 } as never, KYIV_AREA, cb));
    expect(items.map((h) => h.id).sort()).toEqual(['kyiv', 'lviv-host', 'lviv-seat']);
  });

  it('meetups from the area around the person, and every one they host or are invited to', async () => {
    const later = Date.now() + 3 * HOUR;
    const bob = { userId: 'bob', userName: 'Bob', userAvatar: '', role: 'member', status: 'invited' };
    await adminDb.doc('group_meetups/kyiv').set(meetupDoc('kyiv', later));
    await adminDb.doc('group_meetups/lviv').set({ ...meetupDoc('lviv', later), ...LVIV });
    const invite = meetupDoc('lviv-invite', later);
    await adminDb.doc('group_meetups/lviv-invite').set({ ...invite, ...LVIV, participants: { ...invite.participants, bob } });
    const { geo: _unplaced, ...own } = meetupDoc('nowhere-mine', later);
    await adminDb.doc('group_meetups/nowhere-mine').set({ ...own, creatorId: 'bob', participants: { bob: { ...bob, role: 'host', status: 'going' } } });
    as('bob');

    const items = await firstSnapshot<GroupMeetup>((cb) => svc.subscribeToMeetups('bob', KYIV_AREA, cb));
    expect(items.map((m) => m.id).sort()).toEqual(['kyiv', 'lviv-invite', 'nowhere-mine']);
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

  it('profiles stamped with a visit time by older builds are found, without that time and never as online', async () => {
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

  it('a profile write drops the visit time an older build left behind', async () => {
    as('alice');
    await adminDb.doc('users/alice').set({ id: 'alice', name: 'Alice', lastSeenAt: new Date().toISOString() });
    await svc.saveUserProfile({ id: 'alice', name: 'Alice' });
    expect((await adminDb.doc('users/alice').get()).data()).not.toHaveProperty('lastSeenAt');
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

describe('chat history in pages through the real client', () => {
  const T0 = Date.UTC(2026, 9, 1);
  const id = (i: number) => `m${String(i).padStart(3, '0')}`;
  const at = (i: number) => T0 + i * 1000;
  const seedChat = async (count: number) => {
    await adminDb.doc('chats/c1').set({ members: ['alice', 'bob'], isGroup: false });
    const batch = adminDb.batch();
    for (let i = 0; i < count; i++) {
      // Plain text is what decryptMessage passes through unchanged (messages from before encryption)
      batch.set(adminDb.doc(`chats/c1/messages/${id(i)}`), { id: id(i), senderId: 'bob', senderName: 'Bob', cipherPayload: `text ${i}`, type: 'text', timestamp: 'x', createdAt: new Date(at(i)) });
    }
    await batch.commit();
    as('alice');
  };
  const firstPage = (since?: number) =>
    new Promise<{ ids: string[]; replacesOlder: boolean }>((resolve) => {
      const stop = svc.subscribeToEncryptedChat('c1', 'alice', (messages, replacesOlder) => {
        stop();
        resolve({ ids: messages.map((m) => m.id), replacesOlder });
      }, since);
    });

  it('a chat new to this device starts from its newest 30 messages', async () => {
    await seedChat(50);
    const page = await firstPage();
    expect(page.ids).toEqual(Array.from({ length: 30 }, (_, i) => id(20 + i)));
    expect(page.replacesOlder).toBe(false);
  });

  it('"Show earlier" pages back from the oldest message held until the first one', async () => {
    await seedChat(50);
    const older = await svc.loadOlderMessages('c1', 'alice', at(35));
    expect(older.messages.map((m) => m.id)).toEqual(Array.from({ length: 30 }, (_, i) => id(5 + i)));
    expect(older.complete).toBe(false);
    const first = await svc.loadOlderMessages('c1', 'alice', at(5));
    expect(first.messages.map((m) => m.id)).toEqual([id(0), id(1), id(2), id(3), id(4)]);
    expect(first.complete).toBe(true);
  });

  it('after a long absence the page since the last message says it may not reach back', async () => {
    await seedChat(150);
    const away = await firstPage(at(9)); // 140 arrived since: only the newest 100 come
    expect(away.ids).toHaveLength(100);
    expect(away.ids[0]).toBe(id(50));
    expect(away.replacesOlder).toBe(true);
  });

  it('a short absence just continues the thread', async () => {
    await seedChat(150);
    const back = await firstPage(at(120));
    expect(back.ids).toEqual(Array.from({ length: 29 }, (_, i) => id(121 + i)));
    expect(back.replacesOlder).toBe(false);
  });
});

describe('the area cell of documents from older builds', () => {
  it('is filled in from the coordinates on creation, and left alone when present or not placeable', async () => {
    const { geo: _none, ...old } = table('old', Date.now() + HOUR);
    const ref = adminDb.doc('hangouts/old');
    await ref.set({ ...old, lat: 49.84, lng: 24.03 });
    expect(await tagFeedCell(ref, (await ref.get()).data())).toBe(true);
    expect((await ref.get()).data()!.geo).toBe(feedCell(49.84, 24.03));
    expect(await tagFeedCell(ref, (await ref.get()).data())).toBe(false);
    expect(await tagFeedCell(adminDb.doc('group_meetups/x'), { title: 'no place' })).toBe(false);
    await ref.delete();
    expect(await tagFeedCell(ref, old)).toBe(false); // closed before the trigger ran
  });

  it('a one-time pass tags the live documents written before the deploy, then costs a single read', async () => {
    const now = Date.now();
    const { geo: _a, ...liveTable } = table('live', now + HOUR);
    const { geo: _b, ...overTable } = table('over', now - HOUR);
    const { geo: _c, ...liveMeetup } = meetupDoc('placed', now + DAY);
    await adminDb.doc('hangouts/live').set(liveTable);
    await adminDb.doc('hangouts/over').set(overTable);
    await adminDb.doc('group_meetups/placed').set({ ...liveMeetup, lat: 50.4, lng: 30.5 });
    await adminDb.doc('group_meetups/unplaced').set({ ...liveMeetup, id: 'unplaced' });

    expect(await backfillFeedCells(adminDb, now)).toEqual({ hangouts: 1, meetups: 1 });
    expect((await adminDb.doc('hangouts/live').get()).data()!.geo).toBe(feedCell(50.4, 30.5));
    expect((await adminDb.doc('hangouts/over').get()).data()!.geo).toBeUndefined();
    expect((await adminDb.doc('group_meetups/placed').get()).data()!.geo).toBe(feedCell(50.4, 30.5));
    expect((await adminDb.doc('group_meetups/unplaced').get()).data()!.geo).toBeUndefined();
    expect(await backfillFeedCells(adminDb, now)).toBeNull();
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

  it('checks bans nearest first across batches and still returns the 50 nearest allowed people', async () => {
    const batch = adminDb.batch();
    for (let i = 0; i < 80; i++) {
      const id = `far-${String(i).padStart(2, '0')}`;
      batch.set(adminDb.doc(`users/${id}`), { id, name: id, age: 30, shareLocation: true, lat: 50.45 + 0.0002 * i, lng: 30.52, geohash: publicGeohash(50.45 + 0.0002 * i, 30.52) });
    }
    for (const id of ['far-05', 'far-31', 'far-47']) batch.set(adminDb.doc(`bannedUsers/${id}`), { reportId: 'test' });
    batch.set(adminDb.doc('users/far-60/blocks/alice'), { userId: 'alice' }); // beyond the cap: changes nothing
    await batch.commit();
    const found = (await discoverPeople(adminDb, 'alice', 50.45, 30.52)).map((p) => p.id);
    const banned = ['far-05', 'far-31', 'far-47'];
    expect(found).toEqual(Array.from({ length: 53 }, (_, i) => `far-${String(i).padStart(2, '0')}`).filter((id) => !banned.includes(id)));
  });
});
