import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEncryptedStorage, type KeyVault } from './secureStorage';

const KEY_NAME = 'budmo.persist.key.v1';

// Not migrated to a new device or restored from a backup: the cache is rebuilt from Firestore instead
const vault: KeyVault = {
  get: () => SecureStore.getItemAsync(KEY_NAME),
  set: (value) => SecureStore.setItemAsync(KEY_NAME, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
};

/** The storage the app persists its Redux state to: AsyncStorage, encrypted with a keystore-held key */
export const encryptedAsyncStorage = createEncryptedStorage(AsyncStorage, vault);
