/**
 * Chat message encryption (AES-GCM 256-bit). Payloads look like `enc:<version>:<iv b64>:<ciphertext+tag b64>`:
 *   v2 (written now): key = HKDF-SHA256 of the app constant, salted and bound to the chat id.
 *   v1 (read only):   key = PBKDF2-SHA256 (10 000 rounds), the former WebCrypto scheme; kept so existing
 *                     messages stay readable.
 *
 * Why HKDF: the input is not a password, it is a constant plus a public chat id, so there is nothing for
 * PBKDF2's stretching to protect. HKDF derives the same-strength key in two HMAC calls instead of 10 000
 * hashes, which matters on Hermes (pure-JS hashing). It is a cleaner fit, not a security upgrade (see NOTE).
 *
 * Hermes has no `crypto.subtle`, so this uses audited pure-JS primitives from @noble.
 *
 * NOTE: the room key is derived from a constant bundled in the app plus the chat id, so
 * this protects data at rest in Firestore, not against someone holding the app bundle.
 * Real end-to-end encryption needs per-user key exchange.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { getRandomBytes } from 'expo-crypto';
import { ph } from './i18nService';

const APP_SECRET_SALT = 'budmo_kyiv_e2ee_2026_salt_v1';
const PBKDF2_ITERATIONS = 10000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keyCache = new Map<string, Uint8Array>();
const legacyKeyCache = new Map<string, Uint8Array>();

const CURRENT_VERSION = 'v2';

/** Current scheme (v2): HKDF-SHA256, the chat id goes into `info` so every room gets an independent key */
function deriveChatKey(chatId: string): Uint8Array {
  const cached = keyCache.get(chatId);
  if (cached) return cached;

  const key = hkdf(sha256, encoder.encode(APP_SECRET_SALT), encoder.encode('budmo/chat-key/v2'), encoder.encode(chatId), 32);
  keyCache.set(chatId, key);
  return key;
}

/** Former scheme (v1), only to read messages written before v2 */
function deriveLegacyChatKey(chatId: string): Uint8Array {
  const cached = legacyKeyCache.get(chatId);
  if (cached) return cached;

  const key = pbkdf2(sha256, encoder.encode(`${APP_SECRET_SALT}::${chatId}`), encoder.encode(`salt_${chatId}`), {
    c: PBKDF2_ITERATIONS,
    dkLen: 32,
  });
  legacyKeyCache.set(chatId, key);
  return key;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const cryptoService = {
  isEncrypted(payload: string): boolean {
    return typeof payload === 'string' && (payload.startsWith('enc:v1:') || payload.startsWith('enc:v2:'));
  },

  async encryptMessage(plaintext: string, chatId: string): Promise<string> {
    if (!plaintext) return '';
    const key = deriveChatKey(chatId);
    const iv = getRandomBytes(12);
    const encrypted = gcm(key, iv).encrypt(encoder.encode(plaintext));
    return `enc:${CURRENT_VERSION}:${bytesToBase64(iv)}:${bytesToBase64(encrypted)}`;
  },

  async decryptMessage(encryptedPayload: string, chatId: string): Promise<string> {
    if (!encryptedPayload) return '';
    // Backward compatibility: plaintext messages written before encryption was added
    if (!this.isEncrypted(encryptedPayload)) return encryptedPayload;

    try {
      const parts = encryptedPayload.split(':');
      if (parts[2] === 'fallback' && parts[3]) {
        // Legacy obfuscated payloads written when WebCrypto was unavailable
        return decodeURIComponent(atob(parts[3]));
      }
      if (parts.length === 4) {
        const key = parts[1] === 'v2' ? deriveChatKey(chatId) : deriveLegacyChatKey(chatId);
        const decrypted = gcm(key, base64ToBytes(parts[2])).decrypt(base64ToBytes(parts[3]));
        return decoder.decode(decrypted);
      }
    } catch (err) {
      console.warn('Decryption failed for payload:', err);
      return ph('🔒 [Не вдалося розшифрувати повідомлення]');
    }

    return encryptedPayload;
  },

  /** Human-verifiable fingerprint of the room key material, shown in the security inspector */
  getRoomFingerprint(chatId: string): {
    algorithm: string;
    protocol: string;
    fingerprint: string;
    keyLength: string;
  } {
    let hash = 0;
    const str = `${APP_SECRET_SALT}#${chatId}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
    const formatted = `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${chatId.replace(/\D/g, '').slice(-4).padStart(4, '7')}`;

    return {
      algorithm: 'AES-GCM',
      keyLength: '256-bit',
      protocol: 'AES-GCM at-rest encryption',
      fingerprint: formatted,
    };
  },
};
