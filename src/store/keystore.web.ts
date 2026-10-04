import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSplitStorage } from './secureStorage';

/**
 * Browser build: there is no OS keystore to hold an encryption key (expo-secure-store is native only), and a key kept
 * in localStorage next to the data would protect nothing. The state is stored per slice but unencrypted; this build
 * is for previews and development, not for the stores.
 */
export const encryptedAsyncStorage = createSplitStorage(AsyncStorage);
