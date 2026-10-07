/**
 * Account deletion end to end on the emulator: the REAL client builds a world (profile, private data, a block,
 * favorites, a device, own table and meetup, a seat at someone else's table, an RSVP to someone else's meetup, a DM and
 * a group with messages), then the REAL server code (functions/src/account.ts + createAccountDeps on the Admin SDK)
 * deletes the account. Everything the privacy policy promises must be gone, and nobody else's data may be touched.
 * This replaces the old client-side deletion, which left blocks, tables, meetups, RSVPs and chat names behind and
 * could not run at all for a Google account (audit render-1 / firestore-1 / firestore-6 / auth-5).   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

const PROJECT = 'demo-budmo-account-deletion';
const current: { db: any } = { db: null };
vi.mock('@/services/firebase', () => ({
  get db() {
    return current.db;
  },
  auth: {},
  firebaseApp: {},
}));
vi.mock('expo-crypto', () => ({ getRandomValues: (buffer: Uint8Array) => { buffer.set(randomBytes(buffer.length)); return buffer; } }));

import { firestoreSyncService as svc } from '@/services/firestoreSyncService';
import { buildMeetup } from '@/logic/meetups';
import { dmChatId, dmMembers } from '@/logic/chats';
import { hangoutExpiresAt } from '@/logic/lifecycle';
import type { HangoutAlert, Message } from '@/types';
import { adminFirestoreFor, createAccountDeps } from '../../functions/src/deps';
import { AccountError, deleteAccount, RECENT_LOGIN_MS } from '../../functions/src/account';

/** The Admin Auth the deletion uses (typed through deps.ts, whose firebase-admin lives in functions/node_modules) */
type Auth = Parameters<typeof createAccountDeps>[1];

let env: RulesTestEnvironment;
let adminDb: ReturnType<typeof adminFirestoreFor>['db'];
let closeAdmin: () => Promise<void>;

const as = (uid: string) => {
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

const table = (id: string, userId: string): HangoutAlert => ({
  id, userId, userName: userId, userAvatar: '', barName: 'Squat 17b', locationArea: 'Поділ', drinkPreference: 'craft', description: '',
  createdAt: 'Щойно', slotsAvailable: 3, participantsCount: 1, joinedUsers: [userId], expiresAt: hangoutExpiresAt(Date.now()),
});
const meetupOf = (creator: string, title: string) =>
  buildMeetup({
    title, description: '', venueName: 'Squat', venueAddress: '', scheduledDate: '01.11.2026', scheduledTime: '19:00',
    dateTimeIso: new Date(Date.now() + 2 * 24 * 3600_000).toISOString(), maxParticipants: 6, creatorId: creator, creatorName: creator, creatorAvatar: '',
  });
const message = (id: string, chatId: string, senderId: string, text: string): Message => ({
  id, chatId, senderId, senderName: senderId === 'alice' ? 'Аліса' : 'Боб', senderAvatar: senderId === 'alice' ? 'https://x.test/alice.png' : undefined,
  text, timestamp: '20:00', isMe: true, type: 'text',
});
const me = (uid: string) => ({ id: uid, name: uid === 'alice' ? 'Аліса' : 'Боб', avatar: uid === 'alice' ? 'https://x.test/alice.png' : '' });

/** Alice's life in the app, written by the real client under the real rules */
async function buildWorld() {
  as('bob');
  await svc.saveUserProfile({ id: 'bob', name: 'Боб', lat: 50.46, lng: 30.52 });
  await svc.publishHangout(table('h_bob', 'bob'));
  const bobMeetup = meetupOf('bob', 'Настілки');
  await svc.saveMeetup(bobMeetup);
  await svc.saveDevice('bob', 'ExponentPushToken[bobbobbobbob1]', 'android', 'uk');

  as('alice');
  await svc.savePrivateProfile('alice', { email: 'alice@example.com', birthDate: '1990-01-01' });
  await svc.saveUserProfile({ id: 'alice', name: 'Аліса', avatar: 'https://x.test/alice.png', lat: 50.46, lng: 30.52 });
  await svc.saveFavoriteVenue('alice', { id: 'v1', name: 'Squat', area: 'Поділ', category: 'craft', lat: 50.4, lng: 30.5 });
  await svc.syncFriend('alice', { friendId: 'bob', friendName: 'Боб' });
  await svc.saveBlock('alice', { userId: 'mallory', userName: 'Mallory', blockedAt: 'now', reason: 'spam' });
  await svc.saveDevice('alice', 'ExponentPushToken[alicealice001]', 'ios', 'uk');
  await svc.publishHangout(table('h_alice', 'alice'));
  await svc.joinLiveHangout('h_bob', 'alice');
  await svc.saveMeetup(meetupOf('alice', 'Квіз'));
  await svc.setMeetupParticipation(bobMeetup.id, 'alice', { userId: 'alice', userName: 'Аліса', userAvatar: 'https://x.test/alice.png', role: 'member', status: 'going' });

  const dm = dmChatId('alice', 'bob');
  const dmChat = { id: dm, isGroup: false, memberIds: dmMembers('alice', 'bob') };
  expect((await svc.sendEncryptedMessage(dmChat, message('a1', dm, 'alice', 'Привіт'), me('alice'))).success).toBe(true);
  as('bob');
  expect((await svc.sendEncryptedMessage(dmChat, message('b1', dm, 'bob', 'Привіт!'), me('bob'))).success).toBe(true);

  const grp = 'grp_bob_1';
  const grpChat = {
    id: grp, isGroup: true, memberIds: ['bob', 'alice'], createdBy: 'bob', groupName: 'Пʼятниця',
    participants: [{ id: 'alice', name: 'Аліса', avatar: 'https://x.test/alice.png' }],
  };
  expect((await svc.sendEncryptedMessage(grpChat, message('g1', grp, 'bob', 'Хто йде?'), me('bob'))).success).toBe(true);
  as('alice');
  expect((await svc.sendEncryptedMessage({ ...grpChat, createdBy: 'bob' }, message('g2', grp, 'alice', 'Я!'), me('alice'))).success).toBe(true);

  return { dm, grp, bobMeetupId: bobMeetup.id };
}

const fakeAuth = () => {
  const deleted: string[] = [];
  return { auth: { deleteUser: async (uid: string) => void deleted.push(uid) } as unknown as Auth, deleted };
};
const nowSec = () => Math.floor(Date.now() / 1000);

describe('deleting an account on the server', () => {
  it('removes everything of the person, everywhere, and nothing of anyone else', async () => {
    const { dm, grp, bobMeetupId } = await buildWorld();
    const { auth, deleted } = fakeAuth();

    const result = await deleteAccount(createAccountDeps(adminDb, auth), 'alice', nowSec(), Date.now());
    expect(result).toEqual({ chats: 2, seatsReleased: 1, meetupsLeft: 1, hangouts: 1, meetups: 1, devices: 1 });
    expect(deleted).toEqual(['alice']);

    // Her own documents: the profile with every subcollection, her table, her meetup, her phone
    expect((await adminDb.doc('users/alice').get()).exists).toBe(false);
    for (const sub of ['private', 'favorites', 'friends', 'blocks']) expect((await adminDb.collection(`users/alice/${sub}`).get()).size).toBe(0);
    expect((await adminDb.doc('hangouts/h_alice').get()).exists).toBe(false);
    expect((await adminDb.collection('group_meetups').where('creatorId', '==', 'alice').get()).size).toBe(0);
    expect((await adminDb.collection('devices').get()).docs.map((d) => d.get('uid'))).toEqual(['bob']);

    // Her traces in other people's documents
    const bobTable = (await adminDb.doc('hangouts/h_bob').get()).data()!;
    expect(bobTable.joinedUsers).toEqual(['bob']);
    expect(bobTable.participantsCount).toBe(1);
    const bobMeetup = (await adminDb.doc(`group_meetups/${bobMeetupId}`).get()).data()!;
    expect(Object.keys(bobMeetup.participants)).toEqual(['bob']);

    const dmDoc = (await adminDb.doc(`chats/${dm}`).get()).data()!;
    expect(Object.keys(dmDoc.profiles ?? {})).not.toContain('alice');
    const grpDoc = (await adminDb.doc(`chats/${grp}`).get()).data()!;
    expect((grpDoc.participants as Array<{ id: string }>).map((p) => p.id)).not.toContain('alice');

    // Her messages stay in the conversations (encrypted), without her name or photo; Bob's are untouched
    const a1 = (await adminDb.doc(`chats/${dm}/messages/a1`).get()).data()!;
    expect(a1).toMatchObject({ senderId: 'alice', senderName: '', senderAvatar: null });
    expect(a1.cipherPayload).toBeTruthy();
    expect((await adminDb.doc(`chats/${grp}/messages/g2`).get()).data()).toMatchObject({ senderName: '', senderAvatar: null });
    expect((await adminDb.doc(`chats/${dm}/messages/b1`).get()).data()).toMatchObject({ senderName: 'Боб' });

    // Bob's own life is intact
    expect((await adminDb.doc('users/bob').get()).get('name')).toBe('Боб');
    expect((await adminDb.doc('hangouts/h_bob').get()).exists).toBe(true);
    expect((await adminDb.doc(`group_meetups/${bobMeetupId}`).get()).exists).toBe(true);
  });

  it('refuses without a fresh sign-in and then touches nothing', async () => {
    await buildWorld();
    const { auth, deleted } = fakeAuth();
    const stale = Math.floor((Date.now() - RECENT_LOGIN_MS - 60_000) / 1000);
    await expect(deleteAccount(createAccountDeps(adminDb, auth), 'alice', stale, Date.now())).rejects.toBeInstanceOf(AccountError);
    expect(deleted).toEqual([]);
    expect((await adminDb.doc('users/alice').get()).exists).toBe(true);
    expect((await adminDb.doc('hangouts/h_bob').get()).get('joinedUsers')).toEqual(['bob', 'alice']);
  });

  it('requires fresh authentication even when no birth date was stored', async () => {
    as('teen');
    // A first Google sign-in: no private profile, nothing published yet (the age gate holds everything back)
    const { auth, deleted } = fakeAuth();
    const hoursAgo = Math.floor((Date.now() - 3 * 3600_000) / 1000);
    await expect(deleteAccount(createAccountDeps(adminDb, auth), 'teen', hoursAgo, Date.now())).rejects.toBeInstanceOf(AccountError);
    expect(deleted).toEqual([]);
    await deleteAccount(createAccountDeps(adminDb, auth), 'teen', nowSec(), Date.now());
    expect(deleted).toEqual(['teen']);
  });

  it('a second run after a completed deletion is harmless (the Auth user is already gone)', async () => {
    await buildWorld();
    const { auth } = fakeAuth();
    const deps = createAccountDeps(adminDb, auth);
    await deleteAccount(deps, 'alice', nowSec(), Date.now());
    const gone = createAccountDeps(adminDb, {
      deleteUser: async () => {
        throw Object.assign(new Error('gone'), { code: 'auth/user-not-found' });
      },
    } as unknown as Auth);
    await expect(deleteAccount(gone, 'alice', nowSec(), Date.now())).resolves.toMatchObject({ chats: 1, hangouts: 0, meetups: 0, devices: 0 }); // group membership was removed in the first run
  });
});
