import { useMemo } from 'react';
import { useTr } from './useT';
import { useNavigation } from '@react-navigation/native';
import { BuddyProfile } from '../types';
import { useAppDispatch } from '../store/hooks';
import { matchWithBuddy, openDirectChat, toggleFriend } from '../store/thunks/social';
import { recordCheckIn } from '../store/thunks/gamification';
import type { BuddyActions } from '../components/BuddyViews';

/** Shared buddy interactions (open chat, friend toggle, "Будьмо!" toast) for every list of people */
export function useBuddyActions(handlers: Pick<BuddyActions, 'onReport' | 'onDetails'> & { onMatched?: (buddy: BuddyProfile, chatId: string) => void }): BuddyActions {
  const dispatch = useAppDispatch();
  const tr = useTr();
  const navigation = useNavigation();
  const { onReport, onDetails, onMatched } = handlers;

  return useMemo(
    () => ({
      onOpenChat: (buddy) => {
        const chatId = dispatch(openDirectChat(buddy));
        navigation.navigate('ChatRoom', { chatId });
      },
      onToggleFriend: (buddy) => {
        dispatch(toggleFriend(buddy));
      },
      onToast: (buddy) => {
        // A toast earns XP and opens (or creates) the conversation
        dispatch(
          recordCheckIn({
            barName: buddy.activeCheckIn?.barName || buddy.favoriteBars[0] || tr('Барний тост'),
            area: buddy.locationName,
            buddyName: buddy.name,
            note: tr('Тост келихами та знайомство з {name}! 🍻', { name: buddy.name }),
            type: 'cheers_toast',
          })
        );
        const chatId = dispatch(matchWithBuddy(buddy));
        onMatched?.(buddy, chatId);
      },
      onReport,
      onDetails,
    }),
    [dispatch, navigation, tr, onReport, onDetails, onMatched]
  );
}
