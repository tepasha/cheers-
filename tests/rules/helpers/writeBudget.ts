import { doc, getDoc, serverTimestamp, type WriteBatch } from 'firebase/firestore';
import type { RulesTestContext } from '@firebase/rules-unit-testing';
type Firestore = ReturnType<RulesTestContext['firestore']>;

export async function attachBudget(db: Firestore, batch: WriteBatch, uid: string, operation: 'message' | 'hangout' | 'meetup', resourceId: string) {
  const ref = doc(db, 'writeQuotas', `${uid}_${operation}`);
  const previous = (await getDoc(ref)).data();
  batch.set(ref, {
    uid, operation, resourceId, count: previous ? previous.count + 1 : 1,
    windowStartedAt: previous?.windowStartedAt ?? serverTimestamp(), lastAt: serverTimestamp(),
  });
}

export async function createWithBudget(db: Firestore, path: string, uid: string, operation: 'hangout' | 'meetup', fields: Record<string, unknown>) {
  const { writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);
  await attachBudget(db, batch, uid, operation, path.split('/').at(-1)!);
  batch.set(doc(db, path), fields);
  await batch.commit();
}
