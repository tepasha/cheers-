/**
 * redux-persist storage that encrypts everything at rest. The persisted store holds decrypted chats,
 * friends and reports, so a plain AsyncStorage dump (rooted device, backup, forensic copy) would expose
 * them. A random AES-256-GCM key lives in the OS keystore (iOS Keychain / Android Keystore) and never in
 * AsyncStorage; losing the key (new phone, restored backup) means the local cache is simply discarded and
 * rebuilt from Firestore.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { secureRandomBytes } from '../utils/secureRandom';

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

// Converted in 8 KB chunks (small enough for any engine's argument limit): one character at a time costs ~8x more
// on a multi-megabyte state (measured on V8)
const CHUNK = 0x2000;
const toBase64 = (bytes: Uint8Array) => {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  return btoa(parts.join(''));
};
const fromBase64 = (b64: string) => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export function createEncryptedStorage(inner: StringStorage, vault: KeyVault, random: (n: number) => Uint8Array = secureRandomBytes): StringStorage {
  let keyPromise: Promise<Uint8Array> | null = null;

  // One key per install, created on first use. Cached so concurrent writes share a single creation.
  const getKey = () =>
    (keyPromise ??= (async () => {
      const stored = await vault.get();
      if (stored) return fromBase64(stored);
      const fresh = random(32);
      await vault.set(toBase64(fresh));
      return fresh;
    })().catch((error) => { keyPromise = null; throw error; }));

  return {
    async getItem(name) {
      const raw = await inner.getItem(name);
      if (raw === null) return null;

      const [version, ivB64, dataB64] = raw.split(':');
      if (version !== VERSION || !ivB64 || !dataB64) return null; // legacy/plaintext or corrupt: start clean
      // An unavailable OS vault is not evidence of corrupt ciphertext. Preserve the cache and allow a retry.
      const key = await getKey();
      try {
        const plain = gcm(key, fromBase64(ivB64)).decrypt(fromBase64(dataB64));
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

interface SplitIndex {
  __split: 1;
  fields: string[];
}

const parseIndex = (raw: string): SplitIndex | null => {
  try {
    const value = JSON.parse(raw);
    return value && value.__split === 1 && Array.isArray(value.fields) ? value : null;
  } catch {
    return null;
  }
};

/** The `{field: "<json string>"}` shape redux-persist produces, or null for anything else */
const parseSlices = (value: string): Record<string, string> | null => {
  try {
    const parsed = JSON.parse(value);
    const ok = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.values(parsed).every((v) => typeof v === 'string');
    return ok ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * redux-persist hands its storage ONE string per key: `{"chats":"<json>","auth":"<json>",…}` (every slice already
 * stringified). Written as is, any change (one message, one setting) re-encrypts and rewrites the whole state, which
 * on a heavy account takes seconds of JS time. This wrapper stores each slice under its own key and rewrites only
 * the slices whose text changed since the last write.
 *
 * Layout: `name` holds a small index (`{"__split":1,"fields":[…]}`), each slice lives in `name.<field>`. A value
 * written before this wrapper existed (a plain state object) is read as is and converted on the next write.
 */
export function createSplitStorage(inner: StringStorage): StringStorage {
  /** What is currently stored per `name.field`, to skip writing identical slices */
  const written = new Map<string, string>();
  const known = new Map<string, string[]>();

  const fieldKey = (name: string, field: string) => `${name}.${field}`;

  return {
    async getItem(name) {
      const raw = await inner.getItem(name);
      if (raw === null) return null;
      const index = parseIndex(raw);
      if (!index) return raw; // pre-split value (or not ours): hand it over unchanged

      const values = await Promise.all(index.fields.map((f) => inner.getItem(fieldKey(name, f))));
      const outer: Record<string, string> = {};
      index.fields.forEach((f, i) => {
        const v = values[i];
        if (v !== null) {
          outer[f] = v;
          written.set(fieldKey(name, f), v);
        }
      });
      known.set(name, Object.keys(outer));
      return JSON.stringify(outer);
    },

    async setItem(name, value) {
      const outer = parseSlices(value);
      if (!outer) {
        await inner.setItem(name, value);
        return;
      }

      const fields = Object.keys(outer);
      for (const f of fields) {
        const text = outer[f];
        if (written.get(fieldKey(name, f)) === text) continue;
        await inner.setItem(fieldKey(name, f), text);
        written.set(fieldKey(name, f), text);
      }

      const previous = known.get(name);
      const sameFields = previous && previous.length === fields.length && previous.every((f, i) => f === fields[i]);
      if (!sameFields) {
        // Fields first, index last: a crash in between leaves the old index pointing at still-valid slices
        await inner.setItem(name, JSON.stringify({ __split: 1, fields } satisfies SplitIndex));
        for (const f of previous ?? []) {
          if (!fields.includes(f)) {
            await inner.removeItem(fieldKey(name, f));
            written.delete(fieldKey(name, f));
          }
        }
        known.set(name, fields);
      }
    },

    async removeItem(name) {
      const raw = await inner.getItem(name);
      const index = raw === null ? null : parseIndex(raw);
      for (const f of index?.fields ?? known.get(name) ?? []) {
        await inner.removeItem(fieldKey(name, f));
        written.delete(fieldKey(name, f));
      }
      known.delete(name);
      await inner.removeItem(name);
    },
  };
}
