import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export const TERMS_VERSION = '2026-10-07';

export function adultAge(iso: unknown, now = new Date()): number {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new HttpsError('invalid-argument', 'Invalid birth date');
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw new HttpsError('invalid-argument', 'Invalid birth date');
  const age = now.getUTCFullYear() - y - Number(now.getUTCMonth() < m - 1 || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d));
  if (age < 21 || age > 120) throw new HttpsError('failed-precondition', 'Age requirement not met');
  return age;
}

/** Server-owned quota records cannot be reset by deleting a client profile. */
export async function rateLimit(db: Firestore, uid: string, operation: string, intervalMs: number, dailyMax: number, now = Date.now()) {
  const ref = db.doc(`internalRateLimits/${uid}_${operation}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const value = snap.data();
    const day = Math.floor(now / 86400000);
    const count = value?.day === day ? Number(value.count) || 0 : 0;
    if (now - (Number(value?.lastAt) || 0) < intervalMs || count >= dailyMax) throw new HttpsError('resource-exhausted', 'Try again later');
    tx.set(ref, { day, count: count + 1, lastAt: now });
  });
}
