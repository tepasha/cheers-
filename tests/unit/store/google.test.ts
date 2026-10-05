import { describe, it, expect, vi, beforeEach } from 'vitest';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
vi.mock('@/services/systemNotifications', () => ({ registerForPush: vi.fn() }));
vi.mock('@/services/firebase', () => ({ db: {}, auth: {}, firebaseApp: {} }));
vi.mock('@/services/authService', () => ({
  authService: {
    logout: vi.fn().mockResolvedValue(undefined),
    removeAccountAfterAgeRejection: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/services/firestoreSyncService', () => ({
  firestoreSyncService: {
    getPrivateProfile: vi.fn().mockResolvedValue(null),
    savePrivateProfile: vi.fn().mockResolvedValue(undefined),
  },
}));

import auth from '@/store/slices/authSlice';
import settings from '@/store/slices/settingsSlice';
import location from '@/store/slices/locationSlice';
import buddies from '@/store/slices/buddiesSlice';
import hangouts from '@/store/slices/hangoutsSlice';
import chats from '@/store/slices/chatsSlice';
import friends from '@/store/slices/friendsSlice';
import notifications from '@/store/slices/notificationsSlice';
import gamification from '@/store/slices/gamificationSlice';
import meetups from '@/store/slices/meetupsSlice';
import safety from '@/store/slices/safetySlice';
import favorites from '@/store/slices/favoritesSlice';
import ui, { authNoticeSet } from '@/store/slices/uiSlice';
import { authService } from '@/services/authService';
import { firestoreSyncService } from '@/services/firestoreSyncService';
import { handleFirebaseUser, submitBirthDate } from '@/store/thunks/auth';
import type { RootState } from '@/store/index';

const rootReducer = combineReducers({ auth, settings, location, buddies, hangouts, chats, friends, notifications, gamification, meetups, safety, favorites, ui });
const makeStore = () => configureStore({ reducer: rootReducer });
type TestStore = ReturnType<typeof makeStore>;
const st = (s: TestStore) => s.getState() as unknown as RootState;
const run = <R,>(s: TestStore, thunk: unknown) => (s.dispatch as unknown as (t: unknown) => R)(thunk);

const googleUser = (uid = 'g1') =>
  ({
    uid,
    email: `${uid}@gmail.com`,
    displayName: 'Ірина Google',
    photoURL: 'https://lh3.googleusercontent.com/a/photo',
    emailVerified: true, // Google verifies the address itself
    providerData: [{ providerId: 'google.com' }],
  }) as never;

/** A birth date that makes the person exactly `years` old today, minus `offsetDays` (positive: not yet their birthday) */
const bornYearsAgo = (years: number, offsetDays = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const profile = vi.mocked(firestoreSyncService.getPrivateProfile);
const reject = vi.mocked(authService.removeAccountAfterAgeRejection);

beforeEach(() => {
  vi.clearAllMocks();
  profile.mockResolvedValue(null); // mockResolvedValue survives clearAllMocks: reset it so tests do not leak into each other
});

describe('Google sign-in: the account', () => {
  it('is mirrored as a Google, already verified user with its own photo', async () => {
    const s = makeStore();
    run(s, handleFirebaseUser(googleUser()));
    expect(st(s).auth.user).toMatchObject({ id: 'g1', provider: 'google', emailVerified: true, isLoggedIn: true, avatar: 'https://lh3.googleusercontent.com/a/photo' });
  });

  it('a first Google sign-in has no birth date: the app is told to ask for it, after the lookup finished', async () => {
    profile.mockResolvedValue(null);
    const s = makeStore();
    run(s, handleFirebaseUser(googleUser()));
    expect(st(s).auth.birthDateChecked).toBe(false); // still looking: the app shows a loader, not the form
    await vi.waitFor(() => expect(st(s).auth.birthDateChecked).toBe(true));
    expect(st(s).auth.user.birthDate).toBeUndefined();
  });

  it('a returning Google user who already gave a birth date goes straight in', async () => {
    profile.mockResolvedValue({ birthDate: bornYearsAgo(30) });
    const s = makeStore();
    run(s, handleFirebaseUser(googleUser()));
    await vi.waitFor(() => expect(st(s).auth.user.birthDate).toBeTruthy());
    expect(st(s).auth.birthDateChecked).toBe(true);
    expect(reject).not.toHaveBeenCalled();
    expect(st(s).ui.authNotice).toBeNull();
  });
});

describe('the minimum age (21)', () => {
  it('turns away a stored birth date under 21: the account is removed, the notice is set, the person is signed out', async () => {
    profile.mockResolvedValue({ birthDate: bornYearsAgo(19) });
    const s = makeStore();
    run(s, handleFirebaseUser(googleUser()));
    await vi.waitFor(() => expect(reject).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(st(s).auth.user.isLoggedIn).toBe(false));
    expect(st(s).ui.authNotice).toBe('underage');
  });

  it('submitBirthDate: refuses an unreadable date without touching the account', async () => {
    const s = makeStore();
    run(s, handleFirebaseUser(googleUser()));
    expect(await run<Promise<string>>(s, submitBirthDate('not-a-date'))).toBe('invalid');
    expect(reject).not.toHaveBeenCalled();
    expect(firestoreSyncService.savePrivateProfile).not.toHaveBeenCalled();
  });

  it('submitBirthDate: someone who turns 21 tomorrow is turned away', async () => {
    const s = makeStore();
    run(s, handleFirebaseUser(googleUser()));
    expect(await run<Promise<string>>(s, submitBirthDate(bornYearsAgo(21, 1)))).toBe('too_young');
    expect(reject).toHaveBeenCalledTimes(1);
    expect(st(s).ui.authNotice).toBe('underage');
    expect(st(s).auth.user.isLoggedIn).toBe(false);
    expect(firestoreSyncService.savePrivateProfile).not.toHaveBeenCalled(); // nothing about them is kept
  });

  it('submitBirthDate: someone who turns 21 today is let in, and the date is stored privately', async () => {
    const s = makeStore();
    run(s, handleFirebaseUser(googleUser()));
    const iso = bornYearsAgo(21);
    expect(await run<Promise<string>>(s, submitBirthDate(iso))).toBe('ok');
    expect(firestoreSyncService.savePrivateProfile).toHaveBeenCalledWith('g1', { email: 'g1@gmail.com', birthDate: iso });
    expect(st(s).auth.user.birthDate).toBe(iso);
    expect(st(s).auth.user.age).toBe(21);
    expect(reject).not.toHaveBeenCalled();
  });

  it('the notice is cleared when the person starts a new attempt', () => {
    const s = makeStore();
    s.dispatch(authNoticeSet('underage'));
    s.dispatch(authNoticeSet(null));
    expect(st(s).ui.authNotice).toBeNull();
  });
});
