/**
 * The sign-in form shows errors about what the person typed under the field, and only the rest (network, server,
 * configuration) on the full error screen.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({ auth: {}, functions: {}, db: {} }));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));
vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: vi.fn() },
  reauthenticateWithCredential: vi.fn(),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  getAdditionalUserInfo: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock('@/services/googleSignIn', () => ({}));
vi.mock('@/services/appleSignIn', () => ({}));
vi.mock('@/services/firestoreSyncService', () => ({ firestoreSyncService: {} }));

import { authErrorField } from '@/services/authService';

describe('authErrorField', () => {
  it('puts a taken email under the email field', () => {
    expect(authErrorField({ code: 'auth/email-already-in-use' })).toBe('email');
  });

  it('puts wrong credentials, a weak password and rate limiting under the password field', () => {
    for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/weak-password', 'auth/too-many-requests']) {
      expect(authErrorField({ code })).toBe('password');
    }
  });

  it('leaves network, server and unknown errors to the error screen', () => {
    for (const err of [{ code: 'auth/network-request-failed' }, { code: 'functions/not-found' }, { code: 'permission-denied' }, new Error('boom'), null]) {
      expect(authErrorField(err)).toBeNull();
    }
  });
});
