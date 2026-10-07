import location from '@/store/slices/locationSlice';
import outbox from '@/store/slices/outboxSlice';
/**
 * End to end with two REAL clients (stores + thunks + firestoreSyncService) against the emulator and the real
 * rules: Alice proposes a meetup, Bob answers, Alice must see the answer.  npm run test:rules
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
vi.mock('expo-crypto', () => ({ getRandomValues: (buffer: Uint8Array) => { buffer.set(randomBytes(buffer.length)); return buffer; } }));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
vi.mock('@/services/systemNotifications', () => ({ registerForPush: vi.fn(), stopSystemPush: vi.fn().mockResolvedValue(undefined) }));

import { firestoreSyncService as svc } from '@/services/firestoreSyncService';
import { openDirectChat, respondToProposal, sendMessage } from '@/store/thunks/social';
import auth, { loggedIn } from '@/store/slices/authSlice';
import chats, { messagesReceived } from '@/store/slices/chatsSlice';
import gamification from '@/store/slices/gamificationSlice';
import safety from '@/store/slices/safetySlice';
import notifications from '@/store/slices/notificationsSlice';
import settings from '@/store/slices/settingsSlice';
import friends from '@/store/slices/friendsSlice';
import ui from '@/store/slices/uiSlice';
import { createUser } from '@/logic/session';
import { dmChatId } from '@/logic/chats';
import type { BuddyProfile, Message } from '@/types';

let env: RulesTestEnvironment;
const as = (uid: string) => {
  current.db = env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true, age_21: true }).firestore();
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
    projectId: 'demo-budmo-proposals-e2e',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/** Writes are fire-and-forget in the app, so poll the emulator; a fresh client's first write can exceed vi.waitFor's 1s default */
const eventually = <T,>(fn: () => T | Promise<T>) => vi.waitFor(fn, { timeout: 15000, interval: 100 });

const buddy = (id: string): BuddyProfile => ({
  id, name: id, avatar: '', age: 27, tagline: '', bio: '', locationName: '', distanceKm: 0, coordinates: { lat: 0, lng: 0 },
  preferredDrinks: [], paymentRule: 'split_50_50', currentMood: 'chill_talk', favoriteBars: [], talkTopics: [], online: true,
});

const clientFor = (uid: string) => {
  const store = configureStore({ reducer: combineReducers({ location, outbox, auth, chats, gamification, safety, notifications, settings, friends, ui }) });
  store.dispatch(loggedIn(createUser({ id: uid, email: `${uid}@example.com`, emailVerified: true })));
  const run = <R,>(thunk: unknown) => (store.dispatch as unknown as (t: unknown) => R)(thunk);
  const messages = () => (store.getState() as any).chats.threads[0]?.messages as Message[] | undefined;
  /** Follows the chat from Firestore like useChatSync does, as that user */
  const follow = (chatId: string) => {
    as(uid);
    return svc.subscribeToEncryptedChat(chatId, uid, (msgs) => store.dispatch(messagesReceived({ chatId, messages: msgs })));
  };
  return { store, run, messages, follow };
};

describe('proposal answers between two real clients', () => {
  it('Alice proposes, Bob accepts, and Alice sees the status change', async () => {
    const chatId = dmChatId('alice', 'bob');
    const alice = clientFor('alice');
    const bob = clientFor('bob');

    // Alice proposes a meetup
    as('alice');
    alice.run(openDirectChat(buddy('bob')));
    alice.run(sendMessage({ chatId, text: 'Запропонував зустріч у Squat 17b', type: 'location_proposal', proposalData: { barName: 'Squat 17b', address: 'Київ', time: 'Сьогодні о 20:30', status: 'pending' } }));
    const proposalId = alice.messages()![0].id;
    await eventually(async () => expect((await admin((db) => getDoc(doc(db, `chats/${chatId}/messages/${proposalId}`)))).exists()).toBe(true));

    // Venue, address and time are stored as ciphertext, never in clear
    const storedProposal = (await admin((db) => getDoc(doc(db, `chats/${chatId}/messages/${proposalId}`)))).data()!;
    expect(storedProposal.proposalData).toBeNull();
    expect(storedProposal.proposalCipher).toMatch(/^enc:v2:/);
    expect(JSON.stringify(storedProposal)).not.toMatch(/Squat|20:30|Київ/);

    // Bob receives it and answers
    bob.run(openDirectChat(buddy('alice')));
    const stopBob = bob.follow(chatId);
    await eventually(() => expect(bob.messages()?.some((m) => m.id === proposalId)).toBe(true));
    expect(bob.messages()!.find((m) => m.id === proposalId)!.proposalData).toMatchObject({ barName: 'Squat 17b', address: 'Київ', time: 'Сьогодні о 20:30', status: 'pending' }); // decrypted on Bob's side

    as('bob');
    bob.run(respondToProposal(chatId, proposalId, 'accepted'));
    expect(bob.messages()!.find((m) => m.id === proposalId)!.proposalData?.status).toBe('accepted'); // immediate for Bob

    const stored = await eventually(async () => {
      const snap = await admin((db) => getDoc(doc(db, `chats/${chatId}/messages/resp_${proposalId}`)));
      expect(snap.exists()).toBe(true);
      return snap.data()!;
    });
    expect(stored).toMatchObject({ type: 'proposal_response', proposalId, proposalStatus: 'accepted', senderId: 'bob' });
    expect(stored.cipherPayload).toMatch(/^enc:v2:/); // the text of the answer is encrypted like any other message

    // Alice, who was not online for the answer, opens the chat and sees it
    const stopAlice = alice.follow(chatId);
    await eventually(() => expect(alice.messages()!.find((m) => m.id === proposalId)!.proposalData?.status).toBe('accepted'));
    expect(alice.messages()!.some((m) => m.id === `resp_${proposalId}`)).toBe(true);

    stopBob();
    stopAlice();
  });

  it('a declined proposal shows as declined for both, and cannot be changed afterwards', async () => {
    const chatId = dmChatId('alice', 'bob');
    const alice = clientFor('alice');
    const bob = clientFor('bob');

    as('alice');
    alice.run(openDirectChat(buddy('bob')));
    alice.run(sendMessage({ chatId, text: 'Запропонував зустріч', type: 'location_proposal', proposalData: { barName: 'Win Bar', address: 'Київ', time: '19:00', status: 'pending' } }));
    const proposalId = alice.messages()![0].id;
    await eventually(async () => expect((await admin((db) => getDoc(doc(db, `chats/${chatId}/messages/${proposalId}`)))).exists()).toBe(true));

    bob.run(openDirectChat(buddy('alice')));
    const stopBob = bob.follow(chatId);
    await eventually(() => expect(bob.messages()?.some((m) => m.id === proposalId)).toBe(true));
    as('bob');
    bob.run(respondToProposal(chatId, proposalId, 'declined'));
    bob.run(respondToProposal(chatId, proposalId, 'accepted')); // second thoughts: ignored locally
    await eventually(async () => expect((await admin((db) => getDoc(doc(db, `chats/${chatId}/messages/resp_${proposalId}`)))).exists()).toBe(true));
    expect((await admin((db) => getDoc(doc(db, `chats/${chatId}/messages/resp_${proposalId}`)))).data()!.proposalStatus).toBe('declined');

    const stopAlice = alice.follow(chatId);
    await eventually(() => expect(alice.messages()!.find((m) => m.id === proposalId)!.proposalData?.status).toBe('declined'));
    stopBob();
    stopAlice();
  });

  it('the server rejects Alice answering her own proposal even if a modified client tried', async () => {
    const chatId = dmChatId('alice', 'bob');
    const alice = clientFor('alice');
    as('alice');
    alice.run(openDirectChat(buddy('bob')));
    alice.run(sendMessage({ chatId, text: 'p', type: 'location_proposal', proposalData: { barName: 'B', address: 'A', time: 'T', status: 'pending' } }));
    const proposalId = alice.messages()![0].id;
    await eventually(async () => expect((await admin((db) => getDoc(doc(db, `chats/${chatId}/messages/${proposalId}`)))).exists()).toBe(true));

    // bypass the thunk's own guard and send the answer message directly
    const forged = await svc.sendEncryptedMessage(
      { id: chatId, isGroup: false, memberIds: ['alice', 'bob'] },
      { id: `resp_${proposalId}`, chatId, senderId: 'alice', senderName: 'alice', text: 'ok', timestamp: '1', isMe: true, type: 'proposal_response', proposalId, proposalStatus: 'accepted' },
      { id: 'alice', name: 'alice' }
    );
    expect(forged.success).toBe(false);
    expect((await admin((db) => getDoc(doc(db, `chats/${chatId}/messages/resp_${proposalId}`)))).exists()).toBe(false);
  });
});
