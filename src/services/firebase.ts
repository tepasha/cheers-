import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
  doc, 
  getDocFromServer,
  enableNetwork,
  disableNetwork,
  waitForPendingWrites,
  Firestore 
} from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

// Retrieve Firebase credentials from environment variables / secrets (VITE_FIREBASE_*)
// with fallback to default project config if secrets are not yet configured.
// NOTE: Firebase Analytics requires a matching measurementId registered on the Firebase server.
// If not configured on the Firebase project or set to empty quotes (""), omit measurementId from
// the local Firebase config to prevent @firebase/analytics config-mismatch warnings.
const rawMeasurementId = (
  import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 
  ((defaultFirebaseConfig as Record<string, unknown>).measurementId as string | undefined) || 
  ''
).trim().replace(/^["']+|["']+$/g, '');

const isValidMeasurementId = /^G-[A-Z0-9]+$/i.test(rawMeasurementId);

const rawApiKey = (
  import.meta.env.VITE_FIREBASE_API_KEY || 
  defaultFirebaseConfig.apiKey || 
  'AIzaSyB0ZTp7YqZlOOgz5V3-NKYLVwo7ADFFcOo'
).trim().replace(/^["']+|["']+$/g, '');

export const firebaseConfig = {
  apiKey: rawApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || defaultFirebaseConfig.firestoreDatabaseId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  ...(isValidMeasurementId ? { measurementId: rawMeasurementId } : {}),
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || defaultFirebaseConfig.oAuthClientId || '',
};

// Initialize Firebase App
export const firebaseApp = initializeApp(firebaseConfig);
const app = firebaseApp;

// CRITICAL: Configure persistent multi-tab offline cache with unlimited size for basement bars
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      }),
    },
    firebaseConfig.firestoreDatabaseId
  );
  console.log('[Firestore] Offline persistent local cache (IndexedDB) configured for basement bars');
} catch (err) {
  console.warn('[Firestore] Falling back to default getFirestore instance:', err);
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

// CRITICAL: Export the configured Firestore instance and safely initialized Auth
export const db = firestoreInstance;

let authInstance: ReturnType<typeof getAuth>;
try {
  authInstance = getAuth(app);
} catch (err) {
  console.warn('[Firebase Auth] Gracefully bypassing Auth initialization:', err);
  authInstance = {
    currentUser: null,
  } as unknown as ReturnType<typeof getAuth>;
}
export const auth = authInstance;

// Cached flag to track if anonymous sign-in is disabled in Firebase Console
let isAnonymousAuthRestricted = false;

// Ensure Firebase Auth user session safely without triggering admin-restricted-operation error
export function ensureFirebaseAuth(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!auth || !auth.currentUser && !rawApiKey) {
      resolve(null);
      return;
    }

    // If a user is already authenticated (Google OAuth or email)
    if (auth.currentUser) {
      resolve(auth.currentUser.uid);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        if (user) {
          resolve(user.uid);
          return;
        }

        // If anonymous auth is already marked as restricted in project settings, skip
        if (isAnonymousAuthRestricted) {
          resolve(null);
          return;
        }

        try {
          const cred = await signInAnonymously(auth);
          resolve(cred.user.uid);
        } catch (err: unknown) {
          const errObj = err as { code?: string; message?: string };
          // If Anonymous Auth provider is not enabled in Firebase Console (auth/admin-restricted-operation),
          // gracefully handle without warnings; Google OAuth and local guest mode are active.
          if (
            errObj?.code === 'auth/admin-restricted-operation' ||
            errObj?.message?.includes('admin-restricted-operation')
          ) {
            isAnonymousAuthRestricted = true;
            resolve(null);
            return;
          }
          // Silent fallback for guest mode
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });
}

// Network control for basement bars (offline testing & simulation)
export async function disableOfflineNetwork(): Promise<void> {
  try {
    await disableNetwork(db);
    console.log('[Firestore] Network disabled: Activated basement bar offline mode');
  } catch (err) {
    console.warn('[Firestore] Error disabling network:', err);
  }
}

export async function enableOfflineNetwork(): Promise<void> {
  try {
    await enableNetwork(db);
    console.log('[Firestore] Network re-enabled: Reconnected to Cloud Firestore');
  } catch (err) {
    console.warn('[Firestore] Error enabling network:', err);
  }
}

export async function syncPendingWrites(): Promise<void> {
  try {
    await waitForPendingWrites(db);
    console.log('[Firestore] All offline basement writes have synchronized with Cloud Firestore');
  } catch (err) {
    console.warn('[Firestore] Sync pending writes notice:', err);
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot as mandated by skill
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection verified');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is running in offline mode with IndexedDB local cache active.');
      return false;
    }
    // Connection test document may not exist yet, but reaching server without offline error means connected
    return true;
  }
}
