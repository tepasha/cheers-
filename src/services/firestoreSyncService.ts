import { ph } from './i18nService';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  updateDoc,
  arrayUnion as arrayUnionFs,
  orderBy,
  startAt,
  endAt,
  limit,
  serverTimestamp,
  writeBatch,
  runTransaction,
  arrayUnion,
  increment,
  deleteField
} from 'firebase/firestore';

/** Newest messages loaded per chat; older history is not streamed */
const CHAT_PAGE_SIZE = 100;
import { db } from './firebase';
import { FavoriteVenueItem, PaymentEtiquette, DrinkType, Message, HangoutAlert, UserGamificationState, BuddyProfile, GroupMeetup, ChatThread, ChatParticipant } from '../types';
import type { CloudChat } from '../logic/chats';
import { meetupToCloud } from '../logic/meetups';
import { DRINK_TYPES, MOOD_TYPES, PAYMENT_RULES, asNumber, asOptString, asString, asStringList, oneOf, readCloudChat, readCloudHangout, readCloudMeetup, readEach, timeMillis } from '../logic/cloudData';
import type { MeetupParticipant } from '../types';
import { omitUndefined } from '../utils/firestoreData';
import type { BlockedUserRecord } from '../types';
import { cryptoService } from './cryptoService';
import { deviceIdFor } from '../logic/push';
import { hangoutExpiresAt, isHangoutExpired } from '../logic/lifecycle';
import { coarseCoordinate as coarse } from '../logic/privacy';
import { isInactive, isOnline, nearbyQueryBounds, PER_RANGE_LIMIT, pickNearby, publicGeohash, type GeoPoint } from '../logic/nearby';
import { UserGeoLocation, calculateDistanceKm, formatDistance } from './geoService';

export interface FirestoreUserProfile {
  id: string;
  name: string;
  avatar?: string;
  tagline?: string;
  paymentRule?: PaymentEtiquette;
  preferredDrinks?: DrinkType[];
  locationName?: string;
  lat?: number;
  lng?: number;
  updatedAt?: string;
  age?: number;
  /** Added on save from the coarsened coordinates; used for the "nearby" range queries */
  geohash?: string;
  lastSeenAt?: string;
}

/** Data only the owner may read: never shown to other users */
export interface PrivateProfile {
  email?: string;
  birthDate?: string;
}


/**
 * Wraps a snapshot callback. Firestore calls it from a timer, where an exception is uncaught and kills a release
 * build, so a snapshot that cannot be processed is logged and skipped; the next one is processed normally.
 */
function guard<T>(what: string, onNext: (value: T) => void | Promise<void>): (value: T) => void {
  const skip = (error: unknown) => console.warn(`[Firestore] ${what}: snapshot skipped`, error);
  return (value) => {
    try {
      const result = onNext(value);
      if (result instanceof Promise) result.catch(skip);
    } catch (error) {
      skip(error);
    }
  };
}

/** Decrypts the details of a meetup proposal; a proposal starts out pending until an answer message says otherwise */
async function readProposal(cipher: string, chatId: string): Promise<Message['proposalData']> {
  try {
    const { barName, address, time } = JSON.parse(await cryptoService.decryptMessage(cipher, chatId));
    if (typeof barName !== 'string') return undefined;
    return { barName, address: String(address ?? ''), time: String(time ?? ''), status: 'pending' };
  } catch {
    return undefined;
  }
}

export const firestoreSyncService = {
  // Save/Update the PUBLIC profile. Only supplied fields are written (merge), so a location update never
  // overwrites a tagline set elsewhere. Email and birth date never go here (see savePrivateProfile).
  async saveUserProfile(profile: FirestoreUserProfile): Promise<void> {
    try {
      const fields = Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined));
      if (typeof fields.lat === 'number') fields.lat = coarse(fields.lat);
      if (typeof fields.lng === 'number') fields.lng = coarse(fields.lng);
      if (typeof fields.lat === 'number' && typeof fields.lng === 'number') fields.geohash = publicGeohash(fields.lat, fields.lng);
      await setDoc(doc(db, 'users', profile.id), { ...fields, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      console.warn('Firestore sync failed, local state preserved:', error);
    }
  },

  async savePrivateProfile(userId: string, data: PrivateProfile): Promise<void> {
    try {
      const fields = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
      await setDoc(doc(db, 'users', userId, 'private', 'profile'), fields, { merge: true });
    } catch (error) {
      console.warn('Could not save private profile:', error);
    }
  },

  async getPrivateProfile(userId: string): Promise<PrivateProfile | null> {
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'private', 'profile'));
      return snap.exists() ? (snap.data() as PrivateProfile) : null;
    } catch (error) {
      console.warn('Could not read private profile:', error);
      return null;
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

  // Gamification is private to the owner (it is not part of the public profile)
  async syncGamification(userId: string, state: UserGamificationState): Promise<void> {
    try {
      await setDoc(doc(db, 'users', userId, 'private', 'gamification'), {
        xp: state.xp,
        level: state.level,
        totalMeetups: state.totalMeetups,
        achievements: state.achievements,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Could not sync gamification to Firestore:', error);
    }
  },

  async getUserGamification(userId: string): Promise<UserGamificationState | null> {
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'private', 'gamification'));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        xp: data.xp ?? 0,
        level: data.level ?? 1,
        totalMeetups: data.totalMeetups ?? 0,
        achievements: data.achievements ?? [],
        checkIns: [],
      };
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
        expiresAt: hangout.expiresAt ?? hangoutExpiresAt(Date.now()),
        slotsAvailable: Number(hangout.slotsAvailable ?? 2),
        participantsCount: Number(hangout.participantsCount ?? 1),
        lat: typeof hangout.lat === 'number' ? hangout.lat : null,
        lng: typeof hangout.lng === 'number' ? hangout.lng : null,
        status: 'active',
        joinedUsers: hangout.joinedUsers || [],
      });
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
    callback: (hangouts: HangoutAlert[]) => void,
    options: { throttleMs?: number } = {}
  ): () => void {
    try {
      // Only tables that are still live: expired ones are never read (and never billed), whoever forgot to close them
      const hangoutsCol = query(collection(db, 'hangouts'), where('expiresAt', '>', Date.now()));
      let lastEmissionTimestamp = 0;

      const unsubscribe = onSnapshot(
        hangoutsCol,
        guard('hangouts', (snapshot) => {
          const now = Date.now();
          // In Battery Saver mode the caller passes a throttle to conserve CPU & battery
          if (options.throttleMs && lastEmissionTimestamp > 0 && now - lastEmissionTimestamp < options.throttleMs) {
            return;
          }
          lastEmissionTimestamp = now;

          const liveFirestoreItems = readEach(snapshot.docs, (d) => {
            const data = readCloudHangout(d.id, d.data());
            if (!data || data.status === 'closed' || isHangoutExpired(data, now)) return null;

            let distKm: number | undefined = undefined;
            let distFormatted: string | undefined = undefined;
            if (typeof data.lat === 'number' && typeof data.lng === 'number' && userLocation && typeof userLocation.lat === 'number') {
              distKm = calculateDistanceKm(userLocation.lat, userLocation.lng, data.lat, data.lng);
              distFormatted = formatDistance(distKm);
            }

            const item: HangoutAlert = {
              ...data,
              userName: data.userName || ph('Користувач'),
              barName: data.barName || ph('Бар'),
              locationArea: data.locationArea || ph('Київ'),
              drinkPreference: data.drinkPreference || ph('Келих за настроєм'),
              createdAt: data.createdAt || ph('Щойно'),
              distanceKm: distKm,
              distanceFormatted: distFormatted,
              isLive: true,
            };
            return item;
          });

          // Real live hangouts from Firestore only
          const merged: HangoutAlert[] = [...liveFirestoreItems];

          // Sort by proximity: closest check-ins first, keeping newest live check-ins prominent
          merged.sort((a, b) => {
            const distA = typeof a.distanceKm === 'number' ? a.distanceKm : 999;
            const distB = typeof b.distanceKm === 'number' ? b.distanceKm : 999;
            return distA - distB;
          });

          callback(merged);
        }),
        (error) => {
          console.warn('[Firestore] Live Hangouts subscription warning:', error);
          callback([]);
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
      // Transaction: two people joining at once must both be counted, and re-joining must not double-count
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(hangoutRef);
        if (!snap.exists()) return;
        const joined: string[] = Array.isArray(snap.data().joinedUsers) ? snap.data().joinedUsers : [];
        if (joined.includes(currentUserId)) return;
        tx.update(hangoutRef, {
          participantsCount: increment(1),
          joinedUsers: arrayUnion(currentUserId),
          updatedAt: new Date().toISOString(),
        });
      });
    } catch (err) {
      console.warn('[Firestore] Error joining live hangout in Firestore:', err);
    }
  },

  /**
   * Закрити / завершити активний чекін у барі
   */
  /**
   * The host brings their table back for another 4 hours. While the document still exists only the expiry changes
   * (guests keep their seats); once the cleanup removed it, a fresh table is posted without guests.
   */
  async renewHangout(hangout: HangoutAlert): Promise<number> {
    const expiresAt = hangoutExpiresAt(Date.now());
    const ref = doc(db, 'hangouts', hangout.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, { expiresAt, updatedAt: new Date().toISOString() });
    } else {
      await this.publishHangout({ ...hangout, expiresAt, participantsCount: 1, joinedUsers: [hangout.userId] });
    }
    return expiresAt;
  },

  async closeLiveHangout(hangoutId: string): Promise<void> {
    try {
      const hangoutRef = doc(db, 'hangouts', hangoutId);
      // Soft-delete or delete
      await deleteDoc(hangoutRef);
    } catch (err) {
      console.warn('[Firestore] Error closing live hangout:', err);
    }
  },

  /** Creator only (rules): creates the meetup or rewrites it (invites, cancel) */
  async saveMeetup(meetup: GroupMeetup): Promise<void> {
    try {
      await setDoc(doc(db, 'group_meetups', meetup.id), omitUndefined({ ...meetupToCloud(meetup), updatedAt: new Date().toISOString() }));
    } catch (err) {
      console.warn('[Firestore] Group meetup sync warning:', err);
    }
  },

  /**
   * Any member: set (join) or remove (leave) only their own participant entry. A field-path update never
   * overwrites what other people changed in the meantime, which a whole-document write would.
   */
  async setMeetupParticipation(meetupId: string, userId: string, entry: MeetupParticipant | null): Promise<void> {
    try {
      await updateDoc(doc(db, 'group_meetups', meetupId), {
        [`participants.${userId}`]: entry ? omitUndefined(entry) : deleteField(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Firestore] Meetup participation sync warning:', err);
    }
  },

  /**
   * Live stream of scheduled group meetups
   */
  subscribeToMeetups(callback: (meetups: GroupMeetup[]) => void): () => void {
    try {
      // Meetups are listed until 24 h after their start; the archive (30 more days) is not loaded
      return onSnapshot(
        query(collection(db, 'group_meetups'), where('endsAt', '>', Date.now())),
        guard('group_meetups', (snapshot) => {
          callback(readEach(snapshot.docs, (d) => readCloudMeetup(d.data())));
        }),
        (error) => console.warn('[Firestore] group_meetups sync warning:', error)
      );
    } catch (err) {
      console.warn('Could not setup Firestore sync for group_meetups:', err);
      return () => {};
    }
  },

  // --------------------------------------------------------------------------
  // Encrypted Chat Firestore Methods (E2EE Client-Side Encryption)
  // --------------------------------------------------------------------------

  /**
   * Encrypts a message and writes it, together with the chat document, in one atomic batch.
   * The chat document carries `members`, which is what firestore.rules check for read/write access.
   * Membership fields are written by the DM participants and by a group's creator only; other group
   * members just update the preview (their writes would be rejected if they touched `members`).
   */
  async sendEncryptedMessage(
    chat: Pick<ChatThread, 'id' | 'isGroup' | 'memberIds' | 'createdBy' | 'groupName' | 'groupTopic' | 'groupAvatar' | 'participants'>,
    message: Message,
    me: { id: string; name: string; avatar?: string }
  ): Promise<{ cipherPayload: string; success: boolean }> {
    try {
      const cipherPayload = await cryptoService.encryptMessage(message.text, chat.id);
      const now = new Date().toISOString();

      const chatFields: Record<string, unknown> = {
        lastCipherPayload: cipherPayload,
        lastSenderId: me.id,
        lastMessageTime: message.timestamp,
        updatedAt: now,
      };
      const members = chat.memberIds ?? [];
      if (!chat.isGroup) {
        chatFields.members = members;
        chatFields.isGroup = false;
        chatFields.profiles = { [me.id]: { name: me.name.slice(0, 60), avatar: me.avatar ?? '' } };
      } else if (chat.createdBy === me.id) {
        chatFields.members = members;
        chatFields.isGroup = true;
        chatFields.createdBy = me.id;
        chatFields.groupName = chat.groupName ?? '';
        chatFields.groupTopic = chat.groupTopic ?? '';
        chatFields.groupAvatar = chat.groupAvatar ?? '';
        chatFields.participants = [
          { id: me.id, name: me.name, avatar: me.avatar ?? '', role: 'admin' },
          ...(chat.participants ?? []).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar ?? '', role: p.role ?? 'member' })),
        ];
      }

      // Venue, address and time of a proposed meetup are as private as the message text: encrypt them too
      const proposalCipher = message.proposalData
        ? await cryptoService.encryptMessage(
            JSON.stringify({ barName: message.proposalData.barName, address: message.proposalData.address, time: message.proposalData.time }),
            chat.id
          )
        : null;

      const batch = writeBatch(db);
      batch.set(doc(db, 'chats', chat.id, 'messages', message.id), {
        id: message.id,
        chatId: chat.id,
        senderId: message.senderId,
        senderName: message.senderName.slice(0, 60), // a Google display name can be longer than the rules allow
        senderAvatar: message.senderAvatar || null,
        cipherPayload,
        type: message.type || 'text',
        proposalData: null, // never plaintext: see proposalCipher
        ...(proposalCipher ? { proposalCipher } : {}),
        ...(message.proposalId ? { proposalId: message.proposalId, proposalStatus: message.proposalStatus } : {}),
        timestamp: message.timestamp,
        isEncrypted: true,
        // Server time, not the phone's: it is the only ordering key of a conversation, and the rules accept nothing
        // else, so a skewed clock cannot misorder replies and nobody can pin a message to the top of the history
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'chats', chat.id), chatFields, { merge: true });
      await batch.commit();

      return { cipherPayload, success: true };
    } catch (error) {
      console.warn('Could not sync encrypted message to Firestore (running in offline/local fallback):', error);
      return { cipherPayload: '', success: false };
    }
  },

  /**
   * Group creator adds people (rules allow this for the creator only). One person per write: the rules check
   * each newcomer against the creator's blocks, and a person who blocked the creator is refused without
   * stopping the others.
   */
  async addGroupMembers(chatId: string, participants: ChatParticipant[]): Promise<void> {
    for (const p of participants) {
      try {
        await updateDoc(doc(db, 'chats', chatId), {
          members: arrayUnionFs(p.id),
          participants: arrayUnionFs({ id: p.id, name: p.name, avatar: p.avatar ?? '', role: 'member' }),
        });
      } catch (error) {
        console.warn('Could not add group member:', error);
      }
    }
  },

  // --------------------------------------------------------------------------
  // Blocking. The rules read users/{me}/blocks/{them} to refuse the blocked person's chats, messages,
  // table seats, meetup joins and profile fetches. The list is private to its owner.
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // Push devices: one document per Expo push token (see the `devices` rules)
  // --------------------------------------------------------------------------

  async saveDevice(userId: string, token: string, platform: 'ios' | 'android', language: string): Promise<void> {
    await setDoc(doc(db, 'devices', deviceIdFor(token)), {
      uid: userId,
      token,
      platform,
      language,
      updatedAt: new Date().toISOString(),
    });
  },

  async removeDevice(token: string): Promise<void> {
    await deleteDoc(doc(db, 'devices', deviceIdFor(token)));
  },

  async saveBlock(userId: string, record: BlockedUserRecord): Promise<void> {
    try {
      await setDoc(
        doc(db, 'users', userId, 'blocks', record.userId),
        omitUndefined({
          userId: record.userId,
          userName: record.userName,
          userAvatar: record.userAvatar,
          blockedAt: record.blockedAt,
          reason: record.reason,
          autoBlocked: record.autoBlocked,
        })
      );
    } catch (error) {
      console.warn('Could not save the block:', error);
    }
  },

  async removeBlock(userId: string, blockedId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', userId, 'blocks', blockedId));
    } catch (error) {
      console.warn('Could not remove the block:', error);
    }
  },

  /** The cloud copy of my block list, or null when it could not be read (so callers never wipe local data on a failure) */
  async getBlocks(userId: string): Promise<BlockedUserRecord[] | null> {
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'blocks'));
      return snap.docs.map((d) => d.data() as BlockedUserRecord);
    } catch (error) {
      console.warn('Could not read the block list:', error);
      return null;
    }
  },

  /** Live list of the chats this user belongs to (the inbox). Includes chats started by other people. */
  subscribeToMyChats(userId: string, callback: (chats: CloudChat[]) => void): () => void {
    try {
      const q = query(collection(db, 'chats'), where('members', 'array-contains', userId));
      return onSnapshot(
        q,
        guard('chat inbox', (snapshot) => {
          callback(readEach(snapshot.docs, (d) => readCloudChat(d.id, d.data(), userId)));
        }),
        (err) => console.warn('[Firestore] chat inbox warning:', err)
      );
    } catch (err) {
      console.warn('Could not subscribe to chat inbox:', err);
      return () => {};
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
      const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(CHAT_PAGE_SIZE));

      const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, guard(`chat ${chatId}`, async (snapshot) => {
        // Only what changed since the last snapshot (incl. delivery-state changes); the initial
        // snapshot reports every loaded doc as "added". Avoids re-decrypting the whole history.
        const changed = snapshot.docChanges({ includeMetadataChanges: true }).filter((c) => c.type !== 'removed');
        if (changed.length === 0) return;

        const read = await Promise.all(
          changed.map(async ({ doc: docSnap }): Promise<(Message & { _createdAt: number }) | null> => {
            try {
              // A message still on its way has no server time yet: use the local estimate until the server answers
              const data = docSnap.data({ serverTimestamps: 'estimate' });
              const senderId = asString(data.senderId);
              if (!senderId) return null;
              const cipher = asString(data.cipherPayload);
              const proposalCipher = asOptString(data.proposalCipher);
              const type = asString(data.type, 'text');
              return {
                id: asString(data.id, docSnap.id),
                chatId,
                senderId,
                senderName: asString(data.senderName),
                senderAvatar: asOptString(data.senderAvatar) || undefined,
                text: await cryptoService.decryptMessage(cipher, chatId),
                timestamp: asString(data.timestamp) || ph('Щойно'),
                isMe: senderId === currentUserId,
                type: (['text', 'cheers', 'location_proposal', 'audio', 'proposal_response'].includes(type) ? type : 'text') as Message['type'],
                audioUrl: asOptString(data.audioUrl) || undefined,
                audioDuration: asNumber(data.audioDuration),
                isEncrypted: true,
                cipherPayload: cipher,
                proposalData: proposalCipher ? await readProposal(proposalCipher, chatId) : undefined,
                proposalId: asOptString(data.proposalId) || undefined,
                proposalStatus: data.proposalStatus === 'accepted' || data.proposalStatus === 'declined' ? data.proposalStatus : undefined,
                isFromCache: snapshot.metadata.fromCache,
                hasPendingWrites: docSnap.metadata.hasPendingWrites,
                _createdAt: timeMillis(data.createdAt),
              };
            } catch (error) {
              console.warn('[Firestore] unreadable message skipped:', docSnap.id, error);
              return null;
            }
          })
        );

        // The query is newest-first; deliver oldest-first (by server time) so the thread appends in order
        const messages = read.filter((m): m is Message & { _createdAt: number } => m !== null);
        messages.sort((x, y) => x._createdAt - y._createdAt);
        onMessages(messages.map(({ _createdAt, ...m }) => m));
      }), (err) => {
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
  },

  /**
   * "People nearby": registered users within ~3 km of `center`, nearest first, at most 50. Firestore cannot filter by
   * distance, so the circle is covered by a few geohash ranges (one listener each) and the exact distance is applied
   * here. Users without a location carry no geohash and are never returned.
   */
  subscribeToPublicBuddies(
    currentUserId: string,
    center: GeoPoint,
    callback: (buddies: BuddyProfile[]) => void
  ): () => void {
    try {
      const bounds = nearbyQueryBounds(center);
      const byRange = new Map<number, BuddyProfile[]>();
      const emit = () => callback(pickNearby(Array.from(byRange.values()).flat(), center));

      const unsubscribes = bounds.map(([start, end], index) =>
        onSnapshot(
          query(collection(db, 'users'), orderBy('geohash'), startAt(start), endAt(end), limit(PER_RANGE_LIMIT)),
          guard('nearby profiles', (snapshot) => {
            const now = Date.now();
            const found = readEach(snapshot.docs, (docSnap): BuddyProfile | null => {
              const data = docSnap.data();
              const uid = docSnap.id;
              const name = asString(data.name);
              const lat = asNumber(data.lat);
              const lng = asNumber(data.lng);
              if (uid === currentUserId || !name) return null;
              if (lat === undefined || lng === undefined) return null; // no location: not "nearby"
              const drinks = asStringList(data.preferredDrinks, 8).filter((x): x is DrinkType => (DRINK_TYPES as readonly string[]).includes(x));

              return {
                id: uid,
                name,
                age: asNumber(data.age) ?? 26,
                avatar: asString(data.avatar),
                tagline: asString(data.tagline) || ph('Радий знайомству за келихом 🍻'),
                bio: asString(data.bio),
                locationName: asString(data.locationName) || ph('Київ'),
                distanceKm: 0, // set by pickNearby, recomputed from the live position in selectors
                coordinates: { lat, lng },
                preferredDrinks: drinks.length > 0 ? drinks : ['craft'],
                paymentRule: oneOf(data.paymentRule, PAYMENT_RULES, 'split_50_50'),
                currentMood: oneOf(data.currentMood, MOOD_TYPES, 'chill_talk'),
                favoriteBars: asStringList(data.favoriteBars, 20),
                talkTopics: asStringList(data.talkTopics, 20),
                online: isOnline(asOptString(data.lastSeenAt), now),
                inactive: isInactive(asOptString(data.lastSeenAt), now),
                lastSeenAt: asOptString(data.lastSeenAt),
                level: asNumber(data.level) ?? 1,
                levelTitle: asOptString(data.levelTitle),
                totalCheckIns: asNumber(data.totalCheckIns),
              };
            });
            byRange.set(index, found);
            emit();
          }),
          (error) => {
            console.warn('[Firestore] Error subscribing to nearby profiles:', error);
            byRange.set(index, []);
            emit();
          }
        )
      );

      return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    } catch (err) {
      console.warn('[Firestore] Failed to establish nearby profiles listener:', err);
      return () => {};
    }
  },

  /** Tells other users this person has the app open (the online dot, and the "inactive" mark after a week away) */
  async touchPresence(userId: string): Promise<void> {
    try {
      await setDoc(doc(db, 'users', userId), { id: userId, lastSeenAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      console.warn('Could not update presence:', error);
    }
  },

  /**
   * Account deletion (required by the App Store / Google Play): removes the profile, private
   * data, favorites and friends. Messages already sent stay in chats as ciphertext for the other members.
   */
  async deleteAccountData(userId: string): Promise<void> {
    for (const sub of ['favorites', 'friends', 'private']) {
      const snap = await getDocs(collection(db, 'users', userId, sub));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }
    const devices = await getDocs(query(collection(db, 'devices'), where('uid', '==', userId)));
    await Promise.all(devices.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'users', userId));
  },
};

