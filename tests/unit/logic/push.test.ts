import { describe, expect, it } from 'vitest';
import { deviceIdFor, isExpoPushToken } from '../../../src/logic/push';

describe('push tokens', () => {
  it('accepts Expo tokens only', () => {
    expect(isExpoPushToken('ExponentPushToken[abcDEF123_-xyz]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abcDEF123_-xyz]')).toBe(true);
    expect(isExpoPushToken('fcm:APA91b...')).toBe(false);
    expect(isExpoPushToken('ExponentPushToken[short]')).toBe(false);
    expect(isExpoPushToken('')).toBe(false);
  });

  it('derives a stable, Firestore-safe document id from the token', () => {
    expect(deviceIdFor('ExponentPushToken[abc_DEF-123456]')).toBe('ExponentPushToken_abc_DEF-123456_');
    expect(deviceIdFor('ExponentPushToken[abc_DEF-123456]')).not.toMatch(/[/[\]]/);
  });
});
