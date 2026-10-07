import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  OAuthProvider,
  reauthenticateWithCredential,
  revokeAccessToken,
  signInWithCredential,
  updateProfile,
  type Auth,
  type User,
  type UserCredential,
} from 'firebase/auth';

/**
 * Sign in with Apple (iOS). App Store Guideline 4.8: an app that offers a third-party login (here Google) must also
 * offer an equally private one, and Sign in with Apple is that. Apple's ID token goes to Firebase the same way as
 * Google's, so the account, the birth-date step and the age gate work exactly as for Google. The web build replaces
 * this file (appleSignIn.web.ts); Android does not offer it.
 */

export class AppleSignInError extends Error {
  constructor(public code: 'apple/no-token', message: string) {
    super(message);
  }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

interface AppleResult {
  idToken: string;
  rawNonce: string;
  authorizationCode: string | null;
  /** Apple shares the name only on the very first sign-in, and only if the person allows it */
  fullName: string;
}

/** Apple's dialog. Null when the person closed it. The nonce ties Apple's token to this one request (anti-replay). */
async function askApple(): Promise<AppleResult | null> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const result = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!result.identityToken) throw new AppleSignInError('apple/no-token', 'Apple returned no identity token');
    const fullName = [result.fullName?.givenName, result.fullName?.familyName].filter(Boolean).join(' ').trim();
    return { idToken: result.identityToken, rawNonce, authorizationCode: result.authorizationCode, fullName };
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw err;
  }
}

const credentialOf = (r: AppleResult) => new OAuthProvider('apple.com').credential({ idToken: r.idToken, rawNonce: r.rawNonce });

export async function signInWithApple(auth: Auth): Promise<{ cred: UserCredential; fullName: string } | null> {
  const apple = await askApple();
  if (!apple) return null;
  const cred = await signInWithCredential(auth, credentialOf(apple));
  if (apple.fullName && !cred.user.displayName) await updateProfile(cred.user, { displayName: apple.fullName.slice(0, 60) }).catch(() => {});
  return { cred, fullName: apple.fullName };
}

/**
 * Confirms it is the account's owner before deleting the account, and revokes the app's Sign in with Apple tokens:
 * Apple requires an app that deletes an account to revoke them too. Returns false when the dialog was closed.
 */
export async function reauthenticateWithApple(auth: Auth, user: User): Promise<boolean> {
  const apple = await askApple();
  if (!apple) return false;
  await reauthenticateWithCredential(user, credentialOf(apple));
  if (apple.authorizationCode) await revokeAccessToken(auth, apple.authorizationCode);
  return true;
}
