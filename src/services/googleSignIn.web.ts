import { GoogleAuthProvider, signInWithPopup, type Auth, type UserCredential } from 'firebase/auth';

/** Browser build: Firebase's own Google popup (no native module, no client ids needed beyond the Firebase project) */
export class GoogleSignInError extends Error {
  constructor(public code: 'google/not-configured' | 'google/development-build' | 'google/play-services' | 'google/no-token', message: string) {
    super(message);
  }
}

export async function signInWithGoogle(auth: Auth): Promise<UserCredential | null> {
  try {
    return await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
    throw err;
  }
}
