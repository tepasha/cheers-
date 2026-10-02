import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { sendToExpo } from './expo';
import type { ChatDoc, Device, ExpoMessage, ExpoTicket, PushDeps } from './push';

/** Firestore `in` queries accept up to 30 values */
const IN_LIMIT = 30;

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** `send` is replaceable so tests can record what would go to Expo */
export function createDeps(
  db: Firestore,
  accessToken?: string,
  send: (messages: ExpoMessage[]) => Promise<ExpoTicket[]> = (messages) => sendToExpo(messages, { accessToken: accessToken || undefined })
): PushDeps {
  return {
    async getChat(chatId) {
      const snap = await db.doc(`chats/${chatId}`).get();
      return snap.exists ? (snap.data() as ChatDoc) : null;
    },
    async blockedSenders(recipientIds, senderId) {
      const refs = recipientIds.map((id) => db.doc(`users/${id}/blocks/${senderId}`));
      const snaps = await db.getAll(...refs);
      return new Set(recipientIds.filter((_, i) => snaps[i].exists));
    },
    async getDevices(userIds) {
      const devices: Device[] = [];
      for (const ids of chunk(userIds, IN_LIMIT)) {
        const snap = await db.collection('devices').where('uid', 'in', ids).get();
        snap.forEach((d) => {
          const data = d.data();
          devices.push({ id: d.id, uid: data.uid, token: data.token, language: data.language });
        });
      }
      return devices;
    },
    send,
    async removeDevices(deviceIds) {
      const batch = db.batch();
      deviceIds.forEach((id) => batch.delete(db.doc(`devices/${id}`)));
      await batch.commit();
    },
  };
}

/** For tests: an Admin SDK Firestore bound to a project, to be used against the emulator */
export function adminFirestoreFor(projectId: string): { db: Firestore; close: () => Promise<void> } {
  const app = initializeApp({ projectId }, projectId);
  return { db: getFirestore(app), close: () => deleteApp(app) };
}
