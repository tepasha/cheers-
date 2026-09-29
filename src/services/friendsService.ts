import { BuddyProfile } from '../types';
import { sounds } from './soundService';
import { gamificationService } from './gamificationService';
import { pushNotificationService } from './pushNotificationService';
import { firestoreSyncService } from './firestoreSyncService';

const FRIENDS_STORAGE_KEY = 'budmo_friends_ids';
const FRIENDS_PROFILES_STORAGE_KEY = 'budmo_friends_profiles_v1';

// Clean initial friend list (no mock seed)
const DEFAULT_FRIEND_IDS: string[] = [];

type FriendChangeListener = (friends: BuddyProfile[]) => void;
const listeners: FriendChangeListener[] = [];

class FriendsService {
  private friendIds: Set<string>;
  private friendsMap: Map<string, BuddyProfile>;

  constructor() {
    this.friendIds = new Set<string>(this.loadStoredFriendIds());
    this.friendsMap = new Map<string, BuddyProfile>(this.loadStoredFriendProfiles());
  }

  private loadStoredFriendProfiles(): [string, BuddyProfile][] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(FRIENDS_PROFILES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter(([id]) => !id.startsWith('buddy-'));
        }
      }
    } catch (e) {
      console.warn('Could not load friend profiles from localStorage:', e);
    }
    return [];
  }

  private persistFriendProfiles(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        FRIENDS_PROFILES_STORAGE_KEY,
        JSON.stringify(Array.from(this.friendsMap.entries()))
      );
    } catch (e) {
      console.warn('Could not persist friend profiles to localStorage:', e);
    }
  }

  private loadStoredFriendIds(): string[] {
    if (typeof window === 'undefined') return DEFAULT_FRIEND_IDS;
    try {
      const stored = localStorage.getItem(FRIENDS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filter out mock friend IDs
          const cleaned = parsed.filter((id: string) => !id.startsWith('buddy-'));
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('Could not load friend IDs from localStorage:', e);
    }
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
  public getFriends(allBuddiesPool: BuddyProfile[] = []): BuddyProfile[] {
    const poolMap = new Map<string, BuddyProfile>();
    // Seed with stored friend profiles
    this.friendsMap.forEach((b, id) => poolMap.set(id, b));
    allBuddiesPool.forEach((b) => poolMap.set(b.id, b));

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
    this.friendsMap.set(buddy.id, { ...buddy, isFriend: true });
    const newIds = Array.from(this.friendIds);
    this.persistFriendIds(newIds);
    this.persistFriendProfiles();

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
    this.friendsMap.delete(buddyId);
    const newIds = Array.from(this.friendIds);
    this.persistFriendIds(newIds);
    this.persistFriendProfiles();

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
