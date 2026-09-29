import { describe, it, expect, beforeEach } from 'vitest';
import { chatService } from './chatService';
import { ChatParticipant } from '../types';

describe('chatService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with empty chats when no mock data is present', () => {
    const chats = chatService.getChats();
    expect(chats.length).toBe(0);
  });

  it('should create a new group chat and prepend it', () => {
    const participants: ChatParticipant[] = [
      {
        id: 'user-1',
        name: 'Олена',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        online: true,
        role: 'member',
      },
    ];

    const newGroup = chatService.createGroupChat({
      name: 'Крафтовий клуб',
      topic: 'Тестування IPA',
      avatar: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=150',
      participants,
      creatorId: 'me',
      creatorName: 'Павло (Ви)',
    });

    expect(newGroup.isGroup).toBe(true);
    expect(newGroup.groupName).toBe('Крафтовий клуб');
    expect(newGroup.participants?.length).toBe(1);

    const chats = chatService.getChats();
    expect(chats[0].id).toBe(newGroup.id);
  });

  it('should add participants to existing group chat', () => {
    const group = chatService.createGroupChat({
      name: 'Барний двіж',
      topic: 'Зустріч',
      avatar: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=150',
      participants: [],
      creatorId: 'me',
      creatorName: 'Павло',
    });

    const newParticipant: ChatParticipant = {
      id: 'test-new-buddy',
      name: 'Новий Друг',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      online: true,
      role: 'member',
    };

    chatService.addParticipants(group.id, [newParticipant]);

    const updatedGroup = chatService.getChatById(group.id);
    expect(updatedGroup?.participants?.length).toBe(1);
  });

  it('should delete a chat thread by ID', () => {
    const createdChat = chatService.createGroupChat({
      name: 'Чат для видалення',
      topic: 'Тест',
      avatar: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=150',
      participants: [],
      creatorId: 'me',
      creatorName: 'Павло',
    });

    const chatsBefore = chatService.getChats();
    const initialCount = chatsBefore.length;

    chatService.deleteChat(createdChat.id);

    const chatsAfter = chatService.getChats();
    expect(chatsAfter.length).toBe(initialCount - 1);
    expect(chatsAfter.find((c) => c.id === createdChat.id)).toBeUndefined();
  });
});
