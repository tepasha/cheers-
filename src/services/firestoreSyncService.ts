import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { 
  db, 
  testFirestoreConnection, 
  disableOfflineNetwork, 
  enableOfflineNetwork, 
  syncPendingWrites 
} from './firebase';
import { FavoriteVenueItem, PaymentEtiquette, DrinkType, Message, HangoutAlert, UserGamificationState } from '../types';
import { cryptoService } from './cryptoService';
import { UserGeoLocation, calculateDistanceKm, formatDistance } from './geoService';
import { INITIAL_HANGOUTS } from '../data/mockData';

let isBasementOfflineSimulated = false;
const networkListeners: Array<(isOnline: boolean, isBasement: boolean) => void> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    networkListeners.forEach((cb) => cb(true, isBasementOfflineSimulated));
  });
  window.addEventListener('offline', () => {
    networkListeners.forEach((cb) => cb(false, isBasementOfflineSimulated));
  });
}

export interface FirestoreUserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  tagline: string;
  paymentRule: PaymentEtiquette;
  preferredDrinks: DrinkType[];
  locationName: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export const firestoreSyncService = {
  // Test connection status
  async verifyConnection(): Promise<boolean> {
    return await testFirestoreConnection();
  },

  // Save/Update user profile in Firestore
  async saveUserProfile(profile: FirestoreUserProfile): Promise<void> {
    try {
      const userRef = doc(db, 'users', profile.id);
      await setDoc(userRef, {
        id: profile.id,
        name: profile.name,
        email: profile.email || '',
        avatar: profile.avatar || '',
        tagline: profile.tagline || '',
        paymentRule: profile.paymentRule || 'split_50_50',
        preferredDrinks: profile.preferredDrinks || [],
        locationName: profile.locationName || '',
        lat: profile.lat || 0,
        lng: profile.lng || 0,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      // In guest or offline mode, warn gracefully
      console.warn('Firestore sync failed, local state preserved:', error);
    }
  },

  // Fetch user profile from Firestore
  async getUserProfile(userId: string): Promise<Partial<FirestoreUserProfile> | null> {
    try {
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return snap.data() as FirestoreUserProfile;
      }
      return null;
    } catch (error) {
      console.warn('Could not fetch Firestore profile:', error);
      return null;
    }
  },

  // Sync gamification points & checkins to Firestore
  async syncGamification(userId: string, state: UserGamificationState): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          gamification: {
            xp: state.xp,
            level: state.level,
            totalMeetups: state.totalMeetups,
            achievements: state.achievements,
            lastUpdated: new Date().toISOString(),
          },
        },
        { merge: true }
      );
    } catch (error) {
      console.warn('Could not sync gamification to Firestore:', error);
    }
  },

  // Fetch gamification state from Firestore
  async getUserGamification(userId: string): Promise<UserGamificationState | null> {
    try {
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.gamification) {
          return {
            xp: data.gamification.xp ?? 0,
            level: data.gamification.level ?? 1,
            totalMeetups: data.gamification.totalMeetups ?? 0,
            achievements: data.gamification.achievements ?? [],
            checkIns: [],
          };
        }
      }
      return null;
    } catch (error) {
      console.warn('Could not get gamification from Firestore:', error);
      return null;
    }
  },

  // Save favorite venue to Firestore
  async saveFavoriteVenue(userId: string, venue: FavoriteVenueItem): Promise<void> {
    try {
      const favRef = doc(db, 'users', userId, 'favorites', venue.id);
      await setDoc(favRef, {
        id: venue.id,
        userId,
        name: venue.name,
        area: venue.area,
        category: venue.category,
        lat: venue.lat,
        lng: venue.lng,
        comment: venue.comment || '',
        createdAt: venue.createdAt || new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Failed to save venue to Firestore:', error);
    }
  },

  // Remove favorite venue from Firestore
  async removeFavoriteVenue(userId: string, venueId: string): Promise<void> {
    try {
      const favRef = doc(db, 'users', userId, 'favorites', venueId);
      await deleteDoc(favRef);
    } catch (error) {
      console.warn('Failed to delete venue from Firestore:', error);
    }
  },

  // Get all user favorites from Firestore
  async getUserFavorites(userId: string): Promise<FavoriteVenueItem[]> {
    try {
      const favsCol = collection(db, 'users', userId, 'favorites');
      const snap = await getDocs(favsCol);
      const venues: FavoriteVenueItem[] = [];
      snap.forEach((docSnap) => {
        venues.push(docSnap.data() as FavoriteVenueItem);
      });
      return venues;
    } catch (error) {
      console.warn('Failed to load favorites from Firestore:', error);
      return [];
    }
  },

  // --------------------------------------------------------------------------
  // Live Hangouts & Bar Check-Ins (Миттєве відображення для користувачів поблизу)
  // --------------------------------------------------------------------------

  /**
   * Публікація активного чекіну в барі в Cloud Firestore.
   * Зберігається з локальним кешем IndexedDB та миттєво транслюється іншим користувачам.
   */
  async publishHangout(hangout: HangoutAlert): Promise<void> {
    try {
      const hangoutRef = doc(db, 'hangouts', hangout.id);
      await setDoc(hangoutRef, {
        id: hangout.id,
        userId: hangout.userId,
        userName: hangout.userName,
        userAvatar: hangout.userAvatar,
        barName: hangout.barName,
        locationArea: hangout.locationArea,
        drinkPreference: hangout.drinkPreference,
        description: hangout.description,
        createdAt: hangout.createdAt,
        createdAtTimestamp: Date.now(),
        slotsAvailable: Number(hangout.slotsAvailable ?? 2),
        participantsCount: Number(hangout.participantsCount ?? 1),
        lat: typeof hangout.lat === 'number' ? hangout.lat : null,
        lng: typeof hangout.lng === 'number' ? hangout.lng : null,
        status: 'active',
        joinedUsers: hangout.joinedUsers || [],
      });
      console.log('[Firestore] Live hangout check-in published to cloud:', hangout.id);
    } catch (error) {
      console.warn('[Firestore] Failed to publish live hangout check-in:', error);
      throw error;
    }
  },

  /**
   * Миттєва підписка на живі чекіни (Hangouts) у реальному часі.
   * Розраховує дистанцію до кожного бару відносно поточних координат користувача.
   */
  subscribeToLiveHangouts(
    userLocation: UserGeoLocation,
    callback: (hangouts: HangoutAlert[]) => void
  ): () => void {
    try {
      const hangoutsCol = collection(db, 'hangouts');
      const unsubscribe = onSnapshot(
        hangoutsCol,
        { includeMetadataChanges: true },
        (snapshot) => {
          const liveFirestoreItems: HangoutAlert[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === 'closed') return;

            let distKm: number | undefined = undefined;
            let distFormatted: string | undefined = undefined;

            if (
              typeof data.lat === 'number' &&
              typeof data.lng === 'number' &&
              userLocation &&
              typeof userLocation.lat === 'number'
            ) {
              distKm = calculateDistanceKm(userLocation.lat, userLocation.lng, data.lat, data.lng);
              distFormatted = formatDistance(distKm);
            }

            liveFirestoreItems.push({
              id: docSnap.id,
              userId: data.userId || 'guest',
              userName: data.userName || 'Користувач',
              userAvatar:
                data.userAvatar ||
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
              barName: data.barName || 'Бар',
              locationArea: data.locationArea || 'Київ',
              drinkPreference: data.drinkPreference || 'Келих за настроєм',
              description: data.description || '',
              createdAt: data.createdAt || 'Щойно',
              slotsAvailable: Number(data.slotsAvailable ?? 2),
              participantsCount: Number(data.participantsCount ?? 1),
              lat: typeof data.lat === 'number' ? data.lat : undefined,
              lng: typeof data.lng === 'number' ? data.lng : undefined,
              distanceKm: distKm,
              distanceFormatted: distFormatted,
              isLive: true,
              status: data.status || 'active',
              joinedUsers: Array.isArray(data.joinedUsers) ? data.joinedUsers : [],
            });
          });

          // Merge live items with initial curated hangouts (avoiding duplicates)
          const merged: HangoutAlert[] = [...liveFirestoreItems];

          INITIAL_HANGOUTS.forEach((initialHangout) => {
            if (!merged.some((h) => h.id === initialHangout.id)) {
              let distKm = initialHangout.distanceKm;
              let distFormatted = initialHangout.distanceFormatted;
              if (
                typeof initialHangout.lat === 'number' &&
                typeof initialHangout.lng === 'number' &&
                userLocation &&
                typeof userLocation.lat === 'number'
              ) {
                distKm = calculateDistanceKm(
                  userLocation.lat,
                  userLocation.lng,
                  initialHangout.lat,
                  initialHangout.lng
                );
                distFormatted = formatDistance(distKm);
              }

              merged.push({
                ...initialHangout,
                distanceKm: distKm,
                distanceFormatted: distFormatted,
              });
            }
          });

          // Sort by proximity: closest check-ins first, keeping newest live check-ins prominent
          merged.sort((a, b) => {
            // Live Firestore check-ins first
            if (a.isLive && !b.isLive) return -1;
            if (!a.isLive && b.isLive) return 1;
            const distA = typeof a.distanceKm === 'number' ? a.distanceKm : 999;
            const distB = typeof b.distanceKm === 'number' ? b.distanceKm : 999;
            return distA - distB;
          });

          callback(merged);
        },
        (error) => {
          console.warn('[Firestore] Live Hangouts subscription warning:', error);
          // Fallback with calculated distances
          const fallback = INITIAL_HANGOUTS.map((h) => {
            if (typeof h.lat === 'number' && typeof h.lng === 'number' && userLocation) {
              const d = calculateDistanceKm(userLocation.lat, userLocation.lng, h.lat, h.lng);
              return { ...h, distanceKm: d, distanceFormatted: formatDistance(d) };
            }
            return h;
          });
          callback(fallback);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('[Firestore] Error creating Hangouts live listener:', err);
      return () => {};
    }
  },

  /**
   * Приєднатися до живого чекіну (забронювати місце за столиком)
   */
  async joinLiveHangout(hangoutId: string, currentUserId: string): Promise<void> {
    try {
      const hangoutRef = doc(db, 'hangouts', hangoutId);
      const snap = await getDoc(hangoutRef);
      if (snap.exists()) {
        const data = snap.data();
        const existingUsers = Array.isArray(data.joinedUsers) ? [...data.joinedUsers] : [];
        if (!existingUsers.includes(currentUserId)) {
          existingUsers.push(currentUserId);
        }
        await updateDoc(hangoutRef, {
          participantsCount: (data.participantsCount || 1) + 1,
          joinedUsers: existingUsers,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('[Firestore] Error joining live hangout in Firestore:', err);
    }
  },

  /**
   * Закрити / завершити активний чекін у барі
   */
  async closeLiveHangout(hangoutId: string): Promise<void> {
    try {
      const hangoutRef = doc(db, 'hangouts', hangoutId);
      // Soft-delete or delete
      await deleteDoc(hangoutRef);
      console.log('[Firestore] Closed live hangout:', hangoutId);
    } catch (err) {
      console.warn('[Firestore] Error closing live hangout:', err);
    }
  },

  // --------------------------------------------------------------------------
  // Encrypted Chat Firestore Methods (E2EE Client-Side Encryption)
  // --------------------------------------------------------------------------

  /**
   * Encrypts and writes a chat message into Cloud Firestore:
   * Document: chats/{chatId}/messages/{messageId}
   */
  async sendEncryptedMessage(
    chatId: string, 
    message: Message
  ): Promise<{ cipherPayload: string; success: boolean }> {
    try {
      // 1. Encrypt message text on client using AES-GCM 256
      const cipherPayload = await cryptoService.encryptMessage(message.text, chatId);

      // 2. Write encrypted payload to Firestore message subcollection
      const msgRef = doc(db, 'chats', chatId, 'messages', message.id);
      await setDoc(msgRef, {
        id: message.id,
        chatId,
        senderId: message.senderId,
        senderName: message.senderName,
        cipherPayload,
        type: message.type || 'text',
        proposalData: message.proposalData || null,
        timestamp: message.timestamp,
        isEncrypted: true,
        createdAt: new Date().toISOString(),
      });

      // 3. Update parent chat thread metadata with encrypted snippet
      const chatDocRef = doc(db, 'chats', chatId);
      await setDoc(chatDocRef, {
        id: chatId,
        lastCipherPayload: cipherPayload,
        lastMessageTime: message.timestamp,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      return { cipherPayload, success: true };
    } catch (error) {
      console.warn('Could not sync encrypted message to Firestore (running in offline/local fallback):', error);
      return { cipherPayload: '', success: false };
    }
  },

  /**
   * Deletes a chat thread and its metadata in Cloud Firestore
   */
  async deleteChatThread(chatId: string): Promise<void> {
    try {
      const chatDocRef = doc(db, 'chats', chatId);
      await deleteDoc(chatDocRef);
      console.log('[Firestore] Deleted chat thread doc:', chatId);
    } catch (error) {
      console.warn('Could not delete chat thread in Firestore:', error);
    }
  },

  /**
   * Subscribes to real-time chat messages from Cloud Firestore and decrypts them on the fly
   */
  subscribeToEncryptedChat(
    chatId: string,
    currentUserId: string,
    onMessages: (messages: Message[]) => void
  ): () => void {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'));

      const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, async (snapshot) => {
        if (snapshot.empty) return;

        const decryptedMessages: Message[] = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const cipher = data.cipherPayload || data.text || '';
          const decryptedText = await cryptoService.decryptMessage(cipher, chatId);

          decryptedMessages.push({
            id: data.id || docSnap.id,
            chatId: data.chatId || chatId,
            senderId: data.senderId,
            senderName: data.senderName,
            text: decryptedText,
            timestamp: data.timestamp || 'Щойно',
            isMe: data.senderId === currentUserId || data.senderId === 'me',
            type: data.type || 'text',
            isEncrypted: true,
            cipherPayload: cipher,
            proposalData: data.proposalData || undefined,
            isFromCache: snapshot.metadata.fromCache,
            hasPendingWrites: docSnap.metadata.hasPendingWrites,
          });
        }

        if (decryptedMessages.length > 0) {
          onMessages(decryptedMessages);
        }
      }, (err) => {
        console.warn('Firestore snapshot listener notice (local state remains active):', err);
      });

      return unsubscribe;
    } catch (err) {
      console.warn('Failed to establish Firestore chat subscription:', err);
      return () => {};
    }
  },

  /**
   * Retrieves security fingerprint for a given room
   */
  getChatSecurity(chatId: string) {
    return cryptoService.getRoomFingerprint(chatId);
  },

  /**
   * Check if basement offline bar mode is active
   */
  isBasementMode(): boolean {
    return isBasementOfflineSimulated;
  },

  /**
   * Toggle basement bar offline mode (simulates underground bar with no cellular connection)
   */
  async setBasementMode(enabled: boolean): Promise<void> {
    isBasementOfflineSimulated = enabled;
    if (enabled) {
      await disableOfflineNetwork();
    } else {
      await enableOfflineNetwork();
      await syncPendingWrites();
    }
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    networkListeners.forEach((cb) => cb(isOnline && !enabled, enabled));
  },

  /**
   * Listen for online/offline and basement mode changes
   */
  onNetworkStatusChange(callback: (isOnline: boolean, isBasement: boolean) => void): () => void {
    networkListeners.push(callback);
    // Initial call
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    callback(isOnline && !isBasementOfflineSimulated, isBasementOfflineSimulated);
    return () => {
      const idx = networkListeners.indexOf(callback);
      if (idx !== -1) networkListeners.splice(idx, 1);
    };
  },

  /**
   * Wait for all pending offline writes to synchronize with Cloud Firestore
   */
  async flushOfflineQueue(): Promise<void> {
    await syncPendingWrites();
  },

  /**
   * Return offline cache configuration details
   */
  getOfflineCacheInfo() {
    return {
      storageEngine: 'IndexedDB (multi-tab persistent)',
      cacheSizeLimit: 'Безлімітний (CACHE_SIZE_UNLIMITED)',
      offlineFeatures: [
        'Перегляд раніше відкритих діалогів та тостів без звʼязку',
        'Миттєве збереження нових повідомлень у локальну чергу',
        'Автоматична двостороння синхронізація при виході з підвалу',
        'Збереження профілю та списку улюблених барів офлайн',
      ],
    };
  },

  /**
   * Sync a friend document to user's Firestore subcollection
   */
  async syncFriend(
    userId: string,
    friendData: {
      friendId: string;
      friendName: string;
      friendAvatar?: string;
      tagline?: string;
      locationName?: string;
      drinkPreference?: string;
    }
  ): Promise<void> {
    try {
      const friendRef = doc(db, 'users', userId, 'friends', friendData.friendId);
      await setDoc(friendRef, {
        id: friendData.friendId,
        userId,
        friendId: friendData.friendId,
        friendName: friendData.friendName,
        friendAvatar: friendData.friendAvatar || '',
        tagline: friendData.tagline || '',
        locationName: friendData.locationName || '',
        drinkPreference: friendData.drinkPreference || '',
        addedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('Could not sync friend to Firestore:', e);
    }
  },

  /**
   * Remove a friend document from user's Firestore subcollection
   */
  async removeFriendFromFirestore(userId: string, friendId: string): Promise<void> {
    try {
      const friendRef = doc(db, 'users', userId, 'friends', friendId);
      await deleteDoc(friendRef);
    } catch (e) {
      console.warn('Could not delete friend from Firestore:', e);
    }
  },

  /**
   * Get all friends from Firestore subcollection
   */
  async getFriendsFromFirestore(userId: string): Promise<any[]> {
    try {
      const friendsCol = collection(db, 'users', userId, 'friends');
      const snap = await getDocs(friendsCol);
      return snap.docs.map((d) => d.data());
    } catch (e) {
      console.warn('Could not fetch friends from Firestore:', e);
      return [];
    }
  }
};

