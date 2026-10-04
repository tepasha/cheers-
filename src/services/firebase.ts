import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * The Firebase config is not stored in the repository: app.config.ts reads it from the environment (`.env` locally,
 * EAS variables in the cloud) into `extra.firebase`. A web API key is not a secret in the cryptographic sense (it
 * ships inside every build); access is enforced by firestore.rules and the key's restrictions in Google Cloud.
 */
interface FirebaseExtra {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  firestoreDatabaseId?: string;
}
const extra = (Constants.expoConfig?.extra?.firebase ?? {}) as FirebaseExtra;

const missing = (['apiKey', 'projectId', 'appId'] as const).filter((k) => !extra[k]);

/**
 * False when the environment holds no Firebase config (a fresh checkout, a web preview without secrets). The app then
 * still starts, in demo mode: the sign-in screen explains what is missing and no request ever reaches a real project.
 */
export const firebaseConfigured = missing.length === 0;
if (!firebaseConfigured) {
  console.warn(`Firebase is not configured (missing: ${missing.join(', ')}). Fill in .env (see .env.example) and restart with \`npx expo start -c\`.`);
}

// Inert placeholders so the SDK objects exist; sign-in is refused before any call is made (see AuthScreen)
const DEMO_CONFIG = { apiKey: 'demo-not-configured', projectId: 'demo-not-configured', appId: '1:0:web:demo' };

export const firebaseConfig = firebaseConfigured
  ? {
      apiKey: extra.apiKey,
      authDomain: extra.authDomain,
      projectId: extra.projectId,
      appId: extra.appId,
      storageBucket: extra.storageBucket,
      messagingSenderId: extra.messagingSenderId,
    }
  : DEMO_CONFIG;

const firestoreDatabaseId = extra.firestoreDatabaseId || '(default)';

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Firestore's persistent (IndexedDB) cache is web-only; on React Native the SDK keeps an
// in-memory cache and the Redux persisted store is the offline source of truth.
// Long polling auto-detection avoids WebChannel stalls on some mobile networks/proxies.
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true, ignoreUndefinedProperties: true }, firestoreDatabaseId);
} catch {
  // Already initialised (e.g. Fast Refresh)
  firestoreInstance = getFirestore(firebaseApp, firestoreDatabaseId);
}
export const db = firestoreInstance;

let authInstance: Auth;
try {
  authInstance = initializeAuth(firebaseApp, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  authInstance = getAuth(firebaseApp);
}
export const auth = authInstance;

/** Resolves true when the Firestore backend answers, false when the client is offline */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      return false;
    }
    // The probe document may not exist / be readable, but reaching the server means we are online
    return true;
  }
}
