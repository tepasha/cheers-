import { createNavigationContainerRef } from '@react-navigation/native';
import type { PushNotificationItem } from '../types';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Deep-links from a notification (banner tap or notification center) to the relevant screen */
export function navigateFromNotification(n: PushNotificationItem): void {
  if (!navigationRef.isReady()) return;

  if (n.chatId) {
    navigationRef.navigate('ChatRoom', { chatId: n.chatId });
  } else if (n.hangoutId || n.venueName) {
    navigationRef.navigate('Tabs', { screen: 'Hangouts' });
  } else if (n.buddyId) {
    navigationRef.navigate('Tabs', { screen: 'Friends' });
  }
}
