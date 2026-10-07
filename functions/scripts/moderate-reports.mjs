#!/usr/bin/env node
// Admin SDK operator tool. Reading is the default; actions require an explicit report ID and --execute.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const [projectId, databaseId, command = 'list', reportId, ...flags] = process.argv.slice(2);
if (!projectId || !databaseId || !['list', 'inspect', 'dismiss', 'ban'].includes(command)) {
  throw new Error('Usage: moderate-reports.mjs <project> <database> list|inspect|dismiss|ban [reportId] [--execute]');
}
initializeApp({ projectId });
const db = getFirestore(databaseId);
if (command === 'list') {
  const pending = await db.collection('reports').where('status', '==', 'pending').limit(100).get();
  pending.docs.forEach((d) => console.log(JSON.stringify({ id: d.id, ...d.data() })));
} else {
  if (!reportId || reportId.includes('/')) throw new Error('An exact report ID is required');
  const ref = db.doc(`reports/${reportId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error('Report not found');
  const report = snapshot.data();
  console.log(JSON.stringify({ id: reportId, ...report }));
  if (command !== 'inspect') {
    if (!flags.includes('--execute')) throw new Error('Reviewed report printed. Add --execute to apply the action.');
    if (command === 'ban') {
      const user = await getAuth().getUser(report.targetId);
      // Rules consult this marker immediately, including clients holding an older ID token.
      await db.doc(`bannedUsers/${user.uid}`).set({ reportId, bannedAt: FieldValue.serverTimestamp() });
      await getAuth().updateUser(user.uid, { disabled: true });
      await getAuth().revokeRefreshTokens(user.uid);
      // Remove discovery visibility and public events too.
      await db.doc(`users/${user.uid}`).set({ shareLocation: false, lat: FieldValue.delete(), lng: FieldValue.delete(), geohash: FieldValue.delete() }, { merge: true });
      for (const [collection, field] of [['hangouts', 'userId'], ['group_meetups', 'creatorId'], ['devices', 'uid']]) {
        const docs = await db.collection(collection).where(field, '==', user.uid).get();
        for (let i = 0; i < docs.docs.length; i += 400) {
          const batch = db.batch(); docs.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref)); await batch.commit();
        }
      }
    }
    await ref.update({ status: command === 'dismiss' ? 'dismissed' : 'resolved', resolution: command, reviewedAt: FieldValue.serverTimestamp() });
  }
}
