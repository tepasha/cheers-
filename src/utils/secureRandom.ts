import { getRandomValues } from 'expo-crypto';

/** No dev/debug Math.random fallback; missing native/Web Crypto is an explicit error. */
export const secureRandomBytes = (length: number): Uint8Array => getRandomValues(new Uint8Array(length));
