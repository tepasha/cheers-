import Constants from 'expo-constants';
import { GoogleAuthProvider, reauthenticateWithCredential, signInWithCredential, type Auth, type User, type UserCredential } from 'firebase/auth';

/**
 * Google sign-in on iOS / Android. The native Google dialog yields an ID token, which Firebase turns into a session
 * (and creates the account the first time). The native module is loaded lazily so that an app without it (Expo Go)
 * still starts, and the web build never touches it (googleSignIn.web.ts replaces this file there).
 */
interface GoogleExtra {
  webClientId?: string;
  iosClientId?: string;
}

export class GoogleSignInError extends Error {
  constructor(public code: 'google/not-configured' | 'google/development-build' | 'google/play-services' | 'google/no-token', message: string) {
    super(message);
  }
}

const googleExtra = (): GoogleExtra => (Constants.expoConfig?.extra?.google ?? {}) as GoogleExtra;

/**
 * Whether this build can offer Google sign-in at all. Without the web client id (and, on iOS, the iOS client id,
 * whose URL scheme app.config.ts registers) every tap would only end in a configuration error, so the sign-in screen
 * hides the button instead. Release builds always have both (scripts/release-check.mjs --env).
 */
export function isGoogleSignInConfigured(os: string): boolean {
  const { webClientId, iosClientId } = googleExtra();
  return !!webClientId && (os !== 'ios' || !!iosClientId);
}

/** The Google dialog's ID token, or null when the person closed it */
async function googleIdToken(): Promise<string | null> {
  const { webClientId, iosClientId } = googleExtra();
  if (!webClientId) throw new GoogleSignInError('google/not-configured', 'GOOGLE_WEB_CLIENT_ID is not set');

  let lib: typeof import('@react-native-google-signin/google-signin');
  try {
    lib = await import('@react-native-google-signin/google-signin');
  } catch {
    throw new GoogleSignInError('google/development-build', 'The Google sign-in native module is missing (Expo Go?)');
  }
  const { GoogleSignin, statusCodes, isErrorWithCode } = lib;

  GoogleSignin.configure({ webClientId, iosClientId });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return null; // the user closed the dialog
    const idToken = response.data.idToken;
    if (!idToken) throw new GoogleSignInError('google/no-token', 'Google returned no ID token');
    return idToken;
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS) return null;
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new GoogleSignInError('google/play-services', 'Google Play services are not available');
    }
    throw err;
  }
}

export async function signInWithGoogle(auth: Auth): Promise<UserCredential | null> {
  const idToken = await googleIdToken();
  return idToken ? signInWithCredential(auth, GoogleAuthProvider.credential(idToken)) : null;
}

export async function signOutGoogle(): Promise<void> {
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    // Expo Go or an unavailable native provider must not prevent Firebase sign-out.
  }
}

/**
 * Confirms that the person holding the phone owns the Google account (a fresh sign-in), as required before deleting
 * the account. Returns false when they closed the Google dialog.
 */
export async function reauthenticateWithGoogle(user: User): Promise<boolean> {
  const idToken = await googleIdToken();
  if (!idToken) return false;
  await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
  return true;
}
