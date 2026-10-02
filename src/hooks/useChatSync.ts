import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { chatRead, messagesReceived } from '../store/slices/chatsSlice';
import { firestoreSyncService } from '../services/firestoreSyncService';

/** Streams and decrypts the open chat's messages from Firestore into the store */
export function useChatSync(chatId: string | undefined) {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user.id);

  useEffect(() => {
    if (!chatId) return;
    dispatch(chatRead(chatId));

    return firestoreSyncService.subscribeToEncryptedChat(chatId, userId, (messages) => {
      dispatch(messagesReceived({ chatId, messages }));
      // The user is looking at the thread, so anything that just arrived is already read
      dispatch(chatRead(chatId));
    });
  }, [dispatch, chatId, userId]);
}
