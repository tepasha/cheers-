/**
 * Security tests for firestore.rules, run against the Firestore emulator:
 *   npm run test:rules        (needs Java 11+ on the machine)
 * They are NOT part of `npm test` because they need the emulator.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { arrayUnion, deleteField, doc, getDoc, getDocs, collection, query, setDoc, updateDoc, where, writeBatch, deleteDoc, increment } from 'firebase/firestore';

let env: RulesTestEnvironment;

const verifiedUser = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
const unverifiedUser = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: false }).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();
const seed = (fn: (db: any) => Promise<void>) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-budmo-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env.cleanup());
beforeEach(async () => env.clearFirestore());

const profile = (uid: string, over: Record<string, unknown> = {}) => ({ id: uid, name: 'Олена', avatar: 'https://x.test/a.png', lat: 50.46, lng: 30.52, age: 27, ...over });

describe('authentication gate', () => {
  it('denies everything to signed-out users', async () => {
    await seed((db) => setDoc(doc(db, 'users/alice'), profile('alice')));
    await assertFails(getDoc(doc(anonymous(), 'users/alice')));
    await assertFails(setDoc(doc(anonymous(), 'users/alice'), profile('alice')));
    await assertFails(getDocs(collection(anonymous(), 'hangouts')));
  });

  it('denies unverified accounts everywhere (reads and writes)', async () => {
    await seed((db) => setDoc(doc(db, 'users/bob'), profile('bob')));
    await assertFails(getDoc(doc(unverifiedUser('alice'), 'users/bob')));
    await assertFails(setDoc(doc(unverifiedUser('alice'), 'users/alice'), profile('alice')));
  });

  it('closes unknown paths and the old connection-probe document', async () => {
    await assertFails(getDoc(doc(verifiedUser('alice'), 'test/connection')));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'anything/else'), { a: 1 }));
  });
});

describe('users', () => {
  it('lets a verified user read other profiles but write only their own', async () => {
    await seed((db) => setDoc(doc(db, 'users/bob'), profile('bob')));
    await assertSucceeds(getDoc(doc(verifiedUser('alice'), 'users/bob')));
    await assertSucceeds(setDoc(doc(verifiedUser('alice'), 'users/alice'), profile('alice')));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'users/bob'), profile('bob', { name: 'Hacked' })));
    // the fields behind "people nearby" and presence
    await assertSucceeds(setDoc(doc(verifiedUser('alice'), 'users/alice'), profile('alice', { geohash: 'u8vxn80js', lastSeenAt: '2026-10-10T12:00:00.000Z' })));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'users/alice'), profile('alice', { geohash: 'x'.repeat(40) })));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'users/alice'), profile('alice', { lastSeenAt: 12345 })));
    await assertFails(updateDoc(doc(verifiedUser('alice'), 'users/bob'), { name: 'Hacked' }));
    await assertFails(deleteDoc(doc(verifiedUser('alice'), 'users/bob')));
  });

  it('rejects profiles that claim another id, carry unknown or oversized fields, or bad values', async () => {
    const db = verifiedUser('alice');
    await assertFails(setDoc(doc(db, 'users/alice'), profile('mallory')));
    await assertFails(setDoc(doc(db, 'users/alice'), profile('alice', { email: 'a@b.co' }))); // email is private-only
    await assertFails(setDoc(doc(db, 'users/alice'), profile('alice', { birthDate: '1990-01-01' })));
    await assertFails(setDoc(doc(db, 'users/alice'), profile('alice', { name: 'x'.repeat(61) })));
    await assertFails(setDoc(doc(db, 'users/alice'), profile('alice', { name: '' })));
    await assertFails(setDoc(doc(db, 'users/alice'), profile('alice', { lat: 123 })));
    await assertFails(setDoc(doc(db, 'users/alice'), profile('alice', { age: 12 })));
    await assertFails(setDoc(doc(db, 'users/alice'), profile('alice', { age: 20 }))); // the minimum is 21
    await assertSucceeds(setDoc(doc(db, 'users/alice'), profile('alice', { age: 21 })));
    await assertFails(setDoc(doc(db, 'users/alice'), profile('alice', { isAdmin: true })));
  });

  it('keeps email, birth date and gamification private to the owner', async () => {
    await seed((db) => setDoc(doc(db, 'users/bob/private/profile'), { email: 'bob@x.co', birthDate: '1990-01-01' }));
    await assertFails(getDoc(doc(verifiedUser('alice'), 'users/bob/private/profile')));
    await assertSucceeds(getDoc(doc(verifiedUser('bob'), 'users/bob/private/profile')));
    await assertSucceeds(setDoc(doc(unverifiedUser('alice'), 'users/alice/private/profile'), { email: 'a@x.co', birthDate: '1998-05-15' }));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'users/alice/private/profile'), { role: 'admin' }));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'users/alice/private/secrets'), { a: 1 }));
    await assertSucceeds(setDoc(doc(verifiedUser('alice'), 'users/alice/private/gamification'), { xp: 10, level: 1, totalMeetups: 0, achievements: [], lastUpdated: 'now' }));
    await assertFails(getDoc(doc(verifiedUser('mallory'), 'users/alice/private/gamification')));
  });

  it('keeps favorites and friends owner-only', async () => {
    const fav = { id: 'v1', userId: 'alice', name: 'Squat', area: 'Київ', category: 'craft', lat: 1, lng: 2, comment: '', createdAt: 'x' };
    await assertSucceeds(setDoc(doc(verifiedUser('alice'), 'users/alice/favorites/v1'), fav));
    await assertFails(getDoc(doc(verifiedUser('bob'), 'users/alice/favorites/v1')));
    await assertFails(setDoc(doc(verifiedUser('bob'), 'users/alice/favorites/v2'), { ...fav, id: 'v2', userId: 'bob' }));
    const friend = { id: 'bob', userId: 'alice', friendId: 'bob', friendName: 'Bob', friendAvatar: '', tagline: '', locationName: '', drinkPreference: '', addedAt: 'x' };
    await assertSucceeds(setDoc(doc(verifiedUser('alice'), 'users/alice/friends/bob'), friend));
    await assertFails(getDocs(collection(verifiedUser('bob'), 'users/alice/friends')));
  });
});

describe('hangouts', () => {
  const hangout = (uid: string, over: Record<string, unknown> = {}) => ({
    id: 'h1', userId: uid, userName: 'Host', userAvatar: '', barName: 'Squat 17b', locationArea: 'Київ', drinkPreference: 'craft',
    description: '', createdAt: 'Щойно', createdAtTimestamp: 1, slotsAvailable: 2, participantsCount: 1, lat: 50.4, lng: 30.5,
    status: 'active', joinedUsers: [uid], expiresAt: Date.now() + 4 * 3600_000, ...over,
  });

  describe('table lifetime (4 hours)', () => {
    const HOUR = 3600_000;

    it('accepts an expiry up to 4 hours ahead and refuses one that is in the past or too far ahead', async () => {
      const db = verifiedUser('alice');
      await assertSucceeds(setDoc(doc(db, 'hangouts/ok'), hangout('alice', { id: 'ok', expiresAt: Date.now() + 4 * HOUR })));
      await assertFails(setDoc(doc(db, 'hangouts/past'), hangout('alice', { id: 'past', expiresAt: Date.now() - 1000 })));
      await assertFails(setDoc(doc(db, 'hangouts/far'), hangout('alice', { id: 'far', expiresAt: Date.now() + 5 * HOUR })));
      await assertFails(setDoc(doc(db, 'hangouts/forever'), hangout('alice', { id: 'forever', expiresAt: Date.now() + 365 * 24 * HOUR })));
    });

    it('requires a numeric expiry', async () => {
      const db = verifiedUser('alice');
      const { expiresAt: _omit, ...without } = hangout('alice', { id: 'none' });
      await assertFails(setDoc(doc(db, 'hangouts/none'), without));
      await assertFails(setDoc(doc(db, 'hangouts/str'), hangout('alice', { id: 'str', expiresAt: 'tomorrow' })));
    });

    it('lets the host renew the table, but only for at most 4 hours from now', async () => {
      await seed((db) => setDoc(doc(db, 'hangouts/h1'), hangout('alice', { expiresAt: Date.now() - HOUR })));
      const alice = verifiedUser('alice');
      await assertFails(updateDoc(doc(alice, 'hangouts/h1'), { expiresAt: Date.now() + 8 * HOUR }));
      await assertFails(updateDoc(doc(alice, 'hangouts/h1'), { expiresAt: Date.now() - 1000 }));
      await assertSucceeds(updateDoc(doc(alice, 'hangouts/h1'), { expiresAt: Date.now() + 4 * HOUR }));
      await assertSucceeds(updateDoc(doc(alice, 'hangouts/h1'), { description: 'Ще є місце' }));
    });

    it("nobody else can renew another person's table", async () => {
      await seed((db) => setDoc(doc(db, 'hangouts/h1'), hangout('alice', { expiresAt: Date.now() - HOUR })));
      await assertFails(updateDoc(doc(verifiedUser('bob'), 'hangouts/h1'), { expiresAt: Date.now() + 4 * HOUR }));
    });

    it('a seat join leaves the expiry untouched and cannot change it', async () => {
      await seed((db) => setDoc(doc(db, 'hangouts/h1'), hangout('alice')));
      const bob = verifiedUser('bob');
      await assertFails(updateDoc(doc(bob, 'hangouts/h1'), { participantsCount: increment(1), joinedUsers: arrayUnion('bob'), expiresAt: Date.now() + 9 * HOUR }));
      await assertSucceeds(updateDoc(doc(bob, 'hangouts/h1'), { participantsCount: increment(1), joinedUsers: arrayUnion('bob') }));
    });
  });

  it('lets verified users create their own hangout only', async () => {
    await assertSucceeds(setDoc(doc(verifiedUser('alice'), 'hangouts/h1'), hangout('alice')));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'hangouts/h2'), hangout('bob', { id: 'h2' })));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'hangouts/h3'), hangout('alice', { id: 'h3', participantsCount: 5 })));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'hangouts/h4'), hangout('alice', { id: 'h4', joinedUsers: ['alice', 'bob'] })));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'hangouts/h5'), hangout('alice', { id: 'h5', barName: '' })));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'hangouts/h6'), hangout('alice', { id: 'h6', slotsAvailable: 99 })));
  });

  it('lets others take a seat exactly once and nothing more', async () => {
    await seed((db) => setDoc(doc(db, 'hangouts/h1'), hangout('alice')));
    const bob = verifiedUser('bob');
    await assertSucceeds(updateDoc(doc(bob, 'hangouts/h1'), { participantsCount: increment(1), joinedUsers: arrayUnion('bob') }));
    // joining again, or with a different counter, is rejected
    await assertFails(updateDoc(doc(bob, 'hangouts/h1'), { participantsCount: increment(1), joinedUsers: arrayUnion('bob') }));
    await assertFails(updateDoc(doc(verifiedUser('carol'), 'hangouts/h1'), { participantsCount: 9, joinedUsers: arrayUnion('carol') }));
    // cannot seat someone else, hijack the hangout, or exceed capacity
    await assertFails(updateDoc(doc(verifiedUser('carol'), 'hangouts/h1'), { participantsCount: increment(1), joinedUsers: arrayUnion('dave') }));
    await assertFails(updateDoc(doc(verifiedUser('carol'), 'hangouts/h1'), { userId: 'carol' }));
    await assertFails(updateDoc(doc(verifiedUser('carol'), 'hangouts/h1'), { barName: 'Hacked' }));
  });

  it('stops joins once the hangout is full', async () => {
    await seed((db) => setDoc(doc(db, 'hangouts/h1'), hangout('alice', { slotsAvailable: 1, participantsCount: 2, joinedUsers: ['alice', 'bob'] })));
    await assertFails(updateDoc(doc(verifiedUser('carol'), 'hangouts/h1'), { participantsCount: increment(1), joinedUsers: arrayUnion('carol') }));
  });

  it('lets only the owner edit or delete', async () => {
    await seed((db) => setDoc(doc(db, 'hangouts/h1'), hangout('alice')));
    await assertSucceeds(updateDoc(doc(verifiedUser('alice'), 'hangouts/h1'), { description: 'Updated' }));
    await assertFails(deleteDoc(doc(verifiedUser('bob'), 'hangouts/h1')));
    await assertSucceeds(deleteDoc(doc(verifiedUser('alice'), 'hangouts/h1')));
  });
});

describe('group meetups', () => {
  const entry = (uid: string, role = 'member', status = 'going') => ({ userId: uid, userName: uid, userAvatar: '', role, status, joinedAt: 'x' });
  const meetup = (creator: string, over: Record<string, unknown> = {}) => ({
    id: 'm1', title: 'Настілки', description: '', venueName: 'Squat', venueAddress: '', scheduledDate: '01.10.2026', scheduledTime: '19:00',
    maxParticipants: 6, participants: { [creator]: entry(creator, 'host') }, creatorId: creator, creatorName: creator, creatorAvatar: '',
    status: 'upcoming', createdAt: 'x', endsAt: Date.now() + 2 * 24 * 3600_000, ...over,
  });

  describe('meetup archive time', () => {
    const DAY = 24 * 3600_000;

    it('requires endsAt and caps how far ahead a meetup can be planned', async () => {
      const db = verifiedUser('alice');
      await assertSucceeds(setDoc(doc(db, 'group_meetups/ok'), meetup('alice', { id: 'ok', endsAt: Date.now() + 30 * DAY })));
      await assertSucceeds(setDoc(doc(db, 'group_meetups/edge'), meetup('alice', { id: 'edge', endsAt: Date.now() + 90 * DAY })));
      await assertFails(setDoc(doc(db, 'group_meetups/far'), meetup('alice', { id: 'far', endsAt: Date.now() + 400 * DAY })));
      await assertFails(setDoc(doc(db, 'group_meetups/never'), meetup('alice', { id: 'never', endsAt: Number.MAX_SAFE_INTEGER })));
      const { endsAt: _omit, ...without } = meetup('alice', { id: 'none' });
      await assertFails(setDoc(doc(db, 'group_meetups/none'), without));
      await assertFails(setDoc(doc(db, 'group_meetups/str'), meetup('alice', { id: 'str', endsAt: 'later' })));
    });

    it('the creator can reschedule within the same bounds, and not beyond them', async () => {
      await seed((db) => setDoc(doc(db, 'group_meetups/m1'), meetup('alice')));
      const alice = verifiedUser('alice');
      await assertSucceeds(setDoc(doc(alice, 'group_meetups/m1'), meetup('alice', { endsAt: Date.now() + 10 * DAY })));
      await assertFails(setDoc(doc(alice, 'group_meetups/m1'), meetup('alice', { endsAt: Date.now() + 500 * DAY })));
    });
  });

  it('creates only as yourself', async () => {
    await assertSucceeds(setDoc(doc(verifiedUser('alice'), 'group_meetups/m1'), meetup('alice')));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'group_meetups/m2'), meetup('bob', { id: 'm2' })));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'group_meetups/m3'), meetup('alice', { id: 'm3', maxParticipants: 500 })));
  });

  it('lets a member change only their own entry', async () => {
    await seed((db) => setDoc(doc(db, 'group_meetups/m1'), meetup('alice', { participants: { alice: entry('alice', 'host'), carol: entry('carol') } })));
    const bob = verifiedUser('bob');
    await assertSucceeds(updateDoc(doc(bob, 'group_meetups/m1'), { 'participants.bob': entry('bob') }));
    await assertSucceeds(updateDoc(doc(bob, 'group_meetups/m1'), { 'participants.bob': deleteField() }));
    // cannot touch someone else's entry, promote self to host, impersonate, or edit the meetup itself
    await assertFails(updateDoc(doc(bob, 'group_meetups/m1'), { 'participants.carol': deleteField() }));
    await assertFails(updateDoc(doc(bob, 'group_meetups/m1'), { 'participants.bob': entry('bob', 'host') }));
    await assertFails(updateDoc(doc(bob, 'group_meetups/m1'), { 'participants.bob': entry('carol') }));
    await assertFails(updateDoc(doc(bob, 'group_meetups/m1'), { title: 'Hacked' }));
    await assertFails(updateDoc(doc(bob, 'group_meetups/m1'), { status: 'cancelled' }));
    await assertFails(deleteDoc(doc(bob, 'group_meetups/m1')));
  });

  it('lets the creator manage everyone and cancel', async () => {
    await seed((db) => setDoc(doc(db, 'group_meetups/m1'), meetup('alice')));
    const alice = verifiedUser('alice');
    await assertSucceeds(updateDoc(doc(alice, 'group_meetups/m1'), { 'participants.dave': entry('dave', 'member', 'invited') }));
    await assertSucceeds(updateDoc(doc(alice, 'group_meetups/m1'), { status: 'cancelled' }));
    await assertFails(updateDoc(doc(alice, 'group_meetups/m1'), { creatorId: 'bob' }));
  });
});

describe('chats and messages', () => {
  const dm = 'dm_alice_bob';
  const dmDoc = (over: Record<string, unknown> = {}) => ({
    members: ['alice', 'bob'], isGroup: false, profiles: { alice: { name: 'Alice', avatar: '' } },
    lastCipherPayload: 'enc:v1:a:b', lastSenderId: 'alice', lastMessageTime: '12:00', updatedAt: 'now', ...over,
  });
  const msg = (uid: string, id = 'm1', over: Record<string, unknown> = {}) => ({
    id, chatId: dm, senderId: uid, senderName: uid, senderAvatar: null, cipherPayload: 'enc:v1:iv:ct', type: 'text',
    proposalData: null, timestamp: '12:00', isEncrypted: true, createdAt: 'now', ...over,
  });
  const send = (db: any, chatId: string, chat: Record<string, unknown>, m: Record<string, unknown>) => {
    const batch = writeBatch(db);
    batch.set(doc(db, `chats/${chatId}/messages/${m.id}`), m);
    batch.set(doc(db, `chats/${chatId}`), chat, { merge: true });
    return batch.commit();
  };

  it('creates a DM and its first message in one batch, with a derived id', async () => {
    await assertSucceeds(send(verifiedUser('alice'), dm, dmDoc(), msg('alice')));
  });

  it('refuses a DM id that does not match its members (id squatting)', async () => {
    await assertFails(send(verifiedUser('mallory'), dm, dmDoc({ members: ['mallory', 'mallory2'], lastSenderId: 'mallory' }), { ...msg('mallory'), chatId: dm }));
    await assertFails(setDoc(doc(verifiedUser('mallory'), 'chats/dm_alice_bob'), dmDoc({ members: ['mallory', 'bob'], lastSenderId: 'mallory' })));
  });

  it('refuses chats the creator is not a member of, 1-person chats and oversized groups', async () => {
    await assertFails(setDoc(doc(verifiedUser('alice'), 'chats/dm_bob_carol'), dmDoc({ members: ['bob', 'carol'] })));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'chats/dm_alice_alice'), dmDoc({ members: ['alice'] })));
    const many = Array.from({ length: 51 }, (_, i) => `u${i}`).concat('alice');
    await assertFails(setDoc(doc(verifiedUser('alice'), 'chats/grp_alice_1'), { members: many, isGroup: true, createdBy: 'alice', lastSenderId: 'alice' }));
  });

  it('lets members read, outsiders not', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `chats/${dm}`), dmDoc());
      await setDoc(doc(db, `chats/${dm}/messages/m1`), msg('alice'));
    });
    await assertSucceeds(getDoc(doc(verifiedUser('bob'), `chats/${dm}`)));
    await assertSucceeds(getDoc(doc(verifiedUser('bob'), `chats/${dm}/messages/m1`)));
    await assertFails(getDoc(doc(verifiedUser('mallory'), `chats/${dm}`)));
    await assertFails(getDoc(doc(verifiedUser('mallory'), `chats/${dm}/messages/m1`)));
    await assertFails(getDocs(collection(verifiedUser('mallory'), `chats/${dm}/messages`)));
  });

  it('shows each user only their own chats in the inbox query', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `chats/${dm}`), dmDoc());
      await setDoc(doc(db, 'chats/dm_carol_dave'), dmDoc({ members: ['carol', 'dave'] }));
    });
    await assertSucceeds(getDocs(query(collection(verifiedUser('alice'), 'chats'), where('members', 'array-contains', 'alice'))));
    await assertFails(getDocs(query(collection(verifiedUser('alice'), 'chats'), where('members', 'array-contains', 'carol'))));
    await assertFails(getDocs(collection(verifiedUser('alice'), 'chats')));
  });

  it('only accepts messages from the sender themselves into chats they belong to', async () => {
    await seed((db) => setDoc(doc(db, `chats/${dm}`), dmDoc()));
    await assertSucceeds(send(verifiedUser('bob'), dm, { lastCipherPayload: 'x', lastSenderId: 'bob', lastMessageTime: '12:01', updatedAt: 'n', profiles: { bob: { name: 'Bob', avatar: '' } } }, msg('bob', 'm2')));
    // impersonation, foreign chat, wrong chatId field, junk fields, empty/oversized payloads
    await assertFails(send(verifiedUser('bob'), dm, { lastCipherPayload: 'x', lastSenderId: 'bob', updatedAt: 'n' }, msg('alice', 'm3')));
    await assertFails(setDoc(doc(verifiedUser('mallory'), `chats/${dm}/messages/m4`), msg('mallory', 'm4')));
    await assertFails(send(verifiedUser('bob'), dm, { lastCipherPayload: 'x', lastSenderId: 'bob', updatedAt: 'n' }, msg('bob', 'm5', { chatId: 'other' })));
    await assertFails(send(verifiedUser('bob'), dm, { lastCipherPayload: 'x', lastSenderId: 'bob', updatedAt: 'n' }, msg('bob', 'm6', { admin: true })));
    await assertFails(send(verifiedUser('bob'), dm, { lastCipherPayload: 'x', lastSenderId: 'bob', updatedAt: 'n' }, msg('bob', 'm7', { cipherPayload: '' })));
    await assertFails(send(verifiedUser('bob'), dm, { lastCipherPayload: 'x', lastSenderId: 'bob', updatedAt: 'n' }, msg('bob', 'm8', { cipherPayload: 'x'.repeat(8001) })));
  });

  it('makes messages immutable', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `chats/${dm}`), dmDoc());
      await setDoc(doc(db, `chats/${dm}/messages/m1`), msg('alice'));
    });
    await assertFails(updateDoc(doc(verifiedUser('alice'), `chats/${dm}/messages/m1`), { cipherPayload: 'enc:v1:new:new' }));
    await assertFails(deleteDoc(doc(verifiedUser('alice'), `chats/${dm}/messages/m1`)));
    await assertFails(deleteDoc(doc(verifiedUser('bob'), `chats/${dm}/messages/m1`)));
  });

  it('forbids changing a DM\'s members, spoofing the last sender, and deleting chats', async () => {
    await seed((db) => setDoc(doc(db, `chats/${dm}`), dmDoc()));
    const bob = verifiedUser('bob');
    await assertFails(updateDoc(doc(bob, `chats/${dm}`), { members: ['alice', 'bob', 'mallory'] }));
    await assertFails(updateDoc(doc(bob, `chats/${dm}`), { lastSenderId: 'carol' }));
    // rewriting the preview text while leaving Alice as its author is also a spoof
    await assertFails(updateDoc(doc(bob, `chats/${dm}`), { lastCipherPayload: 'enc:v1:fake:fake' }));
    await assertSucceeds(updateDoc(doc(bob, `chats/${dm}`), { lastCipherPayload: 'enc:v1:ok:ok', lastSenderId: 'bob' }));
    await assertFails(updateDoc(doc(bob, `chats/${dm}`), { 'profiles.alice': { name: 'Fake', avatar: '' } }));
    await assertSucceeds(updateDoc(doc(bob, `chats/${dm}`), { 'profiles.bob': { name: 'Bob', avatar: '' } }));
    await assertFails(deleteDoc(doc(bob, `chats/${dm}`)));
    await assertFails(deleteDoc(doc(verifiedUser('alice'), `chats/${dm}`)));
    await assertFails(updateDoc(doc(verifiedUser('mallory'), `chats/${dm}`), { updatedAt: 'x' }));
  });

  describe('groups', () => {
    const grp = 'grp_alice_1';
    const grpDoc = (over: Record<string, unknown> = {}) => ({
      members: ['alice', 'bob'], isGroup: true, createdBy: 'alice', groupName: 'Пʼятниця', groupTopic: '', groupAvatar: '🍻',
      participants: [{ id: 'alice', name: 'Alice', avatar: '', role: 'admin' }], lastCipherPayload: 'x', lastSenderId: 'alice', lastMessageTime: '1', updatedAt: 'n', ...over,
    });

    it('lets the creator create the group under their own id prefix only', async () => {
      await assertSucceeds(send(verifiedUser('alice'), grp, grpDoc(), msg('alice', 'g1', { chatId: grp })));
      await assertFails(setDoc(doc(verifiedUser('mallory'), `chats/${grp}`), grpDoc({ members: ['mallory', 'bob'], createdBy: 'mallory', lastSenderId: 'mallory' })));
      await assertFails(setDoc(doc(verifiedUser('alice'), 'chats/grp_alice_2'), grpDoc({ createdBy: 'bob' })));
    });

    it('lets only the creator change membership; members may still post', async () => {
      await seed((db) => setDoc(doc(db, `chats/${grp}`), grpDoc()));
      await assertSucceeds(updateDoc(doc(verifiedUser('alice'), `chats/${grp}`), { members: arrayUnion('carol') }));
      await assertFails(updateDoc(doc(verifiedUser('bob'), `chats/${grp}`), { members: arrayUnion('mallory') }));
      await assertFails(updateDoc(doc(verifiedUser('bob'), `chats/${grp}`), { groupName: 'Hacked' }));
      await assertFails(updateDoc(doc(verifiedUser('bob'), `chats/${grp}`), { createdBy: 'bob' }));
      await assertSucceeds(send(verifiedUser('bob'), grp, { lastCipherPayload: 'y', lastSenderId: 'bob', lastMessageTime: '2', updatedAt: 'n2' }, msg('bob', 'g2', { chatId: grp })));
    });

    it('does not let the creator remove existing members through an update', async () => {
      await seed((db) => setDoc(doc(db, `chats/${grp}`), grpDoc()));
      await assertFails(updateDoc(doc(verifiedUser('alice'), `chats/${grp}`), { members: ['alice'] }));
    });
  });
});

describe('reports', () => {
  const report = (uid: string, over: Record<string, unknown> = {}) => ({
    id: 'r1', reporterId: uid, reporterName: uid, targetId: 'bad', targetType: 'profile', targetName: 'Bad', category: 'spam',
    categoryTitle: 'Spam', comment: 'x', timestamp: '1', createdAt: 1, status: 'pending', ...over,
  });

  it('lets users file reports as themselves but never read them back', async () => {
    await assertSucceeds(setDoc(doc(verifiedUser('alice'), 'reports/r1'), report('alice')));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'reports/r2'), report('bob', { id: 'r2' })));
    await assertFails(setDoc(doc(verifiedUser('alice'), 'reports/r3'), report('alice', { id: 'r3', comment: 'x'.repeat(501) })));
    await assertFails(getDoc(doc(verifiedUser('alice'), 'reports/r1')));
    await assertFails(getDocs(collection(verifiedUser('alice'), 'reports')));
    await assertFails(deleteDoc(doc(verifiedUser('alice'), 'reports/r1')));
    await assertFails(updateDoc(doc(verifiedUser('alice'), 'reports/r1'), { status: 'resolved' }));
  });
});
