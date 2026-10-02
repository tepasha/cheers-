import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { pushSettingsUpdated } from '../store/slices/settingsSlice';
import { registerPush } from '../store/thunks/push';
import { getSystemNotificationPermission } from '../services/systemNotifications';
import { useTr } from './useT';

const ASK_DELAY_MS = 1500;

/**
 * Asks once, in the context where it makes sense (a conversation is open), whether to turn notifications on.
 * Skipped when the user already decided, or the system already holds an answer.
 */
export function usePushOptIn() {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const alreadyAsked = useAppSelector((s) => s.settings.push.promptShown === true || s.settings.push.webPushEnabled);

  useEffect(() => {
    if (alreadyAsked) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if ((await getSystemNotificationPermission()) !== 'undetermined' || cancelled) return;
      dispatch(pushSettingsUpdated({ promptShown: true }));
      Alert.alert(
        tr('Сповіщення про повідомлення'),
        tr('Дозволити «Будьмо!» повідомляти вас, коли вам напишуть, навіть коли застосунок закрито?'),
        [
          { text: tr('Не зараз'), style: 'cancel' },
          { text: tr('Увімкнути'), onPress: () => void dispatch(registerPush({ ask: true })) },
        ]
      );
    }, ASK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [alreadyAsked, dispatch, tr]);
}
