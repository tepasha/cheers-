import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { toBase64, type Aead } from './secureStorage';

/**
 * AES-256-GCM of the platform (javax.crypto on Android, CryptoKit on iOS) through expo-crypto, run on a native thread
 * instead of the JS one. Same layout as @noble's gcm (12-byte IV, ciphertext with its 16-byte tag appended), so each
 * reads what the other wrote. expo-crypto with its AES module is in every build of the app already (secureRandom
 * imports it), so this needs no new native code and arrives with an OTA update.
 */
const TAG_BYTES = 16;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** The native key object, imported once per raw key */
const keys = new WeakMap<Uint8Array, Promise<AESEncryptionKey>>();
function importKey(raw: Uint8Array): Promise<AESEncryptionKey> {
  let key = keys.get(raw);
  if (!key) {
    key = AESEncryptionKey.import(raw);
    keys.set(raw, key);
    key.catch(() => keys.delete(raw));
  }
  return key;
}

// expo-crypto 57: the Android and iOS modules read the output format of ciphertext() as `outputFormat`, the web one
// and the typings as `encoding`. Both are passed, and bytes are still accepted should neither be honoured.
const TAGGED_BASE64 = { includeTag: true, encoding: 'base64' as const, outputFormat: 'base64' };

export const nativeAead: Aead = {
  async seal(key, iv, plain) {
    const sealed = await aesEncryptAsync(encoder.encode(plain), await importKey(key), { nonce: { bytes: iv } });
    const out: string | Uint8Array = await sealed.ciphertext(TAGGED_BASE64);
    return typeof out === 'string' ? out : toBase64(out);
  },
  async open(key, ivB64, sealedB64) {
    const plain = await aesDecryptAsync(AESSealedData.fromParts(ivB64, sealedB64, TAG_BYTES), await importKey(key));
    return decoder.decode(plain);
  },
};
