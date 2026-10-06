/**
 * Meetup proposals. Messages are immutable, so an answer is its own message `resp_<proposalId>`; the rules
 * decide who may send it and make "answered once" a database fact.  npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';

let env: RulesTestEnvironment;
const user = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
const seed = (fn: (db: any) => Promise<void>) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-budmo-proposals',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env.cleanup());

const dm = 'dm_alice_bob';
const base = (uid: string, id: string, over: Record<string, unknown> = {}) => ({
  id, chatId: dm, senderId: uid, senderName: uid, senderAvatar: null, cipherPayload: 'enc:v1:iv:ct', type: 'text', proposalData: null, timestamp: '1', isEncrypted: true, createdAt: serverTimestamp(), ...over,
});
const proposal = (uid: string, id = 'p1') =>
  base(uid, id, { type: 'location_proposal', proposalCipher: 'enc:v1:iv:details' });
const answer = (uid: string, over: Record<string, unknown> = {}, id = 'resp_p1') =>
  base(uid, id, { type: 'proposal_response', proposalId: 'p1', proposalStatus: 'accepted', ...over });
const preview = (uid: string) => ({ lastCipherPayload: 'x', lastSenderId: uid, lastMessageTime: '2', updatedAt: 'n2' });
const send = (db: any, m: Record<string, any>) => {
  const batch = writeBatch(db);
  batch.set(doc(db, `chats/${dm}/messages/${m.id}`), m);
  batch.set(doc(db, `chats/${dm}`), preview(m.senderId), { merge: true });
  return batch.commit();
};

beforeEach(async () => {
  await env.clearFirestore();
  // Alice proposed a meetup to Bob
  await seed(async (db) => {
    await setDoc(doc(db, `chats/${dm}`), {
      members: ['alice', 'bob'], isGroup: false, profiles: { alice: { name: 'Alice', avatar: '' } }, lastCipherPayload: 'x', lastSenderId: 'alice', lastMessageTime: '1', updatedAt: 'n',
    });
    await setDoc(doc(db, `chats/${dm}/messages/p1`), proposal('alice'));
    await setDoc(doc(db, `chats/${dm}/messages/t1`), base('alice', 't1'));
  });
});

describe('answering a proposal', () => {
  it('lets the person who received it accept or decline', async () => {
    await assertSucceeds(send(user('bob'), answer('bob')));
  });

  it('accepts a decline as well', async () => {
    await assertSucceeds(send(user('bob'), answer('bob', { proposalStatus: 'declined' })));
  });

  it('refuses the proposer answering their own proposal', async () => {
    await assertFails(send(user('alice'), answer('alice')));
  });

  it('allows exactly one answer: a second one, or a changed mind, hits the existing document', async () => {
    await assertSucceeds(send(user('bob'), answer('bob')));
    await assertFails(send(user('bob'), answer('bob', { proposalStatus: 'declined' })));
    await assertFails(send(user('bob'), answer('bob')));
  });

  it('forces the answer id to be derived from the proposal, so it cannot be duplicated under another id', async () => {
    await assertFails(send(user('bob'), answer('bob', {}, 'resp_other')));
    await assertFails(send(user('bob'), answer('bob', {}, 'msg-123')));
  });

  it('refuses invalid statuses and answers that point at nothing or at an ordinary message', async () => {
    await assertFails(send(user('bob'), answer('bob', { proposalStatus: 'maybe' })));
    await assertFails(send(user('bob'), answer('bob', { proposalStatus: null })));
    await assertFails(send(user('bob'), answer('bob', { proposalId: 'ghost' }, 'resp_ghost')));
    await assertFails(send(user('bob'), answer('bob', { proposalId: 't1' }, 'resp_t1'))); // t1 is a plain text message
    await assertFails(send(user('bob'), base('bob', 'resp_p1', { type: 'proposal_response', proposalStatus: 'accepted' }))); // no proposalId at all
  });

  it('keeps outsiders out and refuses impersonation', async () => {
    await assertFails(send(user('mallory'), answer('mallory')));
    await assertFails(send(user('mallory'), answer('bob'))); // senderId must be the caller
  });

  it('does not let ordinary messages smuggle answer fields', async () => {
    await assertFails(send(user('bob'), base('bob', 'm9', { proposalId: 'p1', proposalStatus: 'accepted' })));
    await assertFails(send(user('bob'), base('bob', 'm10', { type: 'location_proposal', proposalId: 'p1', proposalStatus: 'accepted' })));
  });

  it('keeps messages immutable: the proposal itself can never be edited to "accepted"', async () => {
    await assertFails(setDoc(doc(user('bob'), `chats/${dm}/messages/p1`), proposal('alice')));
    await assertFails(setDoc(doc(user('alice'), `chats/${dm}/messages/p1`), { ...proposal('alice'), proposalCipher: 'enc:v1:iv:other' }));
    await assertFails(setDoc(doc(user('alice'), `chats/${dm}/messages/p1`), { ...proposal('alice'), proposalData: { barName: 'Squat', address: 'Київ', time: '20:00', status: 'accepted' } }));
  });
});

describe('proposal details are ciphertext', () => {
  const plainProposal = (uid: string, id: string) =>
    base(uid, id, { type: 'location_proposal', proposalData: { barName: 'Squat', address: 'Київ', time: '20:00', status: 'pending' } });

  it('refuses plaintext venue/address/time, and a proposal without its cipher', async () => {
    await assertFails(send(user('bob'), plainProposal('bob', 'p2')));
    await assertFails(send(user('bob'), base('bob', 'p3', { type: 'location_proposal' })));
    await assertFails(send(user('bob'), base('bob', 'p4', { type: 'location_proposal', proposalCipher: 12345 })));
    await assertFails(send(user('bob'), base('bob', 'p5', { type: 'location_proposal', proposalCipher: 'x'.repeat(4001) })));
  });

  it('accepts a proposal that carries only the cipher, and keeps the cipher off other message types', async () => {
    await assertSucceeds(send(user('bob'), proposal('bob', 'p6')));
    await assertFails(send(user('bob'), base('bob', 't7', { type: 'text', proposalCipher: 'enc:v1:iv:details' })));
  });
});
