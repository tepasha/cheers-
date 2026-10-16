import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEncryptedStorage, createSplitStorage, nobleAead, preferring, type KeyVault } from './secureStorage';
import { nativeAead } from './nativeAead';
import { secureRandomBytes } from '../utils/secureRandom';

const KEY_NAME = 'budmo.persist.key.v1';

// Not migrated to a new device or restored from a backup: the cache is rebuilt from Firestore instead
const vault: KeyVault = {
  get: () => SecureStore.getItemAsync(KEY_NAME),
  set: (value) => SecureStore.setItemAsync(KEY_NAME, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
};

/**
 * Each entry encrypted on its own (key held in the keystore); the chats are saved through it one thread per entry.
 * The platform's AES-GCM does the work off the JS thread; the JS one stands in if that call ever fails.
 */
export const encryptedEntryStorage = createEncryptedStorage(AsyncStorage, vault, secureRandomBytes, preferring(nativeAead, nobleAead));

/** The storage the app persists its Redux state to: AsyncStorage, one encrypted entry per slice (key held in the keystore) */
export const encryptedAsyncStorage = createSplitStorage(encryptedEntryStorage);
