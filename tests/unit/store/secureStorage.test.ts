import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';

vi.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(randomBytes(n)) }));

import { createEncryptedStorage, type KeyVault, type StringStorage } from '@/store/secureStorage';

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
