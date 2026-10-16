import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from 'react-redux';
import type { RootState } from '../store';
import { captureSession } from '../store/sessionGuard';
import { selectCanUseApp } from '../store/selectors';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { chatRead, messagesReceived } from '../store/slices/chatsSlice';
import { firestoreSyncService } from '../services/firestoreSyncService';
import { useAppInForeground } from './useAppInForeground';
import { newestConfirmedAt } from '../logic/chats';

/**
 * Streams and decrypts the open chat's messages from Firestore into the store. Only while the chat is on screen: not
 * under another screen and not with the app in the background (pushes cover that, and nothing gets marked read unseen).
 */
export function useChatSync(chatId: string | undefined) {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const userId = useAppSelector((s) => s.auth.user.id);
  const generation = useAppSelector((s) => s.ui.sessionGeneration);
  const foreground = useAppInForeground();
  const allowed = useAppSelector((s) => {
    const chat = s.chats.threads.find((t) => t.id === chatId);
    return selectCanUseApp(s) && !!chat?.updatedAt && !s.chats.hiddenIds.includes(chatId ?? '') &&
      (chat.isGroup || !s.safety.blockedUsers.some((b) => b.userId === chat.buddy.id));
  });

  useFocusEffect(useCallback(() => {
    if (!chatId || !allowed || !foreground) return;
    let cancelled = false;
    const current = captureSession(store.getState);
    dispatch(chatRead(chatId));

    // Taken once per subscription (not a dependency): what this device already holds is not downloaded again
    const since = newestConfirmedAt(store.getState().chats.threads.find((t) => t.id === chatId)?.messages);
    const stop = firestoreSyncService.subscribeToEncryptedChat(chatId, userId, (messages, replacesOlder) => {
      if (cancelled || !current() || store.getState().ui.sessionGeneration !== generation) return;
      dispatch(messagesReceived({ chatId, messages, replacesOlder }));
      // The user is looking at the thread, so anything that just arrived is already read
      dispatch(chatRead(chatId));
    }, since);
    return () => { cancelled = true; stop(); };
  }, [dispatch, store, chatId, userId, allowed, foreground, generation]));
}
