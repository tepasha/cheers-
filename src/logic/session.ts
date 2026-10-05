import { AuthUser } from '../types';
import { calculateAge } from '../utils/ageUtils';
import { LOCALE_BY_LANG, ph, tr } from '../services/i18nService';
import type { AppLanguage } from '../types';

export const SESSION_DURATION_HOURS = 36;
export const SESSION_DURATION_MS = SESSION_DURATION_HOURS * 60 * 60 * 1000;

/** The app is for people aged 21 and over (alcohol-themed meetups); the same limit applies to every way of signing up */
export const MIN_AGE = 21;
export const MIN_PASSWORD_LENGTH = 8;

export type AgeCheck = 'ok' | 'too_young' | 'invalid';

/** Decides from a stored birth date ("YYYY-MM-DD") whether the person may use the app */
export function checkAge(birthIso: string | null | undefined, now = new Date()): AgeCheck {
  const age = birthIso ? calculateAge(birthIso, now) : null;
  if (age === null) return 'invalid';
  return age >= MIN_AGE ? 'ok' : 'too_young';
}

export function createGuestUser(): AuthUser {
  return {
    id: `guest_${Math.random().toString(36).substring(2, 9)}`,
    name: '',
    email: '',
    avatar: '',
    provider: 'guest',
    isLoggedIn: false,
    emailVerified: false,
    sessionExpiresAt: 0,
    lastActiveAt: 0,
  };
}

/** The app-side view of a Firebase account. `id` is the Firebase uid, the same id Firestore rules see. */
export function createUser(
  input: {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
    emailVerified?: boolean;
    provider?: 'google' | 'email';
    birthDate?: string;
    joinedAt?: string;
  },
  now = Date.now()
): AuthUser {
  const email = input.email.trim();
  const fallback = email.split('@')[0].replace(/[._]/g, ' ');
  const base = input.name?.trim() || fallback || ph('Друг');
  const age = input.birthDate ? calculateAge(input.birthDate) : null;

  return {
    id: input.id,
    name: base.charAt(0).toUpperCase() + base.slice(1),
    email,
    // Empty on purpose: <Avatar> draws the initials on the device. A hosted placeholder (e.g. DiceBear) would send
    // the user's name to a third party and let it log the IP of everyone who views the profile.
    avatar: input.avatar ?? '',
    provider: input.provider ?? 'email',
    isLoggedIn: true,
    emailVerified: !!input.emailVerified,
    joinedAt: input.joinedAt ?? new Date(now).toISOString(),
    sessionExpiresAt: now + SESSION_DURATION_MS,
    lastActiveAt: now,
    birthDate: input.birthDate,
    age: age ?? undefined,
  };
}

export function isSessionValid(user: AuthUser, now = Date.now()): boolean {
  if (!user.isLoggedIn) return false;
  if (!user.sessionExpiresAt) return true;
  return now < user.sessionExpiresAt;
}

export function formatRemainingSession(expiresAt: number | undefined, now = Date.now(), lang: AppLanguage = 'uk'): string {
  if (!expiresAt) return tr('{hours} год', lang, { hours: SESSION_DURATION_HOURS });
  const diff = expiresAt - now;
  if (diff <= 0) return tr('Вичерпано', lang);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return hours > 0 ? tr('{hours} год {minutes} хв', lang, { hours, minutes }) : tr('{minutes} хв', lang, { minutes });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string) => EMAIL_RE.test(email.trim());

/** At least 8 characters with a letter and a digit. Returns a user-facing message, or null when fine. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return ph('Пароль має містити щонайменше 8 символів'); // keep in sync with MIN_PASSWORD_LENGTH
  if (!/[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(password) || !/\d/.test(password)) return ph('Пароль має містити літери та цифри');
  return null;
}

/** "Member since" label: the stored ISO date in the UI language (older accounts stored a ready-made string) */
export function formatJoinedAt(joinedAt: string, lang: AppLanguage = 'uk'): string {
  // Only real ISO timestamps: Date() happily "parses" free text such as "вересень 2026" into a wrong month
  if (!/^\d{4}-\d{2}-\d{2}T/.test(joinedAt)) return joinedAt;
  const date = new Date(joinedAt);
  if (isNaN(date.getTime())) return joinedAt;
  return date.toLocaleDateString(LOCALE_BY_LANG[lang], { month: 'long', year: 'numeric' });
}
