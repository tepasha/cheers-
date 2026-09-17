import { describe, it, expect, beforeEach } from 'vitest';
import { authService, DEFAULT_AUTH_USER, GUEST_USER, KNOWN_GOOGLE_ACCOUNTS } from './authService';

describe('authService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return DEFAULT_AUTH_USER when nothing is stored', () => {
    const user = authService.getStoredUser();
    expect(user).toBeDefined();
    expect(user.id).toBe(DEFAULT_AUTH_USER.id);
    expect(user.email).toBe(DEFAULT_AUTH_USER.email);
    expect(user.provider).toBe('google');
  });

  it('should save and retrieve user from storage', () => {
    const customUser = {
      ...DEFAULT_AUTH_USER,
      name: 'Олександр Тест',
      email: 'alex.test@example.com',
    };
    authService.saveUser(customUser);
    const retrieved = authService.getStoredUser();
    expect(retrieved.name).toBe('Олександр Тест');
    expect(retrieved.email).toBe('alex.test@example.com');
  });

  it('should handle guest logout properly', () => {
    const guest = authService.logout();
    expect(guest.provider).toBe('guest');
    expect(guest.isLoggedIn).toBe(false);

    const stored = authService.getStoredUser();
    expect(stored.provider).toBe('guest');
    expect(stored.isLoggedIn).toBe(false);
  });

  it('should login with predefined Google accounts asynchronously', async () => {
    const target = KNOWN_GOOGLE_ACCOUNTS[0];
    const loggedIn = await authService.loginWithGoogle(target.email, target.name);
    expect(loggedIn.email).toBe(target.email);
    expect(loggedIn.name).toBe(target.name);
    expect(loggedIn.isLoggedIn).toBe(true);
    expect(loggedIn.provider).toBe('google');
    expect(loggedIn.accessToken).toContain('ya29');
  });

  it('should provide valid GUEST_USER format', () => {
    expect(GUEST_USER.provider).toBe('guest');
    expect(GUEST_USER.isLoggedIn).toBe(false);
    expect(GUEST_USER.name).toBe('Гість');
  });
});
