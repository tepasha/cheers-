import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEncryptedStorage, createSplitStorage, type KeyVault } from './secureStorage';

const KEY_NAME = 'budmo.persist.key.v1';

// Not migrated to a new device or restored from a backup: the cache is rebuilt from Firestore instead
const vault: KeyVault = {
  get: () => SecureStore.getItemAsync(KEY_NAME),
  set: (value) => SecureStore.setItemAsync(KEY_NAME, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
};

/** The storage the app persists its Redux state to: AsyncStorage, one encrypted entry per slice (key held in the keystore) */
export const encryptedAsyncStorage = createSplitStorage(createEncryptedStorage(AsyncStorage, vault));
