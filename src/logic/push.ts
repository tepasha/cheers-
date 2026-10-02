/** Pure helpers for push registration (no native modules, so they run in unit tests) */

const TOKEN_PATTERN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,60}\]$/;

export const isExpoPushToken = (token: string): boolean => TOKEN_PATTERN.test(token);

/**
 * Document id of a device. Derived from the token so one phone is one document, whoever is signed in:
 * the Firestore rules require exactly this id.
 */
export const deviceIdFor = (token: string): string => token.replace(/[^A-Za-z0-9_-]/g, '_');

/** The chat a push notification points at, or null for anything that is not a chat message of ours */
export const chatIdFromPushData = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null;
  const { type, chatId } = data as Record<string, unknown>;
  if (type !== 'chat_message' || typeof chatId !== 'string') return null;
  return chatId.length > 0 && chatId.length <= 200 && !chatId.includes('/') ? chatId : null;
};
