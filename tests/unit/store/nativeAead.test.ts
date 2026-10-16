/**
 * The platform AES-GCM adapter (store/nativeAead.ts) against a stand-in for expo-crypto built on Node's own AES-GCM,
 * shaped like the native module: ciphertext() reads `outputFormat` (Android, iOS) or `encoding` (web) for its format.
 * Node's GCM is an implementation independent of @noble, so the cross-reads below check the shared layout for real.
 */
import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';

const fake = vi.hoisted(() => ({ formatOption: 'outputFormat' as 'outputFormat' | 'encoding', failEncrypt: false, failDecrypt: false }));

vi.mock('expo-crypto', async () => {
  const { createCipheriv, createDecipheriv } = await import('node:crypto');
  const bytesOf = (v: string | Uint8Array) => (typeof v === 'string' ? Buffer.from(v, 'base64') : Buffer.from(v));
  class AESEncryptionKey {
    constructor(readonly raw: Buffer) {}
    static async import(raw: Uint8Array) {
      return new AESEncryptionKey(Buffer.from(raw));
    }
  }
  class AESSealedData {
    constructor(readonly iv: Buffer, readonly tagged: Buffer) {}
    static fromParts(iv: string | Uint8Array, taggedCiphertext: string | Uint8Array) {
      return new AESSealedData(bytesOf(iv), bytesOf(taggedCiphertext));
    }
    async ciphertext(options: Record<string, unknown>) {
      return options[fake.formatOption] === 'base64' ? this.tagged.toString('base64') : new Uint8Array(this.tagged);
    }
  }
  return {
    getRandomValues: (buffer: Uint8Array) => { buffer.set(randomBytes(buffer.length)); return buffer; },
    AESEncryptionKey,
    AESSealedData,
    aesEncryptAsync: async (plain: Uint8Array, key: AESEncryptionKey, options: { nonce: { bytes: Uint8Array } }) => {
      if (fake.failEncrypt) throw new Error('native encrypt failed');
      const iv = bytesOf(options.nonce.bytes);
      const cipher = createCipheriv('aes-256-gcm', key.raw, iv);
      return new AESSealedData(iv, Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]));
    },
    aesDecryptAsync: async (sealed: AESSealedData, key: AESEncryptionKey) => {
      if (fake.failDecrypt) throw new Error('native decrypt failed');
      const decipher = createDecipheriv('aes-256-gcm', key.raw, sealed.iv);
      decipher.setAuthTag(sealed.tagged.subarray(-16));
      return new Uint8Array(Buffer.concat([decipher.update(sealed.tagged.subarray(0, -16)), decipher.final()]));
    },
  };
});

import { nativeAead } from '@/store/nativeAead';
import { createEncryptedStorage, nobleAead, preferring, toBase64, type KeyVault, type StringStorage } from '@/store/secureStorage';

const memory = (): StringStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v), removeItem: async (k) => void data.delete(k) };
};
const vault = (): KeyVault => {
  let value: string | null = null;
  return { get: async () => value, set: async (x) => { value = x; } };
};
const key = () => new Uint8Array(randomBytes(32));
const iv = () => new Uint8Array(randomBytes(12));
const TEXT = JSON.stringify({ chats: [{ text: 'Секретне повідомлення 🍻', n: 1 }] });

describe('platform AES-GCM (expo-crypto)', () => {
  it('round-trips unicode, whichever name the module reads the output format by', async () => {
    for (const option of ['outputFormat', 'encoding'] as const) {
      fake.formatOption = option;
      const k = key();
      const i = iv();
      const sealed = await nativeAead.seal(k, i, TEXT);
      expect(await nativeAead.open(k, toBase64(i), sealed)).toBe(TEXT);
    }
    fake.formatOption = 'outputFormat';
  });

  it('reads what @noble wrote and writes what @noble reads: entries from before the switch stay readable', async () => {
    const k = key();
    const i = iv();
    expect(await nativeAead.open(k, toBase64(i), await nobleAead.seal(k, i, TEXT))).toBe(TEXT);
    expect(await nobleAead.open(k, toBase64(i), await nativeAead.seal(k, i, TEXT))).toBe(TEXT);
    expect(await nativeAead.seal(k, i, TEXT)).toBe(await nobleAead.seal(k, i, TEXT)); // byte for byte the same entry
  });

  it('refuses a wrong key and a tampered entry', async () => {
    const k = key();
    const i = iv();
    const sealed = await nativeAead.seal(k, i, TEXT);
    await expect(nativeAead.open(key(), toBase64(i), sealed)).rejects.toThrow();
    await expect(nativeAead.open(k, toBase64(i), `${sealed.slice(0, -4)}AAAA`)).rejects.toThrow();
  });
});

describe('the storage the app uses: platform first, @noble when it fails', () => {
  const appStorage = (inner: StringStorage, keys: KeyVault) => createEncryptedStorage(inner, keys, undefined, preferring(nativeAead, nobleAead));

  it('reads the entries an older build wrote with @noble, and that build can read the new ones', async () => {
    const inner = memory();
    const keys = vault();
    await createEncryptedStorage(inner, keys).setItem('old', TEXT);
    const storage = appStorage(inner, keys);
    expect(await storage.getItem('old')).toBe(TEXT);
    await storage.setItem('new', TEXT);
    expect(await createEncryptedStorage(inner, keys).getItem('new')).toBe(TEXT); // OTA rollback
  });

  it('a failing native call costs speed, not the cache', async () => {
    const inner = memory();
    const keys = vault();
    const storage = appStorage(inner, keys);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fake.failEncrypt = true;
    fake.failDecrypt = true;
    try {
      await storage.setItem('a', TEXT);
      expect(await storage.getItem('a')).toBe(TEXT);
      expect(inner.data.has('a')).toBe(true);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      fake.failEncrypt = false;
      fake.failDecrypt = false;
      warn.mockRestore();
    }
    expect(await storage.getItem('a')).toBe(TEXT);
  });

  it('still drops an entry that no key opens (restored backup, tampering)', async () => {
    const inner = memory();
    await appStorage(inner, vault()).setItem('root', TEXT);
    expect(await appStorage(inner, vault()).getItem('root')).toBeNull();
    expect(inner.data.has('root')).toBe(false);
  });
});
