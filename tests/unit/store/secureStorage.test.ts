import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';

vi.mock('expo-crypto', () => ({ getRandomValues: (buffer: Uint8Array) => { buffer.set(randomBytes(buffer.length)); return buffer; } }));

import { createEncryptedStorage, createSplitStorage, type KeyVault, type StringStorage } from '@/store/secureStorage';

const memory = (): StringStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
};
const vault = (): KeyVault & { value: string | null; sets: number } => {
  const v = { value: null as string | null, sets: 0, get: async () => v.value, set: async (x: string) => { v.value = x; v.sets++; } };
  return v;
};

describe('encrypted persistence storage', () => {
  it('round-trips unicode data and never writes plaintext', async () => {
    const inner = memory();
    const storage = createEncryptedStorage(inner, vault());
    const state = JSON.stringify({ chats: [{ text: 'Секретне повідомлення 🍻' }] });

    await storage.setItem('root', state);
    expect(inner.data.get('root')).not.toContain('Секретне');
    expect(inner.data.get('root')).toMatch(/^v1:/);
    expect(await storage.getItem('root')).toBe(state);
  });

  it('uses a fresh IV for every write', async () => {
    const inner = memory();
    const storage = createEncryptedStorage(inner, vault());
    await storage.setItem('a', 'same');
    const first = inner.data.get('a');
    await storage.setItem('a', 'same');
    expect(inner.data.get('a')).not.toBe(first);
  });

  it('creates the key once, even for concurrent first writes, and reuses it across restarts', async () => {
    const inner = memory();
    const keys = vault();
    const storage = createEncryptedStorage(inner, keys);
    await Promise.all([storage.setItem('a', '1'), storage.setItem('b', '2'), storage.getItem('a')]);
    expect(keys.sets).toBe(1);

    const afterRestart = createEncryptedStorage(inner, keys);
    expect(await afterRestart.getItem('a')).toBe('1');
    expect(keys.sets).toBe(1);
  });

  it('discards the cache when the key is lost or the data was tampered with', async () => {
    const inner = memory();
    await createEncryptedStorage(inner, vault()).setItem('root', 'data');

    const newDevice = createEncryptedStorage(inner, vault()); // different key
    expect(await newDevice.getItem('root')).toBeNull();
    expect(inner.data.has('root')).toBe(false);

    const keys = vault();
    const storage = createEncryptedStorage(inner, keys);
    await storage.setItem('root', 'data');
    const [v, iv, ct] = inner.data.get('root')!.split(':');
    inner.data.set('root', `${v}:${iv}:${ct.slice(0, -4)}AAAA`);
    expect(await storage.getItem('root')).toBeNull();
  });

  it('treats legacy plaintext and missing items as empty', async () => {
    const inner = memory();
    inner.data.set('legacy', '{"auth":{}}');
    const storage = createEncryptedStorage(inner, vault());
    expect(await storage.getItem('legacy')).toBeNull();
    expect(await storage.getItem('missing')).toBeNull();
  });

  it('removes items', async () => {
    const inner = memory();
    const storage = createEncryptedStorage(inner, vault());
    await storage.setItem('a', '1');
    await storage.removeItem('a');
    expect(await storage.getItem('a')).toBeNull();
  });
});

describe('split persistence storage', () => {
  /** What redux-persist writes: every slice already stringified */
  const state = (slices: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(slices).map(([k, v]) => [k, JSON.stringify(v)])));
  const counting = () => {
    const inner = memory();
    const writes: string[] = [];
    const wrapped: StringStorage = { ...inner, setItem: async (k, v) => (writes.push(k), inner.setItem(k, v)) };
    return { inner, writes, wrapped };
  };

  it('round-trips the state and keeps every slice under its own key', async () => {
    const { inner, wrapped } = counting();
    const storage = createSplitStorage(wrapped);
    const value = state({ chats: { threads: [1, 2] }, auth: { id: 'u' }, _persist: { version: 1, rehydrated: true } });
    await storage.setItem('root', value);

    expect([...inner.data.keys()].sort()).toEqual(['root', 'root._persist', 'root.auth', 'root.chats']);
    expect(JSON.parse((await storage.getItem('root'))!)).toEqual(JSON.parse(value));
  });

  it('rewrites only the slices that changed', async () => {
    const { writes, wrapped } = counting();
    const storage = createSplitStorage(wrapped);
    await storage.setItem('root', state({ chats: { n: 1 }, location: { lat: 1 } }));
    writes.length = 0;

    await storage.setItem('root', state({ chats: { n: 1 }, location: { lat: 2 } }));
    expect(writes).toEqual(['root.location']); // the (large) chats slice was not touched

    writes.length = 0;
    await storage.setItem('root', state({ chats: { n: 1 }, location: { lat: 2 } }));
    expect(writes).toEqual([]);
  });

  it('skips unchanged slices right after a restart too (cache primed by the read)', async () => {
    const { inner, wrapped } = counting();
    const before = createSplitStorage(wrapped);
    await before.setItem('root', state({ chats: { n: 1 }, location: { lat: 1 } }));

    const writes: string[] = [];
    const restarted = createSplitStorage({ ...inner, setItem: async (k, v) => (writes.push(k), inner.setItem(k, v)) });
    await restarted.getItem('root');
    await restarted.setItem('root', state({ chats: { n: 1 }, location: { lat: 2 } }));
    expect(writes).toEqual(['root.location']);
  });

  it('drops the keys of slices that are gone', async () => {
    const { inner, wrapped } = counting();
    const storage = createSplitStorage(wrapped);
    await storage.setItem('root', state({ a: 1, b: 2 }));
    await storage.setItem('root', state({ a: 1 }));
    expect(inner.data.has('root.b')).toBe(false);
    expect(JSON.parse((await storage.getItem('root'))!)).toEqual({ a: '1' });
  });

  it('reads a value written before the split existed, and converts it on the next write', async () => {
    const { inner, wrapped } = counting();
    const legacy = state({ chats: { n: 1 } });
    inner.data.set('root', legacy);
    const storage = createSplitStorage(wrapped);

    expect(await storage.getItem('root')).toBe(legacy);
    await storage.setItem('root', state({ chats: { n: 2 } }));
    expect(inner.data.has('root.chats')).toBe(true);
    expect(JSON.parse((await storage.getItem('root'))!)).toEqual({ chats: '{"n":2}' });
  });

  it('survives a missing slice (interrupted write): the rest still loads', async () => {
    const { inner, wrapped } = counting();
    const storage = createSplitStorage(wrapped);
    await storage.setItem('root', state({ a: 1, b: 2 }));
    inner.data.delete('root.b');
    expect(JSON.parse((await createSplitStorage(wrapped).getItem('root'))!)).toEqual({ a: '1' });
  });

  it('passes through anything that is not a map of strings', async () => {
    const { inner, wrapped } = counting();
    const storage = createSplitStorage(wrapped);
    await storage.setItem('raw', 'not json');
    expect(inner.data.get('raw')).toBe('not json');
    expect(await storage.getItem('raw')).toBe('not json');
  });

  it('removes the index and every slice', async () => {
    const { inner, wrapped } = counting();
    const storage = createSplitStorage(wrapped);
    await storage.setItem('root', state({ a: 1, b: 2 }));
    await storage.removeItem('root');
    expect([...inner.data.keys()]).toEqual([]);
    expect(await storage.getItem('root')).toBeNull();
  });

  it('composes with encryption: nothing readable lands in the underlying store', async () => {
    const inner = memory();
    const storage = createSplitStorage(createEncryptedStorage(inner, vault()));
    const value = state({ chats: { text: 'Секретне 🍻' } });
    await storage.setItem('root', value);
    expect([...inner.data.values()].join('')).not.toContain('Секретне');
    expect(await storage.getItem('root')).toBe(value);
  });
});
