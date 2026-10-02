/**
 * Contract: the REAL client (firestoreSyncService + the block thunks) against the emulator with the REAL rules.
 * Proves the app writes blocks in the shape the rules read, and that the blocked person is actually stopped.
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

const current: { db: any } = { db: null };
vi.mock('@/services/firebase', () => ({
  get db() {
    return current.db;
  },
  auth: {},
  firebaseApp: {},
}));
vi.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(randomBytes(n)) }));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
vi.mock('@/services/systemNotifications', () => ({ registerForPush: vi.fn() }));

import { firestoreSyncService as svc } from '@/services/firestoreSyncService';
import { blockUser, syncBlocksFromCloud, unblockUser } from '@/store/thunks/safety';
import { dmChatId } from '@/logic/chats';
import auth, { loggedIn } from '@/store/slices/authSlice';
import safety from '@/store/slices/safetySlice';
import notifications from '@/store/slices/notificationsSlice';
import settings from '@/store/slices/settingsSlice';
import ui from '@/store/slices/uiSlice';
import { createUser } from '@/logic/session';
import type { Message } from '@/types';

let env: RulesTestEnvironment;
const as = (uid: string) => {
  current.db = env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
};
const admin = async <T,>(fn: (db: any) => Promise<T>): Promise<T> => {
  let out!: T;
  await env.withSecurityRulesDisabled(async (ctx) => {
    out = await fn(ctx.firestore());
  });
  return out;
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-budmo-client-blocking',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const storeFor = (uid: string) => {
  const store = configureStore({ reducer: combineReducers({ auth, safety, notifications, settings, ui }) });
  store.dispatch(loggedIn(createUser({ id: uid, email: `${uid}@example.com`, emailVerified: true })));
  return store;
};
const run = <R,>(store: ReturnType<typeof storeFor>, thunk: unknown) => (store.dispatch as unknown as (t: unknown) => R)(thunk);

const message = (id: string, senderId: string, chatId: string): Message => ({ id, chatId, senderId, senderName: senderId, text: 'Привіт', timestamp: '12:00', isMe: true, type: 'text' });
const dmFor = (a: string, b: string) => ({ id: dmChatId(a, b), isGroup: false, memberIds: [a, b] });
const me = (id: string) => ({ id, name: id, avatar: '' });

describe('blocking through the real client', () => {
  it('the block thunk writes a document the rules honour: the blocked user can no longer start a chat or message', async () => {
    const bob = storeFor('bob');
    as('bob');
    run(bob, blockUser('alice', 'Alice', 'https://x.test/a.png'));
    await vi.waitFor(async () => expect((await admin((db) => getDoc(doc(db, 'users/bob/blocks/alice')))).exists()).toBe(true));
    expect((await admin((db) => getDoc(doc(db, 'users/bob/blocks/alice')))).data()).toMatchObject({ userId: 'alice', userName: 'Alice' });

    as('alice');
    const chat = dmFor('alice', 'bob');
    const attempt = await svc.sendEncryptedMessage(chat, message('m1', 'alice', chat.id), me('alice'));
    expect(attempt.success).toBe(false);
    expect((await admin((db) => getDoc(doc(db, `chats/${chat.id}`)))).exists()).toBe(false); // nothing was created

    as('bob'); // the blocker can still reach out
    expect((await svc.sendEncryptedMessage(chat, message('m2', 'bob', chat.id), me('bob'))).success).toBe(true);
  });

  it('unblocking through the thunk lifts the restriction', async () => {
    const bob = storeFor('bob');
    as('bob');
    run(bob, blockUser('alice', 'Alice'));
    await vi.waitFor(async () => expect((await admin((db) => getDoc(doc(db, 'users/bob/blocks/alice')))).exists()).toBe(true));
    run(bob, unblockUser('alice'));
    await vi.waitFor(async () => expect((await admin((db) => getDoc(doc(db, 'users/bob/blocks/alice')))).exists()).toBe(false));

    as('alice');
    const chat = dmFor('alice', 'bob');
    expect((await svc.sendEncryptedMessage(chat, message('m1', 'alice', chat.id), me('alice'))).success).toBe(true);
  });

  it('restores the block list on a fresh device, and the blocked person cannot read it', async () => {
    const phone1 = storeFor('bob');
    as('bob');
    run(phone1, blockUser('alice', 'Alice'));
    run(phone1, blockUser('mallory', 'Mallory', undefined, 'Spam'));
    await vi.waitFor(async () => expect((await svc.getBlocks('bob'))?.length).toBe(2));

    const phone2 = storeFor('bob'); // nothing local yet
    await run<Promise<void>>(phone2, syncBlocksFromCloud());
    expect(phone2.getState().safety.blockedUsers.map((u) => u.userId).sort()).toEqual(['alice', 'mallory']);

    as('alice');
    expect(await svc.getBlocks('bob')).toBeNull(); // permission denied: the blocked user learns nothing
  });

  it('the group creator can add people one by one; a person who blocked the creator is skipped, the rest still join', async () => {
    const chatId = 'grp_alice_1';
    const group = { id: chatId, isGroup: true, createdBy: 'alice', groupName: 'G', groupTopic: '', groupAvatar: '', memberIds: ['alice', 'carol'], participants: [{ id: 'carol', name: 'carol', avatar: '' }] };
    as('bob');
    await svc.saveBlock('bob', { userId: 'alice', userName: 'Alice', blockedAt: '1' });

    as('alice');
    expect((await svc.sendEncryptedMessage(group, message('g1', 'alice', chatId), me('alice'))).success).toBe(true);
    await svc.addGroupMembers(chatId, [
      { id: 'bob', name: 'bob', avatar: '' }, // blocked alice: refused
      { id: 'dave', name: 'dave', avatar: '' },
      { id: 'erin', name: 'erin', avatar: '' },
    ]);
    const members = (await admin((db) => getDoc(doc(db, `chats/${chatId}`)))).data()!.members;
    expect(members).toEqual(['alice', 'carol', 'dave', 'erin']);
  });
});
