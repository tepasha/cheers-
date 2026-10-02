import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { createCleanupDeps, createDeps } from './deps';
import { cleanupExpired } from './lifecycle';
import { notifyChatMessage } from './push';

initializeApp();

/** Same named database the app uses (FIREBASE_FIRESTORE_DATABASE_ID in the app's .env) */
const DATABASE_ID = defineString('FIRESTORE_DATABASE_ID', { default: '(default)' });
/** Optional: set when "enhanced push security" is on for the Expo project */
const EXPO_ACCESS_TOKEN = defineString('EXPO_ACCESS_TOKEN', { default: '' });

export const onChatMessage = onDocumentCreated(
  { document: 'chats/{chatId}/messages/{messageId}', database: DATABASE_ID },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const db = getFirestore(DATABASE_ID.value());
    const result = await notifyChatMessage(createDeps(db, EXPO_ACCESS_TOKEN.value()), event.params.chatId, {
      id: event.params.messageId,
      senderId: data.senderId,
      senderName: data.senderName,
      type: data.type,
    });
    console.log('push', { chatId: event.params.chatId, ...result });
  }
);

/**
 * Hourly cleanup: tables past their 4 hours, meetups past their 30-day archive. Needs the Cloud Scheduler API
 * (enabled automatically on the first deploy of a scheduled function; Blaze plan).
 */
export const cleanupExpiredContent = onSchedule({ schedule: 'every 60 minutes', timeZone: 'Europe/Kyiv' }, async () => {
  const result = await cleanupExpired(createCleanupDeps(getFirestore(DATABASE_ID.value())), Date.now());
  console.log('cleanup', result);
});
