import { attachBudget } from './helpers/writeBudget';
/**
 * Server-side blocking. If Bob blocked Alice (document users/bob/blocks/alice), the rules must stop Alice from
 * reaching Bob, and must never reveal the block to her.  npm run test:rules  (needs the Firestore emulator)
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, increment, setDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';

let env: RulesTestEnvironment;
const user = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true, age_21: true }).firestore();
const seed = (fn: (db: any) => Promise<void>) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-budmo-blocking',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env.cleanup());
beforeEach(async () => env.clearFirestore());

// Bob has blocked Alice
const blockAliceByBob = () => seed((db) => setDoc(doc(db, 'users/bob/blocks/alice'), { userId: 'alice', userName: 'Alice', blockedAt: '12:00' }));

const dm = 'dm_alice_bob';
const dmChat = (members: string[], sender: string) => ({
  members, isGroup: false, profiles: { [sender]: { name: sender, avatar: '' } }, lastCipherPayload: '', lastSenderId: sender, lastMessageTime: '1', updatedAt: 'n',
});
const msg = (uid: string, chatId: string, id = 'm1') => ({
  id, chatId, senderId: uid, senderName: uid, senderAvatar: null, cipherPayload: 'enc:v1:iv:ct', type: 'text', proposalData: null, timestamp: '1', isEncrypted: true, createdAt: serverTimestamp(),
});
const send = async (db: any, chatId: string, chat: Record<string, unknown>, m: Record<string, unknown>) => {
  const batch = writeBatch(db);
  await attachBudget(db, batch, String(m.senderId), 'message', `${chatId}/${m.id}`);
  batch.set(doc(db, `chats/${chatId}/messages/${m.id}`), m);
  batch.set(doc(db, `chats/${chatId}`), { ...chat, lastMessageId: m.id, lastCipherPayload: m.cipherPayload, lastMessageTime: m.timestamp }, { merge: true });
  return batch.commit();
};
const preview = (uid: string) => ({ lastCipherPayload: 'x', lastSenderId: uid, lastMessageTime: '2', updatedAt: 'n2' });
const profile = (uid: string) => ({ id: uid, name: uid, avatar: 'https://x.test/a.png', lat: 50.46, lng: 30.52, age: 27 });

describe('the block list', () => {
  it('is private to its owner: the blocked person cannot read, learn about, or remove a block', async () => {
    await blockAliceByBob();
    await assertSucceeds(getDoc(doc(user('bob'), 'users/bob/blocks/alice')));
    await assertFails(getDoc(doc(user('alice'), 'users/bob/blocks/alice')));
    await assertFails(getDocs(collection(user('alice'), 'users/bob/blocks')));
    await assertFails(deleteDoc(doc(user('alice'), 'users/bob/blocks/alice')));
    await assertFails(setDoc(doc(user('alice'), 'users/bob/blocks/carol'), { userId: 'carol', blockedAt: 'x' }));
  });

  it('only accepts well-formed entries, never a self-block', async () => {
    const bob = user('bob');
    await assertSucceeds(setDoc(doc(bob, 'users/bob/blocks/carol'), { userId: 'carol', userName: 'Carol', blockedAt: 'x', autoBlocked: false }));
    await assertFails(setDoc(doc(bob, 'users/bob/blocks/bob'), { userId: 'bob', blockedAt: 'x' }));
    await assertFails(setDoc(doc(bob, 'users/bob/blocks/dave'), { userId: 'someone-else', blockedAt: 'x' }));
    await assertFails(setDoc(doc(bob, 'users/bob/blocks/dave'), { userId: 'dave', blockedAt: 'x', note: 'junk' }));
  });
});

describe('profile', () => {
  it('cannot be fetched by id by the blocked user, but can by everyone else and by the owner', async () => {
    await seed((db) => setDoc(doc(db, 'users/bob'), profile('bob')));
    await blockAliceByBob();
    await assertFails(getDoc(doc(user('alice'), 'users/bob')));
    await assertFails(getDoc(doc(user('carol'), 'users/bob')));
    await assertSucceeds(getDoc(doc(user('bob'), 'users/bob')));
  });

  it('documents the limit: rules cannot filter list queries, so discovery lists still include it', async () => {
    await seed((db) => setDoc(doc(db, 'users/bob'), profile('bob')));
    await blockAliceByBob();
    await assertFails(getDocs(collection(user('alice'), 'users')));
  });
});

describe('direct chats', () => {
  it('the blocked user cannot start a chat with the blocker; the blocker can start one', async () => {
    await blockAliceByBob();
    await assertFails(send(user('alice'), dm, dmChat(['alice', 'bob'], 'alice'), msg('alice', dm)));
    await assertSucceeds(send(user('bob'), dm, dmChat(['alice', 'bob'], 'bob'), msg('bob', dm)));
  });

  it('the blocked user cannot message into an existing chat, history stays readable, unblocking restores it', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `chats/${dm}`), dmChat(['alice', 'bob'], 'alice'));
      await setDoc(doc(db, `chats/${dm}/messages/m0`), msg('alice', dm, 'm0'));
    });

    await assertSucceeds(send(user('alice'), dm, preview('alice'), msg('alice', dm, 'm1'))); // before the block
    await blockAliceByBob();
    await assertFails(send(user('alice'), dm, preview('alice'), msg('alice', dm, 'm2')));
    await assertSucceeds(send(user('bob'), dm, preview('bob'), msg('bob', dm, 'm3')));
    await assertSucceeds(getDoc(doc(user('alice'), `chats/${dm}/messages/m0`)));

    await assertSucceeds(deleteDoc(doc(user('bob'), 'users/bob/blocks/alice')));
    await assertSucceeds(send(user('alice'), dm, preview('alice'), msg('alice', dm, 'm4')));
  });

  it('does not affect other people talking to the blocker', async () => {
    await blockAliceByBob();
    await assertSucceeds(send(user('carol'), 'dm_bob_carol', dmChat(['bob', 'carol'], 'carol'), msg('carol', 'dm_bob_carol')));
  });
});

describe('tables and meetups', () => {
  it('the blocked user cannot take a seat at the blocker\'s table', async () => {
    await seed((db) =>
      setDoc(doc(db, 'hangouts/h1'), {
        id: 'h1', userId: 'bob', userName: 'Bob', userAvatar: '', barName: 'Squat', locationArea: '', drinkPreference: '', description: '', createdAt: 'x',
        slotsAvailable: 3, participantsCount: 1, status: 'active', joinedUsers: ['bob'], expiresAt: Date.now() + 3600000,
      })
    );
    await blockAliceByBob();
    await assertFails(updateDoc(doc(user('alice'), 'hangouts/h1'), { participantsCount: increment(1), joinedUsers: arrayUnion('alice') }));
    await assertSucceeds(updateDoc(doc(user('carol'), 'hangouts/h1'), { participantsCount: increment(1), joinedUsers: arrayUnion('carol') }));
  });

  it('the blocked user cannot join the blocker\'s meetup', async () => {
    const entry = (uid: string, role = 'member') => ({ userId: uid, userName: uid, userAvatar: '', role, status: 'going', joinedAt: 'x' });
    await seed((db) =>
      setDoc(doc(db, 'group_meetups/m1'), {
        id: 'm1', title: 'Настілки', maxParticipants: 6, participants: { bob: entry('bob', 'host') }, creatorId: 'bob', creatorName: 'Bob', creatorAvatar: '', status: 'upcoming', endsAt: Date.now() + 86400000,
      })
    );
    await blockAliceByBob();
    await assertFails(updateDoc(doc(user('alice'), 'group_meetups/m1'), { 'participants.alice': entry('alice') }));
    await assertSucceeds(updateDoc(doc(user('carol'), 'group_meetups/m1'), { 'participants.carol': entry('carol') }));
  });
});

describe('group chats', () => {
  const grp = (creator: string, members: string[], id: string) => ({
    id,
    doc: { members, isGroup: true, createdBy: creator, groupName: 'G', groupTopic: '', groupAvatar: '', participants: [], lastCipherPayload: '', lastSenderId: creator, lastMessageTime: '1', updatedAt: 'n' },
  });

  it('refuses a blocked recipient and ten members, and accepts nine with all rule checks', async () => {
    await blockAliceByBob();
    const withBob = grp('alice', ['alice', 'carol', 'bob'], 'grp_alice_1');
    await assertFails(send(user('alice'), withBob.id, withBob.doc, msg('alice', withBob.id, 'g1')));

    const ok = grp('alice', ['alice', 'carol', 'dave'], 'grp_alice_2');
    await assertSucceeds(send(user('alice'), ok.id, ok.doc, msg('alice', ok.id, 'g2')));

    const eleven = grp('alice', ['alice', ...Array.from({ length: 10 }, (_, i) => `u${i}`)], 'grp_alice_3');
    await assertFails(send(user('alice'), eleven.id, eleven.doc, msg('alice', eleven.id, 'g3')));
    const ten = grp('alice', ['alice', ...Array.from({ length: 9 }, (_, i) => `u${i}`)], 'grp_alice_4');
    await assertFails(send(user('alice'), ten.id, ten.doc, msg('alice', ten.id, 'g4')));
    const nine = grp('alice', ['alice', ...Array.from({ length: 8 }, (_, i) => `u${i}`)], 'grp_alice_5');
    await assertSucceeds(send(user('alice'), nine.id, nine.doc, msg('alice', nine.id, 'g5')));
  });

  it('lets the creator add members one at a time, never someone who blocked them', async () => {
    const g = grp('alice', ['alice', 'carol'], 'grp_alice_9');
    await seed((db) => setDoc(doc(db, `chats/${g.id}`), g.doc));
    await blockAliceByBob();
    const alice = user('alice');
    await assertFails(updateDoc(doc(alice, `chats/${g.id}`), { members: arrayUnion('bob') }));
    await assertFails(updateDoc(doc(alice, `chats/${g.id}`), { members: arrayUnion('dave', 'erin') })); // two at once
    await assertSucceeds(updateDoc(doc(alice, `chats/${g.id}`), { members: arrayUnion('dave') }));
    await assertSucceeds(updateDoc(doc(alice, `chats/${g.id}`), { members: arrayUnion('erin') }));
  });
});
