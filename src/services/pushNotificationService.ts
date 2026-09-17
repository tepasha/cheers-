import { PushNotificationItem, PushNotificationSettings } from '../types';
import { sounds } from './soundService';

const STORAGE_KEY_NOTIFS = 'budmo_push_notifications_v1';
const STORAGE_KEY_SETTINGS = 'budmo_push_settings_v1';

const DEFAULT_SETTINGS: PushNotificationSettings = {
  soundEnabled: true,
  bannerEnabled: true,
  webPushEnabled: false,
  vibrateEnabled: true,
};

type NotificationListener = (
  notifications: PushNotificationItem[],
  activeBanner: PushNotificationItem | null
) => void;

class PushNotificationService {
  private notifications: PushNotificationItem[] = [];
  private activeBanner: PushNotificationItem | null = null;
  private settings: PushNotificationSettings = DEFAULT_SETTINGS;
  private listeners: Set<NotificationListener> = new Set();
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadState();
  }

  private loadState() {
    if (typeof window === 'undefined') return;

    try {
      const storedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (storedSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };
      }

      const storedNotifs = localStorage.getItem(STORAGE_KEY_NOTIFS);
      if (storedNotifs) {
        this.notifications = JSON.parse(storedNotifs);
      } else {
        // Seed initial notifications showcasing both requested examples
        this.notifications = [
          {
            id: 'init-push-1',
            type: 'table_seat',
            title: 'Squat 17b • Новий гість за столиком 🍻',
            body: 'Хтось присів за ваш столик у Squat 17b',
            subtitle: 'Богдан приєднався до вашої компанії у дворику!',
            timestamp: '5 хв тому',
            createdAt: Date.now() - 5 * 60 * 1000,
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
            venueName: 'Squat 17b',
            hangoutId: 'hangout-squat-1',
            buddyName: 'Богдан',
            isRead: false,
            actionText: 'Переглянути столик',
          },
          {
            id: 'init-push-2',
            type: 'chat_message',
            title: 'Нове повідомлення від супутника 💬',
            body: 'Оксана: «Я вже замовила сидр біля барної стійки! Ти де?»',
            subtitle: 'Оксана чекає біля бару',
            timestamp: '15 хв тому',
            createdAt: Date.now() - 15 * 60 * 1000,
            avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
            chatId: 'chat-2',
            buddyId: '2',
            buddyName: 'Оксана',
            isRead: false,
            actionText: 'Відповісти в чаті',
          },
        ];
        this.persistNotifications();
      }
    } catch {
      this.notifications = [];
      this.settings = DEFAULT_SETTINGS;
    }
  }

  private persistNotifications() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(this.notifications.slice(0, 30)));
    } catch {}
  }

  private persistSettings() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    } catch {}
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb([...this.notifications], this.activeBanner);
      } catch (err) {
        console.error('PushNotification listener error:', err);
      }
    });
  }

  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    // Initial call
    listener([...this.notifications], this.activeBanner);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getNotifications(): PushNotificationItem[] {
    return [...this.notifications];
  }

  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.isRead).length;
  }

  getActiveBanner(): PushNotificationItem | null {
    return this.activeBanner;
  }

  getSettings(): PushNotificationSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<PushNotificationSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.persistSettings();
    this.notify();
  }

  dismissBanner() {
    if (this.bannerTimer) {
      clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }
    this.activeBanner = null;
    this.notify();
  }

  markAsRead(id: string) {
    this.notifications = this.notifications.map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    this.persistNotifications();
    this.notify();
  }

  markAllAsRead() {
    this.notifications = this.notifications.map((n) => ({ ...n, isRead: true }));
    this.persistNotifications();
    this.notify();
  }

  clearNotifications() {
    this.notifications = [];
    this.activeBanner = null;
    this.persistNotifications();
    this.notify();
  }

  // Web Notification API (Browser Native Push)
  getWebPushPermission(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  async requestWebPushPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        this.updateSettings({ webPushEnabled: true });
      }
      return perm;
    } catch {
      return 'denied';
    }
  }

  private sendNativeNotification(title: string, body: string, icon?: string) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted' && this.settings.webPushEnabled) {
      try {
        new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'budmo-push-' + Date.now(),
        });
      } catch {
        // Notification might be blocked in cross-origin iframe
      }
    }
  }

  // Core Dispatcher
  dispatch(item: Omit<PushNotificationItem, 'id' | 'createdAt' | 'timestamp' | 'isRead'>): PushNotificationItem {
    const newItem: PushNotificationItem = {
      ...item,
      id: `push-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
      timestamp: 'Щойно',
      isRead: false,
    };

    // Add to notification list
    this.notifications = [newItem, ...this.notifications];
    this.persistNotifications();

    // Play push sound if enabled
    if (this.settings.soundEnabled) {
      sounds.playPushNotification();
    }

    // Vibrate on mobile device if supported
    if (this.settings.vibrateEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {}
    }

    // Set active heads-up banner if enabled
    if (this.settings.bannerEnabled) {
      if (this.bannerTimer) {
        clearTimeout(this.bannerTimer);
      }
      this.activeBanner = newItem;

      // Auto dismiss after 6 seconds
      this.bannerTimer = setTimeout(() => {
        this.dismissBanner();
      }, 6000);
    }

    // Trigger Native Browser Web Push
    this.sendNativeNotification(newItem.title, `${newItem.body}${newItem.subtitle ? ` — ${newItem.subtitle}` : ''}`, newItem.avatar);

    this.notify();
    return newItem;
  }

  // Trigger generic local notification
  triggerLocalNotification(params: {
    title: string;
    body: string;
    subtitle?: string;
    type?: PushNotificationItem['type'];
    avatar?: string;
    actionText?: string;
    actionUrl?: string;
  }): PushNotificationItem {
    return this.dispatch({
      type: params.type || 'system',
      title: params.title,
      body: params.body,
      subtitle: params.subtitle,
      avatar: params.avatar,
      actionText: params.actionText,
      actionUrl: params.actionUrl,
    });
  }

  // 1. SPECIFIC TRIGGER: «Хтось присів за ваш столик у Squat 17b»
  triggerTableSeatNotification(params?: {
    venueName?: string;
    guestName?: string;
    guestAvatar?: string;
    hangoutId?: string;
    customNote?: string;
  }): PushNotificationItem {
    const venue = params?.venueName || 'Squat 17b';
    const guest = params?.guestName || 'Богдан';
    const avatar = params?.guestAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80';
    const hangoutId = params?.hangoutId || 'hangout-squat-1';

    return this.dispatch({
      type: 'table_seat',
      title: `${venue} • Новий гість за столиком 🍻`,
      body: `Хтось присів за ваш столик у ${venue}`,
      subtitle: `${guest} приєднався до вашої компанії та замовляє крафт!`,
      avatar,
      venueName: venue,
      hangoutId,
      buddyName: guest,
      actionText: 'Переглянути столик',
    });
  }

  // 2. SPECIFIC TRIGGER: «Нове повідомлення від супутника»
  triggerChatMessageNotification(params?: {
    buddyName?: string;
    messageText?: string;
    buddyAvatar?: string;
    chatId?: string;
    buddyId?: string;
  }): PushNotificationItem {
    const buddy = params?.buddyName || 'Оксана';
    const message = params?.messageText || 'Я вже замовила сидр біля барної стійки! Ти де? 🍻';
    const avatar = params?.buddyAvatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80';
    const chatId = params?.chatId || 'chat-2';
    const buddyId = params?.buddyId || '2';

    return this.dispatch({
      type: 'chat_message',
      title: 'Нове повідомлення від супутника 💬',
      body: `Нове повідомлення від супутника: «${message}»`,
      subtitle: `${buddy} пише у чат`,
      avatar,
      chatId,
      buddyId,
      buddyName: buddy,
      actionText: 'Відповісти',
    });
  }

  // Schedule a notification after delay (e.g. for realistic testing after tab switch)
  scheduleNotification(
    type: 'table_seat' | 'chat_message',
    delayMs: number = 3000,
    customParams?: Record<string, unknown>
  ): () => void {
    const timer = setTimeout(() => {
      if (type === 'table_seat') {
        this.triggerTableSeatNotification(customParams);
      } else {
        this.triggerChatMessageNotification(customParams);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }
}

export const pushNotificationService = new PushNotificationService();
