import { deleteApp, initializeApp } from 'firebase-admin/app';
import { FieldPath, FieldValue, getFirestore, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type { AccountDeps } from './account';
import { sendToExpo } from './expo';
import type { CleanupDeps } from './lifecycle';
import type { ChatDoc, Device, ExpoMessage, ExpoTicket, PushDeps } from './push';


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
      for (const uid of userIds) {
        const snap = await db.collection('devices').where('uid', '==', uid).orderBy('updatedAt', 'desc').limit(5).get();
        snap.forEach((d) => {
          const data = d.data();
          if (typeof data.leaseUntil !== 'number' || data.leaseUntil <= Date.now()) return;
          devices.push({ id: d.id, uid: data.uid, token: data.token, language: data.language, privatePreview: data.privatePreview === true });
        });
      }
      return devices;
    },
    async senderProfileName(uid) {
      const snap = await db.doc(`users/${uid}`).get();
      return typeof snap.get('name') === 'string' ? snap.get('name') : '';
    },
    async saveTickets(tickets) {
      const batch = db.batch();
      tickets.forEach((ticket) => batch.set(db.doc(`pushReceipts/${ticket.id}`), { ...ticket, createdAt: Date.now() }));
      await batch.commit();
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

export function createCleanupDeps(db: Firestore): CleanupDeps {
  return {
    async findBefore(collection, field, before, limit) {
      const snap = await db.collection(collection).where(field, '<', before).limit(limit).get();
      return snap.docs.map((d) => d.id);
    },
    async deleteMany(collection, ids) {
      const batch = db.batch();
      ids.forEach((id) => batch.delete(db.doc(`${collection}/${id}`)));
      await batch.commit();
    },
  };
}

/** Firestore batches take at most 500 writes */
const WRITE_BATCH = 400;

async function commitAll(db: Firestore, writes: Array<(batch: FirebaseFirestore.WriteBatch) => void>): Promise<void> {
  for (const part of chunk(writes, WRITE_BATCH)) {
    const batch = db.batch();
    part.forEach((write) => write(batch));
    await batch.commit();
  }
}

export function createAccountDeps(db: Firestore, auth: Auth): AccountDeps {
  const deleteAll = (refs: DocumentReference[]) => commitAll(db, refs.map((ref) => (batch) => batch.delete(ref)));

  return {
    async forgetInChats(uid) {
      const chats = await db.collection('chats').where('members', 'array-contains', uid).get();
      const writes: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
      for (const chat of chats.docs) {
        const data = chat.data();
        const remaining = Array.isArray(data.members) ? data.members.filter((id: unknown) => id !== uid) : [];
        writes.push((batch) => batch.update(chat.ref, { anonymizedMembers: FieldValue.arrayUnion(uid), ...(data.isGroup ? { members: remaining, ...(data.createdBy === uid && remaining.length ? { createdBy: remaining[0] } : {}) } : {}) }));
        const profiles = data.profiles && typeof data.profiles === 'object' ? (data.profiles as Record<string, unknown>) : {};
        if (Object.prototype.hasOwnProperty.call(profiles, uid)) {
          writes.push((batch) => batch.update(chat.ref, new FieldPath('profiles', uid), FieldValue.delete()));
        }
        if (Array.isArray(data.participants)) {
          const rest = data.participants.filter((p: unknown) => !(p && typeof p === 'object' && (p as { id?: unknown }).id === uid));
          if (rest.length !== data.participants.length) writes.push((batch) => batch.update(chat.ref, { participants: rest }));
        }
        // Sent messages stay (they belong to the conversation and are encrypted), but no longer carry the name or photo
        const sent = await chat.ref.collection('messages').where('senderId', '==', uid).get();
        sent.docs.forEach((m) => writes.push((batch) => batch.update(m.ref, { senderName: '', senderAvatar: null })));
      }
      const friendships = await db.collectionGroup('friends').where('friendId', '==', uid).get();
      friendships.docs.forEach((friend) => writes.push((batch) => batch.delete(friend.ref)));
      await commitAll(db, writes);
      return chats.size;
    },

    async leaveHangouts(uid) {
      const snap = await db.collection('hangouts').where('joinedUsers', 'array-contains', uid).get();
      const others = snap.docs.filter((d) => d.get('userId') !== uid);
      await commitAll(
        db,
        others.map((d) => (batch) => batch.update(d.ref, { joinedUsers: FieldValue.arrayRemove(uid), participantsCount: FieldValue.increment(-1) }))
      );
      return others.length;
    },

    async leaveMeetups(uid) {
      const snap = await db.collection('group_meetups').where(new FieldPath('participants', uid, 'userId'), '==', uid).get();
      const others = snap.docs.filter((d) => d.get('creatorId') !== uid);
      await commitAll(db, others.map((d) => (batch) => batch.update(d.ref, new FieldPath('participants', uid), FieldValue.delete())));
      return others.length;
    },

    async deleteOwned(collection, field, uid) {
      const snap = await db.collection(collection).where(field, '==', uid).get();
      await deleteAll(snap.docs.map((d) => d.ref));
      return snap.size;
    },

    async deleteUserTree(uid) {
      const administrative = ['reportRateLimits/' + uid, 'bannedUsers/' + uid, ...['onboarding', 'discovery', 'profile'].map((operation) => `internalRateLimits/${uid}_${operation}`), ...['message', 'hangout', 'meetup'].map((operation) => `writeQuotas/${uid}_${operation}`)];
      await deleteAll(administrative.map((path) => db.doc(path)));
      // Keep the moderation record, remove names/photos contributed by the deleted account.
      for (const field of ['reporterId', 'targetId']) {
        const reports = await db.collection('reports').where(field, '==', uid).get();
        await commitAll(db, reports.docs.map((report) => (batch) => batch.update(report.ref,
          field === 'reporterId' ? { reporterName: '' } : { targetName: '', targetAvatar: FieldValue.delete() })));
      }
      await db.recursiveDelete(db.doc(`users/${uid}`));
    },

    async deleteAuthUser(uid) {
      try {
        await auth.deleteUser(uid);
      } catch (err) {
        // Already gone (a retry after a failure further down): the job is done
        if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
      }
    },
  };
}
