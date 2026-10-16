import { ph } from './i18nService';
import { captureAppErrorReporter } from './appErrors';
import { requireAllowedContent } from '../logic/contentPolicy';
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
    limit,
  limitToLast,
  Timestamp,
  serverTimestamp,
  runTransaction,
  arrayUnion,
  increment,
  deleteField,
  FieldPath
} from 'firebase/firestore';
import type { DocumentData, Query, QueryDocumentSnapshot, Transaction } from 'firebase/firestore';

/**
 * At most this many messages arrive when a chat this device already holds is opened (those sent since). More means it
 * was away long enough for the page not to reach back to them: the stream says so (`replacesOlder`).
 */
const CHAT_SINCE_LIMIT = 100;

/**
 * Lower bound of the "still live" feed queries, rounded down to the hour. A re-subscription within the hour sends the
 * very same query, so it resumes from the cached result and downloads only the changes (LRU cache, services/firebase.ts);
 * whatever ended since the full hour is dropped on the client.
 */
const liveSince = (now: number): number => now - (now % 3_600_000);
import { db } from './firebase';
import { auth, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { FavoriteVenueItem, PaymentEtiquette, DrinkType, Message, HangoutAlert, UserGamificationState, BuddyProfile, GroupMeetup, ChatThread, ChatParticipant } from '../types';
import { CHAT_FIRST_PAGE, type CloudChat } from '../logic/chats';
import { meetupToCloud } from '../logic/meetups';
import { DRINK_TYPES, MOOD_TYPES, PAYMENT_RULES, asNumber, asOptString, asString, asStringList, oneOf, readCloudChat, readCloudHangout, readCloudMeetup, readEach, timeMillis } from '../logic/cloudData';
import type { MeetupParticipant } from '../types';
import { omitUndefined } from '../utils/firestoreData';
import type { BlockedUserRecord } from '../types';
import { cryptoService } from './cryptoService';
import { deviceIdFor } from '../logic/push';
import { hangoutExpiresAt, isHangoutExpired, isMeetupArchived } from '../logic/lifecycle';
import { coarseCoordinate as coarse } from '../logic/privacy';
import { publicGeohash, type GeoPoint } from '../logic/nearby';
import { feedCellOf } from '../logic/feedArea';
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
  shareLocation?: boolean;
  bio?: string;
  currentMood?: string;
  favoriteBars?: string[];
  talkTopics?: string[];
}

/** Data only the owner may read: never shown to other users */
export interface PrivateProfile {
  email?: string;
  birthDate?: string;
  termsVersion?: string;
}

/** Read before any transaction writes. The rules bind this debit to one newly created resource. */
async function prepareWriteBudget(tx: Transaction, uid: string, operation: 'message' | 'hangout' | 'meetup', resourceId: string) {
  const ref = doc(db, 'writeQuotas', `${uid}_${operation}`);
  const snap = await tx.get(ref);
  const previous = snap.data();
  const reset = !previous || Date.now() - timeMillis(previous.windowStartedAt) >= 86400000;
  const count = reset ? 1 : Number(previous.count) + 1;
  const maximum = operation === 'message' ? 2000 : operation === 'hangout' ? 30 : 20;
  if (count > maximum) throw Object.assign(new Error('Daily publishing limit reached'), { code: 'resource-exhausted' });
  return () => tx.set(ref, {
    uid, operation, resourceId, count,
    windowStartedAt: reset ? serverTimestamp() : previous!.windowStartedAt,
    lastAt: serverTimestamp(),
  });
}


/**
 * Wraps a snapshot callback. Firestore calls it from a timer, where an exception is uncaught and kills a release
 * build, so a snapshot that cannot be processed is logged and skipped; the next one is processed normally.
 */
function guard<T>(what: string, onNext: (value: T) => void | Promise<void>): (value: T) => void {
  const report = captureAppErrorReporter({ restart: true });
  const skip = (error: unknown) => { console.warn(`[Firestore] ${what}: snapshot skipped`, error); report(error); };
  return (value) => {
    try {
      const result = onNext(value);
      if (result instanceof Promise) result.catch(skip);
    } catch (error) {
      skip(error);
    }
  };
}

/**
 * Listens to several queries over one collection and reports the union of their documents (by id). Nothing is
 * reported until every query has answered once, so a partial first answer cannot make the list blink. A query that
 * fails (a missing index, say) counts as empty, so the others still show.
 */
function onUnionSnapshot(queries: Query[], what: string, onDocs: (docs: QueryDocumentSnapshot[]) => void, onError: (error: unknown) => void): () => void {
  const latest: Array<QueryDocumentSnapshot[] | undefined> = queries.map(() => undefined);
  const emit = guard(what, () => {
    if (latest.some((docs) => docs === undefined)) return;
    const byId = new Map<string, QueryDocumentSnapshot>();
    latest.forEach((docs) => docs!.forEach((d) => byId.set(d.id, d)));
    onDocs([...byId.values()]);
  });
  const stops = queries.map((q, i) =>
    onSnapshot(
      q,
      (snapshot) => { latest[i] = snapshot.docs; emit(undefined); },
      (error) => { onError(error); latest[i] = []; emit(undefined); }
    )
  );
  return () => stops.forEach((stop) => stop());
}

type ReadMessage = Message & { _createdAt: number };

/** One stored chat message, decrypted; null (and reported) when it cannot be read */
async function readChatMessage(docSnap: QueryDocumentSnapshot, chatId: string, currentUserId: string, fromCache: boolean, report: (error: unknown) => void): Promise<ReadMessage | null> {
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
      isFromCache: fromCache,
      hasPendingWrites: docSnap.metadata.hasPendingWrites,
      _createdAt: timeMillis(data.createdAt),
      createdAt: timeMillis(data.createdAt),
    };
  } catch (error) {
    console.warn('[Firestore] unreadable message skipped:', docSnap.id, error);
    report(error);
    return null;
  }
}

/** Readable messages oldest first (by server time), so a thread appends in order */
function oldestFirst(read: Array<ReadMessage | null>): Message[] {
  const messages = read.filter((m): m is ReadMessage => m !== null);
  messages.sort((x, y) => x._createdAt - y._createdAt);
  return messages.map(({ _createdAt, ...m }) => m);
}

/** An earlier attempt already wrote this message (it committed after its timeout): report that one, never rewrite it */
function alreadySent(data: DocumentData, senderId: string): { cipherPayload: string; success: boolean } {
  if (data.senderId !== senderId) throw Object.assign(new Error('Message id belongs to another sender'), { code: 'permission-denied' });
  return { cipherPayload: asString(data.cipherPayload), success: true };
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
    requireAllowedContent(profile.name, profile.tagline, profile.bio);
    try {
      const fields = Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined));
      if (profile.shareLocation === false) {
        fields.lat = deleteField(); fields.lng = deleteField(); fields.geohash = deleteField(); fields.locationName = deleteField();
      }
      if (typeof fields.lat === 'number') fields.lat = coarse(fields.lat);
      if (typeof fields.lng === 'number') fields.lng = coarse(fields.lng);
      if (typeof fields.lat === 'number' && typeof fields.lng === 'number') fields.geohash = publicGeohash(fields.lat, fields.lng);
      // Builds before 2026-10-16 stamped a visit time here; nothing reads it, so the next profile write drops it
      fields.lastSeenAt = deleteField();
      await setDoc(doc(db, 'users', profile.id), { ...fields, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      throw error;
    }
  },

  async savePrivateProfile(userId: string, data: PrivateProfile): Promise<void> {
    try {
      const fields = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
      await setDoc(doc(db, 'users', userId, 'private', 'profile'), fields, { merge: true });
    } catch (error) {
      throw error;
    }
  },

  async getPrivateProfile(userId: string): Promise<PrivateProfile | null> {
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'private', 'profile'));
      return snap.exists() ? (snap.data() as PrivateProfile) : null;
    } catch (error) {
      throw error;
    }
  },

  // Fetch user profile from Firestore
  async getUserProfile(userId: string): Promise<Partial<FirestoreUserProfile> | null> {
    if (auth.currentUser?.uid === userId) {
      const snap = await getDoc(doc(db, 'users', userId));
      return snap.exists() ? snap.data() as FirestoreUserProfile : null;
    }
    const result = await httpsCallable<{ userId: string }, Partial<FirestoreUserProfile> | null>(functions, 'publicUserProfile')({ userId });
    return result.data;
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

      throw error;
    }
  },

  async getUserGamification(userId: string): Promise<UserGamificationState | null> {
    const report = captureAppErrorReporter({ restart: true });
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
      report(error);
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

      throw error;
    }
  },

  // Remove favorite venue from Firestore
  async removeFavoriteVenue(userId: string, venueId: string): Promise<void> {
    try {
      const favRef = doc(db, 'users', userId, 'favorites', venueId);
      await deleteDoc(favRef);
    } catch (error) {
      console.warn('Failed to delete venue from Firestore:', error);

      throw error;
    }
  },

  // Get all user favorites from Firestore
  async getUserFavorites(userId: string): Promise<FavoriteVenueItem[]> {
    const report = captureAppErrorReporter({ restart: true });
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
      report(error);
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
    requireAllowedContent(hangout.userName, hangout.barName, hangout.description);
    try {
      const hangoutRef = doc(db, 'hangouts', hangout.id);
      await runTransaction(db, async (tx) => {
      if ((await tx.get(hangoutRef)).exists()) return;
      const debit = await prepareWriteBudget(tx, hangout.userId, 'hangout', hangout.id);
      debit();
      tx.set(hangoutRef, {
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
        // The area clients listen to (logic/feedArea.ts)
        ...omitUndefined({ geo: feedCellOf(hangout.lat, hangout.lng) }),
        status: 'active',
        joinedUsers: hangout.joinedUsers || [],
      });
      });
    } catch (error) {
      console.warn('[Firestore] Failed to publish live hangout check-in:', error);
      throw error;
    }
  },

  /**
   * Live tables in the area around `cells` (logic/feedArea.ts), plus the ones this person hosts or sits at wherever
   * they are (the "ended" modal relies on those). Distances are measured from `userLocation`.
   */
  subscribeToLiveHangouts(
    userId: string,
    userLocation: UserGeoLocation,
    cells: string[],
    callback: (hangouts: HangoutAlert[]) => void
  ): () => void {
    const report = captureAppErrorReporter({ restart: true });
    try {
      // Only tables live this hour: older expired ones are never read (and never billed), whoever forgot to close them.
      // Tables that ended within the hour are skipped below (isHangoutExpired).
      // Battery saver does not drop snapshots here (that saved no traffic and could lose the last change): it keeps the
      // whole listener to the screens that show tables instead (hooks/useCloudSync.ts).
      const since = liveSince(Date.now());
      const hangouts = collection(db, 'hangouts');
      const queries = [
        ...(cells.length ? [query(hangouts, where('geo', 'in', cells), where('expiresAt', '>', since))] : []),
        // The host is in joinedUsers from the start (rules), so this one query covers hosting and sitting at a table
        query(hangouts, where('joinedUsers', 'array-contains', userId), where('expiresAt', '>', since)),
      ];

      const unsubscribe = onUnionSnapshot(
        queries,
        'hangouts',
        (docs) => {
          const now = Date.now();
          const liveFirestoreItems = readEach(docs, (d) => {
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
        },
        (error) => {
          console.warn('[Firestore] Live Hangouts subscription warning:', error);
          report(error);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('[Firestore] Error creating Hangouts live listener:', err);
      report(err);
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
        if (!snap.exists()) throw Object.assign(new Error('Table no longer exists'), { code: 'not-found' });
        const joined: string[] = Array.isArray(snap.data().joinedUsers) ? snap.data().joinedUsers : [];
        if (joined.includes(currentUserId)) return;
        const table = snap.data();
        if (table.status === 'closed' || Number(table.expiresAt) <= Date.now() || Number(table.participantsCount) >= Number(table.slotsAvailable) + 1) {
          throw Object.assign(new Error('Table is closed or full'), { code: 'failed-precondition' });
        }
        tx.update(hangoutRef, {
          participantsCount: increment(1),
          joinedUsers: arrayUnion(currentUserId),
          updatedAt: new Date().toISOString(),
        });
      });
    } catch (err) {
      console.warn('[Firestore] Error joining live hangout in Firestore:', err);

      throw err;
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

      throw err;
    }
  },

  /** Creator only (rules): creates the meetup or rewrites it (invites, cancel) */
  async saveMeetup(meetup: GroupMeetup): Promise<void> {
    requireAllowedContent(meetup.title, meetup.description, meetup.venueName);
    try {
      const ref = doc(db, 'group_meetups', meetup.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const fields = omitUndefined({ ...meetupToCloud(meetup), updatedAt: new Date().toISOString() });
        if (!snap.exists()) {
          const debit = await prepareWriteBudget(tx, meetup.creatorId, 'meetup', meetup.id);
          debit(); tx.set(ref, fields); return;
        }
        const existing = snap.data();
        if (existing.creatorId !== meetup.creatorId) throw new Error('Meetup owner changed');
        // Only new invitations are merged; never overwrite a guest's concurrent RSVP from a stale host copy.
        const participants = { ...existing.participants };
        for (const [uid, entry] of Object.entries(fields.participants as Record<string, MeetupParticipant>)) {
          if (!(uid in participants)) participants[uid] = entry;
        }
        if (Object.keys(participants).length > meetup.maxParticipants) throw new Error('Meetup is full');
        tx.update(ref, { ...fields, participants });
      });
    } catch (err) {
      throw err;
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
      throw err;
    }
  },

  /**
   * Scheduled group meetups in the area around `cells` (logic/feedArea.ts), plus every meetup this person hosts or is
   * invited to, wherever it is
   */
  subscribeToMeetups(userId: string, cells: string[], callback: (meetups: GroupMeetup[]) => void): () => void {
    const report = captureAppErrorReporter({ restart: true });
    try {
      // Meetups are listed until 24 h after their start; the archive (30 more days) is not loaded, and the ones archived
      // within the current hour (the query bound is rounded, see liveSince) are skipped here.
      // "Mine" filters on the person's own participant entry alone: the automatic single-field index serves it, and
      // the few archived meetups it also returns are skipped like the rest.
      const meetups = collection(db, 'group_meetups');
      return onUnionSnapshot(
        [
          ...(cells.length ? [query(meetups, where('geo', 'in', cells), where('endsAt', '>', liveSince(Date.now())))] : []),
          query(meetups, where(new FieldPath('participants', userId, 'userId'), '==', userId)),
        ],
        'group_meetups',
        (docs) => {
          const now = Date.now();
          callback(readEach(docs, (d) => readCloudMeetup(d.data())).filter((m) => !isMeetupArchived(m, now)));
        },
        (error) => { console.warn('[Firestore] group_meetups sync warning:', error); report(error); }
      );
    } catch (err) {
      console.warn('Could not setup Firestore sync for group_meetups:', err);
      report(err);
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
    chat: Pick<ChatThread, 'id' | 'isGroup' | 'memberIds' | 'createdBy' | 'groupName' | 'groupTopic' | 'groupAvatar' | 'participants'> & {
      /** The inbox already received this chat from the cloud: it exists, and this sender may read it */
      existsInCloud?: boolean;
    },
    message: Message,
    me: { id: string; name: string; avatar?: string }
  ): Promise<{ cipherPayload: string; success: boolean; errorCode?: string }> {
    try {
      requireAllowedContent(message.text, chat.groupName, chat.groupTopic, message.proposalData?.barName, message.proposalData?.address);
      const messageRef = doc(db, 'chats', chat.id, 'messages', message.id);
      // A previous attempt may have committed after its timeout. Never rewrite an immutable message on retry.
      // In a chat known to exist, that check is one of the transaction's reads below (no extra round trip). Reading a
      // message of a chat that may not exist yet is refused by the rules, so a new chat is checked here, with its parent.
      let parentExists = chat.existsInCloud === true;
      if (!parentExists) {
        const [existing, parent] = await Promise.all([
          getDoc(messageRef).catch(() => null),
          getDoc(doc(db, 'chats', chat.id)).catch(() => null),
        ]);
        if (existing?.exists()) return alreadySent(existing.data(), me.id);
        parentExists = !!parent?.exists();
      }
      const cipherPayload = await cryptoService.encryptMessage(message.text, chat.id);
      const now = new Date().toISOString();

      const chatFields: Record<string, unknown> = {
        lastMessageId: message.id,
        lastCipherPayload: cipherPayload,
        lastSenderId: me.id,
        lastMessageTime: message.timestamp,
        updatedAt: now,
      };
      // Rules hide a missing parent too; the atomic write below proves membership on creation.
      const members = chat.memberIds ?? [];
      if (!chat.isGroup && !parentExists) {
        chatFields.members = members;
        chatFields.isGroup = false;
        chatFields.profiles = { [me.id]: { name: me.name.slice(0, 60), avatar: me.avatar ?? '' } };
      } else if (!chat.isGroup) {
        chatFields.profiles = { [me.id]: { name: me.name.slice(0, 60), avatar: me.avatar ?? '' } };
      } else if (chat.isGroup && chat.createdBy === me.id && !parentExists) {
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

      let result: { cipherPayload: string; success: boolean } = { cipherPayload, success: true };
      await runTransaction(db, async (tx) => {
      // A concurrent retry that loses creation is retried by the durable outbox.
      const [debit, existing] = await Promise.all([
        prepareWriteBudget(tx, me.id, 'message', `${chat.id}/${message.id}`),
        chat.existsInCloud === true ? tx.get(messageRef) : null,
      ]);
      if (existing?.exists()) {
        result = alreadySent(existing.data(), me.id);
        return;
      }
      result = { cipherPayload, success: true };
      debit();
      tx.set(messageRef, {
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
      tx.set(doc(db, 'chats', chat.id), chatFields, { merge: true });
      });

      return result;
    } catch (error) {
      console.warn('Could not sync encrypted message to Firestore (running in offline/local fallback):', error);
      return { cipherPayload: '', success: false, errorCode: String((error as { code?: unknown })?.code ?? 'unavailable') };
    }
  },

  /**
   * Group creator adds people (rules allow this for the creator only). One person per write: the rules check
   * each newcomer against the creator's blocks, and a person who blocked the creator is refused without
   * stopping the others.
   */
  async addGroupMembers(chatId: string, participants: ChatParticipant[]): Promise<void> {
    const failures: unknown[] = [];
    for (const p of participants) {
      try {
        await updateDoc(doc(db, 'chats', chatId), {
          members: arrayUnionFs(p.id),
          participants: arrayUnionFs({ id: p.id, name: p.name, avatar: p.avatar ?? '', role: 'member' }),
        });
      } catch (error) {
        console.warn('Could not add group member:', error);

        failures.push(error);
      }
    }
    if (failures.length) throw failures[0];
  },

  // --------------------------------------------------------------------------
  // Blocking. The rules read users/{me}/blocks/{them} to refuse the blocked person's chats, messages,
  // table seats, meetup joins and profile fetches. The list is private to its owner.
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // Push devices: one document per Expo push token (see the `devices` rules)
  // --------------------------------------------------------------------------

  async saveDevice(userId: string, token: string, platform: 'ios' | 'android', language: string, bindingSequence = Date.now()): Promise<void> {
    await setDoc(doc(db, 'devices', deviceIdFor(token)), {
      uid: userId,
      token,
      platform,
      language,
      privatePreview: false,
      bindingSequence,
      leaseUntil: Date.now() + 24 * 60 * 60 * 1000,
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

      throw error;
    }
  },

  async removeBlock(userId: string, blockedId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', userId, 'blocks', blockedId));
    } catch (error) {
      console.warn('Could not remove the block:', error);

      throw error;
    }
  },

  /** The cloud copy of my block list, or null when it could not be read (so callers never wipe local data on a failure) */
  async getBlocks(userId: string): Promise<BlockedUserRecord[] | null> {
    const report = captureAppErrorReporter({ restart: true });
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'blocks'));
      return snap.docs.map((d) => d.data() as BlockedUserRecord);
    } catch (error) {
      console.warn('Could not read the block list:', error);
      report(error);
      return null;
    }
  },

  /** Live list of the chats this user belongs to (the inbox). Includes chats started by other people. */
  subscribeToMyChats(userId: string, callback: (chats: CloudChat[]) => void): () => void {
    const report = captureAppErrorReporter({ restart: true });
    try {
      const q = query(collection(db, 'chats'), where('members', 'array-contains', userId));
      return onSnapshot(
        q,
        guard('chat inbox', (snapshot) => {
          callback(readEach(snapshot.docs, (d) => readCloudChat(d.id, d.data(), userId)));
        }),
        (err) => { console.warn('[Firestore] chat inbox warning:', err); report(err); }
      );
    } catch (err) {
      console.warn('Could not subscribe to chat inbox:', err);
      report(err);
      return () => {};
    }
  },

  /**
   * Subscribes to real-time chat messages from Cloud Firestore and decrypts them on the fly.
   * Messages never change once written (rules), so a chat this device already holds only needs what came after the
   * newest message the server confirmed (`since`, server time in ms); the newest page is loaded only without one.
   */
  subscribeToEncryptedChat(
    chatId: string,
    currentUserId: string,
    onMessages: (messages: Message[], replacesOlder: boolean) => void,
    since?: number
  ): () => void {
    const report = captureAppErrorReporter({ restart: true });
    try {
      const messages = collection(db, 'chats', chatId, 'messages');
      const q = since !== undefined
        ? query(messages, where('createdAt', '>', Timestamp.fromMillis(since)), orderBy('createdAt'), limitToLast(CHAT_SINCE_LIMIT))
        : query(messages, orderBy('createdAt', 'desc'), limit(CHAT_FIRST_PAGE));
      // Settled by the first answer from the server (a cached one may be partial)
      let gapChecked = since === undefined;

      const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, guard(`chat ${chatId}`, async (snapshot) => {
        let replacesOlder = false;
        if (!gapChecked && !snapshot.metadata.fromCache) {
          gapChecked = true;
          replacesOlder = snapshot.size >= CHAT_SINCE_LIMIT;
        }
        // Only what changed since the last snapshot (incl. delivery-state changes); the initial snapshot reports every
        // loaded doc as "added". Avoids re-decrypting the whole history. A page that replaces the older messages goes whole.
        const docs = replacesOlder
          ? snapshot.docs
          : snapshot.docChanges({ includeMetadataChanges: true }).filter((c) => c.type !== 'removed').map((c) => c.doc);
        if (docs.length === 0) return;

        const read = await Promise.all(docs.map((d) => readChatMessage(d, chatId, currentUserId, snapshot.metadata.fromCache, report)));
        onMessages(oldestFirst(read), replacesOlder);
      }), (err) => {
        console.warn('Firestore snapshot listener notice (local state remains active):', err);
        report(err);
      });

      return unsubscribe;
    } catch (err) {
      console.warn('Failed to establish Firestore chat subscription:', err);
      report(err);
      return () => {};
    }
  },

  /**
   * "Show earlier": the page of messages sent before `before` (server time in ms), oldest first. `complete` when the
   * server has nothing older; an answer from the cache (offline) never claims that.
   */
  async loadOlderMessages(chatId: string, currentUserId: string, before: number): Promise<{ messages: Message[]; complete: boolean }> {
    const report = captureAppErrorReporter();
    const snapshot = await getDocs(query(
      collection(db, 'chats', chatId, 'messages'),
      where('createdAt', '<', Timestamp.fromMillis(before)),
      orderBy('createdAt', 'desc'),
      limit(CHAT_FIRST_PAGE)
    ));
    const read = await Promise.all(snapshot.docs.map((d) => readChatMessage(d, chatId, currentUserId, snapshot.metadata.fromCache, report)));
    return { messages: oldestFirst(read), complete: !snapshot.metadata.fromCache && snapshot.size < CHAT_FIRST_PAGE };
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

      throw e;
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

      throw e;
    }
  },

  /**
   * Get all friends from Firestore subcollection
   */
  async getFriendsFromFirestore(userId: string): Promise<any[]> {
    const report = captureAppErrorReporter({ restart: true });
    try {
      const friendsCol = collection(db, 'users', userId, 'friends');
      const snap = await getDocs(friendsCol);
      return snap.docs.map((d) => d.data());
    } catch (e) {
      console.warn('Could not fetch friends from Firestore:', e);
      report(e);
      return [];
    }
  },

  /**
   * "People nearby": registered users within ~3 km of `center`, nearest first, at most 50 (callable discoverNearby).
   * Asked right away, then every `refreshMs` while subscribed.
   */
  subscribeToPublicBuddies(currentUserId: string, center: GeoPoint, callback: (buddies: BuddyProfile[]) => void, refreshMs = 2 * 60 * 1000): () => void {
    const report = captureAppErrorReporter({ restart: true });
    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const result = await httpsCallable<GeoPoint, Record<string, unknown>[]>(functions, 'discoverNearby')(center);
        if (cancelled) return;
        const buddies = readEach(result.data, (data): BuddyProfile | null => {
          const uid = asString(data.id), name = asString(data.name);
          const lat = asNumber(data.lat), lng = asNumber(data.lng);
          if (!uid || uid === currentUserId || !name || lat === undefined || lng === undefined) return null;
          return {
            id: uid, name, age: asNumber(data.age) ?? 0, avatar: asString(data.avatar),
            tagline: asString(data.tagline), bio: asString(data.bio), locationName: '',
            distanceKm: calculateDistanceKm(center.lat, center.lng, lat, lng), coordinates: { lat, lng },
            preferredDrinks: asStringList(data.preferredDrinks, 8).filter((x): x is DrinkType => (DRINK_TYPES as readonly string[]).includes(x)),
            paymentRule: oneOf(data.paymentRule, PAYMENT_RULES, 'not_specified'),
            currentMood: oneOf(data.currentMood, MOOD_TYPES, 'not_specified'),
            favoriteBars: asStringList(data.favoriteBars, 20), talkTopics: asStringList(data.talkTopics, 20), online: false,
          };
        });
        callback(buddies);
      } catch (error) { console.warn('[discovery] refresh failed:', error); if (!cancelled) report(error); }
      finally { inFlight = false; }
    };
    void poll();
    const timer = setInterval(() => void poll(), refreshMs);
    return () => { cancelled = true; clearInterval(timer); };
  },

  async saveReport(report: import('../types').UserReport): Promise<void> {
    const ref = doc(db, 'reports', report.id);
    const quota = doc(db, 'reportRateLimits', report.reporterId);
    await runTransaction(db, async (tx) => {
      const [existing, limit] = await Promise.all([tx.get(ref), tx.get(quota)]);
      if (existing.exists()) return;
      const previous = limit.exists() ? limit.data() : null;
      const reset = !previous || timeMillis(previous.windowStartedAt) < Date.now() - 24 * 3600_000;
      tx.set(quota, { count: reset ? 1 : Number(previous?.count ?? 0) + 1, windowStartedAt: reset ? serverTimestamp() : previous!.windowStartedAt, lastAt: serverTimestamp(), lastReportId: report.id });
      tx.set(ref, omitUndefined({ ...report, syncedAt: new Date().toISOString(), receivedAt: serverTimestamp() }));
    });
  },
};

