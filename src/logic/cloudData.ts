import type { ChatParticipant, DrinkType, GroupMeetup, HangoutAlert, MeetupParticipant, MoodType, PaymentEtiquette } from '../types';
import type { CloudChat } from './chats';

/**
 * Everything read from a shared Firestore collection was written by some other client, and the rules cannot check
 * every value (a rule cannot iterate over a map's entries or a list's items). So nothing from there is trusted as
 * typed: these readers take `unknown` and return a well-formed value or null, and the listeners skip what is null.
 * One malformed document must never throw inside a snapshot callback: Firestore runs those from a timer, where an
 * exception is uncaught and takes the whole app down in a release build.
 */

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const asString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export const asOptString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export const asNumber = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export const asStringList = (v: unknown, max = 100): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : [];

export const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

export const DRINK_TYPES: readonly DrinkType[] = ['beer', 'craft', 'wine', 'cocktail', 'whiskey', 'cider', 'shots', 'non_alcoholic'];
export const PAYMENT_RULES: readonly PaymentEtiquette[] = ['split_50_50', 'each_for_themselves', 'i_treat', 'rounds'];
export const MOOD_TYPES: readonly MoodType[] = ['chill_talk', 'coding_it', 'board_games', 'bar_crawl', 'sports_football', 'deep_philosophy', 'live_music'];

/** Runs `read` on every item and keeps the results that are not null; an item that throws is skipped too */
export function readEach<I, T>(items: readonly I[], read: (item: I) => T | null | undefined): T[] {
  const out: T[] = [];
  for (const item of items) {
    try {
      const value = read(item);
      if (value != null) out.push(value);
    } catch {
      // a single bad document is dropped, never the whole list
    }
  }
  return out;
}

// ─── Meetups ─────────────────────────────────────────────────────────────────

export function readMeetupParticipant(v: unknown, key?: string): MeetupParticipant | null {
  if (!isRecord(v)) return null;
  const userId = asString(v.userId);
  // In the cloud the entry is keyed by uid: an entry that claims another uid than its key is not believed
  if (!userId || (key !== undefined && userId !== key)) return null;
  return {
    userId,
    userName: asString(v.userName),
    userAvatar: asString(v.userAvatar),
    role: oneOf(v.role, ['host', 'member'] as const, 'member'),
    status: oneOf(v.status, ['going', 'invited', 'declined'] as const, 'invited'),
    joinedAt: asOptString(v.joinedAt),
  };
}

/** A `group_meetups` document, or null when it cannot be shown */
export function readCloudMeetup(v: unknown): GroupMeetup | null {
  if (!isRecord(v)) return null;
  const id = asString(v.id);
  const title = asString(v.title);
  const creatorId = asString(v.creatorId);
  if (!id || !title || !creatorId) return null;

  const raw = isRecord(v.participants) ? v.participants : {};
  const participants = readEach(Object.entries(raw), ([key, value]) => readMeetupParticipant(value, key));
  // Only the creator can be the host, whatever the document says
  participants.forEach((p) => {
    p.role = p.userId === creatorId ? 'host' : 'member';
  });
  // Host first, then in stored order; a stable order keeps the UI from jumping between snapshots
  participants.sort((a, b) => Number(b.role === 'host') - Number(a.role === 'host'));

  return {
    id,
    title,
    description: asString(v.description),
    venueName: asString(v.venueName),
    venueAddress: asString(v.venueAddress),
    scheduledDate: asString(v.scheduledDate),
    scheduledTime: asString(v.scheduledTime),
    dateTimeIso: asOptString(v.dateTimeIso),
    endsAt: asNumber(v.endsAt),
    drinkPreference: asOptString(v.drinkPreference),
    maxParticipants: Math.max(2, Math.min(30, Math.round(asNumber(v.maxParticipants) ?? 6))),
    participants,
    creatorId,
    creatorName: asString(v.creatorName),
    creatorAvatar: asString(v.creatorAvatar),
    status: oneOf(v.status, ['upcoming', 'ongoing', 'past', 'cancelled'] as const, 'upcoming'),
    lat: asNumber(v.lat),
    lng: asNumber(v.lng),
    distanceKm: asNumber(v.distanceKm),
    distanceFormatted: asOptString(v.distanceFormatted),
    createdAt: asString(v.createdAt),
    topicTag: asOptString(v.topicTag),
  };
}

// ─── Live tables ─────────────────────────────────────────────────────────────

/** The stored part of a `hangouts` document (no distance, no display defaults), or null when it cannot be shown */
export function readCloudHangout(id: string, v: unknown): Omit<HangoutAlert, 'distanceKm' | 'distanceFormatted' | 'isLive'> | null {
  if (!isRecord(v) || !id) return null;
  const userId = asString(v.userId);
  const expiresAt = asNumber(v.expiresAt);
  if (!userId || expiresAt === undefined) return null;
  return {
    id,
    userId,
    userName: asString(v.userName),
    userAvatar: asString(v.userAvatar),
    barName: asString(v.barName),
    locationArea: asString(v.locationArea),
    drinkPreference: asString(v.drinkPreference),
    description: asString(v.description),
    createdAt: asString(v.createdAt),
    slotsAvailable: asNumber(v.slotsAvailable) ?? 2,
    participantsCount: asNumber(v.participantsCount) ?? 1,
    lat: asNumber(v.lat),
    lng: asNumber(v.lng),
    expiresAt,
    status: oneOf(v.status, ['active', 'closed'] as const, 'active'),
    joinedUsers: asStringList(v.joinedUsers, 7),
  };
}

// ─── Chats ───────────────────────────────────────────────────────────────────

function readChatParticipant(v: unknown): ChatParticipant | null {
  if (!isRecord(v)) return null;
  const id = asString(v.id);
  if (!id) return null;
  return { id, name: asString(v.name), avatar: asString(v.avatar), role: oneOf(v.role, ['admin', 'member'] as const, 'member') };
}

/** A `chats/{id}` document, or null when it is not a chat this user can show */
export function readCloudChat(id: string, v: unknown, myId: string): CloudChat | null {
  if (!isRecord(v) || !id) return null;
  const members = Array.from(new Set(asStringList(v.members, 10)));
  if (members.length < 2 || !members.includes(myId)) return null;

  const profiles: Record<string, { name?: string; avatar?: string }> = {};
  if (isRecord(v.profiles)) {
    for (const [uid, p] of Object.entries(v.profiles)) {
      if (isRecord(p)) profiles[uid] = { name: asOptString(p.name), avatar: asOptString(p.avatar) };
    }
  }

  return {
    id,
    members,
    isGroup: v.isGroup === true,
    createdBy: asOptString(v.createdBy),
    groupName: asOptString(v.groupName),
    groupTopic: asOptString(v.groupTopic),
    groupAvatar: asOptString(v.groupAvatar),
    participants: Array.isArray(v.participants) ? readEach(v.participants.slice(0, 10) as unknown[], readChatParticipant) : undefined,
    profiles,
    lastCipherPayload: asOptString(v.lastCipherPayload),
    lastSenderId: asOptString(v.lastSenderId),
    lastMessageTime: asOptString(v.lastMessageTime),
    updatedAt: asOptString(v.updatedAt),
  };
}

// ─── Messages ────────────────────────────────────────────────────────────────

/** Milliseconds of a Firestore Timestamp (server time), or of a legacy ISO string; 0 when unknown */
export function timeMillis(v: unknown): number {
  if (isRecord(v) && typeof v.toMillis === 'function') {
    const ms = (v.toMillis as () => unknown)();
    return typeof ms === 'number' && Number.isFinite(ms) ? ms : 0;
  }
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}
