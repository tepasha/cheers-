import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

vi.mock('expo-crypto', () => ({ getRandomValues: (buffer: Uint8Array) => { buffer.set(randomBytes(buffer.length)); return buffer; } }));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) },
}));
vi.mock('@/store/keystore', () => {
  const none = { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined };
  return { encryptedAsyncStorage: none, encryptedEntryStorage: none };
});

import chats, { chatDeleted, chatRead, groupChatCreated, inboxSynced, messageAppended } from '@/store/slices/chatsSlice';
import { personalDataReset } from '@/store/actions';
import { createChatsPersistence, legacyChats, toStored, type StoredChats } from '@/store/chatsStorage';
import { createSplitStorage, type StringStorage } from '@/store/secureStorage';
import { createAppStore } from '@/store/index';
import type { BuddyProfile, ChatThread, Message } from '@/types';

const memory = () => {
  const data = new Map<string, string>();
  const writes: string[] = [];
  const storage: StringStorage = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => { writes.push(k); data.set(k, v); },
    removeItem: async (k) => void data.delete(k),
  };
  return { data, writes, storage };
};
const buddy = (id: string) => ({
  id, name: id, avatar: '', age: 30, tagline: '', bio: '', locationName: '', distanceKm: 0, coordinates: { lat: 0, lng: 0 },
  preferredDrinks: [], paymentRule: 'not_specified', currentMood: 'not_specified', favoriteBars: [], talkTopics: [], online: false,
}) as unknown as BuddyProfile;
const message = (id: string, chatId: string, over: Partial<Message> = {}): Message => ({
  id, chatId, senderId: 'a', senderName: 'A', senderAvatar: 'https://lh3.googleusercontent.com/a/x', text: id, timestamp: '12:00', isMe: false,
  cipherPayload: `enc:v2:${id}`, isFromCache: false, hasPendingWrites: false, createdAt: 1, ...over,
});
const thread = (id: string, messages = [message('m1', id), message('m2', id, { createdAt: 2 })]): ChatThread =>
  ({ id, buddy: buddy(id), lastMessage: '', lastMessageTime: '', unreadCount: 0, messages });
const makeStore = (preloaded?: StoredChats) => configureStore({ reducer: combineReducers({ chats }), ...(preloaded ? { preloadedState: { chats: preloaded } } : {}) });

describe('chats on disk, one thread per entry', () => {
  it('keeps only what matters after a restart', () => {
    const stored = toStored(thread('c'));
    expect(stored.messages[0]).not.toHaveProperty('cipherPayload');
    expect(stored.messages[1].cipherPayload).toBe('enc:v2:m2'); // the newest one stays for the security sheet
    for (const m of stored.messages) {
      expect(m).not.toHaveProperty('isFromCache');
      expect(m).not.toHaveProperty('senderAvatar');
      expect(m).not.toHaveProperty('chatId');
      expect(m.hasPendingWrites).toBe(false); // where a chat stream starts after a restart
    }
  });

  it('keeps the newest 100 messages on disk, whatever "Show earlier" loaded into memory', () => {
    const many = Array.from({ length: 140 }, (_, i) => message(`m${i}`, 'c', { createdAt: i }));
    const stored = toStored({ ...thread('c', many), historyComplete: true });
    expect(stored.messages).toHaveLength(100);
    expect(stored.messages[0].id).toBe('m40');
    expect(stored.messages[99].cipherPayload).toBe('enc:v2:m139');
    expect(stored).not.toHaveProperty('historyComplete'); // true only of what was in memory
  });

  it('round-trips, restoring the chat id of every message', async () => {
    const { storage } = memory();
    const store = makeStore();
    store.dispatch(groupChatCreated(thread('c1')));
    store.dispatch(groupChatCreated(thread('c2')));
    const persistence = createChatsPersistence(storage);
    persistence.start(store);
    await persistence.flush();

    const loaded = await createChatsPersistence(storage).load();
    expect(loaded?.threads.map((t) => t.id)).toEqual(['c2', 'c1']);
    expect(loaded?.threads[0].messages.map((m) => m.chatId)).toEqual(['c2', 'c2']);
  });

  it('rewrites only the thread that changed (and the list, when its order did)', async () => {
    const { storage, writes } = memory();
    const store = makeStore();
    store.dispatch(groupChatCreated(thread('c1')));
    store.dispatch(groupChatCreated(thread('c2')));
    const persistence = createChatsPersistence(storage);
    persistence.start(store);
    await persistence.flush();

    writes.length = 0;
    store.dispatch(messageAppended({ chatId: 'c1', message: message('m3', 'c1', { createdAt: 5 }), summary: 'm3' }));
    await persistence.flush();
    expect(writes).toEqual(['budmo-chats.t.c1', 'budmo-chats']);
  });

  it('a repeated inbox snapshot and reading an already read chat change nothing, so nothing is written', async () => {
    const { storage, writes } = memory();
    const store = makeStore();
    const cloud = { ...thread('c1'), memberIds: ['a', 'b'], updatedAt: 't1', lastMessageId: 'm2' };
    store.dispatch(inboxSynced({ myId: 'a', openChatId: null, chats: [{ thread: cloud }] }));
    store.dispatch(chatRead('c1'));
    const persistence = createChatsPersistence(storage);
    persistence.start(store);
    await persistence.flush();

    writes.length = 0;
    const before = store.getState().chats;
    store.dispatch(inboxSynced({ myId: 'a', openChatId: null, chats: [{ thread: { ...cloud, memberIds: ['a', 'b'] } }] }));
    store.dispatch(chatRead('c1'));
    expect(store.getState().chats).toBe(before);
    await persistence.flush();
    expect(writes).toEqual([]);
  });

  it('a deleted chat loses its entry, and a reset (another account) removes them all', async () => {
    const { storage, data } = memory();
    const store = makeStore();
    store.dispatch(groupChatCreated(thread('c1')));
    store.dispatch(groupChatCreated(thread('c2')));
    const persistence = createChatsPersistence(storage);
    persistence.start(store);
    await persistence.flush();

    store.dispatch(chatDeleted('c1'));
    await persistence.flush();
    expect(data.has('budmo-chats.t.c1')).toBe(false);
    expect(data.has('budmo-chats.t.c2')).toBe(true);

    store.dispatch(personalDataReset());
    await persistence.flush();
    expect([...data.keys()]).toEqual(['budmo-chats']);
    expect(JSON.parse(data.get('budmo-chats')!)).toEqual({ ids: [], hiddenIds: [] });
  });

  it('a state hydrated from these entries is not written again', async () => {
    const { storage, writes } = memory();
    const first = makeStore();
    first.dispatch(groupChatCreated(thread('c1')));
    const saving = createChatsPersistence(storage);
    saving.start(first);
    await saving.flush();

    const restarted = createChatsPersistence(storage);
    const loaded = await restarted.load();
    writes.length = 0;
    restarted.start(makeStore(loaded));
    await restarted.flush();
    expect(writes).toEqual([]);
  });

  it('when reading fails (keystore unavailable for a moment), nothing on disk is replaced in that session', async () => {
    const { storage, data } = memory();
    const saving = createChatsPersistence(storage);
    const first = makeStore();
    first.dispatch(groupChatCreated(thread('c1')));
    saving.start(first);
    await saving.flush();
    const saved = new Map(data);

    const failing: StringStorage = { ...storage, getItem: async () => { throw new Error('keystore unavailable'); } };
    const restarted = createChatsPersistence(failing);
    expect(await restarted.load()).toBeUndefined();
    const empty = makeStore();
    restarted.start(empty);
    empty.dispatch(groupChatCreated(thread('c2')));
    await restarted.flush();
    expect(data).toEqual(saved);
  });

  it('chats of the old layout are moved before hydration, and are not written a second time', async () => {
    const { storage, data, writes } = memory();
    const legacy = legacyChats({ threads: [thread('c1'), { broken: true }], hiddenIds: ['x'] });
    expect(legacy?.threads.map((t) => t.id)).toEqual(['c1']);
    const persistence = createChatsPersistence(storage);
    await persistence.migrate(legacy!);
    expect(data.has('budmo-chats.t.c1')).toBe(true);

    writes.length = 0;
    persistence.start(makeStore(legacy!));
    await persistence.flush();
    expect(writes).toEqual([]);
  });
});

describe('the app store with per-thread chats', () => {
  it('moves the chats out of the root entry on the first launch, keeps them, and the root entry then drops them', async () => {
    const disk = memory();
    const root = createSplitStorage(disk.storage);
    const chatsState: StoredChats = { threads: [thread('c1')], hiddenIds: [] };
    // What the previous version wrote: the chats inside the root entry
    await root.setItem('persist:budmo-root', JSON.stringify({ chats: JSON.stringify(chatsState), _persist: JSON.stringify({ version: 2, rehydrated: true }) }));
    expect(disk.data.has('persist:budmo-root.chats')).toBe(true);

    vi.useFakeTimers();
    try {
      const { store, persistor } = createAppStore(root);
      await vi.waitFor(() => expect(persistor.getState().bootstrapped).toBe(true));
      expect(store.getState().chats.threads.map((t) => t.id)).toEqual(['c1']);
      // Copied before hydration ended, so before the root entry could be rewritten
      expect(disk.data.has('budmo-chats.t.c1')).toBe(true);
      // redux-persist's throttle writes one slice per second: the first full write of the root entry takes ~10 s
      await vi.advanceTimersByTimeAsync(15_000);
      expect(disk.data.has('persist:budmo-root.chats')).toBe(false);
      expect(disk.data.has('persist:budmo-root.settings')).toBe(true);
      expect(disk.data.has('budmo-chats.t.c1')).toBe(true);
      persistor.pause();
    } finally {
      vi.useRealTimers();
    }
  });
});
