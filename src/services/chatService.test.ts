import { describe, it, expect, beforeEach } from 'vitest';
import { chatService } from './chatService';
import { ChatParticipant } from '../types';

describe('chatService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should load initial chats including group chat', () => {
    const chats = chatService.getChats();
    expect(chats.length).toBeGreaterThan(0);
    const groupChat = chats.find((c) => c.isGroup);
    expect(groupChat).toBeDefined();
    expect(groupChat?.participants).toBeDefined();
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
    const chats = chatService.getChats();
    const group = chats.find((c) => c.isGroup);
    expect(group).toBeDefined();
    if (!group) return;

    const initialCount = group.participants?.length || 0;
    const newParticipant: ChatParticipant = {
      id: 'test-new-buddy',
      name: 'Новий Друг',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      online: true,
      role: 'member',
    };

    chatService.addParticipants(group.id, [newParticipant]);

    const updatedGroup = chatService.getChatById(group.id);
    expect(updatedGroup?.participants?.length).toBe(initialCount + 1);
  });

  it('should delete a chat thread by ID', () => {
    const chatsBefore = chatService.getChats();
    const targetChat = chatsBefore[0];
    const initialCount = chatsBefore.length;

    chatService.deleteChat(targetChat.id);

    const chatsAfter = chatService.getChats();
    expect(chatsAfter.length).toBe(initialCount - 1);
    expect(chatsAfter.find((c) => c.id === targetChat.id)).toBeUndefined();
  });
});
