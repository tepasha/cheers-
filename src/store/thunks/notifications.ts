import { PushNotificationItem } from '../../types';
import type { AppThunk } from '../hooks';
import { notificationReceived } from '../slices/notificationsSlice';
import { bannerDismissed, bannerShown } from '../slices/uiSlice';
import { sounds } from '../../services/soundService';
import { trFor } from './lang';

export type NewNotification = Omit<PushNotificationItem, 'id' | 'createdAt' | 'timestamp' | 'isRead'>;

const BANNER_VISIBLE_MS = 6000;
let bannerTimer: ReturnType<typeof setTimeout> | null = null;

export const dismissBanner = (): AppThunk => (dispatch) => {
  if (bannerTimer) {
    clearTimeout(bannerTimer);
    bannerTimer = null;
  }
  dispatch(bannerDismissed());
};

/** Central dispatcher: stores the notification, shows the heads-up banner and vibrates. System-tray pushes come from the server. */
export const pushNotification =
  (item: NewNotification): AppThunk<PushNotificationItem> =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const { push } = getState().settings;
    const created: PushNotificationItem = {
      ...item,
      id: `push-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
      timestamp: tr('Щойно'),
      isRead: false,
    };

    dispatch(notificationReceived(created));

    if (push.soundEnabled || push.vibrateEnabled) sounds.playPushNotification();

    if (push.bannerEnabled) {
      if (bannerTimer) clearTimeout(bannerTimer);
      dispatch(bannerShown(created));
      bannerTimer = setTimeout(() => dispatch(dismissBanner()), BANNER_VISIBLE_MS);
    }

    return created;
  };

export const notifyTableSeat =
  (params: { venueName: string; guestName: string; guestAvatar?: string; hangoutId?: string }): AppThunk =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    dispatch(
      pushNotification({
        type: 'table_seat',
        title: tr('{venueName} • Новий гість за столиком 🍻', { venueName: params.venueName }),
        body: tr('Хтось присів за ваш столик у {venueName}', { venueName: params.venueName }),
        subtitle: tr('{guestName} приєднався до вашої компанії!', { guestName: params.guestName }),
        avatar: params.guestAvatar,
        venueName: params.venueName,
        hangoutId: params.hangoutId,
        buddyName: params.guestName,
        actionText: tr('Переглянути столик'),
      })
    );
  };

export const notifyChatMessage =
  (params: { buddyName: string; messageText: string; buddyAvatar?: string; chatId?: string; buddyId?: string }): AppThunk =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    dispatch(
      pushNotification({
        type: 'chat_message',
        title: tr('Нове повідомлення від супутника 💬'),
        body: `«${params.messageText}»`,
        subtitle: tr('{buddyName} пише у чат', { buddyName: params.buddyName }),
        avatar: params.buddyAvatar,
        chatId: params.chatId,
        buddyId: params.buddyId,
        buddyName: params.buddyName,
        actionText: tr('Відповісти'),
      })
    );
  };
