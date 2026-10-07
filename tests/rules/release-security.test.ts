import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { attachBudget } from './helpers/writeBudget';

let env: RulesTestEnvironment;
const user = (uid = 'alice', age = true) => env.authenticatedContext(uid, { email_verified: true, age_21: age }).firestore();
const chatId = 'dm_alice_bob';
const message = (id: string) => ({ id, chatId, senderId: 'alice', senderName: 'Alice', cipherPayload: 'enc:v1:payload', type: 'text', timestamp: '12:00', createdAt: serverTimestamp() });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-budmo-release-security', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `chats/${chatId}`), { members: ['alice', 'bob'], isGroup: false, profiles: { alice: { name: 'Alice', avatar: '' } }, lastCipherPayload: '', lastSenderId: 'alice', lastMessageTime: '', updatedAt: '' });
  });
});

const send = async (id: string, debit = true) => {
  const db = user(); const batch = writeBatch(db); const m = message(id);
  if (debit) await attachBudget(db, batch, 'alice', 'message', `${chatId}/${id}`);
  batch.set(doc(db, `chats/${chatId}/messages/${id}`), m);
  batch.update(doc(db, `chats/${chatId}`), { lastMessageId: id, lastCipherPayload: m.cipherPayload, lastSenderId: 'alice', lastMessageTime: m.timestamp, updatedAt: 'now' });
  return batch.commit();
};

describe('release security regressions', () => {
  it('denies a banned account even while it holds a previously issued eligible token', async () => {
    const db = user();
    await assertSucceeds(getDoc(doc(db, `chats/${chatId}`)));
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'bannedUsers/alice'), { reason: 'moderation' }));
    await assertFails(getDoc(doc(db, `chats/${chatId}`)));
    await assertFails(send('after-ban'));
    await assertFails(updateDoc(doc(db, 'bannedUsers/alice'), { reason: '' }));
  });
  it('requires server eligibility even with a verified email', async () => {
    await assertFails(getDoc(doc(user('alice', false), `chats/${chatId}`)));
    await assertSucceeds(getDoc(doc(user(), `chats/${chatId}`)));
  });

  it('cannot forge a preview or reuse an old message as a new preview', async () => {
    await assertSucceeds(send('m1'));
    await assertFails(updateDoc(doc(user(), `chats/${chatId}`), { lastCipherPayload: 'forged' }));
    await assertFails(updateDoc(doc(user(), `chats/${chatId}`), { lastMessageTime: 'forged' }));
    await assertSucceeds(send('m2'));
    await assertFails(updateDoc(doc(user(), `chats/${chatId}`), { lastMessageId: 'm1', lastCipherPayload: message('m1').cipherPayload }));
  });

  it('requires an atomic quota debit, and rolls back a rejected message', async () => {
    await assertFails(send('missing-budget', false));
    await assertSucceeds(send('m1'));
    expect((await getDoc(doc(user(), 'writeQuotas/alice_message'))).get('count')).toBe(1);
    await assertFails(send('m1'));
    expect((await getDoc(doc(user(), 'writeQuotas/alice_message'))).get('count')).toBe(1);
  });

  it('enforces a daily cap that the owner cannot reset or bypass with another resource', async () => {
    const now = Timestamp.now();
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'writeQuotas/alice_message'), { uid: 'alice', operation: 'message', count: 2000, windowStartedAt: now, lastAt: now, resourceId: 'previous' }));
    await assertFails(send('over-limit'));
    await assertFails(setDoc(doc(user(), 'writeQuotas/alice_message'), { uid: 'alice', operation: 'message', count: 1, windowStartedAt: serverTimestamp(), lastAt: serverTimestamp(), resourceId: `${chatId}/over-limit` }));
    const db = user(); const batch = writeBatch(db);
    batch.set(doc(db, 'writeQuotas/alice_hangout'), { uid: 'alice', operation: 'hangout', count: 1, windowStartedAt: serverTimestamp(), lastAt: serverTimestamp(), resourceId: 'wrong-type' });
    batch.set(doc(db, `chats/${chatId}/messages/wrong-type`), message('wrong-type'));
    await assertFails(batch.commit());
  });

  it('allows the daily window to roll over only after 24 hours', async () => {
    const old = Timestamp.fromMillis(Date.now() - 86400001);
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'writeQuotas/alice_message'), { uid: 'alice', operation: 'message', count: 2000, windowStartedAt: old, lastAt: old, resourceId: 'previous' }));
    const db = user(); const batch = writeBatch(db); const m = message('next-day');
    batch.set(doc(db, 'writeQuotas/alice_message'), { uid: 'alice', operation: 'message', count: 1, windowStartedAt: serverTimestamp(), lastAt: serverTimestamp(), resourceId: `${chatId}/next-day` });
    batch.set(doc(db, `chats/${chatId}/messages/next-day`), m);
    batch.update(doc(db, `chats/${chatId}`), { lastMessageId: m.id, lastCipherPayload: m.cipherPayload, lastSenderId: 'alice', lastMessageTime: m.timestamp });
    await assertSucceeds(batch.commit());
  });

  it('filters explicit threats in shared profiles before publication', async () => {
    const ref = doc(user(), 'users/alice');
    await assertFails(setDoc(ref, { id: 'alice', name: 'Alice', bio: 'I WILL KILL YOU' }));
    await assertSucceeds(setDoc(ref, { id: 'alice', name: 'Alice', bio: 'Looking for company' }));
  });
});
