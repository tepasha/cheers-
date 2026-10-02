import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

// Native / network modules: the thunks' own logic is what is under test
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 0, Medium: 1, Soft: 2, Rigid: 3 },
  NotificationFeedbackType: { Success: 0, Warning: 1, Error: 2 },
}));
vi.mock('@/services/systemNotifications', () => ({ registerForPush: vi.fn() }));
vi.mock('@/services/firebase', () => ({ db: {}, auth: {}, firebaseApp: {} }));
vi.mock('@/services/authService', () => ({
  authService: {
    logout: vi.fn().mockResolvedValue(undefined),
    refreshVerification: vi.fn(),
    deleteAccount: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(() => ({})), setDoc: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/services/firestoreSyncService', () => ({
  firestoreSyncService: {
    sendEncryptedMessage: vi.fn().mockResolvedValue({ cipherPayload: 'enc:v1:test', success: true }),
    addGroupMembers: vi.fn().mockResolvedValue(undefined),
    saveBlock: vi.fn().mockResolvedValue(undefined),
    removeBlock: vi.fn().mockResolvedValue(undefined),
    getBlocks: vi.fn().mockResolvedValue([]),
    saveMeetup: vi.fn().mockResolvedValue(undefined),
    setMeetupParticipation: vi.fn().mockResolvedValue(undefined),
    getPrivateProfile: vi.fn().mockResolvedValue(null),
    syncFriend: vi.fn().mockResolvedValue(undefined),
    removeFriendFromFirestore: vi.fn().mockResolvedValue(undefined),
    syncGamification: vi.fn().mockResolvedValue(undefined),
    publishHangout: vi.fn().mockResolvedValue(undefined),
    joinLiveHangout: vi.fn().mockResolvedValue(undefined),
    closeLiveHangout: vi.fn().mockResolvedValue(undefined),
    saveFavoriteVenue: vi.fn().mockResolvedValue(undefined),
    removeFavoriteVenue: vi.fn().mockResolvedValue(undefined),
  },
}));

import auth, { loggedIn } from '@/store/slices/authSlice';
import settings, { pushSettingsUpdated } from '@/store/slices/settingsSlice';
import location from '@/store/slices/locationSlice';
import buddies from '@/store/slices/buddiesSlice';
import hangouts, { hangoutPublished } from '@/store/slices/hangoutsSlice';
import chats, { groupChatCreated } from '@/store/slices/chatsSlice';
import friends from '@/store/slices/friendsSlice';
import notifications from '@/store/slices/notificationsSlice';
import gamification from '@/store/slices/gamificationSlice';
import meetups from '@/store/slices/meetupsSlice';
import safety from '@/store/slices/safetySlice';
import favorites from '@/store/slices/favoritesSlice';
import ui from '@/store/slices/uiSlice';
import { firestoreSyncService } from '@/services/firestoreSyncService';
import { createUser, SESSION_DURATION_MS } from '@/logic/session';
import { languageChosen } from '@/store/slices/settingsSlice';
import { authService } from '@/services/authService';
import { addFriend, addGroupParticipants, closeHangout, createGroupChat, deleteChat, joinHangout, matchWithBuddy, openDirectChat, respondToProposal, sendMessage, toggleFriend } from '@/store/thunks/social';
import { dismissBanner, pushNotification } from '@/store/thunks/notifications';
import { blockUser, submitReport, syncBlocksFromCloud, triggerSosAlert, unblockUser } from '@/store/thunks/safety';
import { cancelMeetup, createMeetup, joinMeetup, inviteToMeetup, leaveMeetup } from '@/store/thunks/meetups';
import { deleteAccount, enforceSessionExpiry, handleFirebaseUser, logout, refreshEmailVerification, touchSession } from '@/store/thunks/auth';
import { recordCheckIn } from '@/store/thunks/gamification';
import { saveFavoriteVenue, removeFavoriteVenue } from '@/store/thunks/favorites';
import { selectGamification } from '@/store/selectors';
import { BuddyProfile, ChatThread, HangoutAlert, Message } from '@/types';
import { userBlocked } from '@/store/slices/safetySlice';
import { messagesReceived } from '@/store/slices/chatsSlice';
import type { RootState } from '@/store/index';

const rootReducer = combineReducers({ auth, settings, location, buddies, hangouts, chats, friends, notifications, gamification, meetups, safety, favorites, ui });

function makeStore() {
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(loggedIn(createUser({ id: 'me', email: 'me@b.co', name: 'Me', emailVerified: true })));
  return store;
}
type TestStore = ReturnType<typeof makeStore>;
const st = (s: TestStore) => s.getState() as unknown as RootState;
// Thunks are typed against the app store; the test store has the same shape
const run = <R,>(s: TestStore, thunk: unknown) => (s.dispatch as unknown as (t: unknown) => R)(thunk);

const buddy = (id: string): BuddyProfile => ({
  id,
  name: `Buddy ${id}`,
  avatar: '',
  age: 26,
  tagline: '',
  bio: '',
  locationName: 'Київ',
  distanceKm: 1,
  coordinates: { lat: 50.46, lng: 30.52 },
  preferredDrinks: ['craft'],
  paymentRule: 'split_50_50',
  currentMood: 'chill_talk',
  favoriteBars: ['Squat 17b'],
  talkTopics: [],
  online: true,
});

const sync = vi.mocked(firestoreSyncService);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('chat thunks', () => {
  const withChat = (s: TestStore) => {
    const thread: ChatThread = { id: 'chat-a', memberIds: ['me', 'a'], buddy: buddy('a'), lastMessage: '', lastMessageTime: '', unreadCount: 0, messages: [] };
    s.dispatch(groupChatCreated(thread));
  };

  it('sends a message optimistically, syncs it encrypted and attaches the cipher', async () => {
    const s = makeStore();
    withChat(s);
    run(s, sendMessage({ chatId: 'chat-a', text: 'Привіт 🍻' }));

    const msg = st(s).chats.threads[0].messages[0];
    expect(msg).toMatchObject({ text: 'Привіт 🍻', isMe: true, senderId: 'me', isEncrypted: true });
    expect(sync.sendEncryptedMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'chat-a', memberIds: ['me', 'a'] }),
      expect.objectContaining({ id: msg.id, senderId: 'me' }),
      expect.objectContaining({ id: 'me', name: 'Me' })
    );

    await vi.waitFor(() => expect(st(s).chats.threads[0].messages[0].cipherPayload).toBe('enc:v1:test'));
    expect(st(s).chats.threads[0].messages).toHaveLength(1); // no duplicate from the cipher update
  });

  it('summarises cheers and audio messages in the chat list', () => {
    const s = makeStore();
    withChat(s);
    run(s, sendMessage({ chatId: 'chat-a', text: 'За нас!', type: 'cheers' }));
    expect(st(s).chats.threads[0].lastMessage).toBe('Тост: За нас!');
  });

  it('keeps the local message when Firestore is unreachable', async () => {
    sync.sendEncryptedMessage.mockRejectedValueOnce(new Error('offline'));
    const s = makeStore();
    withChat(s);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    run(s, sendMessage({ chatId: 'chat-a', text: 'offline msg' }));
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(st(s).chats.threads[0].messages).toHaveLength(1);
    warn.mockRestore();
  });

  it('opens a DM under an id both people derive, without writing to Firestore or faking a greeting', () => {
    const s = makeStore();
    const id = run<string>(s, matchWithBuddy(buddy('x')));
    expect(id).toBe('dm_me_x');
    expect(run<string>(s, openDirectChat(buddy('x')))).toBe('dm_me_x'); // idempotent
    const t = st(s).chats.threads[0];
    expect(t.messages).toHaveLength(0);
    expect(t.memberIds).toEqual(['me', 'x']);
    expect(sync.sendEncryptedMessage).not.toHaveBeenCalled();
  });

  it('gives both people the identical member list, whoever opens the chat (rules reject a reordered list)', () => {
    const asAlice = makeStore();
    asAlice.dispatch(loggedIn(createUser({ id: 'alice', email: 'a@b.co', emailVerified: true })));
    run(asAlice, openDirectChat(buddy('bob')));
    const asBob = makeStore();
    asBob.dispatch(loggedIn(createUser({ id: 'bob', email: 'b@b.co', emailVerified: true })));
    run(asBob, openDirectChat(buddy('alice')));

    expect(st(asAlice).chats.threads[0].memberIds).toEqual(['alice', 'bob']);
    expect(st(asBob).chats.threads[0].memberIds).toEqual(['alice', 'bob']);
    expect(st(asAlice).chats.threads[0].id).toBe(st(asBob).chats.threads[0].id);
  });

  it('derives the same DM id from either side', () => {
    const s = makeStore();
    expect(run<string>(s, openDirectChat(buddy('aaa')))).toBe('dm_aaa_me');
  });

  it('creates a group chat owned by the current user and syncs the intro', () => {
    const s = makeStore();
    const t = run<ChatThread>(s, createGroupChat({ name: 'П’ятниця', topic: 'Настілки', avatar: '🎲', participants: [] }));
    expect(t.isGroup).toBe(true);
    expect(t.createdBy).toBe('me');
    expect(t.id).toMatch(/^grp_me_\d+$/);
    expect(t.memberIds).toEqual(['me']);
    expect(st(s).chats.threads[0].id).toBe(t.id);
    expect(sync.sendEncryptedMessage).toHaveBeenCalledTimes(1);
  });

  it('includes every participant in the group membership', () => {
    const s = makeStore();
    const t = run<ChatThread>(s, createGroupChat({ name: 'G', topic: '', avatar: '', participants: [{ id: 'p1', name: 'P1', avatar: '' }, { id: 'p2', name: 'P2', avatar: '' }] }));
    expect(t.memberIds).toEqual(['me', 'p1', 'p2']);
  });

  it('lets only the group creator add members', () => {
    const s = makeStore();
    const mine = run<ChatThread>(s, createGroupChat({ name: 'Mine', topic: '', avatar: '', participants: [] }));
    run(s, addGroupParticipants(mine.id, [{ id: 'p1', name: 'P1', avatar: '' }]));
    expect(sync.addGroupMembers).toHaveBeenCalledWith(mine.id, [expect.objectContaining({ id: 'p1' })]);
    expect(st(s).chats.threads.find((t) => t.id === mine.id)?.memberIds).toContain('p1');

    vi.clearAllMocks();
    s.dispatch(groupChatCreated({ id: 'grp_other_1', isGroup: true, createdBy: 'other', memberIds: ['other', 'me'], buddy: buddy('other'), lastMessage: '', lastMessageTime: '', unreadCount: 0, messages: [] }));
    run(s, addGroupParticipants('grp_other_1', [{ id: 'p2', name: 'P2', avatar: '' }]));
    expect(sync.addGroupMembers).not.toHaveBeenCalled();
    expect(st(s).chats.threads.find((t) => t.id === 'grp_other_1')?.participants ?? []).toHaveLength(0);
  });

  it('removes a chat from this device only; nothing is deleted in the cloud', () => {
    const s = makeStore();
    withChat(s);
    run(s, deleteChat('chat-a'));
    expect(st(s).chats.threads).toHaveLength(0);
    expect(st(s).chats.hiddenIds).toEqual(['chat-a']);
  });
});

describe('friend thunks', () => {
  it('adds a friend once: +50 XP, a notification and a cloud sync', () => {
    const s = makeStore();
    run(s, addFriend(buddy('a')));
    run(s, addFriend(buddy('a')));

    expect(st(s).friends.ids).toEqual(['a']);
    expect(selectGamification(st(s)).xp).toBe(50);
    expect(st(s).notifications.items).toHaveLength(1);
    expect(st(s).notifications.items[0].type).toBe('friend_added');
    expect(sync.syncFriend).toHaveBeenCalledTimes(1);
  });

  it('toggles friendship off without granting XP again', () => {
    const s = makeStore();
    expect(run<boolean>(s, toggleFriend(buddy('a')))).toBe(true);
    expect(run<boolean>(s, toggleFriend(buddy('a')))).toBe(false);
    expect(st(s).friends.ids).toEqual([]);
    expect(selectGamification(st(s)).xp).toBe(50);
    expect(sync.removeFriendFromFirestore).toHaveBeenCalledWith('me', 'a');
  });
});

describe('hangout thunks', () => {
  const hangout: HangoutAlert = {
    id: 'h1',
    userId: 'host',
    userName: 'Host',
    userAvatar: '',
    barName: 'Squat 17b',
    locationArea: '',
    drinkPreference: '',
    description: '',
    createdAt: '',
    slotsAvailable: 2,
    participantsCount: 1,
    joinedUsers: [],
  };

  it('joins a hangout, notifies and syncs', async () => {
    const s = makeStore();
    s.dispatch(hangoutPublished(hangout));
    await run<Promise<void>>(s, joinHangout('h1'));

    expect(st(s).hangouts.items[0].participantsCount).toBe(2);
    expect(st(s).hangouts.items[0].joinedUsers).toContain('me');
    expect(st(s).notifications.items[0].hangoutId).toBe('h1');
    expect(sync.joinLiveHangout).toHaveBeenCalledWith('h1', 'me');
  });

  it('closes a hangout locally and in the cloud', async () => {
    const s = makeStore();
    s.dispatch(hangoutPublished(hangout));
    await run<Promise<void>>(s, closeHangout('h1'));
    expect(st(s).hangouts.items).toHaveLength(0);
    expect(sync.closeLiveHangout).toHaveBeenCalledWith('h1');
  });
});

describe('notification thunks', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a banner that auto-dismisses after 6 seconds', () => {
    vi.useFakeTimers();
    const s = makeStore();
    run(s, pushNotification({ type: 'system', title: 'Hi', body: 'There' }));
    expect(st(s).ui.activeBanner?.title).toBe('Hi');
    expect(st(s).notifications.items[0].isRead).toBe(false);

    vi.advanceTimersByTime(5999);
    expect(st(s).ui.activeBanner).not.toBeNull();
    vi.advanceTimersByTime(2);
    expect(st(s).ui.activeBanner).toBeNull();
  });

  it('still stores the notification when banners are disabled', () => {
    const s = makeStore();
    s.dispatch(pushSettingsUpdated({ bannerEnabled: false }));
    run(s, pushNotification({ type: 'system', title: 'Quiet', body: '' }));
    expect(st(s).ui.activeBanner).toBeNull();
    expect(st(s).notifications.items).toHaveLength(1);
  });

  it('dismissBanner clears the banner immediately', () => {
    const s = makeStore();
    run(s, pushNotification({ type: 'system', title: 'x', body: '' }));
    run(s, dismissBanner());
    expect(st(s).ui.activeBanner).toBeNull();
  });
});

describe('safety thunks', () => {
  const report = (s: TestStore, category: 'spam' | 'harassment', extra = {}) =>
    run(s, submitReport({ targetId: 'bad', targetType: 'profile', targetName: 'Bad', category, comment: ' c ', ...extra }));

  it('does not block on a single low-severity report', () => {
    const s = makeStore();
    report(s, 'spam');
    expect(st(s).safety.blockedUsers).toHaveLength(0);
    expect(st(s).safety.reports[0].comment).toBe('c');
  });

  it('auto-blocks on a critical category', () => {
    const s = makeStore();
    report(s, 'harassment');
    expect(st(s).safety.blockedUsers[0]).toMatchObject({ userId: 'bad', autoBlocked: true });
  });

  it('auto-blocks on the second report against the same user', () => {
    const s = makeStore();
    report(s, 'spam');
    report(s, 'spam');
    expect(st(s).safety.blockedUsers).toHaveLength(1);
    expect(st(s).safety.blockedUsers[0].reason).toContain('2 скарги');
  });

  it('honours an explicit "also block"', () => {
    const s = makeStore();
    report(s, 'spam', { shouldBlockUser: true });
    expect(st(s).safety.blockedUsers).toHaveLength(1);
  });

  it('is idempotent when blocking twice', () => {
    const s = makeStore();
    run(s, blockUser('u', 'U'));
    run(s, blockUser('u', 'U'));
    expect(st(s).safety.blockedUsers).toHaveLength(1);
    expect(st(s).notifications.items).toHaveLength(1);
  });

  it('SOS blocks the interlocutor and raises a safety alert', () => {
    const s = makeStore();
    const res = run<{ interlocutorBlocked: boolean }>(s, triggerSosAlert({ interlocutorId: 'u', interlocutorName: 'U' }));
    expect(res.interlocutorBlocked).toBe(true);
    expect(st(s).safety.blockedUsers[0].userId).toBe('u');
    expect(st(s).notifications.items.some((n) => n.type === 'safety_alert')).toBe(true);
  });
});

describe('meetup thunks', () => {
  const create = (s: TestStore, max = 2) =>
    run<{ id: string }>(
      s,
      createMeetup({
        title: 'Настілки',
        description: '',
        venueName: 'Squat 17b',
        venueAddress: '',
        scheduledDate: '01.10.2026',
        scheduledTime: '19:00',
        maxParticipants: max,
      })
    );

  it('creates a meetup hosted by the current user and awards +75 XP', () => {
    const s = makeStore();
    const m = create(s);
    expect(st(s).meetups.items[0]).toMatchObject({ id: m.id, creatorId: 'me', status: 'upcoming' });
    expect(selectGamification(st(s)).xp).toBe(75);
    expect(sync.saveMeetup).toHaveBeenCalledWith(expect.objectContaining({ id: m.id, creatorId: 'me' }));
  });

  it('syncs joining as a change to the caller\'s own entry only', () => {
    const s = makeStore();
    const m = create(s, 6);
    s.dispatch(loggedIn(createUser({ id: 'guest1', email: 'g@b.co', emailVerified: true })));
    expect(run<boolean>(s, joinMeetup(m.id))).toBe(true);
    expect(sync.setMeetupParticipation).toHaveBeenCalledWith(m.id, 'guest1', expect.objectContaining({ userId: 'guest1', role: 'member', status: 'going' }));
    expect(sync.saveMeetup).toHaveBeenCalledTimes(1); // only the creator's original write

    run(s, leaveMeetup(m.id));
    expect(sync.setMeetupParticipation).toHaveBeenLastCalledWith(m.id, 'guest1', null);
  });

  it('keeps invites and cancellation host-only', () => {
    const s = makeStore();
    const m = create(s, 6);
    s.dispatch(loggedIn(createUser({ id: 'guest1', email: 'g@b.co', emailVerified: true })));
    vi.clearAllMocks();
    expect(run<number>(s, inviteToMeetup(m.id, [buddy('a')]))).toBe(0);
    run(s, cancelMeetup(m.id));
    expect(st(s).meetups.items[0].status).toBe('upcoming');
    expect(sync.saveMeetup).not.toHaveBeenCalled();
  });

  it('rejects joining a full meetup without rewards', () => {
    const s = makeStore();
    const m = create(s, 1); // host already fills the only seat
    s.dispatch(loggedIn(createUser({ id: 'other', email: 'other@b.co', emailVerified: true })));
    const xpBefore = selectGamification(st(s)).xp;
    expect(run<boolean>(s, joinMeetup(m.id))).toBe(false);
    expect(selectGamification(st(s)).xp).toBe(xpBefore);
  });

  it('invites only new people and rewards +20 XP each', () => {
    const s = makeStore();
    const m = create(s, 6);
    const xpBefore = selectGamification(st(s)).xp;
    expect(run<number>(s, inviteToMeetup(m.id, [buddy('a'), buddy('b')]))).toBe(2);
    expect(run<number>(s, inviteToMeetup(m.id, [buddy('a')]))).toBe(0);
    expect(selectGamification(st(s)).xp).toBe(xpBefore + 40);
  });
});

describe('gamification & favorites thunks', () => {
  it('records a check-in, persists state per user and syncs to the cloud', () => {
    const s = makeStore();
    const res = run<{ earnedXp: number }>(s, recordCheckIn({ barName: 'Squat 17b', type: 'bar_visit' }));
    expect(res.earnedXp).toBe(125);
    expect(st(s).gamification.byUser.me.checkIns).toHaveLength(1);
    expect(sync.syncGamification).toHaveBeenCalledWith('me', expect.objectContaining({ xp: expect.any(Number) }));
  });

  it('saves and removes favorites locally and in the cloud', () => {
    const s = makeStore();
    run(s, saveFavoriteVenue({ id: 'v', name: 'V', area: 'A', category: 'c', lat: 1, lng: 2 }));
    expect(st(s).favorites.items[0].createdAt).toBeTruthy();
    expect(sync.saveFavoriteVenue).toHaveBeenCalledWith('me', expect.objectContaining({ id: 'v' }));
    run(s, removeFavoriteVenue('v'));
    expect(st(s).favorites.items).toHaveLength(0);
    expect(sync.removeFavoriteVenue).toHaveBeenCalledWith('me', 'v');
  });
});

describe('Firebase auth bridge', () => {
  type Fb = Parameters<typeof handleFirebaseUser>[0];
  const fb = (uid: string, over: Record<string, unknown> = {}) =>
    ({ uid, email: `${uid}@b.co`, displayName: uid.toUpperCase(), photoURL: null, emailVerified: true, ...over }) as unknown as Fb;
  const empty = () => configureStore({ reducer: rootReducer });
  const seed = (s: TestStore) => {
    run(s, addFriend(buddy('a')));
    run(s, blockUser('bad', 'Bad'));
    s.dispatch(groupChatCreated({ id: 'chat-a', buddy: buddy('a'), lastMessage: '', lastMessageTime: '', unreadCount: 0, messages: [] }));
  };

  it('drops a DiceBear placeholder stored by an earlier build, but keeps a real avatar', () => {
    const s = empty();
    run(s, handleFirebaseUser(fb('u1')));
    s.dispatch(loggedIn({ ...st(s).auth.user, avatar: 'https://api.dicebear.com/7.x/initials/png?seed=U1&backgroundColor=f59e0b' }));
    run(s, handleFirebaseUser(fb('u1')));
    expect(st(s).auth.user.avatar).toBe('');

    run(s, handleFirebaseUser(fb('u1', { photoURL: 'https://cdn.example/me.png' })));
    expect(st(s).auth.user.avatar).toBe('https://cdn.example/me.png');
  });

  it('is not ready until Firebase reports, then mirrors the account into Redux', () => {
    const s = empty();
    expect(st(s).ui.authReady).toBe(false);
    run(s, handleFirebaseUser(fb('u1', { emailVerified: false })));
    expect(st(s).ui.authReady).toBe(true);
    expect(st(s).auth.user).toMatchObject({ id: 'u1', email: 'u1@b.co', name: 'U1', isLoggedIn: true, emailVerified: false });
  });

  it('reports ready and stays signed out when there is no Firebase user', () => {
    const s = empty();
    run(s, handleFirebaseUser(null));
    expect(st(s).ui.authReady).toBe(true);
    expect(st(s).auth.user.isLoggedIn).toBe(false);
  });

  it('signs the app out when Firebase signs out, keeping local data for the same person', () => {
    const s = empty();
    run(s, handleFirebaseUser(fb('u1')));
    seed(s);
    run(s, handleFirebaseUser(null));
    expect(st(s).auth.user.isLoggedIn).toBe(false);
    expect(st(s).chats.threads).toHaveLength(1);

    run(s, handleFirebaseUser(fb('u1')));
    expect(st(s).chats.threads).toHaveLength(1);
    expect(st(s).friends.ids).toEqual(['a']);
    expect(st(s).safety.blockedUsers).toHaveLength(1);
  });

  it('wipes personal data when a different account signs in', () => {
    const s = empty();
    run(s, handleFirebaseUser(fb('u1')));
    seed(s);
    run(s, handleFirebaseUser(null));
    run(s, handleFirebaseUser(fb('u2')));
    expect(st(s).chats.threads).toHaveLength(0);
    expect(st(s).friends.ids).toHaveLength(0);
    expect(st(s).safety.blockedUsers).toHaveLength(0);
    expect(st(s).auth.dataOwnerId).toBe('u2');
  });

  it('forces a fresh sign-in when a restored session sat unused beyond 36 hours', () => {
    const s = empty();
    run(s, handleFirebaseUser(fb('u1')));
    const stale = createUser({ id: 'u1', email: 'u1@b.co' }, Date.now() - SESSION_DURATION_MS - 1000);
    s.dispatch(loggedIn(stale));
    vi.mocked(authService.logout).mockClear();
    run(s, handleFirebaseUser(fb('u1')));
    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it('restores the birth date from the private profile on a fresh device', async () => {
    sync.getPrivateProfile.mockResolvedValueOnce({ birthDate: '1990-02-03' });
    const s = empty();
    run(s, handleFirebaseUser(fb('u1')));
    await vi.waitFor(() => expect(st(s).auth.user.birthDate).toBe('1990-02-03'));
  });

  it('touchSession extends a live session and signs out an expired one', () => {
    const s = makeStore();
    const before = st(s).auth.user.sessionExpiresAt!;
    run(s, touchSession());
    expect(st(s).auth.user.sessionExpiresAt!).toBeGreaterThanOrEqual(before);

    s.dispatch(loggedIn(createUser({ id: 'me', email: 'me@b.co' }, Date.now() - SESSION_DURATION_MS - 1)));
    vi.mocked(authService.logout).mockClear();
    run(s, touchSession());
    expect(authService.logout).toHaveBeenCalledTimes(1);
    vi.mocked(authService.logout).mockClear();
    run(s, enforceSessionExpiry());
    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it('logout signs out of Firebase and clears the session immediately', async () => {
    const s = makeStore();
    vi.mocked(authService.logout).mockClear();
    await run<Promise<void>>(s, logout());
    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(st(s).auth.user.isLoggedIn).toBe(false);
  });

  it('marks the account verified only when Firebase confirms', async () => {
    const s = empty();
    run(s, handleFirebaseUser(fb('u1', { emailVerified: false })));
    vi.mocked(authService.refreshVerification).mockResolvedValueOnce(false);
    expect(await run<Promise<boolean>>(s, refreshEmailVerification())).toBe(false);
    expect(st(s).auth.user.emailVerified).toBe(false);
    vi.mocked(authService.refreshVerification).mockResolvedValueOnce(true);
    expect(await run<Promise<boolean>>(s, refreshEmailVerification())).toBe(true);
    expect(st(s).auth.user.emailVerified).toBe(true);
  });

  it('deleting the account wipes local data and signs out; a failure leaves everything intact', async () => {
    const s = empty();
    run(s, handleFirebaseUser(fb('u1')));
    seed(s);

    vi.mocked(authService.deleteAccount).mockRejectedValueOnce(Object.assign(new Error('bad password'), { code: 'auth/invalid-credential' }));
    await expect(run<Promise<void>>(s, deleteAccount('wrong'))).rejects.toThrow();
    expect(st(s).auth.user.isLoggedIn).toBe(true);
    expect(st(s).chats.threads).toHaveLength(1);

    await run<Promise<void>>(s, deleteAccount('right'));
    expect(authService.deleteAccount).toHaveBeenLastCalledWith('right');
    expect(st(s).auth.user.isLoggedIn).toBe(false);
    expect(st(s).chats.threads).toHaveLength(0);
    expect(st(s).friends.ids).toHaveLength(0);
  });
});

describe('thunk text follows the UI language', () => {
  it('writes notifications in the language chosen in settings', () => {
    const s = makeStore();
    s.dispatch(languageChosen('en'));
    run(s, addFriend(buddy('a')));
    const n = st(s).notifications.items[0];
    expect(n.title).toBe('🤝 Buddy a is now your friend!');
    expect(n.actionText).toBe('Message');
    expect(n.timestamp).toBe('Just now');
  });

  it('switching language changes the next notification, not the stored ones', () => {
    const s = makeStore();
    s.dispatch(languageChosen('de'));
    run(s, addFriend(buddy('a')));
    s.dispatch(languageChosen('pl'));
    run(s, blockUser('bad', 'Bad'));
    const [latest, earlier] = st(s).notifications.items;
    expect(latest.title).toBe('🚫 Użytkownik zablokowany');
    expect(earlier.title).toBe('🤝 Buddy a ist jetzt dein Freund!');
  });

  it('falls back to Ukrainian by default', () => {
    const s = makeStore();
    run(s, addFriend(buddy('a')));
    expect(st(s).notifications.items[0].title).toBe('🤝 Buddy a тепер у друзях!');
  });
});

describe('server-side blocking (client half)', () => {
  const record = (id: string) => ({ userId: id, userName: `U ${id}`, blockedAt: '12:00' });

  it('writes a block to the cloud so the rules can enforce it, and removes it on unblock', () => {
    const s = makeStore();
    run(s, blockUser('bad', 'Bad', 'https://x.test/a.png'));
    expect(sync.saveBlock).toHaveBeenCalledWith('me', expect.objectContaining({ userId: 'bad', userName: 'Bad', userAvatar: 'https://x.test/a.png' }));

    run(s, unblockUser('bad'));
    expect(sync.removeBlock).toHaveBeenCalledWith('me', 'bad');
    expect(st(s).safety.blockedUsers).toHaveLength(0);
  });

  it('does not write the same block twice', () => {
    const s = makeStore();
    run(s, blockUser('bad', 'Bad'));
    run(s, blockUser('bad', 'Bad'));
    expect(sync.saveBlock).toHaveBeenCalledTimes(1);
  });

  it('an auto-block from reports and the SOS button are enforced on the server too', () => {
    const s = makeStore();
    run(s, submitReport({ targetId: 'bad', targetType: 'profile', targetName: 'Bad', category: 'harassment', comment: '' }));
    run(s, triggerSosAlert({ interlocutorId: 'sos', interlocutorName: 'Sos' }));
    expect(sync.saveBlock).toHaveBeenCalledWith('me', expect.objectContaining({ userId: 'bad', autoBlocked: true }));
    expect(sync.saveBlock).toHaveBeenCalledWith('me', expect.objectContaining({ userId: 'sos', autoBlocked: true }));
  });

  it('first sync merges: blocks made before this feature are pushed to the cloud and kept', async () => {
    const s = makeStore();
    s.dispatch(userBlocked(record('legacy')));
    sync.getBlocks.mockResolvedValueOnce([record('fromOtherDevice')]);
    await run<Promise<void>>(s, syncBlocksFromCloud());

    expect(st(s).safety.blockedUsers.map((u) => u.userId).sort()).toEqual(['fromOtherDevice', 'legacy']);
    expect(sync.saveBlock).toHaveBeenCalledWith('me', expect.objectContaining({ userId: 'legacy' }));
    expect(st(s).safety.cloudSyncedFor).toBe('me');
  });

  it('later syncs let the cloud win, so unblocking on another device propagates', async () => {
    const s = makeStore();
    s.dispatch(userBlocked(record('a')));
    s.dispatch(userBlocked(record('b')));
    sync.getBlocks.mockResolvedValueOnce([record('a'), record('b')]);
    await run<Promise<void>>(s, syncBlocksFromCloud()); // first sync
    vi.clearAllMocks();

    sync.getBlocks.mockResolvedValueOnce([record('a')]); // b was unblocked elsewhere
    await run<Promise<void>>(s, syncBlocksFromCloud());
    expect(st(s).safety.blockedUsers.map((u) => u.userId)).toEqual(['a']);
    expect(sync.saveBlock).not.toHaveBeenCalled(); // nothing is re-pushed
  });

  it('keeps local blocks when the cloud list cannot be read', async () => {
    const s = makeStore();
    s.dispatch(userBlocked(record('a')));
    sync.getBlocks.mockResolvedValueOnce(null);
    await run<Promise<void>>(s, syncBlocksFromCloud());
    expect(st(s).safety.blockedUsers).toHaveLength(1);
    expect(st(s).safety.cloudSyncedFor).toBeNull();
  });

  it('caps a new group at 10 people including the creator', () => {
    const s = makeStore();
    const many = Array.from({ length: 15 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: '' }));
    const t = run<ChatThread>(s, createGroupChat({ name: 'G', topic: '', avatar: '', participants: many }));
    expect(t.memberIds).toHaveLength(10);
    expect(t.participants).toHaveLength(9);
  });

  it('only adds as many members as there is room for', () => {
    const s = makeStore();
    const first = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: '' }));
    const t = run<ChatThread>(s, createGroupChat({ name: 'G', topic: '', avatar: '', participants: first }));
    run(s, addGroupParticipants(t.id, [{ id: 'x1', name: 'X1', avatar: '' }, { id: 'x2', name: 'X2', avatar: '' }, { id: 'x3', name: 'X3', avatar: '' }]));

    const stored = st(s).chats.threads.find((c) => c.id === t.id)!;
    expect(stored.memberIds).toHaveLength(10);
    expect(sync.addGroupMembers).toHaveBeenCalledWith(t.id, [expect.objectContaining({ id: 'x1' }), expect.objectContaining({ id: 'x2' })]);
  });
});

describe('answering a meetup proposal', () => {
  const setup = () => {
    const s = makeStore();
    s.dispatch(groupChatCreated({ id: 'dm_a_me', memberIds: ['me', 'a'], buddy: buddy('a'), lastMessage: '', lastMessageTime: '', unreadCount: 0, messages: [] }));
    const proposal: Message = {
      id: 'p1', chatId: 'dm_a_me', senderId: 'a', senderName: 'A', text: 'Запропонував зустріч у Squat', timestamp: '20:00', isMe: false, type: 'location_proposal',
      proposalData: { barName: 'Squat 17b', address: 'Київ', time: '20:00', status: 'pending' },
    };
    s.dispatch(messagesReceived({ chatId: 'dm_a_me', messages: [proposal] }));
    vi.clearAllMocks();
    return s;
  };
  const proposalOf = (s: TestStore) => st(s).chats.threads[0].messages.find((m) => m.id === 'p1')!;

  it('sends the answer as its own message with a deterministic id, and shows it right away', () => {
    const s = setup();
    run(s, respondToProposal('dm_a_me', 'p1', 'accepted'));

    expect(proposalOf(s).proposalData?.status).toBe('accepted');
    expect(sync.sendEncryptedMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dm_a_me' }),
      expect.objectContaining({ id: 'resp_p1', type: 'proposal_response', proposalId: 'p1', proposalStatus: 'accepted', senderId: 'me' }),
      expect.anything()
    );
    expect(st(s).chats.threads[0].lastMessage).toContain('Squat 17b');
  });

  it('awards the meetup XP for accepting, not for declining', () => {
    const accepted = setup();
    run(accepted, respondToProposal('dm_a_me', 'p1', 'accepted'));
    // 90 for the meetup plus the first-check-in (+50) and "King of Podil" (+50, Squat) achievements
    expect(selectGamification(st(accepted)).xp).toBe(190);

    const declined = setup();
    run(declined, respondToProposal('dm_a_me', 'p1', 'declined'));
    expect(proposalOf(declined).proposalData?.status).toBe('declined');
    expect(selectGamification(st(declined)).xp).toBe(0);
  });

  it('answers only once, and never your own proposal', () => {
    const s = setup();
    run(s, respondToProposal('dm_a_me', 'p1', 'accepted'));
    run(s, respondToProposal('dm_a_me', 'p1', 'declined'));
    expect(sync.sendEncryptedMessage).toHaveBeenCalledTimes(1);
    expect(proposalOf(s).proposalData?.status).toBe('accepted');

    const mine = makeStore();
    mine.dispatch(groupChatCreated({ id: 'dm_a_me', memberIds: ['me', 'a'], buddy: buddy('a'), lastMessage: '', lastMessageTime: '', unreadCount: 0, messages: [] }));
    mine.dispatch(messagesReceived({ chatId: 'dm_a_me', messages: [{ id: 'p2', chatId: 'dm_a_me', senderId: 'me', senderName: 'Me', text: 'x', timestamp: '1', isMe: true, type: 'location_proposal', proposalData: { barName: 'B', address: 'A', time: 'T', status: 'pending' } }] }));
    vi.clearAllMocks();
    run(mine, respondToProposal('dm_a_me', 'p2', 'accepted'));
    expect(sync.sendEncryptedMessage).not.toHaveBeenCalled();
  });

  it('ignores unknown proposals and ordinary messages', () => {
    const s = setup();
    run(s, respondToProposal('dm_a_me', 'nope', 'accepted'));
    run(s, respondToProposal('missing-chat', 'p1', 'accepted'));
    expect(sync.sendEncryptedMessage).not.toHaveBeenCalled();
  });

  it('writes the answer in the responder\'s language', () => {
    const s = setup();
    s.dispatch(languageChosen('en'));
    run(s, respondToProposal('dm_a_me', 'p1', 'declined'));
    expect(st(s).chats.threads[0].lastMessage).toBe('Not this time 🙏');
  });
});
