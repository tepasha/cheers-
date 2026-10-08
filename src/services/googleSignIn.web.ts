import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup, type Auth, type User, type UserCredential } from 'firebase/auth';
import { fetchGoogleBirthday, GOOGLE_BIRTHDAY_SCOPE } from './googleBirthday';

/** Browser build: Firebase's own Google popup (no native module, no client ids needed beyond the Firebase project) */
export class GoogleSignInError extends Error {
  constructor(public code: 'google/not-configured' | 'google/development-build' | 'google/play-services' | 'google/no-token', message: string) {
    super(message);
  }
}

/** The browser popup needs nothing beyond the Firebase project, so it is always offered */
export function isGoogleSignInConfigured(_os: string): boolean {
  return true;
}

export async function signInWithGoogle(auth: Auth): Promise<UserCredential | null> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope(GOOGLE_BIRTHDAY_SCOPE);
    return await signInWithPopup(auth, provider);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
    throw err;
  }
}

export async function getGoogleBirthDate(credential: UserCredential): Promise<string | null> {
  return fetchGoogleBirthday(GoogleAuthProvider.credentialFromResult(credential)?.accessToken);
}

export async function reauthenticateWithGoogle(user: User): Promise<boolean> {
  try {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    return true;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return false;
    throw err;
  }
}
export async function signOutGoogle(): Promise<void> { /* Firebase owns the browser session. */ }
