import { hangoutExpiresAt } from '../../logic/lifecycle';
import { BuddyProfile, ChatParticipant, ChatThread, HangoutAlert, Message } from '../../types';
import type { AppThunk } from '../hooks';
import {
  chatDeleted,
  directChatEnsured,
  groupChatCreated,
  messageAppended,
  messagesReceived,
  participantsAdded,
} from '../slices/chatsSlice';
import { friendAdded, friendRemoved } from '../slices/friendsSlice';
import { hangoutClosed, hangoutJoined, hangoutPublished } from '../slices/hangoutsSlice';
import { addBonusXp, recordCheckIn } from './gamification';
import { pushNotification } from './notifications';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { analyticsService } from '../../services/analyticsService';
import { sounds } from '../../services/soundService';
import { formatClock } from '../../utils/time';
import { MAX_GROUP_MEMBERS, dmChatId, dmMembers, groupChatId } from '../../logic/chats';
import { trFor } from './lang';

// ─── Chats ──────────────────────────────────────────────────────────────────

export interface SendMessageParams {
  chatId: string;
  text: string;
  type?: Message['type'];
  proposalData?: Message['proposalData'];
  /** Overrides the generated id (a proposal answer uses `resp_<proposalId>`, so each proposal can be answered once) */
  id?: string;
  proposalId?: string;
  proposalStatus?: 'accepted' | 'declined';
  audioData?: { audioUrl: string; audioDuration?: number };
}

/** Appends the message locally right away, then encrypts and syncs it to Firestore */
export const sendMessage =
  (params: SendMessageParams): AppThunk =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const user = getState().auth.user;
    const { chatId, text, type = 'text', proposalData, audioData, proposalId, proposalStatus } = params;

    const message: Message = {
      id: params.id ?? `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      chatId,
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.avatar,
      text,
      timestamp: formatClock(),
      isMe: true,
      type,
      audioUrl: audioData?.audioUrl,
      audioDuration: audioData?.audioDuration,
      proposalData,
      proposalId,
      proposalStatus,
      isEncrypted: true,
    };

    const summary = type === 'cheers' ? tr('Тост: {text}', { text }) : type === 'audio' ? tr('🎙️ Голосове повідомлення') : text;
    dispatch(messageAppended({ chatId, message, summary }));
    sounds.playMessageSent();

    const thread = getState().chats.threads.find((t) => t.id === chatId);
    if (!thread) return;

    firestoreSyncService
      .sendEncryptedMessage(thread, message, { id: user.id, name: user.name, avatar: user.avatar })
      .then((res) => {
        if (res.cipherPayload) {
          // Same id, so the reducer only attaches the ciphertext for the security inspector
          dispatch(messagesReceived({ chatId, messages: [{ ...message, cipherPayload: res.cipherPayload }] }));
        }
      })
      .catch((err) => console.warn('Firestore encrypted sync notice:', err));
  };

/** Opens (creating locally if needed) the 1:1 chat with a buddy. Nothing is written to Firestore until a message is sent. */
/**
 * Accepts or declines a proposal from the other person. The answer is a message of its own (messages are
 * immutable), with a deterministic id, so a proposal can be answered exactly once, even from two devices.
 */
export const respondToProposal =
  (chatId: string, proposalId: string, status: 'accepted' | 'declined'): AppThunk =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const thread = getState().chats.threads.find((t) => t.id === chatId);
    const proposal = thread?.messages.find((m) => m.id === proposalId);
    if (!thread || proposal?.type !== 'location_proposal' || !proposal.proposalData) return;
    if (proposal.senderId === getState().auth.user.id) return; // you cannot answer your own proposal
    if (proposal.proposalData.status !== 'pending') return; // already answered

    const { barName, address } = proposal.proposalData;
    dispatch(
      sendMessage({
        chatId,
        id: `resp_${proposalId}`,
        type: 'proposal_response',
        proposalId,
        proposalStatus: status,
        text: status === 'accepted' ? tr('Домовились! Зустрічаємось у {barName} 🥂', { barName }) : tr('Цього разу не вийде 🙏'),
      })
    );
    if (status === 'accepted') {
      dispatch(recordCheckIn({ barName, area: address, buddyName: thread.buddy.name, type: 'meetup_proposal' }));
    }
  };

export const openDirectChat =
  (buddy: BuddyProfile): AppThunk<string> =>
  (dispatch, getState) => {
    const myId = getState().auth.user.id;
    const chatId = dmChatId(myId, buddy.id);
    dispatch(directChatEnsured({ chatId, memberIds: dmMembers(myId, buddy.id), buddy }));
    analyticsService.trackEvent('chat_opened', { buddy_id: buddy.id, buddy_name: buddy.name });
    sounds.playClink();
    return chatId;
  };

export const matchWithBuddy =
  (buddy: BuddyProfile): AppThunk<string> =>
  (dispatch) => {
    analyticsService.trackEvent('buddy_matched', { buddy_id: buddy.id, buddy_name: buddy.name, mood: buddy.currentMood });
    return dispatch(openDirectChat(buddy));
  };

export const createGroupChat =
  (params: { name: string; topic: string; avatar: string; participants: ChatParticipant[] }): AppThunk<ChatThread> =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const user = getState().auth.user;
    const now = new Date();
    const chatId = groupChatId(user.id, now.getTime());
    const participants = params.participants.slice(0, MAX_GROUP_MEMBERS - 1); // the creator takes one seat
    const time = formatClock(now);

    const intro: Message = {
      id: `msg-group-init-${now.getTime()}`,
      chatId,
      senderId: user.id || 'me',
      senderName: user.name || tr('Ви'),
      senderAvatar: user.avatar,
      text: tr('🎉 Створено новий груповий чат: «{name}»! Давайте оберемо заклад та піднімемо келихи 🍻', { name: params.name }),
      timestamp: time,
      isMe: true,
      type: 'cheers',
    };

    // `buddy` is required by ChatThread for 1:1 rendering; groups reuse it as the header identity
    const headerIdentity: BuddyProfile = {
      id: user.id || 'group-creator',
      name: params.name,
      avatar: params.avatar,
      age: 0,
      distanceKm: 0,
      locationName: '',
      tagline: tr('Груповий чат • {count} учасників', { count: participants.length }),
      bio: params.topic,
      coordinates: { lat: 0, lng: 0 },
      preferredDrinks: [],
      paymentRule: 'split_50_50',
      currentMood: 'chill_talk',
      favoriteBars: [],
      talkTopics: [params.topic],
      online: true,
    };

    const thread: ChatThread = {
      id: chatId,
      isGroup: true,
      groupName: params.name,
      groupTopic: params.topic,
      groupAvatar: params.avatar,
      buddy: headerIdentity,
      participants,
      lastMessage: intro.text,
      lastMessageTime: time,
      unreadCount: 0,
      createdAt: now.toISOString(),
      createdBy: user.id,
      memberIds: [user.id, ...participants.map((p) => p.id)],
      messages: [intro],
    };

    dispatch(groupChatCreated(thread));
    sounds.playMatchCheer();
    firestoreSyncService
      .sendEncryptedMessage(thread, intro, { id: user.id, name: user.name, avatar: user.avatar })
      .catch((err) => console.warn('Firestore group initial message sync notice:', err));
    return thread;
  };

export const addGroupParticipants =
  (chatId: string, requested: ChatParticipant[]): AppThunk =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const thread = getState().chats.threads.find((t) => t.id === chatId);
    // Only the group's creator may change membership (enforced by firestore.rules too)
    if (!thread || thread.createdBy !== getState().auth.user.id) return;
    const room = Math.max(0, MAX_GROUP_MEMBERS - (thread.memberIds?.length ?? 1));
    const participants = requested.slice(0, room);
    if (participants.length === 0) return;

    const names = participants.map((p) => p.name).join(', ');
    dispatch(
      participantsAdded({
        chatId,
        participants,
        notice: {
          id: `msg-sys-${Date.now()}`,
          chatId,
          senderId: 'system',
          senderName: tr('Будьмо Бот 🤖'),
          text: tr('👋 До чату приєдналися: {names}! Вітаємо в компанії 🍻', { names }),
          timestamp: formatClock(),
          isMe: false,
        },
      })
    );
    void firestoreSyncService.addGroupMembers(chatId, participants);
  };

/** Removes the chat from this device. The conversation stays for the other members (clients cannot delete chats). */
export const deleteChat =
  (chatId: string): AppThunk =>
  (dispatch) => {
    sounds.playTap();
    dispatch(chatDeleted(chatId));
  };

// ─── Friends ────────────────────────────────────────────────────────────────

export const addFriend =
  (buddy: BuddyProfile): AppThunk =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const state = getState();
    if (state.friends.ids.includes(buddy.id)) return;

    const userId = state.auth.user.id;
    dispatch(friendAdded(buddy));
    sounds.playClink();
    dispatch(addBonusXp(50, tr('🤝 Новий друг «{name}»! (+50 XP)', { name: buddy.name })));
    dispatch(
      pushNotification({
        type: 'friend_added',
        title: tr('🤝 {name} тепер у друзях!', { name: buddy.name }),
        body: tr('Ви додали {name} до друзів.', { name: buddy.name }),
        subtitle: tr('Тепер ви бачите їхню активність та статус у барах! (+50 XP)'),
        buddyName: buddy.name,
        buddyId: buddy.id,
        avatar: buddy.avatar,
        actionText: tr('Написати'),
      })
    );

    void firestoreSyncService.syncFriend(userId, {
      friendId: buddy.id,
      friendName: buddy.name,
      friendAvatar: buddy.avatar,
      tagline: buddy.tagline,
      locationName: buddy.locationName,
      drinkPreference: buddy.preferredDrinks.join(', '),
    });
  };

export const removeFriend =
  (buddyId: string): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    if (!state.friends.ids.includes(buddyId)) return;

    dispatch(friendRemoved(buddyId));
    sounds.playTap();
    void firestoreSyncService.removeFriendFromFirestore(state.auth.user.id, buddyId);
  };

export const toggleFriend =
  (buddy: BuddyProfile): AppThunk<boolean> =>
  (dispatch, getState) => {
    if (getState().friends.ids.includes(buddy.id)) {
      dispatch(removeFriend(buddy.id));
      return false;
    }
    dispatch(addFriend(buddy));
    return true;
  };

// ─── Hangouts (live bar check-ins) ──────────────────────────────────────────

export const publishHangout =
  (posted: HangoutAlert): AppThunk<Promise<void>> =>
  async (dispatch) => {
    const hangout = { ...posted, expiresAt: posted.expiresAt ?? hangoutExpiresAt(Date.now()) };
    analyticsService.trackMeetupAction('create', hangout.id, {
      bar_name: hangout.barName,
      created_at: hangout.createdAt,
      description: hangout.description,
    });
    // Optimistic: show immediately, Firestore snapshot reconciles
    dispatch(hangoutPublished(hangout));
    try {
      await firestoreSyncService.publishHangout(hangout);
    } catch (err) {
      console.warn('Firestore publish notice:', err);
    }
  };

export const joinHangout =
  (hangoutId: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const tr = trFor(getState);
    const state = getState();
    const target = state.hangouts.items.find((h) => h.id === hangoutId);
    const userId = state.auth.user.id;

    analyticsService.trackMeetupAction('join', hangoutId, { bar_name: target?.barName });
    dispatch(hangoutJoined({ hangoutId, userId }));
    dispatch(
      pushNotification({
        type: 'hangout_alert',
        title: tr('🍻 Ви приєдналися до столика'),
        body: target ? `${target.barName} • ${target.userName}` : tr('Столик у барі'),
        hangoutId,
        venueName: target?.barName,
        avatar: target?.userAvatar,
        actionText: tr('Переглянути столик'),
      })
    );

    try {
      await firestoreSyncService.joinLiveHangout(hangoutId, userId);
    } catch (err) {
      console.warn('Firestore join notice:', err);
    }
  };

export const closeHangout =
  (hangoutId: string): AppThunk<Promise<void>> =>
  async (dispatch) => {
    dispatch(hangoutClosed(hangoutId));
    try {
      await firestoreSyncService.closeLiveHangout(hangoutId);
    } catch (err) {
      console.warn('Firestore close hangout notice:', err);
    }
  };
