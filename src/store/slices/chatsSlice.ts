import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { personalDataReset } from '../actions';
import { BuddyProfile, ChatParticipant, ChatThread, Message } from '../../types';

interface ChatsState {
  threads: ChatThread[];
  /** Chats the user removed from their list. Messages stay in Firestore for the other members, so
   *  the inbox sync must not bring a hidden chat back until the user opens it again. */
  hiddenIds: string[];
}

const initialState: ChatsState = { threads: [], hiddenIds: [] };

/** Keeps the persisted store bounded: only the newest messages live on the device */
// The open chat only streams the newest 100 messages, so keeping more would just make every save slower
export const MAX_MESSAGES_PER_THREAD = 100;

const trim = (messages: Message[]) => {
  if (messages.length > MAX_MESSAGES_PER_THREAD) messages.splice(0, messages.length - MAX_MESSAGES_PER_THREAD);
};

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

const moveToFront = (threads: ChatThread[], id: string) => {
  const idx = threads.findIndex((t) => t.id === id);
  if (idx > 0) threads.unshift(...threads.splice(idx, 1));
};

const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
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

        existing.memberIds = thread.memberIds;
        if (thread.isGroup) {
          existing.groupName = thread.groupName;
          existing.groupTopic = thread.groupTopic;
          existing.groupAvatar = thread.groupAvatar;
          existing.participants = thread.participants;
        }

        if (!thread.updatedAt) return;
        // A thread never matched against the cloud before (fresh install, or it was created locally) has no
        // `updatedAt` yet. Its cloud preview then only counts as news if it differs from what this device already
        // holds; otherwise every already-read chat would light up as unread after each reinstall.
        const hasNews = existing.updatedAt ? thread.updatedAt !== existing.updatedAt : thread.lastMessage !== existing.lastMessage;
        existing.updatedAt = thread.updatedAt;
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
    messagesReceived(state, action: PayloadAction<{ chatId: string; messages: Message[] }>) {
      const { chatId, messages } = action.payload;
      const thread = state.threads.find((t) => t.id === chatId);
      if (!thread || messages.length === 0) return;

      const known = new Map(thread.messages.map((m) => [m.id, m]));
      let appended = false;

      messages.forEach((incoming) => {
        const existing = known.get(incoming.id);
        if (existing) {
          existing.cipherPayload = incoming.cipherPayload ?? existing.cipherPayload;
          existing.isFromCache = incoming.isFromCache;
          existing.hasPendingWrites = incoming.hasPendingWrites;
          return;
        }
        thread.messages.push(incoming);
        known.set(incoming.id, incoming);
        appended = true;
      });

      if (appended) {
        trim(thread.messages);
        applyProposalResponses(thread);
        const latest = thread.messages[thread.messages.length - 1];
        thread.lastMessage = latest.text;
        thread.lastMessageTime = latest.timestamp;
      }
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
    chatRead(state, action: PayloadAction<string>) {
      const thread = state.threads.find((t) => t.id === action.payload);
      if (thread) thread.unreadCount = 0;
    },
    /** Removes the chat from this device's list only; the conversation itself is not deleted for others */
    chatDeleted(state, action: PayloadAction<string>) {
      state.threads = state.threads.filter((t) => t.id !== action.payload);
      if (!state.hiddenIds.includes(action.payload)) state.hiddenIds.push(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(personalDataReset, () => initialState);
  },
});

export const {
  directChatEnsured,
  groupChatCreated,
  inboxSynced,
  messageAppended,
  messagesReceived,
  participantsAdded,
  chatRead,
  chatDeleted,
} = chatsSlice.actions;
export default chatsSlice.reducer;
