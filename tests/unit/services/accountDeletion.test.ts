/**
 * Deleting an account from the app, for every sign-in method (audit render-1 / firestore-1 / security-3 / auth-1 /
 * nav-5): a Google account has no password, so it confirms through the Google dialog; an email account re-enters its
 * password. Either way the server does the deletion (functions/src/account.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  currentUser: null as null | { uid: string; email: string | null; providerData: Array<{ providerId: string }> },
  callable: vi.fn(),
  reauthWithPassword: vi.fn(),
  reauthWithGoogle: vi.fn(),
  reauthWithApple: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  auth: {
    get currentUser() {
      return m.currentUser;
    },
  },
  functions: {},
  db: {},
}));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => m.callable) }));
vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: vi.fn((email: string, password: string) => ({ email, password })) },
  reauthenticateWithCredential: m.reauthWithPassword,
  signOut: m.signOut,
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  getAdditionalUserInfo: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock('@/services/googleSignIn', () => ({ signInWithGoogle: vi.fn(), reauthenticateWithGoogle: m.reauthWithGoogle }));
vi.mock('@/services/appleSignIn', () => ({ signInWithApple: vi.fn(), reauthenticateWithApple: m.reauthWithApple }));
vi.mock('@/services/firestoreSyncService', () => ({ firestoreSyncService: { savePrivateProfile: vi.fn() } }));

import { authService, CANCELLED, describeAuthError } from '@/services/authService';

const googleUser = () => ({ uid: 'g1', email: 'g1@gmail.com', providerData: [{ providerId: 'google.com' }] });
const emailUser = () => ({ uid: 'e1', email: 'e1@example.com', providerData: [{ providerId: 'password' }] });

beforeEach(() => {
  vi.clearAllMocks();
  m.callable.mockResolvedValue({ data: { ok: true } });
  m.reauthWithPassword.mockResolvedValue(undefined);
  m.reauthWithGoogle.mockResolvedValue(true);
  m.reauthWithApple.mockResolvedValue(true);
  m.signOut.mockResolvedValue(undefined);
});

describe('deleting the account', () => {
  it('a Google account confirms through Google (no password exists) and the server deletes it', async () => {
    m.currentUser = googleUser();
    await authService.deleteAccount();
    expect(m.reauthWithGoogle).toHaveBeenCalledWith(m.currentUser);
    expect(m.reauthWithPassword).not.toHaveBeenCalled();
    expect(m.callable).toHaveBeenCalledTimes(1);
    expect(m.signOut).toHaveBeenCalled();
  });

  it('closing the Google dialog cancels quietly: nothing is deleted', async () => {
    m.currentUser = googleUser();
    m.reauthWithGoogle.mockResolvedValue(false);
    await expect(authService.deleteAccount()).rejects.toMatchObject({ code: CANCELLED });
    expect(m.callable).not.toHaveBeenCalled();
  });

  it('an Apple account confirms through Apple (which also revokes the Apple tokens), not Google or a password', async () => {
    m.currentUser = { uid: 'a1', email: 'x@privaterelay.appleid.com', providerData: [{ providerId: 'apple.com' }] };
    await authService.deleteAccount();
    expect(m.reauthWithApple).toHaveBeenCalledTimes(1);
    expect(m.reauthWithGoogle).not.toHaveBeenCalled();
    expect(m.reauthWithPassword).not.toHaveBeenCalled();
    expect(m.callable).toHaveBeenCalledTimes(1);
  });

  it('closing the Apple dialog cancels quietly', async () => {
    m.currentUser = { uid: 'a1', email: null, providerData: [{ providerId: 'apple.com' }] };
    m.reauthWithApple.mockResolvedValue(false);
    await expect(authService.deleteAccount()).rejects.toMatchObject({ code: CANCELLED });
    expect(m.callable).not.toHaveBeenCalled();
  });

  it('an account with a password AND Google uses the password', async () => {
    m.currentUser = { uid: 'e2', email: 'e2@example.com', providerData: [{ providerId: 'google.com' }, { providerId: 'password' }] };
    await authService.deleteAccount('secret');
    expect(m.reauthWithPassword).toHaveBeenCalled();
    expect(m.reauthWithGoogle).not.toHaveBeenCalled();
  });

  it('an email account re-enters its password first', async () => {
    m.currentUser = emailUser();
    await authService.deleteAccount('secret');
    expect(m.reauthWithPassword).toHaveBeenCalledWith(m.currentUser, { email: 'e1@example.com', password: 'secret' });
    expect(m.callable).toHaveBeenCalledTimes(1);
  });

  it('a wrong password stops before the server is asked', async () => {
    m.currentUser = emailUser();
    m.reauthWithPassword.mockRejectedValue(Object.assign(new Error('bad'), { code: 'auth/invalid-credential' }));
    await expect(authService.deleteAccount('wrong')).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    expect(m.callable).not.toHaveBeenCalled();
  });

  it('the server refusing a stale sign-in comes back as Firebase\'s own requires-recent-login', async () => {
    m.currentUser = emailUser();
    m.callable.mockRejectedValue(Object.assign(new Error('requires-recent-login'), { code: 'functions/failed-precondition' }));
    const err = await authService.deleteAccount('secret').catch((e) => e);
    expect(err.code).toBe('auth/requires-recent-login');
    expect(m.signOut).not.toHaveBeenCalled(); // still signed in: the person can try again
  });

  it('no network reads as such', () => {
    expect(describeAuthError({ code: 'functions/unavailable' })).toBe('Немає зв’язку з мережею');
  });
});

describe('removing an under-21 account', () => {
  it('asks the server, and signs out whatever happens', async () => {
    m.currentUser = googleUser();
    await authService.removeAccountAfterAgeRejection();
    expect(m.callable).toHaveBeenCalledTimes(1);
    expect(m.signOut).toHaveBeenCalledTimes(1);

    m.callable.mockRejectedValue(new Error('offline'));
    await authService.removeAccountAfterAgeRejection();
    expect(m.signOut).toHaveBeenCalledTimes(2);
  });
});
