/**
 * Push devices: one document per Expo push token. Only a verified user can register a phone for themselves, nobody can
 * read or remove another account's devices, and a phone changing hands moves to the new account.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { deviceIdFor } from '../../src/logic/push';

let env: RulesTestEnvironment;
const user = (uid: string, verified = true) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: verified }).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-budmo-devices',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env.cleanup());
beforeEach(async () => env.clearFirestore());

const TOKEN = 'ExponentPushToken[abcDEF123_-xyz]';
const device = (uid: string, over: Record<string, unknown> = {}) => ({ uid, token: TOKEN, platform: 'ios', language: 'uk', updatedAt: '2026-10-01T10:00:00Z', ...over });
const ref = (db: any, token = TOKEN) => doc(db, `devices/${deviceIdFor(token)}`);

describe('registering a device', () => {
  it('lets a verified user register their own phone', async () => {
    await assertSucceeds(setDoc(ref(user('alice')), device('alice')));
  });

  it('refuses unverified users and signed-out clients', async () => {
    await assertFails(setDoc(ref(user('alice', false)), device('alice')));
    await assertFails(setDoc(ref(env.unauthenticatedContext().firestore()), device('alice')));
  });

  it('refuses registering a device for someone else', async () => {
    await assertFails(setDoc(ref(user('mallory')), device('alice')));
  });

  it('refuses malformed documents', async () => {
    const db = user('alice');
    await assertFails(setDoc(ref(db), device('alice', { token: 'not-a-token' })));
    await assertFails(setDoc(ref(db), device('alice', { platform: 'web' })));
    await assertFails(setDoc(ref(db), device('alice', { language: 'fr' })));
    await assertFails(setDoc(ref(db), device('alice', { extra: 1 })));
    await assertFails(setDoc(ref(db), { uid: 'alice', token: TOKEN, platform: 'ios', language: 'uk' }));
  });

  it('refuses a document id that is not derived from its token', async () => {
    await assertFails(setDoc(doc(user('alice'), 'devices/anything'), device('alice')));
  });
});

describe('reading and removing devices', () => {
  beforeEach(async () => {
    await setDoc(ref(user('alice')), device('alice'));
  });

  it('shows a device only to its owner', async () => {
    await assertSucceeds(getDoc(ref(user('alice'))));
    await assertFails(getDoc(ref(user('bob'))));
  });

  it('lets an owner list their own devices, never a stranger\'s or everyone\'s', async () => {
    await assertSucceeds(getDocs(query(collection(user('alice'), 'devices'), where('uid', '==', 'alice'))));
    await assertFails(getDocs(query(collection(user('bob'), 'devices'), where('uid', '==', 'alice'))));
    await assertFails(getDocs(collection(user('bob'), 'devices')));
  });

  it('lets only the owner delete', async () => {
    await assertFails(deleteDoc(ref(user('bob'))));
    await assertSucceeds(deleteDoc(ref(user('alice'))));
  });
});

describe('a phone changing hands', () => {
  it('moves to the account that signs in on it, and the previous owner loses it', async () => {
    await setDoc(ref(user('alice')), device('alice'));
    await assertSucceeds(setDoc(ref(user('bob')), device('bob')));
    await assertFails(getDoc(ref(user('alice'))));
    await assertSucceeds(getDoc(ref(user('bob'))));
  });
});
