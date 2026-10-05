import { describe, it, expect } from 'vitest';
import {
  SESSION_DURATION_MS,
  createUser,
  createGuestUser,
  formatRemainingSession,
  isSessionValid,
  isValidEmail,
  validatePassword,
  formatJoinedAt,
} from '@/logic/session';
import { parseBirthDateInput, parseDateInput, parseTimeInput, toIsoDateTime, isoToDateInput } from '@/logic/dateInput';
import { DEFAULT_FILTERS, countActiveFilters, filterBuddies } from '@/logic/buddyFilters';
import { getBatterySaverConfig } from '@/logic/batterySaver';
import { BuddyProfile } from '@/types';

describe('session', () => {
  it('creates a logged-out guest', () => {
    const g = createGuestUser();
    expect(g.isLoggedIn).toBe(false);
    expect(isSessionValid(g)).toBe(false);
  });

  it('mirrors a Firebase account: uid as id, 36h session, computed age', () => {
    const u = createUser({ id: 'uid123', email: ' Pavlo@Example.com ', birthDate: '1998-05-15', emailVerified: true }, Date.UTC(2026, 8, 30));
    expect(u.id).toBe('uid123');
    expect(u.isLoggedIn).toBe(true);
    expect(u.emailVerified).toBe(true);
    expect(u.email).toBe('Pavlo@Example.com');
    expect(u.name).toBe('Pavlo');
    expect(u.sessionExpiresAt).toBe(Date.UTC(2026, 8, 30) + SESSION_DURATION_MS);
    expect(u.age).toBeGreaterThanOrEqual(18);
  });

  it('never invents a hosted avatar: a missing one stays empty so the initials are drawn on the device', () => {
    expect(createUser({ id: 'x', email: 'jane@b.co' }).avatar).toBe('');
    expect(createUser({ id: 'x', email: 'jane@b.co', avatar: 'https://cdn.example/me.png' }).avatar).toBe('https://cdn.example/me.png');
  });

  it('defaults to unverified and falls back to a readable name', () => {
    const u = createUser({ id: 'x', email: 'jane.doe@b.co' });
    expect(u.emailVerified).toBe(false);
    expect(u.name).toBe('Jane doe');
  });

  it('validates emails and passwords', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(validatePassword('short1')).toMatch(/щонайменше 8/);
    expect(validatePassword('onlyletters')).toMatch(/літери та цифри/);
    expect(validatePassword('12345678')).toMatch(/літери та цифри/);
    expect(validatePassword('Пароль2026')).toBeNull();
    expect(validatePassword('correct horse 9')).toBeNull();
  });

  it('validates and formats remaining session time', () => {
    const now = 1_000_000;
    const user = { ...createUser({ id: 'u', email: 'a@b.co' }, now) };
    expect(isSessionValid(user, now + SESSION_DURATION_MS - 1)).toBe(true);
    expect(isSessionValid(user, now + SESSION_DURATION_MS + 1)).toBe(false);
    expect(formatRemainingSession(now + 90 * 60000, now)).toBe('1 год 30 хв');
    expect(formatRemainingSession(now - 1, now)).toBe('Вичерпано');
  });
});

describe('date input', () => {
  it('parses real dates and rejects impossible ones', () => {
    expect(parseDateInput('15.05.1998')).toEqual({ year: 1998, month: 5, day: 15 });
    expect(parseDateInput('31.02.2026')).toBeNull();
    expect(parseDateInput('garbage')).toBeNull();
  });

  it('converts between typed and stored birth dates', () => {
    expect(parseBirthDateInput('5.1.2000')).toBe('2000-01-05');
    expect(isoToDateInput('2000-01-05')).toBe('05.01.2000');
  });

  it('parses times and combines date+time', () => {
    expect(parseTimeInput('19:30')).toEqual({ hours: 19, minutes: 30 });
    expect(parseTimeInput('25:00')).toBeNull();
    expect(toIsoDateTime('01.10.2026', '19:30')).toMatch(/^2026-10-01T/);
    expect(toIsoDateTime('01.10.2026', 'xx')).toBeNull();
  });
});

describe('battery saver config', () => {
  it('polls slower and avoids high accuracy in saver mode', () => {
    expect(getBatterySaverConfig(false)).toMatchObject({ locationIntervalMs: 15000, realtimeSyncIntervalMs: 10000, enableHighAccuracy: true });
    expect(getBatterySaverConfig(true)).toMatchObject({ locationIntervalMs: 90000, realtimeSyncIntervalMs: 60000, enableHighAccuracy: false });
  });
});

describe('buddy filters', () => {
  const b = (over: Partial<BuddyProfile>): BuddyProfile => ({
    id: 'x',
    name: 'Олена',
    avatar: '',
    age: 27,
    tagline: 'Люблю крафт',
    bio: '',
    locationName: 'Поділ',
    distanceKm: 1,
    coordinates: { lat: 0, lng: 0 },
    preferredDrinks: ['craft'],
    paymentRule: 'split_50_50',
    currentMood: 'chill_talk',
    favoriteBars: ['Squat 17b'],
    talkTopics: ['Подорожі'],
    online: true,
    ...over,
  });

  it('filters by distance, drink, mood and text', () => {
    const people = [b({ id: '1' }), b({ id: '2', distanceKm: 4, preferredDrinks: ['wine'], name: 'Іра' })];
    expect(filterBuddies(people, { ...DEFAULT_FILTERS, maxDistance: 2 }).map((p) => p.id)).toEqual(['1']);
    expect(filterBuddies(people, { ...DEFAULT_FILTERS, drinks: ['wine'] }).map((p) => p.id)).toEqual(['2']);
    expect(filterBuddies(people, { ...DEFAULT_FILTERS, moods: ['coding_it'] })).toHaveLength(0);
    expect(filterBuddies(people, { ...DEFAULT_FILTERS, searchQuery: ' ірА ' }).map((p) => p.id)).toEqual(['2']);
  });

  it('matches interests through their keywords', () => {
    const people = [b({ id: '1', talkTopics: ['Подорожі Карпатами'] }), b({ id: '2', talkTopics: ['Футбол'] })];
    expect(filterBuddies(people, { ...DEFAULT_FILTERS, interests: ['travel'] }).map((p) => p.id)).toEqual(['1']);
  });

  it('counts active filters', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, maxDistance: 2, drinks: ['beer', 'wine'], searchQuery: 'x' })).toBe(4);
  });
});

describe('localized session text', () => {
  it('formats the remaining session in each language', () => {
    const now = 1_000_000;
    const exp = now + 90 * 60000;
    expect(formatRemainingSession(exp, now, 'uk')).toBe('1 год 30 хв');
    expect(formatRemainingSession(exp, now, 'en')).toBe('1 h 30 min');
    expect(formatRemainingSession(exp, now, 'pl')).toBe('1 godz. 30 min');
    expect(formatRemainingSession(exp, now, 'de')).toBe('1 Std. 30 Min.');
    expect(formatRemainingSession(now - 1, now, 'en')).toBe('Expired');
  });

  it('formats "member since" from the stored ISO date in the UI language, and tolerates old plain strings', () => {
    const iso = '2026-09-15T10:00:00.000Z';
    expect(formatJoinedAt(iso, 'en')).toMatch(/September 2026/);
    expect(formatJoinedAt(iso, 'de')).toMatch(/September 2026/);
    expect(formatJoinedAt('вересень 2026', 'en')).toBe('вересень 2026');
  });
});

import { MIN_AGE, checkAge } from '@/logic/session';

describe('minimum age', () => {
  it('is 21', () => {
    expect(MIN_AGE).toBe(21);
  });

  it('turns away the day before the 21st birthday and lets in the birthday itself', () => {
    const now = new Date(2026, 9, 5); // 5 October 2026
    expect(checkAge('2005-10-06', now)).toBe('too_young'); // turns 21 tomorrow
    expect(checkAge('2005-10-05', now)).toBe('ok'); // turns 21 today
    expect(checkAge('2005-10-04', now)).toBe('ok');
    expect(checkAge('2008-01-01', now)).toBe('too_young'); // 18: allowed by the old rule, not by this one
  });

  it('treats anything unreadable, missing or implausible as invalid', () => {
    expect(checkAge(undefined)).toBe('invalid');
    expect(checkAge('')).toBe('invalid');
    expect(checkAge('not-a-date')).toBe('invalid');
    expect(checkAge('1800-01-01')).toBe('invalid'); // over 120
    expect(checkAge('2999-01-01')).toBe('invalid'); // in the future
  });
});
