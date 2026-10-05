import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  getAdditionalUserInfo,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { signInWithGoogle } from './googleSignIn';
import { auth } from './firebase';
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
      return ph('Вхід за email вимкнений у проєкті Firebase');
    case 'auth/account-exists-with-different-credential':
      return ph('Акаунт із таким email уже існує. Увійдіть за паролем');
    case 'google/not-configured':
      return ph('Вхід через Google не налаштовано (потрібен GOOGLE_WEB_CLIENT_ID)');
    case 'google/development-build':
      return ph('Вхід через Google працює лише в зібраному застосунку, не в Expo Go');
    case 'google/play-services':
      return ph('Потрібні служби Google Play');
    default:
      return ph('Не вдалося виконати дію. Спробуйте пізніше');
  }
}

const requireUser = (): User => {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/requires-recent-login' });
  return user;
};

export const authService = {
  /** Creates the account, stores the private profile and sends the verification email */
  async register(input: { email: string; password: string; name: string; birthDate: string }): Promise<User> {
    const email = input.email.trim();
    const cred = await createUserWithEmailAndPassword(auth, email, input.password);
    await updateProfile(cred.user, { displayName: input.name.trim() || undefined });
    // Private data first: it needs no verified email, and the public profile is published after verification
    await firestoreSyncService.savePrivateProfile(cred.user.uid, { email, birthDate: input.birthDate });
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
  async loginWithGoogle(): Promise<{ user: User; isNewUser: boolean } | null> {
    const cred = await signInWithGoogle(auth);
    if (!cred) return null;
    return { user: cred.user, isNewUser: getAdditionalUserInfo(cred)?.isNewUser === true };
  },

  /**
   * Removes the account that has just signed in and turned out to be too young: its data and the Firebase user.
   * The sign-in is seconds old, so no re-authentication is needed; if deleting still fails, the session is ended.
   */
  async removeAccountAfterAgeRejection(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await firestoreSyncService.deleteAccountData(user.uid);
      await deleteUser(user);
    } catch (err) {
      console.warn('Could not remove the underage account, signing out instead:', err);
      await signOut(auth);
    }
  },

  async logout(): Promise<void> {
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

  /** Permanently deletes the account and its Firestore data (App Store / Google Play requirement) */
  async deleteAccount(password: string): Promise<void> {
    const user = requireUser();
    if (!user.email) throw Object.assign(new Error('No email'), { code: 'auth/requires-recent-login' });
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    await firestoreSyncService.deleteAccountData(user.uid);
    await deleteUser(user);
  },
};
