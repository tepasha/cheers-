import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from 'react-redux';
import type { RootState } from '../store';
import { captureSession } from '../store/sessionGuard';
import { selectCanUseApp } from '../store/selectors';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { chatRead, messagesReceived } from '../store/slices/chatsSlice';
import { firestoreSyncService } from '../services/firestoreSyncService';

/** Streams and decrypts the open chat's messages from Firestore into the store */
export function useChatSync(chatId: string | undefined) {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const userId = useAppSelector((s) => s.auth.user.id);
  const generation = useAppSelector((s) => s.ui.sessionGeneration);
  const allowed = useAppSelector((s) => {
    const chat = s.chats.threads.find((t) => t.id === chatId);
    return selectCanUseApp(s) && !!chat?.updatedAt && !s.chats.hiddenIds.includes(chatId ?? '') &&
      (chat.isGroup || !s.safety.blockedUsers.some((b) => b.userId === chat.buddy.id));
  });

  useFocusEffect(useCallback(() => {
    if (!chatId || !allowed) return;
    let cancelled = false;
    const current = captureSession(store.getState);
    dispatch(chatRead(chatId));

    const stop = firestoreSyncService.subscribeToEncryptedChat(chatId, userId, (messages) => {
      if (cancelled || !current() || store.getState().ui.sessionGeneration !== generation) return;
      dispatch(messagesReceived({ chatId, messages }));
      // The user is looking at the thread, so anything that just arrived is already read
      dispatch(chatRead(chatId));
    });
    return () => { cancelled = true; stop(); };
  }, [dispatch, store, chatId, userId, allowed, generation]));
}
