import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { chatIdFromPushData } from '../logic/push';

export type SystemNotificationPermission = 'granted' | 'denied' | 'undetermined';

export type PushRegistration =
  | { status: 'registered'; token: string; platform: 'ios' | 'android' }
  /** The user (or the OS) refused notifications */
  | { status: 'denied' }
  /** No push on this build or device: simulator, web, or the app has no EAS project id yet */
  | { status: 'unavailable' };

/** Must match `channelId` in functions/src/push.ts */
const ANDROID_CHANNEL = 'messages';

let configured = false;

/**
 * While the app is open the in-app banner (driven by the Firestore stream) is the notification, so the OS shows
 * nothing in the foreground. Pushes that arrive while the app is in the background are shown by the OS itself.
 */
export function configureNotifications(): void {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function getSystemNotificationPermission(): Promise<SystemNotificationPermission> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return 'denied';
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#f59e0b',
  });
}

/**
 * Gets this phone's Expo push token. With `ask` the system permission dialog may be shown; without it, only an
 * already granted permission is used (background re-registration must never pop a dialog).
 */
export async function registerForPush(ask: boolean): Promise<PushRegistration> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return { status: 'unavailable' };
  try {
    configureNotifications();
    await ensureAndroidChannel();

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return { status: 'denied' };

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return { status: 'unavailable' };

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'registered', token: data, platform: Platform.OS };
  } catch (err) {
    // Simulators and builds without push credentials end up here
    console.warn('Push registration failed:', err);
    return { status: 'unavailable' };
  }
}

/** Called when the OS rotates the device push token; the caller registers again */
export function onPushTokenChanged(callback: () => void): () => void {
  const sub = Notifications.addPushTokenListener(() => callback());
  return () => sub.remove();
}

/**
 * Taps on a chat notification, both while the app runs and the one that launched it from a closed state.
 * Each notification is reported once, whichever of the two paths sees it first.
 */
export function subscribeToNotificationTaps(onChat: (chatId: string) => void): () => void {
  const handled = new Set<string>();
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handled.has(id)) return;
    const chatId = chatIdFromPushData(response.notification.request.content.data);
    if (!chatId) return;
    handled.add(id);
    onChat(chatId);
  };

  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  Notifications.getLastNotificationResponseAsync()
    .then(handle)
    .catch(() => {});
  return () => sub.remove();
}
