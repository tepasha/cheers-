import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ popup: vi.fn(), reauth: vi.fn(), birthday: vi.fn(), accessToken: 'google-access-token' }));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    scopes: string[] = [];
    addScope(scope: string) { this.scopes.push(scope); }
    static credentialFromResult() { return { accessToken: m.accessToken }; }
  },
  signInWithPopup: m.popup,
  reauthenticateWithPopup: m.reauth,
}));
vi.mock('@/services/googleBirthday', () => ({
  GOOGLE_BIRTHDAY_SCOPE: 'https://www.googleapis.com/auth/user.birthday.read',
  fetchGoogleBirthday: m.birthday,
}));

import { getGoogleBirthDate, reauthenticateWithGoogle, signInWithGoogle } from '@/services/googleSignIn.web';

beforeEach(() => { vi.clearAllMocks(); });

describe('Google birthday permission on web', () => {
  it('requests the birthday scope during sign-in and uses the OAuth access token for People API', async () => {
    const credential = { user: { uid: 'g1' } } as never;
    m.popup.mockResolvedValue(credential);
    m.birthday.mockResolvedValue('1990-05-15');
    expect(await signInWithGoogle({} as never)).toBe(credential);
    expect(m.popup.mock.calls[0][1].scopes).toEqual(['https://www.googleapis.com/auth/user.birthday.read']);
    expect(await getGoogleBirthDate(credential)).toBe('1990-05-15');
    expect(m.birthday).toHaveBeenCalledWith('google-access-token');
  });

  it('does not request birthday permission when confirming account deletion', async () => {
    m.reauth.mockResolvedValue({});
    expect(await reauthenticateWithGoogle({} as never)).toBe(true);
    expect(m.reauth.mock.calls[0][1].scopes).toEqual([]);
    expect(m.birthday).not.toHaveBeenCalled();
  });

  it('still propagates a forbidden domain instead of mistaking it for cancellation', async () => {
    m.popup.mockRejectedValue({ code: 'auth/unauthorized-domain' });
    await expect(signInWithGoogle({} as never)).rejects.toMatchObject({ code: 'auth/unauthorized-domain' });
  });
});
