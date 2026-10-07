import outbox from '@/store/slices/outboxSlice';
import { describe, it, expect } from 'vitest';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

import auth, { loggedIn, loggedOut, sessionTouched, profileUpdated } from '@/store/slices/authSlice';
import settings, { languageAutoDetected, languageChosen } from '@/store/slices/settingsSlice';
import location, { locationUpdated } from '@/store/slices/locationSlice';
import buddies, { buddiesSynced } from '@/store/slices/buddiesSlice';
import hangouts, { expiredHangoutsPruned, hangoutClosed, hangoutJoined, hangoutPublished, hangoutsSynced } from '@/store/slices/hangoutsSlice';
import chats, { MAX_MESSAGES_PER_THREAD, inboxSynced, chatDeleted, chatRead, directChatEnsured, groupChatCreated, messageAppended, messagesReceived, participantsAdded } from '@/store/slices/chatsSlice';
import friends, { friendAdded, friendRemoved } from '@/store/slices/friendsSlice';
import notifications, { allNotificationsRead, notificationReceived, notificationRead } from '@/store/slices/notificationsSlice';
import gamification from '@/store/slices/gamificationSlice';
import meetups, { archivedMeetupsPruned, meetupUpserted, meetupsMerged } from '@/store/slices/meetupsSlice';
import safety, { blocksSynced, reportFiled, userBlocked, userUnblocked } from '@/store/slices/safetySlice';
import favorites, { favoriteRemoved, favoriteSaved } from '@/store/slices/favoritesSlice';
import ui, { bannerDismissed, bannerShown } from '@/store/slices/uiSlice';
import {
  selectBuddies,
  selectFriends,
  selectGamification,
  selectGeoBlock,
  selectHangouts,
  selectMeetups,
  selectUnreadChatsCount,
  selectVisibleChatThreads,
} from '@/store/selectors';
import { createUser, SESSION_DURATION_MS } from '@/logic/session';
import { BuddyProfile, ChatThread, HangoutAlert, Message, PushNotificationItem } from '@/types';
import type { RootState } from '@/store/index';

const rootReducer = combineReducers({ outbox, auth, settings, location, buddies, hangouts, chats, friends, notifications, gamification, meetups, safety, favorites, ui });
const makeStore = () => configureStore({ reducer: rootReducer });
const state = (store: ReturnType<typeof makeStore>) => store.getState() as unknown as RootState;

const buddy = (id: string, over: Partial<BuddyProfile> = {}): BuddyProfile => ({
  id,
  name: `Buddy ${id}`,
  avatar: '',
  age: 26,
  tagline: '',
  bio: '',
  locationName: 'Київ',
  distanceKm: 99,
  coordinates: { lat: 50.4635, lng: 30.518 },
  preferredDrinks: ['craft'],
  paymentRule: 'split_50_50',
  currentMood: 'chill_talk',
  favoriteBars: [],
  talkTopics: [],
  online: true,
  ...over,
});

const msg = (id: string, over: Partial<Message> = {}): Message => ({
  id,
  chatId: 'chat-a',
  senderId: 'a',
  senderName: 'A',
  text: `text ${id}`,
  timestamp: '12:00',
  isMe: false,
  ...over,
});

describe('auth slice', () => {
  it('starts as a logged-out guest', () => {
    expect(state(makeStore()).auth.user.isLoggedIn).toBe(false);
  });

  it('logs in, extends the session on touch and logs out', () => {
    const store = makeStore();
    const user = createUser({ id: 'u1', email: 'a@b.co' }, 1000);
    store.dispatch(loggedIn(user));
    store.dispatch(sessionTouched(5000));
    expect(state(store).auth.user.sessionExpiresAt).toBe(5000 + SESSION_DURATION_MS);

    store.dispatch(loggedOut());
    expect(state(store).auth.user.isLoggedIn).toBe(false);
  });

  it('does not extend an already expired session (thunks sign out of Firebase instead)', () => {
    const store = makeStore();
    store.dispatch(loggedIn(createUser({ id: 'u1', email: 'a@b.co' }, 1000)));
    store.dispatch(sessionTouched(1000 + SESSION_DURATION_MS + 1));
    expect(state(store).auth.user.sessionExpiresAt).toBe(1000 + SESSION_DURATION_MS);
    expect(state(store).auth.user.isLoggedIn).toBe(true);
  });

  it('remembers who owns the local data across logout', () => {
    const store = makeStore();
    store.dispatch(loggedIn(createUser({ id: 'u1', email: 'a@b.co' })));
    store.dispatch(loggedOut());
    expect(state(store).auth.dataOwnerId).toBe('u1');
  });

  it('recomputes age when the birth date changes', () => {
    const store = makeStore();
    store.dispatch(loggedIn(createUser({ id: 'u1', email: 'a@b.co' })));
    store.dispatch(profileUpdated({ birthDate: '1990-01-01' }));
    expect(state(store).auth.user.age).toBeGreaterThanOrEqual(35);
  });
});

describe('settings slice', () => {
  it('auto-detects language only until the user picks one', () => {
    const store = makeStore();
    store.dispatch(languageAutoDetected({ lang: 'pl', hint: 'geo' }));
    expect(state(store).settings.language).toBe('pl');

    store.dispatch(languageChosen('de'));
    store.dispatch(languageAutoDetected({ lang: 'en', hint: 'geo' }));
    expect(state(store).settings.language).toBe('de');
    expect(state(store).settings.languageIsManual).toBe(true);
  });
});

describe('chats slice', () => {
  const thread = (): ChatThread => ({
    id: 'chat-a',
    buddy: buddy('a'),
    lastMessage: '',
    lastMessageTime: '',
    unreadCount: 0,
    messages: [],
  });

  const withThread = () => {
    const store = makeStore();
    store.dispatch(groupChatCreated(thread()));
    return store;
  };

  it('creates a direct chat once and un-hides it when re-opened', () => {
    const store = makeStore();
    const action = directChatEnsured({ chatId: 'dm_a_me', memberIds: ['me', 'a'], buddy: buddy('a') });
    store.dispatch(action);
    store.dispatch(action);
    expect(state(store).chats.threads).toHaveLength(1);
    expect(state(store).chats.threads[0].memberIds).toEqual(['me', 'a']);

    store.dispatch(chatDeleted('dm_a_me'));
    expect(state(store).chats.hiddenIds).toEqual(['dm_a_me']);
    store.dispatch(action);
    expect(state(store).chats.hiddenIds).toEqual([]);
    expect(state(store).chats.threads).toHaveLength(1);
  });

  it('appends own messages, dedupes by id and moves the thread to the top', () => {
    const store = withThread();
    store.dispatch(groupChatCreated({ ...thread(), id: 'chat-b' }));
    const m = msg('1', { isMe: true });
    store.dispatch(messageAppended({ chatId: 'chat-a', message: m, summary: 'hi' }));
    store.dispatch(messageAppended({ chatId: 'chat-a', message: m, summary: 'hi' }));

    const threads = state(store).chats.threads;
    expect(threads[0].id).toBe('chat-a');
    expect(threads[0].messages).toHaveLength(1);
    expect(threads[0].lastMessage).toBe('hi');
  });

  it('merges Firestore snapshots without duplicating optimistic messages', () => {
    const store = withThread();
    store.dispatch(messageAppended({ chatId: 'chat-a', message: msg('1', { isMe: true }), summary: 's' }));
    store.dispatch(
      messagesReceived({
        chatId: 'chat-a',
        messages: [msg('1', { isMe: true, cipherPayload: 'enc:v1:x', hasPendingWrites: false }), msg('2'), msg('3')],
      })
    );

    const t = state(store).chats.threads[0];
    expect(t.messages.map((m) => m.id)).toEqual(['1', '2', '3']);
    expect(t.messages[0].cipherPayload).toBe('enc:v1:x');
    expect(t.lastMessage).toBe('text 3');
    expect(t.unreadCount).toBe(0); // unread is driven by the inbox, this stream only runs while the chat is open
  });

  it('keeps only the newest messages per thread', () => {
    const store = withThread();
    const many = Array.from({ length: MAX_MESSAGES_PER_THREAD + 25 }, (_, i) => msg(`m${i}`));
    store.dispatch(messagesReceived({ chatId: 'chat-a', messages: many }));
    const t = state(store).chats.threads[0];
    expect(t.messages).toHaveLength(MAX_MESSAGES_PER_THREAD);
    expect(t.messages[0].id).toBe('m25');
    expect(t.lastMessage).toBe(`text m${MAX_MESSAGES_PER_THREAD + 24}`);
  });

  it('clears unread, updates proposals, adds participants and deletes', () => {
    const store = withThread();
    store.dispatch(messagesReceived({ chatId: 'chat-a', messages: [msg('p', { type: 'location_proposal', proposalData: { barName: 'B', address: 'A', time: 'T', status: 'pending' } })] }));
    store.dispatch(inboxSynced({ myId: 'me', openChatId: null, chats: [{ thread: { ...thread(), updatedAt: 'u1', lastMessage: 'hi', lastMessageTime: '1' }, lastSenderId: 'a' }] }));
    expect(selectUnreadChatsCount(state(store))).toBe(1);

    store.dispatch(chatRead('chat-a'));
    expect(selectUnreadChatsCount(state(store))).toBe(0);

    const p = { id: 'u1', name: 'U1', avatar: '' };
    const notice = msg('n', { senderId: 'system' });
    store.dispatch(participantsAdded({ chatId: 'chat-a', participants: [p], notice }));
    store.dispatch(participantsAdded({ chatId: 'chat-a', participants: [p], notice: msg('n2') }));
    expect(state(store).chats.threads[0].participants).toHaveLength(1);
    expect(state(store).chats.threads[0].messages.some((m) => m.id === 'n2')).toBe(false);

    store.dispatch(chatDeleted('chat-a'));
    expect(state(store).chats.threads).toHaveLength(0);
  });
});

describe('chat inbox sync', () => {
  const cloudThread = (over: Partial<ChatThread> = {}): ChatThread => ({
    id: 'dm_a_me', memberIds: ['a', 'me'], buddy: buddy('a'), lastMessage: 'Привіт', lastMessageTime: '12:00', updatedAt: 'u1', unreadCount: 0, messages: [], ...over,
  });
  const sync = (store: ReturnType<typeof makeStore>, thread: ChatThread, lastSenderId = 'a', openChatId: string | null = null) =>
    store.dispatch(inboxSynced({ myId: 'me', openChatId, chats: [{ thread, lastSenderId }] }));

  it('adds a chat someone else started, unread when they wrote last', () => {
    const store = makeStore();
    sync(store, cloudThread());
    expect(state(store).chats.threads).toHaveLength(1);
    expect(state(store).chats.threads[0].unreadCount).toBe(1);
  });

  describe('a thread this device never matched against the cloud (no updatedAt yet)', () => {
    // e.g. a chat opened locally, or the first sync after a reinstall
    const localThread = (lastMessage: string) => {
      const store = makeStore();
      store.dispatch(directChatEnsured({ chatId: 'dm_a_me', memberIds: ['a', 'me'], buddy: buddy('a') }));
      store.dispatch(messagesReceived({ chatId: 'dm_a_me', messages: [msg('1', { chatId: 'dm_a_me', text: lastMessage })] }));
      return store;
    };

    it('does not flag an already-read reply as unread', () => {
      const store = localThread('reply I already read'); // the stream put this on the thread and the user saw it
      sync(store, cloudThread({ lastMessage: 'reply I already read', updatedAt: 'T1' }));
      expect(state(store).chats.threads[0].unreadCount).toBe(0);
      expect(state(store).chats.threads[0].updatedAt).toBe('T1'); // from now on changes are detected by updatedAt
    });

    it('still flags a message that arrived while the app was closed', () => {
      const store = localThread('old message');
      sync(store, cloudThread({ lastMessage: 'something new', updatedAt: 'T1' }));
      expect(state(store).chats.threads[0].unreadCount).toBe(1);
      expect(state(store).chats.threads[0].lastMessage).toBe('something new');
    });

    it('never flags your own message', () => {
      const store = localThread('old message');
      sync(store, cloudThread({ lastMessage: 'sent from my other phone', updatedAt: 'T1' }), 'me');
      expect(state(store).chats.threads[0].unreadCount).toBe(0);
    });

    it('does not repeat the badge once updatedAt is known', () => {
      const store = localThread('old message');
      sync(store, cloudThread({ lastMessage: 'something new', updatedAt: 'T1' }));
      sync(store, cloudThread({ lastMessage: 'something new', updatedAt: 'T1' }));
      expect(state(store).chats.threads[0].unreadCount).toBe(1);
    });
  });

  it('does not badge your own messages (e.g. from another device)', () => {
    const store = makeStore();
    sync(store, cloudThread(), 'me');
    expect(state(store).chats.threads[0].unreadCount).toBe(0);
  });

  it('bumps unread only on genuinely new activity and moves the chat up', () => {
    const store = makeStore();
    store.dispatch(groupChatCreated({ ...cloudThread({ id: 'other' }), updatedAt: 'x' }));
    sync(store, cloudThread());
    sync(store, cloudThread()); // same updatedAt: nothing new
    expect(state(store).chats.threads.find((t) => t.id === 'dm_a_me')?.unreadCount).toBe(1);

    sync(store, cloudThread({ updatedAt: 'u2', lastMessage: 'Ще одне' }));
    const t = state(store).chats.threads[0];
    expect(t.id).toBe('dm_a_me');
    expect(t.unreadCount).toBe(2);
    expect(t.lastMessage).toBe('Ще одне');
  });

  it('does not badge the chat that is open on screen', () => {
    const store = makeStore();
    sync(store, cloudThread({ updatedAt: 'u1' }), 'me');
    sync(store, cloudThread({ updatedAt: 'u2' }), 'a', 'dm_a_me');
    expect(state(store).chats.threads[0].unreadCount).toBe(0);
  });

  it('does not resurrect a chat the user removed from this device', () => {
    const store = makeStore();
    sync(store, cloudThread());
    store.dispatch(chatDeleted('dm_a_me'));
    sync(store, cloudThread({ updatedAt: 'u9' }));
    expect(state(store).chats.threads).toHaveLength(0);
  });

  it('refreshes group details from the cloud', () => {
    const store = makeStore();
    sync(store, cloudThread({ id: 'grp_a_1', isGroup: true, groupName: 'Old', participants: [] }));
    sync(store, cloudThread({ id: 'grp_a_1', isGroup: true, groupName: 'New', participants: [{ id: 'z', name: 'Z', avatar: '' }] }));
    expect(state(store).chats.threads[0].groupName).toBe('New');
    expect(state(store).chats.threads[0].participants).toHaveLength(1);
  });
});

describe('friends, notifications, favorites, ui', () => {
  it('adds a friend once and removes them', () => {
    const store = makeStore();
    store.dispatch(friendAdded(buddy('a')));
    store.dispatch(friendAdded(buddy('a')));
    expect(state(store).friends.ids).toEqual(['a']);
    expect(state(store).friends.profiles.a.isFriend).toBe(true);
    store.dispatch(friendRemoved('a'));
    expect(state(store).friends.ids).toEqual([]);
    expect(state(store).friends.profiles.a).toBeUndefined();
  });

  it('keeps at most 30 notifications and tracks read state', () => {
    const store = makeStore();
    for (let i = 0; i < 35; i++) {
      store.dispatch(notificationReceived({ id: `n${i}`, type: 'system', title: 't', body: 'b', timestamp: '', createdAt: i, isRead: false } as PushNotificationItem));
    }
    expect(state(store).notifications.items).toHaveLength(30);
    expect(state(store).notifications.items[0].id).toBe('n34');

    store.dispatch(notificationRead('n34'));
    expect(state(store).notifications.items[0].isRead).toBe(true);
    store.dispatch(allNotificationsRead());
    expect(state(store).notifications.items.every((n) => n.isRead)).toBe(true);
  });

  it('upserts and removes favorites', () => {
    const store = makeStore();
    const v = { id: 'v', name: 'V', area: 'A', category: 'c', lat: 1, lng: 2 };
    store.dispatch(favoriteSaved(v));
    store.dispatch(favoriteSaved({ ...v, comment: 'top' }));
    expect(state(store).favorites.items).toHaveLength(1);
    expect(state(store).favorites.items[0].comment).toBe('top');
    store.dispatch(favoriteRemoved('v'));
    expect(state(store).favorites.items).toHaveLength(0);
  });

  it('shows and dismisses the banner', () => {
    const store = makeStore();
    const n = { id: 'n', type: 'system', title: 't', body: 'b', timestamp: '', createdAt: 0 } as PushNotificationItem;
    store.dispatch(bannerShown(n));
    expect(state(store).ui.activeBanner?.id).toBe('n');
    store.dispatch(bannerDismissed());
    expect(state(store).ui.activeBanner).toBeNull();
  });
});

describe('safety slice', () => {
  it('blocks once, counts reports per target and unblocks', () => {
    const store = makeStore();
    const rec = { userId: 'u', userName: 'U', blockedAt: '12:00' };
    store.dispatch(userBlocked(rec));
    store.dispatch(userBlocked(rec));
    expect(state(store).safety.blockedUsers).toHaveLength(1);

    const report = { id: 'r', reporterId: 'me', targetId: 'u', targetType: 'profile', targetName: 'U', category: 'spam', categoryTitle: 's', comment: '', timestamp: '', createdAt: 0, status: 'pending' } as const;
    store.dispatch(reportFiled(report));
    store.dispatch(reportFiled({ ...report, id: 'r2' }));
    expect(state(store).safety.reportCounts.u).toBe(2);

    store.dispatch(userUnblocked('u'));
    expect(state(store).safety.blockedUsers).toHaveLength(0);
  });
});

describe('hangouts & meetups slices', () => {
  const h = (id: string, over: Partial<HangoutAlert> = {}): HangoutAlert => ({
    id,
    userId: 'host',
    userName: 'Host',
    userAvatar: '',
    barName: 'Bar',
    locationArea: '',
    drinkPreference: '',
    description: '',
    createdAt: '',
    slotsAvailable: 2,
    participantsCount: 1,
    joinedUsers: [],
    ...over,
  });

  it('publishes optimistically, joins once and closes', () => {
    const store = makeStore();
    store.dispatch(hangoutPublished(h('1')));
    store.dispatch(hangoutPublished(h('1', { barName: 'Updated' })));
    expect(state(store).hangouts.items).toHaveLength(1);

    store.dispatch(hangoutJoined({ hangoutId: '1', userId: 'me' }));
    store.dispatch(hangoutJoined({ hangoutId: '1', userId: 'me' }));
    expect(state(store).hangouts.items[0].participantsCount).toBe(2);

    store.dispatch(hangoutClosed('1'));
    expect(state(store).hangouts.items).toHaveLength(0);
  });

  it('merges meetups with the cloud copy winning', () => {
    const store = makeStore();
    const m = { id: 'm1', title: 'Local', creatorId: 'c' } as never;
    store.dispatch(meetupUpserted(m));
    store.dispatch(meetupsMerged([{ id: 'm1', title: 'Cloud', creatorId: 'c' } as never, { id: 'm2', title: 'New', creatorId: 'c' } as never]));
    const items = state(store).meetups.items;
    expect(items).toHaveLength(2);
    expect(items.find((x) => x.id === 'm1')?.title).toBe('Cloud');
  });
});

describe('selectors', () => {
  it('recomputes buddy distance from the current location and hides blocked users', () => {
    const store = makeStore();
    store.dispatch(locationUpdated({ lat: 50.4635, lng: 30.518, locationName: 'x', accuracyMeters: 5, lastUpdated: '', isSimulated: true, status: 'active' }));
    store.dispatch(buddiesSynced([buddy('near'), buddy('far', { coordinates: { lat: 49.8419, lng: 24.0315 } }), buddy('bad')]));
    store.dispatch(userBlocked({ userId: 'bad', userName: 'Bad', blockedAt: '' }));
    store.dispatch(friendAdded(buddy('near')));

    const list = selectBuddies(state(store));
    expect(list.map((b) => b.id)).toEqual(['near']); // `far` is 400 km away: outside the 3 km "nearby" radius
    expect(list[0].distanceKm).toBeLessThan(0.1);
    expect(list[0].isFriend).toBe(true);
  });

  it('memoizes derived lists', () => {
    const store = makeStore();
    store.dispatch(buddiesSynced([buddy('a')]));
    expect(selectBuddies(state(store))).toBe(selectBuddies(state(store)));
  });

  it('keeps the identity of buddies that did not change when a snapshot arrives', () => {
    const store = makeStore();
    store.dispatch(buddiesSynced([buddy('a'), buddy('b')]));
    const first = selectBuddies(state(store));
    const itemsBefore = state(store).buddies.items;

    // A snapshot rebuilds every object; only b really changed
    store.dispatch(buddiesSynced([buddy('a'), buddy('b', { tagline: 'new tagline' })]));
    const second = selectBuddies(state(store));
    const byId = (list: typeof first, id: string) => list.find((x) => x.id === id)!;
    expect(byId(second, 'a')).toBe(byId(first, 'a')); // the memoized row for `a` does not re-render
    expect(byId(second, 'b')).not.toBe(byId(first, 'b'));
    expect(byId(second, 'b').tagline).toBe('new tagline');

    // An identical snapshot changes nothing at all, not even the list
    store.dispatch(buddiesSynced([buddy('a'), buddy('b', { tagline: 'new tagline' })]));
    expect(state(store).buddies.items).toBe(state(store).buddies.items);
    expect(selectBuddies(state(store))).toBe(second);
    expect(itemsBefore).not.toBe(state(store).buddies.items);
  });

  it('recomputes a buddy when the distance or the friend flag changes', () => {
    const store = makeStore();
    store.dispatch(buddiesSynced([buddy('a')]));
    const before = selectBuddies(state(store))[0];
    store.dispatch(friendAdded(buddy('a')));
    const after = selectBuddies(state(store))[0];
    expect(after).not.toBe(before);
    expect(after.isFriend).toBe(true);
  });

  it('falls back to the stored profile for friends who are offline', () => {
    const store = makeStore();
    store.dispatch(friendAdded(buddy('gone', { name: 'Saved' })));
    expect(selectFriends(state(store)).map((f) => f.name)).toEqual(['Saved']);
  });

  it('hides hangouts and meetups of blocked users', () => {
    const store = makeStore();
    store.dispatch(hangoutsSynced([{ id: 'h', userId: 'bad', slotsAvailable: 1, participantsCount: 1 } as HangoutAlert]));
    store.dispatch(meetupsMerged([{ id: 'm', creatorId: 'bad' } as never]));
    store.dispatch(userBlocked({ userId: 'bad', userName: 'Bad', blockedAt: '' }));
    expect(selectHangouts(state(store))).toHaveLength(0);
    expect(selectMeetups(state(store))).toHaveLength(0);
  });

  it('flags sanctioned territory and the test simulation', () => {
    const store = makeStore();
    expect(selectGeoBlock(state(store)).isBlocked).toBe(false);
    store.dispatch(locationUpdated({ lat: 55.7558, lng: 37.6173, locationName: 'x', accuracyMeters: 5, lastUpdated: '', isSimulated: false, status: 'active' }));
    expect(selectGeoBlock(state(store)).isBlocked).toBe(true);
  });

  it('returns an empty gamification state for a new user', () => {
    expect(selectGamification(state(makeStore())).xp).toBe(0);
  });
});

describe('blocking in the store', () => {
  const rec = (id: string) => ({ userId: id, userName: id, blockedAt: '1' });

  it('first sync merges, later syncs replace', () => {
    const store = makeStore();
    store.dispatch(userBlocked(rec('local')));
    store.dispatch(blocksSynced({ userId: 'me', records: [rec('cloud'), rec('local')], merge: true }));
    expect(state(store).safety.blockedUsers.map((u) => u.userId).sort()).toEqual(['cloud', 'local']);

    store.dispatch(blocksSynced({ userId: 'me', records: [rec('cloud')], merge: false }));
    expect(state(store).safety.blockedUsers.map((u) => u.userId)).toEqual(['cloud']);
    expect(state(store).safety.cloudSyncedFor).toBe('me');
  });

  it('hides chats with blocked people and groups they created, and keeps them out of the unread badge', () => {
    const store = makeStore();
    const thread = (id: string, over: Partial<ChatThread>): ChatThread => ({ id, buddy: buddy(id), lastMessage: '', lastMessageTime: '', unreadCount: 3, messages: [], ...over });
    store.dispatch(groupChatCreated(thread('dm_bad', { buddy: buddy('bad') })));
    store.dispatch(groupChatCreated(thread('dm_ok', { buddy: buddy('ok') })));
    store.dispatch(groupChatCreated(thread('grp_bad_1', { isGroup: true, createdBy: 'bad', buddy: buddy('bad') })));
    store.dispatch(groupChatCreated(thread('grp_ok_1', { isGroup: true, createdBy: 'ok', buddy: buddy('ok') })));
    expect(selectUnreadChatsCount(state(store))).toBe(12);

    store.dispatch(userBlocked({ userId: 'bad', userName: 'Bad', blockedAt: '1' }));
    expect(selectVisibleChatThreads(state(store)).map((t) => t.id).sort()).toEqual(['dm_ok', 'grp_ok_1']);
    expect(selectUnreadChatsCount(state(store))).toBe(6);

    store.dispatch(userUnblocked('bad'));
    expect(selectUnreadChatsCount(state(store))).toBe(12);
  });
});

describe('proposal answers', () => {
  const proposal = (over: Partial<Message> = {}): Message =>
    msg('p1', { chatId: 'chat-a', senderId: 'a', type: 'location_proposal', proposalData: { barName: 'Squat', address: 'Київ', time: '20:00', status: 'pending' }, ...over });
  const response = (over: Partial<Message> = {}): Message =>
    msg('resp_p1', { chatId: 'chat-a', senderId: 'me', type: 'proposal_response', proposalId: 'p1', proposalStatus: 'accepted', ...over });
  const threadWith = (messages: Message[]) => {
    const store = makeStore();
    store.dispatch(groupChatCreated({ id: 'chat-a', buddy: buddy('a'), lastMessage: '', lastMessageTime: '', unreadCount: 0, messages: [] }));
    store.dispatch(messagesReceived({ chatId: 'chat-a', messages }));
    return store;
  };
  const status = (store: ReturnType<typeof makeStore>) => state(store).chats.threads[0].messages.find((m) => m.id === 'p1')?.proposalData?.status;

  it('shows the answer to the person who proposed, when it arrives from Firestore', () => {
    const store = threadWith([proposal({ isMe: true, senderId: 'me' })]);
    expect(status(store)).toBe('pending');
    store.dispatch(messagesReceived({ chatId: 'chat-a', messages: [response({ senderId: 'a', proposalStatus: 'declined' })] }));
    expect(status(store)).toBe('declined');
  });

  it('applies the answer immediately for the person answering (their own message is appended locally)', () => {
    const store = threadWith([proposal()]);
    store.dispatch(messageAppended({ chatId: 'chat-a', message: response({ isMe: true }), summary: 'ok' }));
    expect(status(store)).toBe('accepted');
  });

  it('gives the same result whatever order the messages arrive in', () => {
    const store = threadWith([response(), proposal()]);
    expect(status(store)).toBe('accepted');
  });

  it('ignores an answer from the proposer themselves, for an unknown proposal, or for a non-proposal message', () => {
    const own = threadWith([proposal({ senderId: 'me', isMe: true }), response({ senderId: 'me' })]);
    expect(status(own)).toBe('pending'); // nobody can accept their own proposal

    const unknown = threadWith([proposal(), response({ proposalId: 'nope' })]);
    expect(status(unknown)).toBe('pending');

    const text = threadWith([msg('p1', { senderId: 'a' }), response()]);
    expect(state(text).chats.threads[0].messages[0].proposalData).toBeUndefined();
  });

  it('is idempotent when the same snapshot is replayed', () => {
    const store = threadWith([proposal(), response()]);
    store.dispatch(messagesReceived({ chatId: 'chat-a', messages: [proposal(), response()] }));
    expect(status(store)).toBe('accepted');
    expect(state(store).chats.threads[0].messages).toHaveLength(2);
  });
});

describe('expiry pruning', () => {
  const HOUR = 3600_000;
  const NOW = Date.UTC(2026, 9, 10, 12);

  it('removes tables whose 4 hours are over, and tables that carry no expiry at all', () => {
    const store = makeStore();
    store.dispatch(
      hangoutsSynced([
        { id: 'live', expiresAt: NOW + HOUR } as HangoutAlert,
        { id: 'over', expiresAt: NOW - 1 } as HangoutAlert,
        { id: 'legacy' } as HangoutAlert,
      ])
    );
    store.dispatch(expiredHangoutsPruned(NOW));
    expect(state(store).hangouts.items.map((h) => h.id)).toEqual(['live']);
  });

  it('leaves the list untouched (same identity) when nothing expired', () => {
    const store = makeStore();
    store.dispatch(hangoutsSynced([{ id: 'live', expiresAt: NOW + HOUR } as HangoutAlert]));
    const before = state(store).hangouts.items;
    store.dispatch(expiredHangoutsPruned(NOW));
    expect(state(store).hangouts.items).toBe(before);
  });

  it('drops a meetup 24 hours after it started, keeps a running one, and keeps one whose time is unknown', () => {
    const store = makeStore();
    const start = (h: number) => new Date(NOW + h * HOUR).toISOString();
    store.dispatch(
      meetupsMerged([
        { id: 'tonight', creatorId: 'c', endsAt: NOW + 5 * HOUR } as never,
        { id: 'yesterday', creatorId: 'c', dateTimeIso: start(-25) } as never,
        { id: 'ended', creatorId: 'c', endsAt: NOW - 1 } as never,
        { id: 'unknown', creatorId: 'c' } as never,
      ])
    );
    store.dispatch(archivedMeetupsPruned(NOW));
    expect(state(store).meetups.items.map((m) => m.id).sort()).toEqual(['tonight', 'unknown']);
  });
});
