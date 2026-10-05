import { describe, it, expect, vi, beforeEach } from 'vitest';

const credentialFromToken = vi.fn((token: string) => ({ token }));
const signInWithCredential = vi.fn();
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: { credential: (t: string) => credentialFromToken(t) },
  signInWithCredential: (...args: unknown[]) => signInWithCredential(...args),
}));

const extra: { google?: { webClientId?: string; iosClientId?: string } } = {};
vi.mock('expo-constants', () => ({ default: { get expoConfig() { return { extra }; } } }));

const configure = vi.fn();
const hasPlayServices = vi.fn().mockResolvedValue(true);
const signIn = vi.fn();
const statusCodes = { SIGN_IN_CANCELLED: 'CANCELLED', IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'NO_PLAY' };
vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure, hasPlayServices, signIn },
  statusCodes,
  isErrorWithCode: (e: unknown) => typeof (e as { code?: unknown })?.code === 'string',
}));

import { GoogleSignInError, signInWithGoogle } from '@/services/googleSignIn';

const auth = { name: 'auth' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  extra.google = { webClientId: 'web-id.apps.googleusercontent.com', iosClientId: 'ios-id.apps.googleusercontent.com' };
});

describe('Google sign-in (native)', () => {
  it('refuses to start without a web client id, with a clear error', async () => {
    extra.google = {};
    await expect(signInWithGoogle(auth)).rejects.toMatchObject({ code: 'google/not-configured' });
    expect(signIn).not.toHaveBeenCalled();
  });

  it('configures the library with the client ids, then trades the Google ID token for a Firebase session', async () => {
    signIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token' } });
    signInWithCredential.mockResolvedValue({ user: { uid: 'u1' } });

    const result = await signInWithGoogle(auth);

    expect(configure).toHaveBeenCalledWith({ webClientId: 'web-id.apps.googleusercontent.com', iosClientId: 'ios-id.apps.googleusercontent.com' });
    expect(credentialFromToken).toHaveBeenCalledWith('google-id-token');
    expect(signInWithCredential).toHaveBeenCalledWith(auth, { token: 'google-id-token' });
    expect(result).toEqual({ user: { uid: 'u1' } });
  });

  it('closing the Google dialog is not an error', async () => {
    signIn.mockResolvedValue({ type: 'cancelled', data: null });
    expect(await signInWithGoogle(auth)).toBeNull();
    signIn.mockRejectedValue({ code: statusCodes.SIGN_IN_CANCELLED });
    expect(await signInWithGoogle(auth)).toBeNull();
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it('a second tap while the first dialog is open is ignored', async () => {
    signIn.mockRejectedValue({ code: statusCodes.IN_PROGRESS });
    expect(await signInWithGoogle(auth)).toBeNull();
  });

  it('reports missing Google Play services', async () => {
    signIn.mockRejectedValue({ code: statusCodes.PLAY_SERVICES_NOT_AVAILABLE });
    await expect(signInWithGoogle(auth)).rejects.toMatchObject({ code: 'google/play-services' });
  });

  it('refuses a response without an ID token', async () => {
    signIn.mockResolvedValue({ type: 'success', data: { idToken: null } });
    await expect(signInWithGoogle(auth)).rejects.toBeInstanceOf(GoogleSignInError);
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it('lets Firebase errors through (e.g. the account is disabled)', async () => {
    signIn.mockResolvedValue({ type: 'success', data: { idToken: 't' } });
    signInWithCredential.mockRejectedValue({ code: 'auth/user-disabled' });
    await expect(signInWithGoogle(auth)).rejects.toMatchObject({ code: 'auth/user-disabled' });
  });
});
