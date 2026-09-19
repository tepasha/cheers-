import { AuthUser } from '../types';
import { calculateAge } from '../utils/ageUtils';

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

export const SESSION_DURATION_HOURS = 36;
export const SESSION_DURATION_MS = SESSION_DURATION_HOURS * 60 * 60 * 1000; // 36 hours = 129,600,000 ms

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
  sessionExpiresAt: Date.now() + SESSION_DURATION_MS,
  lastActiveAt: Date.now(),
  birthDate: '1998-05-15',
  age: 28,
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
  SESSION_DURATION_HOURS,
  SESSION_DURATION_MS,

  getStoredUser(): AuthUser {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const user: AuthUser = JSON.parse(data);
        if (user.isLoggedIn) {
          // Check if the 36-hour session has expired
          if (user.sessionExpiresAt && Date.now() > user.sessionExpiresAt) {
            return this.logout();
          }
          // Initialize session expiration if missing
          if (!user.sessionExpiresAt) {
            user.sessionExpiresAt = Date.now() + SESSION_DURATION_MS;
            user.lastActiveAt = Date.now();
            this.saveUser(user);
          }
          // Dynamically compute age from birthDate
          if (user.birthDate) {
            const freshAge = calculateAge(user.birthDate);
            if (freshAge !== null && freshAge !== user.age) {
              user.age = freshAge;
              this.saveUser(user);
            }
          } else {
            user.birthDate = '1998-05-15';
            user.age = 28;
            this.saveUser(user);
          }
        }
        return user;
      }
    } catch {
      // Ignore localStorage errors
    }
    const defaultUser: AuthUser = {
      ...DEFAULT_AUTH_USER,
      sessionExpiresAt: Date.now() + SESSION_DURATION_MS,
      lastActiveAt: Date.now(),
    };
    this.saveUser(defaultUser);
    return defaultUser;
  },

  // Automatically extends the session by 36 hours when user opens or enters the app
  touchSession(): AuthUser {
    const user = this.getStoredUser();
    if (user.isLoggedIn) {
      if (user.sessionExpiresAt && Date.now() > user.sessionExpiresAt) {
        return this.logout();
      }
      // Automatically prolong session by 36 hours from this entry moment
      user.sessionExpiresAt = Date.now() + SESSION_DURATION_MS;
      user.lastActiveAt = Date.now();
      this.saveUser(user);
    }
    return user;
  },

  isSessionValid(): boolean {
    const user = this.getStoredUser();
    if (!user.isLoggedIn) return false;
    if (!user.sessionExpiresAt) return true;
    return Date.now() < user.sessionExpiresAt;
  },

  getRemainingSessionMs(): number {
    const user = this.getStoredUser();
    if (!user.isLoggedIn || !user.sessionExpiresAt) return 0;
    return Math.max(0, user.sessionExpiresAt - Date.now());
  },

  formatRemainingSession(expiresAt?: number): string {
    const target = expiresAt || this.getStoredUser().sessionExpiresAt;
    if (!target) return '36 годин';
    const diff = target - Date.now();
    if (diff <= 0) return 'Вичерпано';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours} год ${minutes} хв`;
    }
    return `${minutes} хв`;
  },

  saveUser(user: AuthUser): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore
    }
  },

  updateUserName(name: string): AuthUser {
    const current = this.getStoredUser();
    const updated = { 
      ...current, 
      name,
      sessionExpiresAt: Date.now() + SESSION_DURATION_MS,
      lastActiveAt: Date.now(),
    };
    this.saveUser(updated);
    return updated;
  },

  updateBirthDate(birthDate: string): AuthUser {
    const current = this.getStoredUser();
    const calculated = calculateAge(birthDate);
    const updated: AuthUser = {
      ...current,
      birthDate,
      age: calculated !== null ? calculated : current.age,
      sessionExpiresAt: Date.now() + SESSION_DURATION_MS,
      lastActiveAt: Date.now(),
    };
    this.saveUser(updated);
    return updated;
  },

  loginWithEmail(email: string, nameInput?: string, birthDateInput?: string): AuthUser {
    const extractedName = nameInput || email.split('@')[0].replace('.', ' ');
    const capitalized = extractedName.charAt(0).toUpperCase() + extractedName.slice(1);
    const calculatedAge = birthDateInput ? calculateAge(birthDateInput) : 28;
    const user: AuthUser = {
      id: `usr_email_${Date.now()}`,
      name: capitalized,
      email,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(capitalized)}&backgroundColor=f59e0b`,
      provider: 'email',
      isLoggedIn: true,
      emailVerified: true,
      joinedAt: 'Вересень 2026',
      sessionExpiresAt: Date.now() + SESSION_DURATION_MS,
      lastActiveAt: Date.now(),
      birthDate: birthDateInput || '1998-05-15',
      age: calculatedAge ?? 28,
    };
    this.saveUser(user);
    return user;
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
      sessionExpiresAt: Date.now() + SESSION_DURATION_MS,
      lastActiveAt: Date.now(),
    };

    this.saveUser(user);
    return user;
  },

  logout(): AuthUser {
    const unauthenticatedUser: AuthUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: '',
      email: '',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
      provider: 'google',
      isLoggedIn: false,
      emailVerified: false,
      sessionExpiresAt: 0,
      lastActiveAt: 0,
    };
    this.saveUser(unauthenticatedUser);
    return unauthenticatedUser;
  },
};
