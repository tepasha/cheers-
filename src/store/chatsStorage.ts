import type { ChatThread, Message } from '../types';
import type { StringStorage } from './secureStorage';

/**
 * The chats slice is saved outside the root persist (store/index.ts), one entry per thread: a new message re-encrypts
 * only its own conversation instead of every conversation on the device (the encryption runs in JS, about a second per
 * MB without a JIT). Redux keeps unchanged threads as the very same objects (Immer), so what to write is found by
 * reference, without comparing contents.
 *
 *   budmo-chats          {"ids":[…],"hiddenIds":[…]}   the list (newest first) and the chats removed from it
 *   budmo-chats.t.<id>   one thread, without what only matters in memory (toStored)
 */
const INDEX_KEY = 'budmo-chats';
const threadKey = (id: string) => `${INDEX_KEY}.t.${id}`;
const WRITE_THROTTLE_MS = 1000;
/** Messages a thread keeps on disk, newest; older pages from "Show earlier" stay in memory only */
export const STORED_MESSAGES_PER_THREAD = 100;

export interface StoredChats {
  threads: ChatThread[];
  hiddenIds: string[];
}

interface ChatsIndex {
  ids: string[];
  hiddenIds: string[];
}

interface ChatsStore {
  getState(): { chats: StoredChats };
  subscribe(listener: () => void): () => void;
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function parseIndex(raw: string | null): ChatsIndex | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return record(value) && Array.isArray(value.ids) ? { ids: strings(value.ids), hiddenIds: strings(value.hiddenIds) } : null;
  } catch {
    return null;
  }
}

/**
 * What a thread keeps on disk: its newest STORED_MESSAGES_PER_THREAD messages, without `historyComplete` (true only of
 * what is in memory). Dropped per message: the ciphertext of all but the newest one (the security sheet shows only
 * that), the snapshot's cache flag, the sender's photo (no message shows it) and the chat id (the thread's own,
 * restored on load). `hasPendingWrites` stays: it marks the server-confirmed messages a chat stream starts after.
 */
export function toStored(thread: ChatThread): ChatThread {
  const messages = thread.messages.length > STORED_MESSAGES_PER_THREAD ? thread.messages.slice(-STORED_MESSAGES_PER_THREAD) : thread.messages;
  let newestCipher = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].cipherPayload) {
      newestCipher = i;
      break;
    }
  }
  const { historyComplete: _inMemoryOnly, ...kept } = thread;
  return {
    ...kept,
    messages: messages.map((m, i) => {
      const kept: Partial<Message> = { ...m };
      delete kept.isFromCache;
      delete kept.senderAvatar;
      delete kept.chatId;
      if (i !== newestCipher) delete kept.cipherPayload;
      return kept as Message;
    }),
  };
}

const isThread = (value: unknown): value is ChatThread =>
  record(value) && typeof value.id === 'string' && record(value.buddy) && Array.isArray(value.messages);

function fromStored(raw: string | null, id: string): ChatThread | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isThread(value) || value.id !== id) return null;
    return { ...value, messages: value.messages.filter(record).map((m) => ({ ...m, chatId: id })) };
  } catch {
    return null;
  }
}

/** The chats slice as the old layout stored it inside the root entry (already parsed), or null */
export function legacyChats(value: unknown): StoredChats | null {
  if (!record(value) || !Array.isArray(value.threads)) return null;
  return { threads: value.threads.filter(isThread), hiddenIds: strings(value.hiddenIds) };
}

export interface ChatsPersistence {
  /** The saved chats, or undefined when this device has none in this layout (a fresh install, or the old layout) */
  load(): Promise<StoredChats | undefined>;
  /**
   * Writes chats from the old layout one thread per entry, before hydration ends: the root entry drops them on its
   * first write after that, so they must already be safe here. A failure is logged and `start` writes them again.
   */
  migrate(chats: StoredChats): Promise<void>;
  /**
   * Saves every later change of `store.getState().chats`. When the state was hydrated from `load()` or `migrate()`,
   * what is on disk already matches it and nothing is rewritten; otherwise everything is written once.
   */
  start(store: ChatsStore): void;
  /** Writes what is pending now, e.g. before the OS may stop the backgrounded app */
  flush(): Promise<void>;
}

export function createChatsPersistence(storage: StringStorage): ChatsPersistence {
  let loaded: ChatsIndex | null = null;
  /** Reading failed (the keystore can be unavailable for a moment): nothing on disk is touched in this session */
  let unavailable = false;
  let store: ChatsStore | null = null;
  /** The thread objects as last written, by id */
  const written = new Map<string, ChatThread>();
  /** Ids that have an entry on disk */
  let storedIds = new Set<string>();
  let writtenIndex: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  const write = async () => {
    if (!store) return;
    const { threads, hiddenIds } = store.getState().chats;
    for (const thread of threads) {
      if (written.get(thread.id) === thread) continue;
      await storage.setItem(threadKey(thread.id), JSON.stringify(toStored(thread)));
      written.set(thread.id, thread);
    }
    const ids = threads.map((t) => t.id);
    const index = JSON.stringify({ ids, hiddenIds } satisfies ChatsIndex);
    if (index === writtenIndex) return;
    // Threads first, index last: a crash in between leaves the old index pointing at entries that still exist
    await storage.setItem(INDEX_KEY, index);
    writtenIndex = index;
    const current = new Set(ids);
    for (const id of storedIds) {
      if (current.has(id)) continue;
      await storage.removeItem(threadKey(id));
      written.delete(id);
    }
    storedIds = current;
  };

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    chain = chain.then(write).catch((error) => console.warn('Saving the chats failed:', error));
    return chain;
  };

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, WRITE_THROTTLE_MS);
  };

  return {
    async load() {
      try {
        const index = parseIndex(await storage.getItem(INDEX_KEY));
        if (!index) return undefined;
        // An entry that cannot be decrypted is dropped by the storage itself (returns null); a failing read throws
        const entries = await Promise.all(index.ids.map(async (id) => fromStored(await storage.getItem(threadKey(id)), id)));
        loaded = index;
        return { threads: entries.filter((t): t is ChatThread => t !== null), hiddenIds: index.hiddenIds };
      } catch (error) {
        unavailable = true;
        console.warn('Reading the chats failed; they stay on disk untouched until the next launch:', error);
        return undefined;
      }
    },

    async migrate(chats) {
      if (unavailable) return;
      try {
        for (const thread of chats.threads) await storage.setItem(threadKey(thread.id), JSON.stringify(toStored(thread)));
        const index: ChatsIndex = { ids: chats.threads.map((t) => t.id), hiddenIds: chats.hiddenIds };
        await storage.setItem(INDEX_KEY, JSON.stringify(index));
        loaded = index;
      } catch (error) {
        console.warn('Moving the chats to their own entries failed; they are written again after hydration:', error);
      }
    },

    start(target) {
      // Writing now would replace saved chats that could not be read with this session's (possibly empty) ones
      if (unavailable) return;
      store = target;
      let last = target.getState().chats;
      if (loaded) {
        last.threads.forEach((thread) => written.set(thread.id, thread));
        storedIds = new Set(loaded.ids);
        writtenIndex = JSON.stringify({ ids: loaded.ids, hiddenIds: loaded.hiddenIds } satisfies ChatsIndex);
        // Hydration may have trimmed the list (store/persistMigration.ts): then the index and the extra entries go now
        if (JSON.stringify({ ids: last.threads.map((t) => t.id), hiddenIds: last.hiddenIds }) !== writtenIndex) schedule();
      } else {
        schedule();
      }
      target.subscribe(() => {
        const chats = target.getState().chats;
        if (chats === last) return;
        last = chats;
        schedule();
      });
    },

    flush,
  };
}
