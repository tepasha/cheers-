import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './index';
import { BuddyProfile, HangoutAlert, GroupMeetup, UserGamificationState } from '../types';
import { calculateDistanceKm, formatDistance } from '../services/geoService';
import { checkRussianTerritoryRestriction, ph } from '../services/i18nService';
import { EMPTY_GAMIFICATION_STATE, getLevelInfo } from '../logic/gamification';

export const selectUser = (s: RootState) => s.auth.user;
export const selectLocation = (s: RootState) => s.location.current;
export const selectSettings = (s: RootState) => s.settings;
export const selectLanguage = (s: RootState) => s.settings.language;
export const selectChatThreads = (s: RootState) => s.chats.threads;
export const selectBlockedUsers = (s: RootState) => s.safety.blockedUsers;
export const selectNotifications = (s: RootState) => s.notifications.items;
export const selectActiveBanner = (s: RootState) => s.ui.activeBanner;
export const selectIsOnline = (s: RootState) => s.ui.isOnline;

const selectBlockedIds = createSelector([selectBlockedUsers], (blocked) => new Set(blocked.map((u) => u.userId)));
const selectFriendIds = createSelector([(s: RootState) => s.friends.ids], (ids) => new Set(ids));

export const selectGeoBlock = createSelector(
  [selectLocation, (s: RootState) => s.settings.simulateRuBlock],
  (location, simulate) => checkRussianTerritoryRestriction(location, simulate)
);

/** Live buddies with distance recomputed from the current position, blocked users hidden */
export const selectBuddies = createSelector(
  [(s: RootState) => s.buddies.items, selectLocation, selectBlockedIds, selectFriendIds],
  (items, location, blocked, friendIds): BuddyProfile[] =>
    items
      .filter((b) => !blocked.has(b.id))
      .map((b) => ({
        ...b,
        distanceKm: calculateDistanceKm(location.lat, location.lng, b.coordinates.lat, b.coordinates.lng),
        isFriend: friendIds.has(b.id),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
);

export const selectHangouts = createSelector(
  [(s: RootState) => s.hangouts.items, selectLocation, selectBlockedIds],
  (items, location, blocked): HangoutAlert[] =>
    items
      .filter((h) => !blocked.has(h.userId))
      .map((h) => {
        if (typeof h.lat !== 'number' || typeof h.lng !== 'number') return h;
        const distanceKm = calculateDistanceKm(location.lat, location.lng, h.lat, h.lng);
        return { ...h, distanceKm, distanceFormatted: formatDistance(distanceKm) };
      })
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
);

export const selectMeetups = createSelector(
  [(s: RootState) => s.meetups.items, selectBlockedIds],
  (items, blocked): GroupMeetup[] => items.filter((m) => !blocked.has(m.creatorId))
);

/** Friends, refreshed with the live profile when that friend is currently online */
export const selectFriends = createSelector(
  [(s: RootState) => s.friends, selectBuddies],
  (friends, buddies): BuddyProfile[] => {
    const live = new Map(buddies.map((b) => [b.id, b]));
    return friends.ids
      .map((id) => live.get(id) ?? friends.profiles[id])
      .filter((b): b is BuddyProfile => Boolean(b))
      .map((b) => ({ ...b, isFriend: true, friendSince: b.friendSince || ph('Нещодавно') }));
  }
);

export const selectFriendsCount = (s: RootState) => s.friends.ids.length;
/** Chats the user should see: not with a blocked person, and not a group created by one */
export const selectVisibleChatThreads = createSelector([selectChatThreads, selectBlockedIds], (threads, blocked) =>
  threads.filter((t) => (t.isGroup ? !(t.createdBy && blocked.has(t.createdBy)) : !blocked.has(t.buddy.id)))
);
export const selectUnreadChatsCount = createSelector([selectVisibleChatThreads], (threads) =>
  threads.reduce((acc, t) => acc + t.unreadCount, 0)
);
export const selectUnreadNotificationsCount = createSelector(
  [selectNotifications],
  (items) => items.filter((n) => !n.isRead).length
);

export const selectGamification = (s: RootState): UserGamificationState =>
  s.gamification.byUser[s.auth.user.id] ?? EMPTY_GAMIFICATION_STATE;

export const selectLevelProgress = createSelector([selectGamification], (g) => getLevelInfo(g.xp));

export const makeSelectChat = (chatId: string | undefined) => (s: RootState) =>
  chatId ? s.chats.threads.find((t) => t.id === chatId) : undefined;
