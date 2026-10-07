import type { AppThunk } from '../hooks';
import { inboxSynced } from '../slices/chatsSlice';
import { CloudChat, otherMemberId, placeholderBuddy, threadFromCloudChat } from '../../logic/chats';
import { cryptoService } from '../../services/cryptoService';
import { asString } from '../../logic/cloudData';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { BuddyProfile } from '../../types';
import { notifyChatMessage } from './notifications';
import { captureSession } from '../sessionGuard';
import { inboxSyncStarted, inboxReady } from '../slices/uiSlice';
import { identityRedacted } from '../actions';

/**
 * Turns the Firestore chat list into local threads. The ciphertext preview is decrypted here, and the
 * other person's profile is looked up only for chats this device has not seen yet.
 */
export const syncChatInbox =
  (cloudChats: CloudChat[]): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const myId = getState().auth.user.id;
    const current = captureSession(getState);
    dispatch(inboxSyncStarted());
    const generation = getState().ui.inboxGeneration;

    // One chat that cannot be read is left out of this round; it never stops the others from syncing
    const settled = await Promise.allSettled(
      cloudChats.map(async (chat) => {
        const known = getState().chats.threads.some((t) => t.id === chat.id);
        const lastText = chat.lastCipherPayload ? await cryptoService.decryptMessage(chat.lastCipherPayload, chat.id) : '';

        let other: BuddyProfile | null = null;
        if (!chat.isGroup && !known) {
          const otherId = otherMemberId(chat.members, myId);
          const live = getState().buddies.items.find((b) => b.id === otherId);
          if (live) other = live;
          else if (otherId) {
            const p = await firestoreSyncService.getUserProfile(otherId);
            const name = asString(p?.name);
            if (name) other = { ...placeholderBuddy(otherId, name, asString(p?.avatar)), tagline: asString(p?.tagline), locationName: asString(p?.locationName) };
          }
        }

        return { thread: threadFromCloudChat(chat, myId, { other, lastText }), lastSenderId: chat.lastSenderId };
      })
    );
    const chats = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (!current() || generation !== getState().ui.inboxGeneration) return;
    settled.forEach((r) => r.status === 'rejected' && console.warn('[inbox] chat skipped:', r.reason));

    // Decide what counts as news against the state from BEFORE the reducer merges this snapshot
    const openChatId = getState().ui.openChatId;
    const blocked = new Set(getState().safety.blockedUsers.map((u) => u.userId));
    const { threads, hiddenIds } = getState().chats;
    const incoming = chats.filter(({ thread, lastSenderId }) => {
      const existing = threads.find((t) => t.id === thread.id);
      // Only chats this device already matched against the cloud: the first snapshot after a launch is not news
      if (!existing?.updatedAt || !thread.updatedAt) return false;
      if (thread.lastMessageId ? existing.lastMessageId === thread.lastMessageId : existing.updatedAt === thread.updatedAt || existing.lastMessage === thread.lastMessage) return false;
      return (
        !!thread.lastMessage &&
        !!lastSenderId &&
        lastSenderId !== myId &&
        !blocked.has(lastSenderId) &&
        thread.id !== openChatId &&
        !hiddenIds.includes(thread.id)
      );
    });

    dispatch(inboxSynced({ myId, openChatId, chats }));
    new Set(cloudChats.flatMap((chat) => chat.anonymizedMembers ?? [])).forEach((uid) => dispatch(identityRedacted(uid)));
    dispatch(inboxReady());

    // In the foreground the OS shows nothing; this banner is the notification (the server push covers the background)
    incoming.forEach(({ thread, lastSenderId }) => {
      // The cloud thread only carries a placeholder for the other person; what this device already knows is better
      const known = threads.find((t) => t.id === thread.id);
      const sender = thread.isGroup
        ? [...(thread.participants ?? []), ...(known?.participants ?? [])].find((p) => p.id === lastSenderId)
        : known?.buddy;
      dispatch(
        notifyChatMessage({
          buddyName: sender?.name || thread.groupName || '',
          messageText: thread.lastMessage,
          buddyAvatar: sender?.avatar,
          chatId: thread.id,
          buddyId: lastSenderId,
        })
      );
    });
  };
