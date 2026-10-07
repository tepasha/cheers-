import outbox from '@/store/slices/outboxSlice';
/**
 * Nothing may be read from, or published to, other people's data until the age is confirmed.
 * These tests mount the REAL hooks (useFirestoreStreams, usePresence, useProfileSync) on a real store and watch what
 * reaches Firestore. The bug they pin: a first Google sign-in sits on the birth-date screen verified but without a
 * birth date, and the profile (name, Google photo, position) used to be published during that time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

const mocks = vi.hoisted(() => ({ unsubscribe: vi.fn() }));

vi.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
vi.mock('@/services/systemNotifications', () => ({ stopSystemPush: vi.fn().mockResolvedValue(undefined), registerForPush: vi.fn() }));
vi.mock('@/services/firebase', () => ({ db: {}, auth: {}, firebaseApp: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(() => ({})), setDoc: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/services/cryptoService', () => ({ cryptoService: { decryptMessage: vi.fn(async (p: string) => p) } }));
vi.mock('@/services/authService', () => ({
  authService: { completeOnboarding: vi.fn().mockResolvedValue(undefined), logout: vi.fn().mockResolvedValue(undefined), removeAccountAfterAgeRejection: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/services/firestoreSyncService', () => ({
  firestoreSyncService: {
    subscribeToLiveHangouts: vi.fn(() => mocks.unsubscribe),
    subscribeToPublicBuddies: vi.fn(() => mocks.unsubscribe),
    subscribeToMeetups: vi.fn(() => mocks.unsubscribe),
    subscribeToMyChats: vi.fn(() => mocks.unsubscribe),
    saveUserProfile: vi.fn().mockResolvedValue(undefined),
    touchPresence: vi.fn().mockResolvedValue(undefined),
    getBlocks: vi.fn().mockResolvedValue([]),
    getUserFavorites: vi.fn().mockResolvedValue([]),
    getUserProfile: vi.fn().mockResolvedValue(null),
    getPrivateProfile: vi.fn().mockResolvedValue(null),
    savePrivateProfile: vi.fn().mockResolvedValue(undefined),
  },
}));

import auth, { loggedIn, loggedOut, profileUpdated } from '@/store/slices/authSlice';
import settings from '@/store/slices/settingsSlice';
import location, { locationUpdated } from '@/store/slices/locationSlice';
import buddies from '@/store/slices/buddiesSlice';
import hangouts from '@/store/slices/hangoutsSlice';
import chats from '@/store/slices/chatsSlice';
import friends from '@/store/slices/friendsSlice';
import notifications from '@/store/slices/notificationsSlice';
import gamification from '@/store/slices/gamificationSlice';
import meetups from '@/store/slices/meetupsSlice';
import safety from '@/store/slices/safetySlice';
import favorites from '@/store/slices/favoritesSlice';
import ui from '@/store/slices/uiSlice';
import { createUser } from '@/logic/session';
import { firestoreSyncService as cloud } from '@/services/firestoreSyncService';
import { submitBirthDate } from '@/store/thunks/auth';
import { useFirestoreStreams, usePresence, useProfileSync } from '@/hooks/useCloudSync';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rootReducer = combineReducers({ outbox, auth, settings, location, buddies, hangouts, chats, friends, notifications, gamification, meetups, safety, favorites, ui });
const makeStore = () => configureStore({ reducer: rootReducer });
type TestStore = ReturnType<typeof makeStore>;

/** The three hooks that talk to other people's data, mounted the way the app mounts them */
const Harness = () => {
  useFirestoreStreams();
  usePresence();
  useProfileSync();
  return null;
};
let mounted: ReactTestRenderer | null = null;
const mount = (store: TestStore) => {
  act(() => {
    mounted = create(createElement(Provider, { store, children: createElement(Harness) }));
  });
};
const flush = async (ms = 5 * 60 * 1000) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const bornYearsAgo = (years: number, offsetDays = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** What a first Google sign-in looks like to the app: verified by Google, photo and name from Google, no birth date */
const signInWithGoogle = (store: TestStore, over: Record<string, unknown> = {}) =>
  store.dispatch(
    loggedIn(createUser({ id: 'g1', email: 'g1@gmail.com', name: 'Ірина', avatar: 'https://lh3.googleusercontent.com/a/photo', emailVerified: true, provider: 'google', ...over }))
  );

const reads = () => [cloud.subscribeToLiveHangouts, cloud.subscribeToPublicBuddies, cloud.subscribeToMeetups, cloud.subscribeToMyChats, cloud.getBlocks, cloud.getUserFavorites];
const writes = () => [cloud.saveUserProfile, cloud.touchPresence];
const touched = (fns: Array<ReturnType<typeof vi.fn> | unknown>) => (fns as Array<ReturnType<typeof vi.fn>>).filter((f) => f.mock.calls.length > 0).length;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.useRealTimers();
});

describe('before the age is confirmed, nothing is read and nothing is published', () => {
  it('a first Google sign-in (verified, no birth date) publishes no profile and no presence, and subscribes to nothing', async () => {
    const store = makeStore();
    signInWithGoogle(store);
    mount(store);
    await flush();

    expect(cloud.saveUserProfile).not.toHaveBeenCalled(); // the bug: name + Google photo + position went out here
    expect(cloud.touchPresence).not.toHaveBeenCalled();
    expect(touched(reads())).toBe(0);
  });

  it('a stored birth date under 21 is treated the same: nothing leaves the phone', async () => {
    const store = makeStore();
    signInWithGoogle(store, { birthDate: bornYearsAgo(19) });
    mount(store);
    await flush();
    expect(touched(writes())).toBe(0);
    expect(touched(reads())).toBe(0);
  });

  it('an unreadable birth date does not count as confirmed either', async () => {
    const store = makeStore();
    signInWithGoogle(store);
    store.dispatch(profileUpdated({ birthDate: 'not-a-date' }));
    mount(store);
    await flush();
    expect(touched(writes())).toBe(0);
    expect(touched(reads())).toBe(0);
  });

  it('an adult whose e-mail is not verified yet is gated as before', async () => {
    const store = makeStore();
    signInWithGoogle(store, { birthDate: bornYearsAgo(30), emailVerified: false });
    mount(store);
    await flush();
    expect(touched(writes())).toBe(0);
    expect(touched(reads())).toBe(0);
  });

  it('signed out: nothing', async () => {
    const store = makeStore();
    mount(store);
    await flush();
    expect(touched(writes())).toBe(0);
    expect(touched(reads())).toBe(0);
  });
});

describe('once the age is confirmed', () => {
  it('an adult with a verified account is published and subscribed (the normal path still works)', async () => {
    const store = makeStore();
    signInWithGoogle(store, { birthDate: bornYearsAgo(30) });
    mount(store);
    await flush(2_000);

    expect(cloud.touchPresence).toHaveBeenCalledWith('g1');
    expect(cloud.saveUserProfile).toHaveBeenCalledTimes(1);
    expect(cloud.saveUserProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1', name: 'Ірина', avatar: 'https://lh3.googleusercontent.com/a/photo', age: 30 }));
    expect(cloud.subscribeToLiveHangouts).toHaveBeenCalledTimes(1);
    expect(cloud.subscribeToPublicBuddies).toHaveBeenCalledTimes(1);
    expect(cloud.subscribeToMeetups).toHaveBeenCalledTimes(1);
    expect(cloud.subscribeToMyChats).toHaveBeenCalledTimes(1);
  });

  it('exactly 21 today counts as an adult', async () => {
    const store = makeStore();
    signInWithGoogle(store, { birthDate: bornYearsAgo(21) });
    mount(store);
    await flush(2_000);
    expect(cloud.saveUserProfile).toHaveBeenCalledTimes(1);
  });

  it('turning 21 tomorrow is not enough', async () => {
    const store = makeStore();
    signInWithGoogle(store, { birthDate: bornYearsAgo(21, 1) });
    mount(store);
    await flush();
    expect(touched(writes())).toBe(0);
    expect(touched(reads())).toBe(0);
  });
});

describe('the Google sign-in flow end to end', () => {
  it('publishes nothing while the birth-date screen is up, and starts only after an adult date is submitted', async () => {
    const store = makeStore();
    signInWithGoogle(store);
    mount(store);
    await flush(); // the person sits on the birth-date screen
    expect(touched(writes())).toBe(0);
    expect(touched(reads())).toBe(0);

    await act(async () => {
      expect(await (store.dispatch as unknown as (t: unknown) => Promise<string>)(submitBirthDate(bornYearsAgo(30)))).toBe('ok');
    });
    await flush(2_000);

    expect(cloud.savePrivateProfile).toHaveBeenCalledTimes(1);
    expect(cloud.saveUserProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1', age: 30 }));
    expect(cloud.touchPresence).toHaveBeenCalled();
    expect(cloud.subscribeToMyChats).toHaveBeenCalledTimes(1);
  });

  it('a person who turns out to be too young was never visible: no profile, no presence, nothing subscribed', async () => {
    const store = makeStore();
    signInWithGoogle(store);
    mount(store);
    await flush();

    await act(async () => {
      expect(await (store.dispatch as unknown as (t: unknown) => Promise<string>)(submitBirthDate(bornYearsAgo(19)))).toBe('too_young');
    });
    await flush();

    expect(cloud.saveUserProfile).not.toHaveBeenCalled();
    expect(cloud.touchPresence).not.toHaveBeenCalled();
    expect(touched(reads())).toBe(0);
    expect(cloud.savePrivateProfile).not.toHaveBeenCalled(); // nothing about them is kept
    expect(store.getState().auth.user.isLoggedIn).toBe(false);
  });
});

describe('leaving', () => {
  it('removes shared coordinates when GPS permission becomes unavailable', async () => {
    const store = makeStore();
    signInWithGoogle(store, { birthDate: bornYearsAgo(30) });
    store.dispatch({ type: 'settings/locationSharingSet', payload: true });
    store.dispatch(locationUpdated({ ...store.getState().location.current, isSimulated: false, status: 'active' }));
    mount(store); await flush(2000);
    expect(cloud.saveUserProfile).toHaveBeenLastCalledWith(expect.objectContaining({ shareLocation: true }));
    act(() => { store.dispatch(locationUpdated({ ...store.getState().location.current, status: 'error' })); });
    await flush(2000);
    expect(cloud.saveUserProfile).toHaveBeenLastCalledWith(expect.objectContaining({ shareLocation: false, lat: undefined, lng: undefined }));
  });
  it('signing out stops the listeners and any further publishing', async () => {
    const store = makeStore();
    signInWithGoogle(store, { birthDate: bornYearsAgo(30) });
    mount(store);
    await flush(2_000);
    const saves = (cloud.saveUserProfile as ReturnType<typeof vi.fn>).mock.calls.length;
    const presences = (cloud.touchPresence as ReturnType<typeof vi.fn>).mock.calls.length;

    act(() => {
      store.dispatch(loggedOut());
    });
    await flush();

    expect(mocks.unsubscribe).toHaveBeenCalledTimes(4); // hangouts, nearby people, meetups, chat inbox
    expect((cloud.saveUserProfile as ReturnType<typeof vi.fn>).mock.calls.length).toBe(saves);
    expect((cloud.touchPresence as ReturnType<typeof vi.fn>).mock.calls.length).toBe(presences);
  });
});
