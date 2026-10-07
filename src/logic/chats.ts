import { BuddyProfile, ChatParticipant, ChatThread } from '../types';
import { ph } from '../services/i18nService';

/** Direct chats have one id for both people, so a message sent by A lands in the room B reads */
export const dmChatId = (a: string, b: string) => `dm_${[a, b].sort().join('_')}`;

/**
 * Members of a direct chat, always sorted. Both people must send the SAME list: firestore.rules treat a
 * differently ordered `members` array as a change of membership and refuse the write, which used to silently
 * drop every message from whoever wrote second.
 */
export const dmMembers = (a: string, b: string): string[] => [a, b].sort();

/** Eight recipient block checks plus ban and preview checks fit Firestore's ten-read rule budget. */
export const MAX_GROUP_MEMBERS = 9;

export const groupChatId = (creatorId: string, now = Date.now()) => `grp_${creatorId}_${now}`;

/** Shape of a `chats/{chatId}` document. Message bodies are not here, only membership and preview. */
export interface CloudChat {
  id: string;
  members: string[];
  isGroup: boolean;
  createdBy?: string;
  groupName?: string;
  groupTopic?: string;
  groupAvatar?: string;
  participants?: ChatParticipant[];
  profiles?: Record<string, { name?: string; avatar?: string }>;
  lastCipherPayload?: string;
  lastSenderId?: string;
  lastMessageTime?: string;
  updatedAt?: string;
  lastMessageId?: string;
  anonymizedMembers?: string[];
}

export const otherMemberId = (members: string[], myId: string): string | undefined => members.find((m) => m !== myId);

/** Minimal profile for someone we only know from a chat document (not currently on the map) */
export function placeholderBuddy(id: string, name = ph('Користувач'), avatar = ''): BuddyProfile {
  return {
    id,
    name,
    avatar,
    age: 0,
    tagline: '',
    bio: '',
    locationName: '',
    distanceKm: 0,
    coordinates: { lat: 0, lng: 0 },
    preferredDrinks: [],
    paymentRule: 'not_specified',
    currentMood: 'chill_talk',
    favoriteBars: [],
    talkTopics: [],
    online: false,
  };
}

/** Builds the local thread for a chat someone else started with us (or one from another device) */
export function threadFromCloudChat(
  chat: CloudChat,
  myId: string,
  options: { other?: BuddyProfile | null; lastText?: string } = {}
): ChatThread {
  const base = {
    id: chat.id,
    memberIds: chat.members,
    lastMessage: options.lastText ?? '',
    lastMessageTime: chat.lastMessageTime ?? '',
    updatedAt: chat.updatedAt,
    lastMessageId: chat.lastMessageId,
    unreadCount: 0,
    messages: [],
    createdBy: chat.createdBy,
  };

  if (chat.isGroup) {
    const others = (chat.participants ?? []).filter((p) => p.id !== myId);
    return {
      ...base,
      isGroup: true,
      groupName: chat.groupName ?? ph('Група'),
      groupTopic: chat.groupTopic,
      groupAvatar: chat.groupAvatar,
      participants: others,
      buddy: placeholderBuddy(chat.createdBy ?? chat.id, chat.groupName ?? ph('Група'), ''),
    };
  }

  const otherId = otherMemberId(chat.members, myId) ?? chat.id;
  const profile = chat.profiles?.[otherId];
  return { ...base, buddy: options.other ?? placeholderBuddy(otherId, profile?.name, profile?.avatar) };
}
