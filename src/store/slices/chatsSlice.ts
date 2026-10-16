import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { personalDataReset, identityRedacted } from '../actions';
import { BuddyProfile, ChatParticipant, ChatThread, Message } from '../../types';

interface ChatsState {
  threads: ChatThread[];
  /** Chats the user removed from their list. Messages stay in Firestore for the other members, so
   *  the inbox sync must not bring a hidden chat back until the user opens it again. */
  hiddenIds: string[];
}

const initialState: ChatsState = { threads: [], hiddenIds: [] };

/**
 * In memory a thread holds at most this many of its newest messages, older pages from "Show earlier" included. On disk
 * only the newest 100 are kept (store/chatsStorage.ts), so the saved copy stays small whatever was scrolled through.
 */
export const MAX_MESSAGES_PER_THREAD = 500;

const trim = (messages: Message[]) => {
  if (messages.length > MAX_MESSAGES_PER_THREAD) messages.splice(0, messages.length - MAX_MESSAGES_PER_THREAD);
};
const sortMessages = (messages: Message[]) => messages.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || (a.createdAt !== undefined && b.createdAt !== undefined ? a.id.localeCompare(b.id) : 0));

/**
 * Messages are immutable, so answering a proposal is its own message (`proposal_response`). Replaying the
 * responses onto their proposals gives both people the same status, whichever order things arrive in.
 * Only the other person's answer counts: nobody can accept their own proposal.
 */
function applyProposalResponses(thread: ChatThread) {
  const responses = thread.messages.filter((m) => m.type === 'proposal_response' && m.proposalId && m.proposalStatus);
  if (responses.length === 0) return;
  const byId = new Map(thread.messages.map((m) => [m.id, m]));
  responses.forEach((r) => {
    const proposal = byId.get(r.proposalId!);
    if (proposal?.type === 'location_proposal' && proposal.proposalData && proposal.senderId !== r.senderId) {
      proposal.proposalData.status = r.proposalStatus!;
    }
  });
}

const sameJson = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

const moveToFront = (threads: ChatThread[], id: string) => {
  const idx = threads.findIndex((t) => t.id === id);
  if (idx > 0) threads.unshift(...threads.splice(idx, 1));
};

const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    messageDeliveryChanged(state, action: PayloadAction<{ chatId: string; id: string; status: Message['deliveryStatus'] }>) {
      const message = state.threads.find((t) => t.id === action.payload.chatId)?.messages.find((m) => m.id === action.payload.id);
      if (message) message.deliveryStatus = action.payload.status;
    },
    /** Creates a 1:1 thread with the buddy unless one already exists; re-opening un-hides it */
    directChatEnsured(
      state,
      action: PayloadAction<{ chatId: string; memberIds: string[]; buddy: BuddyProfile; greeting?: Message; unreadCount?: number }>
    ) {
      const { chatId, memberIds, buddy, greeting, unreadCount = 0 } = action.payload;
      state.hiddenIds = state.hiddenIds.filter((id) => id !== chatId);
      if (state.threads.some((t) => t.id === chatId)) return;
      state.threads.unshift({
        id: chatId,
        memberIds,
        buddy,
        lastMessage: greeting?.text ?? '',
        lastMessageTime: greeting?.timestamp ?? '',
        unreadCount,
        messages: greeting ? [greeting] : [],
      });
    },
    groupChatCreated(state, action: PayloadAction<ChatThread>) {
      state.threads.unshift(action.payload);
    },
    /**
     * Chats from Firestore (started by someone else, or on another device). Unknown chats are added;
     * known ones get a fresh preview and, if the other side wrote and the chat is not open, an unread badge.
     */
    inboxSynced(
      state,
      action: PayloadAction<{
        myId: string;
        openChatId: string | null;
        chats: Array<{ thread: ChatThread; lastSenderId?: string }>;
      }>
    ) {
      const { myId, openChatId, chats } = action.payload;
      chats.forEach(({ thread, lastSenderId }) => {
        if (state.hiddenIds.includes(thread.id)) return;

        const existing = state.threads.find((t) => t.id === thread.id);
        if (!existing) {
          const fromOther = !!lastSenderId && lastSenderId !== myId && !!thread.lastMessage;
          state.threads.unshift({ ...thread, unreadCount: fromOther ? 1 : 0 });
          return;
        }

        // Every snapshot repeats all chats: only real changes are written, so an unchanged thread stays the same object
        // (no re-render of its row, nothing to save in store/chatsStorage.ts)
        if (!sameJson(existing.memberIds, thread.memberIds)) existing.memberIds = thread.memberIds;
        if (thread.isGroup) {
          if (existing.groupName !== thread.groupName) existing.groupName = thread.groupName;
          if (existing.groupTopic !== thread.groupTopic) existing.groupTopic = thread.groupTopic;
          if (existing.groupAvatar !== thread.groupAvatar) existing.groupAvatar = thread.groupAvatar;
          if (!sameJson(existing.participants, thread.participants)) existing.participants = thread.participants;
        }

        if (!thread.updatedAt) return;
        // A thread never matched against the cloud before (fresh install, or it was created locally) has no
        // `updatedAt` yet. Its cloud preview then only counts as news if it differs from what this device already
        // holds; otherwise every already-read chat would light up as unread after each reinstall.
        const hasNews = thread.lastMessageId ? thread.lastMessageId !== existing.lastMessageId : thread.updatedAt !== existing.updatedAt && thread.lastMessage !== existing.lastMessage;
        if (existing.updatedAt !== thread.updatedAt) existing.updatedAt = thread.updatedAt;
        if (existing.lastMessageId !== thread.lastMessageId) existing.lastMessageId = thread.lastMessageId;
        if (!hasNews) return;
        if (thread.lastMessage) {
          existing.lastMessage = thread.lastMessage;
          existing.lastMessageTime = thread.lastMessageTime;
        }
        if (lastSenderId && lastSenderId !== myId && thread.id !== openChatId) existing.unreadCount += 1;
        moveToFront(state.threads, thread.id);
      });
    },
    /** Appends a locally authored message (optimistic; Firestore echo is deduplicated by id) */
    messageAppended(state, action: PayloadAction<{ chatId: string; message: Message; summary: string }>) {
      const { chatId, message, summary } = action.payload;
      const thread = state.threads.find((t) => t.id === chatId);
      if (!thread || thread.messages.some((m) => m.id === message.id)) return;
      thread.messages.push(message);
      sortMessages(thread.messages);
      trim(thread.messages);
      applyProposalResponses(thread);
      thread.lastMessage = summary;
      thread.lastMessageTime = message.timestamp;
      moveToFront(state.threads, chatId);
    },
    /**
     * Merges a Firestore snapshot of the open chat: unknown messages are appended, known ones only
     * get their delivery flags refreshed so optimistic local messages are never duplicated.
     * Unread counts are driven by the inbox sync, not here (this stream only runs while the chat is open).
     */
    /**
     * Messages from the open chat's stream. `replacesOlder`: the stream started after a long absence and came back as a
     * full page, which may not reach back to what this device held; those older messages are dropped rather than shown
     * with a hole in between ("Show earlier" brings them back in order).
     */
    messagesReceived(state, action: PayloadAction<{ chatId: string; messages: Message[]; replacesOlder?: boolean }>) {
      const { chatId, messages, replacesOlder } = action.payload;
      const thread = state.threads.find((t) => t.id === chatId);
      if (!thread || messages.length === 0) return;

      if (replacesOlder) {
        const from = Math.min(...messages.map((m) => m.createdAt ?? Infinity));
        const kept = thread.messages.filter((m) => m.hasPendingWrites !== false || (m.createdAt ?? 0) >= from);
        if (Number.isFinite(from) && kept.length !== thread.messages.length) {
          thread.messages = kept;
          delete thread.historyComplete;
        }
      }

      const known = new Map(thread.messages.map((m) => [m.id, m]));
      let appended = false;

      messages.forEach((incoming) => {
        const existing = known.get(incoming.id);
        if (existing) {
          // Only real changes are written: a snapshot that repeats what is known leaves the thread (and its saved copy) as is
          const createdAt = incoming.createdAt ?? existing.createdAt;
          const cipherPayload = incoming.cipherPayload ?? existing.cipherPayload;
          if (existing.senderName !== incoming.senderName) existing.senderName = incoming.senderName;
          if (existing.senderAvatar !== incoming.senderAvatar) existing.senderAvatar = incoming.senderAvatar;
          if (existing.createdAt !== createdAt) existing.createdAt = createdAt;
          if (existing.cipherPayload !== cipherPayload) existing.cipherPayload = cipherPayload;
          if (existing.isFromCache !== incoming.isFromCache) existing.isFromCache = incoming.isFromCache;
          if (existing.hasPendingWrites !== incoming.hasPendingWrites) existing.hasPendingWrites = incoming.hasPendingWrites;
          return;
        }
        thread.messages.push(incoming);
        known.set(incoming.id, incoming);
        appended = true;
      });

      if (appended) {
        sortMessages(thread.messages);
        trim(thread.messages);
        applyProposalResponses(thread);
        const latest = thread.messages[thread.messages.length - 1];
        thread.lastMessage = latest.text;
        thread.lastMessageTime = latest.timestamp;
      }
      if (!appended) sortMessages(thread.messages);
    },
    /** A "Show earlier" page: messages before the oldest one held. `complete` when it reached the chat's first message. */
    olderMessagesLoaded(state, action: PayloadAction<{ chatId: string; messages: Message[]; complete: boolean }>) {
      const thread = state.threads.find((t) => t.id === action.payload.chatId);
      if (!thread) return;
      const known = new Set(thread.messages.map((m) => m.id));
      const added = action.payload.messages.filter((m) => !known.has(m.id));
      if (added.length > 0) {
        thread.messages.unshift(...added);
        sortMessages(thread.messages);
        applyProposalResponses(thread);
      }
      if (action.payload.complete && !thread.historyComplete) thread.historyComplete = true;
    },
    participantsAdded(
      state,
      action: PayloadAction<{ chatId: string; participants: ChatParticipant[]; notice: Message }>
    ) {
      const thread = state.threads.find((t) => t.id === action.payload.chatId);
      if (!thread) return;

      const existingIds = new Set((thread.participants ?? []).map((p) => p.id));
      const toAdd = action.payload.participants.filter((p) => !existingIds.has(p.id));
      if (toAdd.length === 0) return;

      thread.participants = [...(thread.participants ?? []), ...toAdd];
      thread.memberIds = Array.from(new Set([...(thread.memberIds ?? []), ...toAdd.map((p) => p.id)]));
      thread.messages.push(action.payload.notice);
      thread.lastMessage = action.payload.notice.text;
      thread.lastMessageTime = action.payload.notice.timestamp;
    },
    /** Dispatched with every snapshot of the open chat: changes the thread only when there was something unread */
    chatRead(state, action: PayloadAction<string>) {
      const thread = state.threads.find((t) => t.id === action.payload);
      if (!thread) return;
      if (thread.unreadCount !== 0) thread.unreadCount = 0;
      if (thread.lastReadMessageId !== thread.lastMessageId) thread.lastReadMessageId = thread.lastMessageId;
    },
    /** Removes the chat from this device's list only; the conversation itself is not deleted for others */
    chatDeleted(state, action: PayloadAction<string>) {
      state.threads = state.threads.filter((t) => t.id !== action.payload);
      if (!state.hiddenIds.includes(action.payload)) state.hiddenIds.push(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(personalDataReset, () => initialState);
    // Repeated by every inbox snapshot: only what still names the person is touched, so a repeat leaves the state (and
    // the persisted, encrypted chats) as they are
    builder.addCase(identityRedacted, (state, { payload: uid }) => {
      state.threads.forEach((thread) => {
        const { buddy } = thread;
        if (buddy.id === uid && (buddy.name || buddy.avatar || buddy.bio || buddy.tagline)) { buddy.name = ''; buddy.avatar = ''; buddy.bio = ''; buddy.tagline = ''; }
        if (thread.participants?.some((p) => p.id === uid)) thread.participants = thread.participants.filter((p) => p.id !== uid);
        thread.messages.forEach((m) => { if (m.senderId === uid && (m.senderName || m.senderAvatar)) { m.senderName = ''; m.senderAvatar = undefined; } });
      });
    });
  },
});

export const {
  messageDeliveryChanged,
  directChatEnsured,
  groupChatCreated,
  inboxSynced,
  messageAppended,
  messagesReceived,
  olderMessagesLoaded,
  participantsAdded,
  chatRead,
  chatDeleted,
} = chatsSlice.actions;
export default chatsSlice.reducer;
