import { describe, expect, it } from 'vitest';
import { newestConfirmedAt } from '@/logic/chats';
import type { Message } from '@/types';

const msg = (id: string, over: Partial<Message>): Message => ({
  id, chatId: 'c', senderId: 'a', senderName: 'A', text: id, timestamp: '12:00', isMe: false, ...over,
});

describe('where a chat stream can start', () => {
  it('after the newest message the server confirmed', () => {
    expect(newestConfirmedAt([
      msg('a', { createdAt: 1_000, hasPendingWrites: false }),
      msg('b', { createdAt: 3_000, hasPendingWrites: false }),
      msg('c', { createdAt: 2_000, hasPendingWrites: false }),
    ])).toBe(3_000);
  });

  it('never after a message still on its way or a local copy (their time is the phone clock, which can run ahead)', () => {
    expect(newestConfirmedAt([
      msg('server', { createdAt: 1_000, hasPendingWrites: false }),
      msg('pending', { createdAt: 9_000, hasPendingWrites: true }),
      msg('local', { createdAt: 9_500, deliveryStatus: 'sent' }),
    ])).toBe(1_000);
  });

  it('nowhere for a chat with nothing confirmed yet: the newest page is loaded instead', () => {
    expect(newestConfirmedAt(undefined)).toBeUndefined();
    expect(newestConfirmedAt([])).toBeUndefined();
    expect(newestConfirmedAt([msg('local', { createdAt: 5_000 }), msg('legacy', { createdAt: 0, hasPendingWrites: false })])).toBeUndefined();
  });
});
