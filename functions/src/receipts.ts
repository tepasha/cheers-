import type { Firestore } from 'firebase-admin/firestore';

/** Expo receipts arrive later than tickets. Remove dead tokens and expire bookkeeping after 24 hours. */
export async function checkPushReceipts(db: Firestore, accessToken = '', fetchImpl: typeof fetch = fetch) {
  const now = Date.now();
  const snapshot = await db.collection('pushReceipts').where('createdAt', '<', now - 15 * 60_000).limit(300).get();
  if (snapshot.empty) return { checked: 0, removed: 0 };
  const response = await fetchImpl('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify({ ids: snapshot.docs.map((d) => d.id) }), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Expo receipts HTTP ${response.status}`);
  const payload = await response.json() as { data?: Record<string, { status: string; details?: { error?: string } }> };
  const batch = db.batch();
  let removed = 0;
  snapshot.docs.forEach((ticket) => {
    const receipt = payload.data?.[ticket.id];
    if (receipt?.details?.error === 'DeviceNotRegistered') {
      batch.delete(db.doc(`devices/${ticket.get('deviceId')}`)); removed += 1;
    } else if (receipt?.status === 'error') console.error('push receipt rejected', { error: receipt.details?.error ?? 'unknown' });
    if (receipt || Number(ticket.get('createdAt')) < now - 24 * 3600_000) batch.delete(ticket.ref);
  });
  await batch.commit();
  return { checked: snapshot.size, removed };
}
