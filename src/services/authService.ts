import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  getAdditionalUserInfo,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getGoogleBirthDate, reauthenticateWithGoogle, signInWithGoogle } from './googleSignIn';
import { signOutGoogle } from './googleSignIn';
import { reauthenticateWithApple, signInWithApple } from './appleSignIn';
import { auth, functions } from './firebase';
import { firestoreSyncService } from './firestoreSyncService';
import { ph } from './i18nService';

/** Maps Firebase Auth error codes to messages for the user. Deliberately vague where it avoids account enumeration. */
export function describeAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return ph('Невірний email або пароль');
    case 'auth/email-already-in-use':
      return ph('Акаунт із таким email уже існує. Спробуйте увійти');
    case 'auth/weak-password':
      return ph('Пароль занадто простий');
    case 'auth/too-many-requests':
      return ph('Забагато спроб. Зачекайте кілька хвилин і спробуйте знову');
    case 'auth/network-request-failed':
      return ph('Немає зв’язку з мережею');
    case 'auth/user-disabled':
      return ph('Цей акаунт заблоковано');
    case 'auth/requires-recent-login':
      return ph('Підтвердіть пароль ще раз');
    case 'auth/operation-not-allowed':
      return ph('Цей спосіб входу вимкнений у проєкті Firebase');
    case 'auth/unauthorized-domain':
      return ph('Цей домен не дозволений для входу. Додайте його до Authorized domains у Firebase Authentication');
    case 'auth/popup-blocked':
      return ph('Браузер заблокував вікно входу. Дозвольте спливні вікна для цього сайту');
    case 'auth/auth-domain-config-required':
      return ph('Не налаштовано домен авторизації Firebase (FIREBASE_AUTH_DOMAIN)');
    case 'auth/operation-not-supported-in-this-environment':
      return ph('Вхід недоступний у цьому вікні. Відкрийте застосунок в окремому браузері');
    case '10':
    case 'DEVELOPER_ERROR':
      return ph('Помилка налаштування Google: перевірте OAuth Client ID, назву пакета та SHA-1 сертифіката цієї збірки');
    case 'auth/account-exists-with-different-credential':
      return ph('Акаунт із таким email уже існує. Увійдіть за паролем');
    case 'google/not-configured':
      return ph('Вхід через Google не налаштовано (потрібен GOOGLE_WEB_CLIENT_ID)');
    case 'google/development-build':
      return ph('Вхід через Google працює лише в зібраному застосунку, не в Expo Go');
    case 'google/play-services':
      return ph('Потрібні служби Google Play');
    case 'google/no-token':
      return ph('Google не підтвердив вхід. Перевірте GOOGLE_WEB_CLIENT_ID');
    case 'apple/no-token':
      return ph('Apple не підтвердив вхід. Спробуйте ще раз');
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return ph('Немає зв’язку з мережею');
    default:
      return ph('Не вдалося виконати дію. Спробуйте пізніше');
  }
}

/** Codes the UI treats as "the person changed their mind", not as an error */
export const CANCELLED = 'auth/cancelled';

const withCode = (code: string, message = code) => Object.assign(new Error(message), { code });

/**
 * Asks the server to delete the account and everything that belongs to it (functions/src/account.ts). The server
 * refuses when the sign-in is not recent; that comes back as auth/requires-recent-login, like Firebase's own check.
 */
async function deleteOnServer(): Promise<void> {
  try {
    await httpsCallable(functions, 'deleteMyAccount')();
  } catch (err) {
    const { code, message } = err as { code?: string; message?: string };
    if (code === 'functions/failed-precondition' && message === 'requires-recent-login') throw withCode('auth/requires-recent-login');
    throw err;
  }
}

/** How this account proves it is its owner again: a password if it has one, otherwise the provider it signed in with */
const reauthMethodOf = (user: User): 'password' | 'apple' | 'google' => {
  const ids = user.providerData.map((p) => p.providerId);
  if (ids.includes('password')) return 'password';
  return ids.includes('apple.com') ? 'apple' : ids.includes('google.com') ? 'google' : 'password';
};

const requireUser = (): User => {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/requires-recent-login' });
  return user;
};

export const authService = {
  async completeOnboarding(birthDate: string): Promise<void> {
    const user = requireUser();
    await httpsCallable(functions, 'completeOnboarding')({ birthDate, termsAccepted: true });
    await user.getIdToken(true);
  },

  async updatePersonalProfile(name: string, birthDate?: string): Promise<void> {
    const user = requireUser();
    if (birthDate) await authService.completeOnboarding(birthDate);
    await updateProfile(user, { displayName: name.trim().slice(0, 60) });
    await firestoreSyncService.saveUserProfile({ id: user.uid, name: name.trim().slice(0, 60) });
  },
  /** Creates the account, stores the private profile and sends the verification email */
  async register(input: { email: string; password: string; name: string; birthDate: string }): Promise<User> {
    const email = input.email.trim();
    const cred = await createUserWithEmailAndPassword(auth, email, input.password);
    await updateProfile(cred.user, { displayName: input.name.trim().slice(0, 60) || undefined });
    // Private data first: it needs no verified email, and the public profile is published after verification
    await firestoreSyncService.savePrivateProfile(cred.user.uid, { email, birthDate: input.birthDate });
    await authService.completeOnboarding(input.birthDate);
    await sendEmailVerification(cred.user);
    return cred.user;
  },

  async login(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  },

  /**
   * Google sign-in. A person who has no account yet gets one automatically (Firebase creates it on the first sign-in).
   * Returns null when the user closed the Google dialog. The age check happens after sign-in, in the app.
   */
  async loginWithGoogle(): Promise<{ user: User; isNewUser: boolean; birthDate: string | null } | null> {
    const cred = await signInWithGoogle(auth);
    if (!cred) return null;
    const birthDate = await getGoogleBirthDate(cred);
    return { user: cred.user, isNewUser: getAdditionalUserInfo(cred)?.isNewUser === true, birthDate };
  },

  /**
   * Sign in with Apple (iOS). Like Google: a new person gets an account, and the app asks for the birth date next.
   * Apple shares the name only the first time, so it is handed back for the profile.
   */
  async loginWithApple(): Promise<{ user: User; isNewUser: boolean; fullName: string } | null> {
    const result = await signInWithApple(auth);
    if (!result) return null;
    return { user: result.cred.user, isNewUser: getAdditionalUserInfo(result.cred)?.isNewUser === true, fullName: result.fullName };
  },

  /**
   * Removes the account that has just signed in and turned out to be too young: its data and the Firebase user.
   * Deletion still requires a recent sign-in. If it expired, sign out and let support handle a verified request.
   */
  async removeAccountAfterAgeRejection(): Promise<void> {
    const owner = auth.currentUser?.uid;
    if (!owner) return;
    try {
      await deleteOnServer();
    } catch (err) {
      console.warn('Could not remove the underage account, signing out instead:', err);
    }
    if (auth.currentUser?.uid === owner) await signOut(auth).catch(() => {});
  },

  async logout(expectedUid?: string): Promise<void> {
    if (expectedUid && auth.currentUser?.uid !== expectedUid) return;
    await signOutGoogle();
    if (expectedUid && auth.currentUser?.uid !== expectedUid) return;
    await signOut(auth);
  },

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email.trim());
  },

  async resendVerification(): Promise<void> {
    await sendEmailVerification(requireUser());
  },

  /**
   * Re-reads the account after the user tapped the link in the email. The ID token is force-refreshed
   * because Firestore rules read `email_verified` from it, not from the local user object.
   */
  async refreshVerification(): Promise<boolean> {
    const user = requireUser();
    await user.reload();
    await user.getIdToken(true);
    return user.emailVerified;
  },

  /**
   * Permanently deletes the account (App Store / Google Play requirement), for every sign-in method: the person first
   * proves it is them again (their password, or the Google dialog for a Google account), then the server removes their
   * data everywhere and the account itself. Throws CANCELLED when they closed the Google dialog.
   */
  async deleteAccount(password?: string): Promise<void> {
    const user = requireUser();
    const method = reauthMethodOf(user);
    if (method === 'google') {
      if (!(await reauthenticateWithGoogle(user))) throw withCode(CANCELLED);
    } else if (method === 'apple') {
      // Also revokes the app's Sign in with Apple tokens, as Apple requires on account deletion
      if (!(await reauthenticateWithApple(auth, user))) throw withCode(CANCELLED);
    } else {
      if (!user.email || !password) throw withCode('auth/requires-recent-login');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    }
    await deleteOnServer();
    // The account no longer exists on the server; drop the local session too
    await signOut(auth).catch(() => {});
  },
};
