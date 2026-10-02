import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
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
