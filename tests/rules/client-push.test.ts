import location from '@/store/slices/locationSlice';
import outbox from '@/store/slices/outboxSlice';
/**
 * Contract for push notifications, end to end on the emulator with the REAL rules:
 *   real client (registerPush thunk, firestoreSyncService)  →  devices/ documents  →  the Cloud Function core
 *   (notifyChatMessage + createDeps on the Admin SDK)  →  the payload that would go to Expo.
 * Only Expo itself is replaced by a recorder.   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

const PROJECT = 'demo-budmo-client-push';
const current: { db: any } = { db: null };
vi.mock('@/services/firebase', () => ({
  get db() {
    return current.db;
  },
  auth: {},
  firebaseApp: {},
}));
vi.mock('expo-crypto', () => ({ getRandomValues: (buffer: Uint8Array) => { buffer.set(randomBytes(buffer.length)); return buffer; } }));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
vi.mock('@/services/systemNotifications', () => ({ registerForPush: vi.fn(), stopSystemPush: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/services/authService', () => ({ authService: { logout: vi.fn().mockResolvedValue(undefined) } }));

import { firestoreSyncService as svc } from '@/services/firestoreSyncService';
import { registerForPush } from '@/services/systemNotifications';
import { registerPush, releaseDevice } from '@/store/thunks/push';
import { blockUser } from '@/store/thunks/safety';
import { dmChatId } from '@/logic/chats';
import { deviceIdFor } from '@/logic/push';
import auth, { loggedIn } from '@/store/slices/authSlice';
import safety from '@/store/slices/safetySlice';
import notifications from '@/store/slices/notificationsSlice';
import settings, { languageChosen } from '@/store/slices/settingsSlice';
import ui from '@/store/slices/uiSlice';
import { createUser } from '@/logic/session';
import { adminFirestoreFor, createAccountDeps, createDeps } from '../../functions/src/deps';
import { deleteAccount } from '../../functions/src/account';
import { notifyChatMessage, type ExpoMessage, type ExpoTicket } from '../../functions/src/push';
import type { Message } from '@/types';

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
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const storeFor = (uid: string, language: 'uk' | 'en' | 'pl' | 'de' = 'uk') => {
  const store = configureStore({ reducer: combineReducers({ location, outbox, auth, safety, notifications, settings, ui }) });
  store.dispatch(loggedIn(createUser({ id: uid, email: `${uid}@example.com`, emailVerified: true, birthDate: '1990-01-01' })));
  store.dispatch(languageChosen(language));
  return store;
};
const run = <R,>(store: ReturnType<typeof storeFor>, thunk: unknown) => (store.dispatch as unknown as (t: unknown) => R)(thunk);

const tokenOf = (n: string) => `ExponentPushToken[${n.padEnd(12, 'x')}]`;
const phone = (token: string, platform: 'ios' | 'android' = 'ios') =>
  vi.mocked(registerForPush).mockResolvedValue({ status: 'registered', token, platform });

/** Registers a phone for `uid` the way the app does */
const registerPhone = async (uid: string, token: string, language: 'uk' | 'en' | 'pl' | 'de' = 'uk') => {
  as(uid);
  phone(token);
  expect(await run(storeFor(uid, language), registerPush({ ask: true }))).toBe('registered');
};

const chat = { id: dmChatId('alice', 'bob'), isGroup: false, memberIds: ['alice', 'bob'] };
const message = (id: string, senderId: string, text: string): Message => ({ id, chatId: chat.id, senderId, senderName: senderId, text, timestamp: '12:00', isMe: true, type: 'text' });

/** Alice writes to Bob through the real client, then the function core handles the message document it created */
const aliceWrites = async (text = 'Дуже особистий текст') => {
  as('alice');
  const sent = await svc.sendEncryptedMessage(chat, message('m1', 'alice', text), { id: 'alice', name: 'Alice' });
  expect(sent.success).toBe(true);
  const stored = (await adminDb.doc(`chats/${chat.id}/messages/m1`).get()).data()!;

  const sentToExpo: ExpoMessage[] = [];
  const result = await notifyChatMessage(
    createDeps(adminDb, undefined, async (messages): Promise<ExpoTicket[]> => {
      sentToExpo.push(...messages);
      return messages.map(() => ({ status: 'ok' }));
    }),
    chat.id,
    { id: 'm1', senderId: stored.senderId, senderName: stored.senderName, type: stored.type }
  );
  return { sentToExpo, result };
};

describe('registering a phone through the real client', () => {
  it('writes a device document the rules accept, keyed by the token', async () => {
    const token = tokenOf('bobphone');
    await registerPhone('bob', token, 'pl');
    const stored = (await adminDb.doc(`devices/${deviceIdFor(token)}`).get()).data();
    expect(stored).toMatchObject({ uid: 'bob', token, platform: 'ios', language: 'pl' });
  });

  it('registering again (language change, app update) updates the same document', async () => {
    const token = tokenOf('bobphone');
    await registerPhone('bob', token, 'uk');
    await registerPhone('bob', token, 'de');
    const all = await adminDb.collection('devices').get();
    expect(all.size).toBe(1);
    expect(all.docs[0].data().language).toBe('de');
  });

  it('a phone that changes hands moves to the new account', async () => {
    const token = tokenOf('sharedphone');
    await registerPhone('bob', token);
    await registerPhone('carol', token);
    expect((await adminDb.doc(`devices/${deviceIdFor(token)}`).get()).data()?.uid).toBe('carol');
  });

  it('releasing removes the device while the user is still signed in', async () => {
    const token = tokenOf('bobphone');
    as('bob');
    phone(token);
    const store = storeFor('bob');
    await run(store, registerPush({ ask: true }));
    await run<Promise<void>>(store, releaseDevice());
    expect((await adminDb.doc(`devices/${deviceIdFor(token)}`).get()).exists).toBe(false);
  });

  it('account deletion removes every device of the account, and only those', async () => {
    await registerPhone('bob', tokenOf('bobphone1'));
    await registerPhone('bob', tokenOf('bobphone2'));
    await registerPhone('carol', tokenOf('carolphone'));
    const noAuth = { deleteUser: async () => {} } as never;
    await deleteAccount(createAccountDeps(adminDb, noAuth), 'bob', Math.floor(Date.now() / 1000), Date.now());
    const left = await adminDb.collection('devices').get();
    expect(left.docs.map((d) => d.data().uid)).toEqual(['carol']);
  });
});

describe('from a message to a push', () => {
  it('notifies the other member on their own phone, in their language, without the message text', async () => {
    await registerPhone('bob', tokenOf('bobphone'), 'en');
    await registerPhone('alice', tokenOf('alicephone'), 'uk'); // the sender's own phone must stay quiet

    const { sentToExpo, result } = await aliceWrites('Дуже особистий текст');
    expect(result.sent).toBe(1);
    expect(sentToExpo).toHaveLength(1);
    expect(sentToExpo[0]).toMatchObject({
      to: tokenOf('bobphone'),
      title: 'Budmo',
      body: 'New message',
      data: { type: 'chat_message', chatId: chat.id },
    });
    expect(JSON.stringify(sentToExpo)).not.toContain('особистий');
  });

  it('does not notify someone who blocked the sender (block written by the real client)', async () => {
    await registerPhone('bob', tokenOf('bobphone'));
    as('bob');
    run(storeFor('bob'), blockUser('alice', 'Alice'));
    await vi.waitFor(async () => expect((await adminDb.doc('users/bob/blocks/alice').get()).exists).toBe(true));

    // Bob blocked Alice, so the rules refuse her write; the function must refuse to notify regardless
    const sentToExpo: ExpoMessage[] = [];
    const result = await notifyChatMessage(
      createDeps(adminDb, undefined, async (m) => (sentToExpo.push(...m), m.map(() => ({ status: 'ok' as const })))),
      chat.id,
      { id: 'forged', senderId: 'alice', senderName: 'Alice', type: 'text' }
    );
    // No chat document exists (her write was blocked), so nothing is sent either way
    expect(result.sent).toBe(0);
    expect(sentToExpo).toHaveLength(0);

    // The chat exists (Bob wrote first), Alice is a member, Bob still blocked her: skipped by the block check itself
    as('bob');
    expect((await svc.sendEncryptedMessage(chat, message('b1', 'bob', 'hi'), { id: 'bob', name: 'Bob' })).success).toBe(true);
    const again = await notifyChatMessage(
      createDeps(adminDb, undefined, async (m) => (sentToExpo.push(...m), m.map(() => ({ status: 'ok' as const })))),
      chat.id,
      { id: 'forged2', senderId: 'alice', senderName: 'Alice', type: 'text' }
    );
    expect(again.skippedBlocked).toBe(1);
    expect(sentToExpo).toHaveLength(0);
  });

  it('removes a device Expo reports as unregistered', async () => {
    const token = tokenOf('deadphone');
    await registerPhone('bob', token);
    as('alice');
    await svc.sendEncryptedMessage(chat, message('m1', 'alice', 'x'), { id: 'alice', name: 'Alice' });

    const result = await notifyChatMessage(
      createDeps(adminDb, undefined, async (m) => m.map(() => ({ status: 'error' as const, details: { error: 'DeviceNotRegistered' } }))),
      chat.id,
      { id: 'm1', senderId: 'alice', senderName: 'Alice', type: 'text' }
    );
    expect(result.removedDevices).toBe(1);
    expect((await adminDb.doc(`devices/${deviceIdFor(token)}`).get()).exists).toBe(false);
  });

  it('people outside the chat get nothing', async () => {
    await registerPhone('mallory', tokenOf('mallophone'));
    const { sentToExpo } = await aliceWrites();
    expect(sentToExpo).toHaveLength(0);
  });
});

describe('the rules keep devices private', () => {
  it('nobody can read another account\'s device through the client', async () => {
    const token = tokenOf('bobphone');
    await registerPhone('bob', token);
    as('alice');
    await expect(getDoc(doc(current.db, 'devices', deviceIdFor(token)))).rejects.toThrow();
  });
});
