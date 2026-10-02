/**
 * redux-persist storage that encrypts everything at rest. The persisted store holds decrypted chats,
 * friends and reports, so a plain AsyncStorage dump (rooted device, backup, forensic copy) would expose
 * them. A random AES-256-GCM key lives in the OS keystore (iOS Keychain / Android Keystore) and never in
 * AsyncStorage; losing the key (new phone, restored backup) means the local cache is simply discarded and
 * rebuilt from Firestore.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { getRandomBytes } from 'expo-crypto';

export interface KeyVault {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
}

export interface StringStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const VERSION = 'v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export function createEncryptedStorage(inner: StringStorage, vault: KeyVault, random: (n: number) => Uint8Array = getRandomBytes): StringStorage {
  let keyPromise: Promise<Uint8Array> | null = null;

  // One key per install, created on first use. Cached so concurrent writes share a single creation.
  const getKey = () =>
    (keyPromise ??= (async () => {
      const stored = await vault.get();
      if (stored) return fromBase64(stored);
      const fresh = random(32);
      await vault.set(toBase64(fresh));
      return fresh;
    })());

  return {
    async getItem(name) {
      const raw = await inner.getItem(name);
      if (raw === null) return null;

      const [version, ivB64, dataB64] = raw.split(':');
      if (version !== VERSION || !ivB64 || !dataB64) return null; // legacy/plaintext or corrupt: start clean
      try {
        const plain = gcm(await getKey(), fromBase64(ivB64)).decrypt(fromBase64(dataB64));
        return decoder.decode(plain);
      } catch {
        // Wrong key (restored backup / new device) or tampering: drop the cache rather than crash
        await inner.removeItem(name);
        return null;
      }
    },

    async setItem(name, value) {
      const iv = random(12);
      const cipher = gcm(await getKey(), iv).encrypt(encoder.encode(value));
      await inner.setItem(name, `${VERSION}:${toBase64(iv)}:${toBase64(cipher)}`);
    },

    removeItem: (name) => inner.removeItem(name),
  };
}
