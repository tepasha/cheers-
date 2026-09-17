import { AuthUser } from '../types';

const STORAGE_KEY = 'budmo_auth_user';

export const KNOWN_GOOGLE_ACCOUNTS = [
  {
    email: 'tepasha.90@gmail.com',
    name: 'Павло',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
    googleId: '109847291048291048123',
  },
  {
    email: 'andrii.dev@gmail.com',
    name: 'Андрій Коваль',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    googleId: '108472910482910484556',
  },
];

export const DEFAULT_AUTH_USER: AuthUser = {
  id: 'usr_tepasha_90',
  name: 'Павло',
  email: 'tepasha.90@gmail.com',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  provider: 'google',
  googleId: '109847291048291048123',
  isLoggedIn: true,
  emailVerified: true,
  accessToken: 'ya29.a0AfH6SMD_budmo_google_oauth_token_' + Math.random().toString(36).substring(2, 9),
  joinedAt: 'Вересень 2026',
};

export const GUEST_USER: AuthUser = {
  id: 'guest_' + Math.random().toString(36).substring(2, 9),
  name: 'Гість',
  email: '',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
  provider: 'guest',
  isLoggedIn: false,
  emailVerified: false,
};

export const authService = {
  getStoredUser(): AuthUser {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Ignore localStorage errors
    }
    return DEFAULT_AUTH_USER;
  },

  saveUser(user: AuthUser): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore
    }
  },

  async loginWithGoogle(emailInput?: string, nameInput?: string, avatarInput?: string): Promise<AuthUser> {
    // Simulate brief network roundtrip for Google Identity Services / OAuth
    await new Promise((resolve) => setTimeout(resolve, 600));

    const email = emailInput || 'tepasha.90@gmail.com';
    let name = nameInput;
    if (!name) {
      const prefix = email.split('@')[0].replace('.', ' ');
      name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }

    const matchedAccount = KNOWN_GOOGLE_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.toLowerCase()
    );

    const avatar =
      avatarInput ||
      matchedAccount?.avatar ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=f59e0b`;

    const user: AuthUser = {
      id: `usr_google_${Math.random().toString(36).substring(2, 10)}`,
      name,
      email,
      avatar,
      provider: 'google',
      googleId: matchedAccount?.googleId || `10${Math.floor(10000000000000000 + Math.random() * 90000000000000000)}`,
      isLoggedIn: true,
      emailVerified: true,
      accessToken: 'ya29.a0AfH6SMD_budmo_google_oauth_' + Math.random().toString(36).substring(2, 10),
      joinedAt: 'Вересень 2026',
    };

    this.saveUser(user);
    return user;
  },

  logout(): AuthUser {
    const guest = { ...GUEST_USER, id: 'guest_' + Math.random().toString(36).substring(2, 9) };
    this.saveUser(guest);
    return guest;
  },
};
