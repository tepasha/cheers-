import { ChatThread, ChatParticipant, Message, BuddyProfile } from '../types';
import { INITIAL_CHATS } from '../data/mockData';
import { firestoreSyncService } from './firestoreSyncService';
import { sounds } from './soundService';

const STORAGE_KEY = 'budmo_chat_threads_v2';

class ChatService {
  private chats: ChatThread[] = [];
  private listeners: Array<(chats: ChatThread[]) => void> = [];

  constructor() {
    this.chats = this.loadFromStorage();
  }

  private loadFromStorage(): ChatThread[] {
    if (typeof window === 'undefined') return INITIAL_CHATS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stored chats, using defaults', e);
    }
    return INITIAL_CHATS;
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.chats));
    } catch (e) {
      console.warn('Failed to persist chats to localStorage', e);
    }
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn(this.chats);
      } catch (err) {
        console.error('ChatService listener error:', err);
      }
    });
  }

  public getChats(): ChatThread[] {
    return [...this.chats];
  }

  public getChatById(id: string): ChatThread | undefined {
    return this.chats.find((c) => c.id === id);
  }

  public subscribe(fn: (chats: ChatThread[]) => void): () => void {
    this.listeners.push(fn);
    fn(this.chats);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  public setChats(updatedChats: ChatThread[]): void {
    this.chats = updatedChats;
    this.saveToStorage();
    this.notify();
  }

  /**
   * Delete a chat thread by ID (removes locally and from Firestore)
   */
  public deleteChat(chatId: string): void {
    sounds.playTap();
    this.chats = this.chats.filter((c) => c.id !== chatId);
    this.saveToStorage();
    this.notify();

    // Sync deletion to Firestore
    firestoreSyncService.deleteChatThread(chatId).catch((err) => {
      console.warn('Firestore chat deletion notice:', err);
    });
  }

  /**
   * Create a new group chat
   */
  public createGroupChat(params: {
    name: string;
    topic: string;
    avatar: string;
    participants: ChatParticipant[];
    creatorId?: string;
    creatorName?: string;
    creatorAvatar?: string;
  }): ChatThread {
    const now = new Date();
    const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newChatId = `chat-group-${Date.now()}`;

    // Select primary buddy for backward compatibility
    const fallbackBuddy: BuddyProfile = {
      id: params.creatorId || 'group-creator',
      name: params.name,
      avatar: params.avatar,
      age: 26,
      distanceKm: 0.8,
      locationName: 'Поділ, Київ',
      tagline: `Груповий чат • ${params.participants.length} учасників`,
      bio: params.topic,
      coordinates: { lat: 50.4501, lng: 30.5234 },
      preferredDrinks: ['craft', 'beer', 'cider'],
      paymentRule: 'split_50_50',
      currentMood: 'chill_talk',
      favoriteBars: ['Squat 17b', 'Punkcraft'],
      talkTopics: [params.topic],
      online: true,
    };

    const initialMessage: Message = {
      id: `msg-group-init-${Date.now()}`,
      chatId: newChatId,
      senderId: params.creatorId || 'me',
      senderName: params.creatorName || 'Павло (Ви)',
      senderAvatar: params.creatorAvatar || params.avatar,
      text: `🎉 Створено новий груповий чат: «${params.name}»! Давайте оберемо заклад та піднімемо келихи 🍻`,
      timestamp: timeString,
      isMe: true,
      type: 'cheers',
    };

    const newGroupThread: ChatThread = {
      id: newChatId,
      isGroup: true,
      groupName: params.name,
      groupTopic: params.topic,
      groupAvatar: params.avatar,
      buddy: fallbackBuddy,
      participants: params.participants,
      lastMessage: initialMessage.text,
      lastMessageTime: timeString,
      unreadCount: 0,
      createdAt: now.toISOString(),
      messages: [initialMessage],
    };

    this.chats = [newGroupThread, ...this.chats];
    this.saveToStorage();
    this.notify();

    // Also send encrypted sync to Firestore
    firestoreSyncService.sendEncryptedMessage(newChatId, initialMessage).catch((err) => {
      console.warn('Firestore group initial message sync notice:', err);
    });

    return newGroupThread;
  }

  /**
   * Add new participants to an existing group chat
   */
  public addParticipants(chatId: string, newParticipants: ChatParticipant[]): void {
    const chat = this.chats.find((c) => c.id === chatId);
    if (!chat) return;

    const existingIds = new Set((chat.participants || []).map((p) => p.id));
    const toAdd = newParticipants.filter((p) => !existingIds.has(p.id));
    if (toAdd.length === 0) return;

    const updatedParticipants = [...(chat.participants || []), ...toAdd];
    const now = new Date();
    const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const namesAdded = toAdd.map((p) => p.name).join(', ');
    const systemNoticeMsg: Message = {
      id: `msg-sys-${Date.now()}`,
      chatId,
      senderId: 'system',
      senderName: 'Будьмо Бот 🤖',
      text: `👋 До чату приєдналися: ${namesAdded}! Вітаємо в компанії 🍻`,
      timestamp: timeString,
      isMe: false,
    };

    this.chats = this.chats.map((c) => {
      if (c.id === chatId) {
        return {
          ...c,
          participants: updatedParticipants,
          messages: [...c.messages, systemNoticeMsg],
          lastMessage: systemNoticeMsg.text,
          lastMessageTime: timeString,
        };
      }
      return c;
    });

    this.saveToStorage();
    this.notify();
  }
}

export const chatService = new ChatService();
