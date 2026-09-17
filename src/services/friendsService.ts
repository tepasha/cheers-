import { BuddyProfile } from '../types';
import { INITIAL_BUDDIES } from '../data/mockData';
import { sounds } from './soundService';
import { gamificationService } from './gamificationService';
import { pushNotificationService } from './pushNotificationService';
import { firestoreSyncService } from './firestoreSyncService';

const FRIENDS_STORAGE_KEY = 'budmo_friends_ids';

// Default initial friend seed so user has a friend out of the box (Богдан from Podil)
const DEFAULT_FRIEND_IDS = ['buddy-1'];

type FriendChangeListener = (friends: BuddyProfile[]) => void;
const listeners: FriendChangeListener[] = [];

class FriendsService {
  private friendIds: Set<string>;

  constructor() {
    this.friendIds = new Set<string>(this.loadStoredFriendIds());
  }

  private loadStoredFriendIds(): string[] {
    if (typeof window === 'undefined') return DEFAULT_FRIEND_IDS;
    try {
      const stored = localStorage.getItem(FRIENDS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not load friend IDs from localStorage:', e);
    }
    // Seed default friend
    this.persistFriendIds(DEFAULT_FRIEND_IDS);
    return DEFAULT_FRIEND_IDS;
  }

  private persistFriendIds(ids: string[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(ids));
      // Trigger storage event for other tabs/listeners
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.warn('Could not persist friend IDs to localStorage:', e);
    }
  }

  private notify(): void {
    const friends = this.getFriends();
    listeners.forEach((listener) => {
      try {
        listener(friends);
      } catch (e) {
        console.error('Error notifying friend listener:', e);
      }
    });
  }

  /**
   * Subscribe to friends list changes
   */
  public subscribe(listener: FriendChangeListener): () => void {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Check if a buddy is currently a friend
   */
  public isFriend(buddyId: string): boolean {
    return this.friendIds.has(buddyId);
  }

  /**
   * Get list of friend IDs
   */
  public getFriendIds(): string[] {
    return Array.from(this.friendIds);
  }

  /**
   * Get all friends as full BuddyProfile objects
   */
  public getFriends(allBuddiesPool: BuddyProfile[] = INITIAL_BUDDIES): BuddyProfile[] {
    const poolMap = new Map<string, BuddyProfile>();
    allBuddiesPool.forEach((b) => poolMap.set(b.id, b));
    INITIAL_BUDDIES.forEach((b) => {
      if (!poolMap.has(b.id)) poolMap.set(b.id, b);
    });

    const result: BuddyProfile[] = [];
    this.friendIds.forEach((id) => {
      const buddy = poolMap.get(id);
      if (buddy) {
        result.push({
          ...buddy,
          isFriend: true,
          friendSince: buddy.friendSince || 'Нещодавно',
        });
      }
    });

    return result;
  }

  /**
   * Decorate any list of buddies with their current friendship status
   */
  public decorateWithFriendStatus(buddies: BuddyProfile[]): BuddyProfile[] {
    return buddies.map((b) => ({
      ...b,
      isFriend: this.friendIds.has(b.id),
    }));
  }

  /**
   * Add a buddy to friends
   */
  public addFriend(buddy: BuddyProfile, currentUserId: string = 'me'): boolean {
    if (this.friendIds.has(buddy.id)) return false;

    this.friendIds.add(buddy.id);
    const newIds = Array.from(this.friendIds);
    this.persistFriendIds(newIds);

    // Play feedback sound
    sounds.playClink();

    // Grant XP bonus (+50 XP for making a friend)
    gamificationService.addBonusXp(
      currentUserId,
      50,
      `🤝 Новий друг «${buddy.name}»! (+50 XP)`
    );

    // Push Notification Banner
    pushNotificationService.dispatch({
      title: `🤝 ${buddy.name} тепер у друзях!`,
      body: `Ви додали ${buddy.name} до друзів.`,
      subtitle: `Тепер ви бачите його активність та статус у барах! (+50 XP)`,
      type: 'friend_added',
      buddyName: buddy.name,
      avatar: buddy.avatar,
      actionText: 'Написати',
    });

    // Sync to Firestore in background
    firestoreSyncService.syncFriend(currentUserId, {
      friendId: buddy.id,
      friendName: buddy.name,
      friendAvatar: buddy.avatar,
      tagline: buddy.tagline,
      locationName: buddy.locationName,
      drinkPreference: buddy.preferredDrinks.join(', '),
    }).catch((err) => console.warn('Could not sync friend to Firestore:', err));

    this.notify();
    return true;
  }

  /**
   * Remove a buddy from friends
   */
  public removeFriend(buddyId: string, currentUserId: string = 'me'): boolean {
    if (!this.friendIds.has(buddyId)) return false;

    this.friendIds.delete(buddyId);
    const newIds = Array.from(this.friendIds);
    this.persistFriendIds(newIds);

    sounds.playTap();

    // Sync removal to Firestore
    firestoreSyncService.removeFriendFromFirestore(currentUserId, buddyId)
      .catch((err) => console.warn('Could not remove friend from Firestore:', err));

    this.notify();
    return true;
  }

  /**
   * Toggle friendship status
   */
  public toggleFriend(buddy: BuddyProfile, currentUserId: string = 'me'): boolean {
    if (this.isFriend(buddy.id)) {
      this.removeFriend(buddy.id, currentUserId);
      return false;
    } else {
      this.addFriend(buddy, currentUserId);
      return true;
    }
  }
}

export const friendsService = new FriendsService();
