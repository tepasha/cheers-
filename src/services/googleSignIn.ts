import Constants from 'expo-constants';
import { GoogleAuthProvider, signInWithCredential, type Auth, type UserCredential } from 'firebase/auth';

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

export async function signInWithGoogle(auth: Auth): Promise<UserCredential | null> {
  const { webClientId, iosClientId } = (Constants.expoConfig?.extra?.google ?? {}) as GoogleExtra;
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
    return await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS) return null;
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new GoogleSignInError('google/play-services', 'Google Play services are not available');
    }
    throw err;
  }
}
