import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { AccountError, deleteAccount } from './account';
import { createAccountDeps, createCleanupDeps, createDeps } from './deps';
import { cleanupExpired } from './lifecycle';
import { notifyChatMessage } from './push';
import { adultAge, rateLimit, TERMS_VERSION } from './access';
import { discoverPeople, getPublicProfile } from './discovery';
import { checkPushReceipts } from './receipts';

const requireEligible = (auth: { uid: string; token: Record<string, unknown> } | undefined) => {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in first');
  if (auth.token.email_verified !== true || auth.token.age_21 !== true) throw new HttpsError('permission-denied', 'Complete onboarding first');
  return auth.uid;
};

initializeApp();

/**
 * Same named database the app uses (FIREBASE_FIRESTORE_DATABASE_ID in the app's .env, `database` in firebase.json).
 * Deliberately no default: with a '(default)' fallback a deploy without functions/.env.<project> bound the chat
 * trigger and the cleanup to an empty database, and pushes stopped without any error. Now a non-interactive deploy
 * without the value aborts, and the interactive prompt refuses an empty answer or '(default)'.
 */
const DATABASE_ID = defineString('FIRESTORE_DATABASE_ID', {
  description: 'Named Firestore database of this project (same id as "database" in firebase.json)',
  input: {
    text: {
      validationRegex: /^(?!\(default\)$).+$/,
      validationErrorMessage: 'Enter the named database id from firebase.json, not "(default)"',
    },
  },
});

/**
 * Optional: set when "enhanced push security" is on for the Expo project. Read from the environment rather than
 * declared as a param on purpose: firebase-tools treats every declared param that is missing from the dotenv files
 * as required (a default does not help) and aborts a --non-interactive deploy, so an optional param would block
 * every release of a team that never enabled the feature. Values from functions/.env.<project> still reach
 * process.env of the deployed functions.
 */
const expoAccessToken = (): string => process.env.EXPO_ACCESS_TOKEN ?? '';

/** Birth date is self-reported, validated on the server; only the server issues eligibility claims. */
export const completeOnboarding = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  const uid = request.auth.uid;
  const input = request.data as { birthDate?: unknown; termsAccepted?: unknown } | null;
  if (input?.termsAccepted !== true) throw new HttpsError('failed-precondition', 'Accept the terms first');
  const age = adultAge(input.birthDate);
  const db = getFirestore(DATABASE_ID.value());
  if ((await db.doc(`bannedUsers/${uid}`).get()).exists) throw new HttpsError('permission-denied', 'Account disabled');
  await rateLimit(db, uid, 'onboarding', 1000, 30);
  await db.doc(`users/${uid}/private/profile`).set({ birthDate: input.birthDate, termsVersion: TERMS_VERSION, termsAcceptedAt: new Date().toISOString() }, { merge: true });
  const user = await getAuth().getUser(uid);
  await getAuth().setCustomUserClaims(uid, { ...user.customClaims, age_21: true, terms_version: TERMS_VERSION });
  return { age, termsVersion: TERMS_VERSION };
});

export const discoverNearby = onCall(async (request) => {
  const uid = requireEligible(request.auth);
  const db = getFirestore(DATABASE_ID.value());
  await rateLimit(db, uid, 'discovery', 10000, 2000);
  if ((await db.doc(`bannedUsers/${uid}`).get()).exists) throw new HttpsError('permission-denied', 'Account disabled');
  return discoverPeople(db, uid, request.data?.lat, request.data?.lng);
});

export const publicUserProfile = onCall(async (request) => {
  const uid = requireEligible(request.auth);
  const db = getFirestore(DATABASE_ID.value());
  await rateLimit(db, uid, 'profile', 0, 3000);
  if ((await db.doc(`bannedUsers/${uid}`).get()).exists) throw new HttpsError('permission-denied', 'Account disabled');
  return getPublicProfile(db, uid, request.data?.userId);
});

export const onChatMessage = onDocumentCreated(
  { document: 'chats/{chatId}/messages/{messageId}', database: DATABASE_ID },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const db = getFirestore(DATABASE_ID.value());
    const result = await notifyChatMessage(createDeps(db, expoAccessToken()), event.params.chatId, {
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
  const db = getFirestore(DATABASE_ID.value());
  const result = await cleanupExpired(createCleanupDeps(db), Date.now());
  const reports = await db.collection('reports').where('receivedAt', '<', new Date(Date.now() - 90 * 24 * 3600_000)).limit(300).get();
  const devices = await db.collection('devices').where('leaseUntil', '<', Date.now() - 24 * 3600_000).limit(100).get();
  const batch = db.batch();
  [...reports.docs, ...devices.docs].forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log('cleanup', result);
});

export const reconcilePushReceipts = onSchedule('every 15 minutes', async () => {
  console.log('push receipts', await checkPushReceipts(getFirestore(DATABASE_ID.value()), expoAccessToken()));
});

// The queue is private to Admin SDK operators. Structured logs can be wired to Cloud Monitoring alerts.
export const onAbuseReport = onDocumentCreated({ document: 'reports/{reportId}', database: DATABASE_ID }, async (event) => {
  const report = event.data?.data();
  if (!report) return;
  console.warn('moderation.report.pending', { reportId: event.params.reportId, category: report.category, targetType: report.targetType });
});

export const monitorModerationQueue = onSchedule('every 60 minutes', async () => {
  const db = getFirestore(DATABASE_ID.value());
  const pending = await db.collection('reports').where('status', '==', 'pending').limit(200).get();
  const overdue = pending.docs.filter((d) => (d.get('receivedAt')?.toMillis?.() ?? d.get('createdAt') ?? Date.now()) < Date.now() - 24 * 3600_000);
  if (overdue.length) console.error('moderation.report.overdue', { count: overdue.length });
});

/**
 * "Delete my account", called by the app after it re-authenticated the person (password or Google). Removes their
 * data everywhere, including what sits in other people's chats and meetups, then the sign-in itself.
 */
export const deleteMyAccount = onCall({ timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  const uid = request.auth.uid;
  try {
    const result = await deleteAccount(
      createAccountDeps(getFirestore(DATABASE_ID.value()), getAuth()),
      uid,
      typeof request.auth.token.auth_time === 'number' ? request.auth.token.auth_time : undefined,
      Date.now()
    );
    console.log('account deleted', { uid, ...result });
    return { ok: true };
  } catch (err) {
    if (err instanceof AccountError) throw new HttpsError('failed-precondition', err.code);
    console.error('account deletion failed', { uid, err });
    throw new HttpsError('internal', 'Account deletion failed');
  }
});
