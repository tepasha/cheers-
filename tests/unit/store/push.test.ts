import outbox from '@/store/slices/outboxSlice';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 0, Medium: 1, Soft: 2, Rigid: 3 },
  NotificationFeedbackType: { Success: 0, Warning: 1, Error: 2 },
}));
vi.mock('@/services/systemNotifications', () => ({ stopSystemPush: vi.fn().mockResolvedValue(undefined), registerForPush: vi.fn() }));
vi.mock('@/services/firebase', () => ({ db: {}, auth: {}, firebaseApp: {} }));
vi.mock('@/services/authService', () => ({ authService: { logout: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('@/services/cryptoService', () => ({ cryptoService: { decryptMessage: vi.fn(async (p: string) => `dec:${p}`) } }));
vi.mock('@/services/firestoreSyncService', () => ({
  firestoreSyncService: {
    saveDevice: vi.fn().mockResolvedValue(undefined),
    removeDevice: vi.fn().mockResolvedValue(undefined),
    getUserProfile: vi.fn().mockResolvedValue(null),
  },
}));

import auth, { loggedIn } from '@/store/slices/authSlice';
import settings, { languageChosen, pushSettingsUpdated } from '@/store/slices/settingsSlice';
import location from '@/store/slices/locationSlice';
import buddies from '@/store/slices/buddiesSlice';
import hangouts from '@/store/slices/hangoutsSlice';
import chats, { chatDeleted, groupChatCreated } from '@/store/slices/chatsSlice';
import friends from '@/store/slices/friendsSlice';
import notifications from '@/store/slices/notificationsSlice';
import gamification from '@/store/slices/gamificationSlice';
import meetups from '@/store/slices/meetupsSlice';
import safety, { userBlocked } from '@/store/slices/safetySlice';
import favorites from '@/store/slices/favoritesSlice';
import ui, { chatOpened } from '@/store/slices/uiSlice';
import { createUser } from '@/logic/session';
import { authService } from '@/services/authService';
import { firestoreSyncService } from '@/services/firestoreSyncService';
import { registerForPush } from '@/services/systemNotifications';
import { disablePush, openChatFromPush, registerPush, releaseDevice } from '@/store/thunks/push';
import { endSession, logout } from '@/store/thunks/auth';
import { syncChatInbox } from '@/store/thunks/inbox';
import type { CloudChat } from '@/logic/chats';
import type { BuddyProfile, ChatThread } from '@/types';
import type { RootState } from '@/store/index';

const rootReducer = combineReducers({ outbox, auth, settings, location, buddies, hangouts, chats, friends, notifications, gamification, meetups, safety, favorites, ui });

function makeStore(verified = true) {
  const store = configureStore({ reducer: rootReducer });
  // An adult with a known birth date: registering a push device needs the age to be confirmed too
  store.dispatch(loggedIn(createUser({ id: 'me', email: 'me@b.co', name: 'Me', emailVerified: verified, birthDate: '1990-01-01' })));
  return store;
}
type TestStore = ReturnType<typeof makeStore>;
const st = (s: TestStore) => s.getState() as unknown as RootState;
const run = <R,>(s: TestStore, thunk: unknown) => (s.dispatch as unknown as (t: unknown) => R)(thunk);

const sync = vi.mocked(firestoreSyncService);
const register = vi.mocked(registerForPush);
const TOKEN = 'ExponentPushToken[abcDEF123456]';

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('registerPush', () => {
  it('ignores a denied permission response from a previous account', async () => {
    const s = makeStore();
    register.mockImplementationOnce(async () => {
      s.dispatch(loggedIn(createUser({ id: 'other', email: 'o@b.co', emailVerified: true, birthDate: '1990-01-01' })));
      s.dispatch(pushSettingsUpdated({ webPushEnabled: true, deviceToken: 'new-account-token' }));
      return { status: 'denied' };
    });
    expect(await run(s, registerPush({ ask: true }))).toBe('unavailable');
    expect(st(s).settings.push).toMatchObject({ webPushEnabled: true, deviceToken: 'new-account-token' });
    expect(sync.saveDevice).not.toHaveBeenCalled();
  });
  it('registers the phone for the signed-in account and remembers the token', async () => {
    register.mockResolvedValue({ status: 'registered', token: TOKEN, platform: 'ios' });
    const s = makeStore();
    s.dispatch(languageChosen('pl'));

    expect(await run(s, registerPush({ ask: true }))).toBe('registered');
    expect(register).toHaveBeenCalledWith(true);
    expect(sync.saveDevice).toHaveBeenCalledWith('me', TOKEN, 'ios', 'pl', expect.any(Number));
    expect(st(s).settings.push).toMatchObject({ webPushEnabled: true, deviceToken: TOKEN });
  });

  it('does nothing before the email is verified (the rules would refuse the write anyway)', async () => {
    const s = makeStore(false);
    expect(await run(s, registerPush({ ask: true }))).toBe('unavailable');
    expect(register).not.toHaveBeenCalled();
    expect(sync.saveDevice).not.toHaveBeenCalled();
  });

  it('does nothing before the age is confirmed (no birth date yet, or under 21)', async () => {
    for (const birthDate of [undefined, new Date(Date.now() - 19 * 365.25 * 86400000).toISOString().slice(0, 10)]) {
      const s = configureStore({ reducer: rootReducer });
      s.dispatch(loggedIn(createUser({ id: 'me', email: 'me@b.co', emailVerified: true, birthDate })));
      expect(await run(s, registerPush({ ask: true }))).toBe('unavailable');
    }
    expect(register).not.toHaveBeenCalled();
    expect(sync.saveDevice).not.toHaveBeenCalled();
  });

  it('turns the switch off when the permission was refused or withdrawn', async () => {
    register.mockResolvedValue({ status: 'denied' });
    const s = makeStore();
    s.dispatch(pushSettingsUpdated({ webPushEnabled: true }));
    expect(await run(s, registerPush({ ask: false }))).toBe('denied');
    expect(st(s).settings.push.webPushEnabled).toBe(false);
    expect(sync.saveDevice).not.toHaveBeenCalled();
  });

  it('leaves the switch alone when push is simply unavailable (simulator, no EAS project yet)', async () => {
    register.mockResolvedValue({ status: 'unavailable' });
    const s = makeStore();
    expect(await run(s, registerPush({ ask: true }))).toBe('unavailable');
    expect(st(s).settings.push.webPushEnabled).toBe(false);
    expect(st(s).settings.push.deviceToken).toBeUndefined();
  });

  it('does not claim success when the device could not be saved', async () => {
    register.mockResolvedValue({ status: 'registered', token: TOKEN, platform: 'android' });
    sync.saveDevice.mockRejectedValueOnce(new Error('permission-denied'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = makeStore();
    expect(await run(s, registerPush({ ask: true }))).toBe('unavailable');
    expect(st(s).settings.push.deviceToken).toBeUndefined();
    expect(st(s).settings.push.webPushEnabled).toBe(false);
  });

  it('drops the result when another account signed in while the dialog was open', async () => {
    const s = makeStore();
    register.mockImplementation(async () => {
      s.dispatch(loggedIn(createUser({ id: 'other', email: 'o@b.co', emailVerified: true })));
      return { status: 'registered', token: TOKEN, platform: 'ios' };
    });
    expect(await run(s, registerPush({ ask: true }))).toBe('unavailable');
    expect(sync.saveDevice).not.toHaveBeenCalled();
  });
});

describe('releasing the device', () => {
  const registered = () => {
    const s = makeStore();
    s.dispatch(pushSettingsUpdated({ webPushEnabled: true, deviceToken: TOKEN }));
    return s;
  };

  it('removes the device and forgets the token, but keeps the switch so the next sign-in restores pushes', async () => {
    const s = registered();
    await run(s, releaseDevice());
    expect(sync.removeDevice).toHaveBeenCalledWith(TOKEN);
    expect(st(s).settings.push.deviceToken).toBeUndefined();
    expect(st(s).settings.push.webPushEnabled).toBe(true);
  });

  it('does nothing without a registered device', async () => {
    await run(makeStore(), releaseDevice());
    expect(sync.removeDevice).not.toHaveBeenCalled();
  });

  it('survives a failing removal', async () => {
    sync.removeDevice.mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(run(registered(), releaseDevice())).resolves.toBeUndefined();
  });

  it('does not hang sign-out on a removal that never finishes (offline)', async () => {
    vi.useFakeTimers();
    sync.removeDevice.mockReturnValueOnce(new Promise(() => {}));
    const done = vi.fn();
    void (run(registered(), releaseDevice()) as Promise<void>).then(done);
    await vi.advanceTimersByTimeAsync(3100);
    expect(done).toHaveBeenCalled();
  });

  it('turning notifications off removes the device and switches off', async () => {
    const s = registered();
    await run(s, disablePush());
    expect(sync.removeDevice).toHaveBeenCalledWith(TOKEN);
    expect(st(s).settings.push).toMatchObject({ webPushEnabled: false, deviceToken: undefined });
  });
});

describe('ending the session', () => {
  it('removes the device BEFORE signing out of Firebase (afterwards the write would be refused)', async () => {
    const order: string[] = [];
    sync.removeDevice.mockImplementationOnce(async () => void order.push('removeDevice'));
    vi.mocked(authService.logout).mockImplementationOnce(async () => void order.push('logout'));
    const s = makeStore();
    s.dispatch(pushSettingsUpdated({ deviceToken: TOKEN }));
    await run(s, endSession());
    expect(order).toEqual(['removeDevice', 'logout']);
  });

  it('clears the local session immediately and unregisters native push before Firebase signout', async () => {
    const s = makeStore();
    const done = run(s, endSession());
    expect(st(s).auth.user.isLoggedIn).toBe(false);
    await done;
    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it('the logout button goes through the same path', async () => {
    const s = makeStore();
    s.dispatch(pushSettingsUpdated({ deviceToken: TOKEN }));
    await run(s, logout());
    expect(sync.removeDevice).toHaveBeenCalledWith(TOKEN);
    expect(authService.logout).toHaveBeenCalledTimes(1);
  });
});

describe('opening a chat from a notification', () => {
  it('records the request until the navigator can act on it', () => {
    const s = makeStore();
    run(s, openChatFromPush('dm_a_me'));
    expect(st(s).ui.pendingChatId).toBe('dm_a_me');
  });
});

describe('in-app notification for an incoming message', () => {
  const buddy = (id: string): BuddyProfile => ({
    id, name: `Buddy ${id}`, avatar: '', age: 26, tagline: '', bio: '', locationName: 'Київ', distanceKm: 1,
    coordinates: { lat: 50.46, lng: 30.52 }, preferredDrinks: ['craft'], paymentRule: 'split_50_50', currentMood: 'chill_talk',
    favoriteBars: [], talkTopics: [], online: true,
  });
  const cloud = (over: Partial<CloudChat> = {}): CloudChat => ({
    id: 'dm_a_me', members: ['a', 'me'], isGroup: false, lastCipherPayload: 'enc:v1:x', lastSenderId: 'a', lastMessageTime: '12:00', updatedAt: 'T2', ...over,
  } as CloudChat);
  const withThread = (updatedAt?: string) => {
    const s = makeStore();
    const thread: ChatThread = { id: 'dm_a_me', memberIds: ['a', 'me'], buddy: buddy('a'), lastMessage: 'old', lastMessageTime: '11:00', unreadCount: 0, messages: [], updatedAt };
    s.dispatch(groupChatCreated(thread));
    return s;
  };
  const notified = (s: TestStore) => st(s).notifications.items.filter((n) => n.type === 'chat_message');

  it('raises a banner and a notification for a new message from the other person', async () => {
    const s = withThread('T1');
    await run(s, syncChatInbox([cloud()]));
    expect(notified(s)).toHaveLength(1);
    expect(notified(s)[0]).toMatchObject({ chatId: 'dm_a_me', buddyName: 'Buddy a', buddyId: 'a' });
    expect(st(s).ui.activeBanner?.chatId).toBe('dm_a_me');
  });

  it('stays quiet for the first snapshot of a chat this device never matched with the cloud', async () => {
    const s = withThread(undefined);
    await run(s, syncChatInbox([cloud()]));
    expect(notified(s)).toHaveLength(0);
  });

  it('stays quiet when nothing changed, for your own messages, and for the chat on screen', async () => {
    const same = withThread('T2');
    await run(same, syncChatInbox([cloud()]));
    expect(notified(same)).toHaveLength(0);

    const mine = withThread('T1');
    await run(mine, syncChatInbox([cloud({ lastSenderId: 'me' })]));
    expect(notified(mine)).toHaveLength(0);

    const open = withThread('T1');
    open.dispatch(chatOpened('dm_a_me'));
    await run(open, syncChatInbox([cloud()]));
    expect(notified(open)).toHaveLength(0);
  });

  it('stays quiet for blocked senders and for chats the user removed from the list', async () => {
    const blocked = withThread('T1');
    blocked.dispatch(userBlocked({ userId: 'a', userName: 'A', blockedAt: '1' }));
    await run(blocked, syncChatInbox([cloud()]));
    expect(notified(blocked)).toHaveLength(0);

    const hidden = withThread('T1');
    hidden.dispatch(chatDeleted('dm_a_me'));
    await run(hidden, syncChatInbox([cloud()]));
    expect(notified(hidden)).toHaveLength(0);
  });

  it('names the author inside a group', async () => {
    const s = makeStore();
    s.dispatch(
      groupChatCreated({
        id: 'grp_me_1', memberIds: ['me', 'a', 'b'], buddy: buddy('a'), isGroup: true, groupName: 'Friday', lastMessage: 'x', lastMessageTime: '1', unreadCount: 0,
        messages: [], updatedAt: 'T1',
        participants: [{ id: 'me', name: 'Me', avatar: '' }, { id: 'b', name: 'Bohdan', avatar: '' }],
      })
    );
    await run(s, syncChatInbox([cloud({ id: 'grp_me_1', members: ['me', 'a', 'b'], isGroup: true, groupName: 'Friday', lastSenderId: 'b' })]));
    expect(notified(s)[0].buddyName).toBe('Bohdan');
  });
});
