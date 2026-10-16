import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { distanceBetween, geohashQueryBounds } from 'geofire-common';
import { HttpsError } from 'firebase-functions/v2/https';

const radiusKm = 3;
const maxPeople = 50;
/** The most values one Firestore `in` filter takes */
const inLimit = 30;
const coarse = (n: number) => Math.round(n * 50) / 50;
const safeText = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : '';

/** Only first-party images and provider-owned Google avatars; never arbitrary tracking URLs. */
export function safeAvatar(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)googleusercontent\.com$/.test(url.hostname) ? value.slice(0, 500) : '';
  } catch { return ''; }
}

export function publicProfile(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id, name: safeText(data.name, 60), avatar: safeAvatar(data.avatar), tagline: safeText(data.tagline, 140),
    bio: safeText(data.bio, 500), age: typeof data.age === 'number' ? data.age : undefined,
    preferredDrinks: Array.isArray(data.preferredDrinks) ? data.preferredDrinks.filter((x: unknown) => typeof x === 'string').slice(0, 8) : [],
    currentMood: safeText(data.currentMood, 40), paymentRule: safeText(data.paymentRule, 40),
    favoriteBars: Array.isArray(data.favoriteBars) ? data.favoriteBars.filter((x: unknown) => typeof x === 'string').slice(0, 20) : [],
    talkTopics: Array.isArray(data.talkTopics) ? data.talkTopics.filter((x: unknown) => typeof x === 'string').slice(0, 20) : [],
    // No locationName/geohash/lastSeenAt: arbitrary location labels can identify a home and presence enables tracking.
    ...(data.shareLocation === true && typeof data.lat === 'number' && typeof data.lng === 'number' ? { lat: coarse(data.lat), lng: coarse(data.lng) } : {}),
  };
}

export async function getPublicProfile(db: Firestore, uid: string, other: unknown) {
  if (typeof other !== 'string' || !other || other.length > 128 || other.includes('/')) throw new HttpsError('invalid-argument', 'Invalid profile id');
  const [profile, blockedByOther, blockedByMe, banned] = await db.getAll(db.doc(`users/${other}`), db.doc(`users/${other}/blocks/${uid}`), db.doc(`users/${uid}/blocks/${other}`), db.doc(`bannedUsers/${other}`));
  if (!profile.exists || blockedByOther.exists || blockedByMe.exists || banned.exists) return null;
  return publicProfile(other, profile.data()!);
}

export async function discoverPeople(db: Firestore, uid: string, lat: unknown, lng: unknown) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new HttpsError('invalid-argument', 'Invalid coordinates');
  const bounds = geohashQueryBounds([lat, lng], radiusKm * 1000);
  // Both directions of blocking come from two queries billed per block that exists, not three reads per candidate.
  // "Who blocked me" relies on the rules forcing blocks/{blockedId}.userId == blockedId (index in firestore.indexes.json).
  const [snaps, blockedMe, blockedByMe] = await Promise.all([
    Promise.all(bounds.map(([start, end]) => db.collection('users').orderBy('geohash').startAt(start).endAt(end).limit(100).get())),
    db.collectionGroup('blocks').where('userId', '==', uid).get(),
    db.collection(`users/${uid}/blocks`).get(),
  ]);
  const hidden = new Set([...blockedMe.docs.map((d) => d.ref.parent.parent?.id), ...blockedByMe.docs.map((d) => d.id)]);
  const candidates = new Map<string, { data: FirebaseFirestore.DocumentData; km: number }>();
  snaps.forEach((snap) => snap.forEach((doc) => {
    const d = doc.data();
    if (doc.id === uid || hidden.has(doc.id) || d.shareLocation !== true || typeof d.lat !== 'number' || typeof d.lng !== 'number') return;
    const km = distanceBetween([lat, lng], [d.lat, d.lng]);
    if (km <= radiusKm) candidates.set(doc.id, { data: d, km });
  }));
  const ids = [...candidates.keys()].sort((a, b) => candidates.get(a)!.km - candidates.get(b)!.km);
  // Bans before the result cap: nearest first, one `in` query per 30 people, stopping once 50 are left.
  const found: string[] = [];
  for (let i = 0; i < ids.length && found.length < maxPeople; i += inLimit) {
    const chunk = ids.slice(i, i + inLimit);
    const banned = new Set((await db.collection('bannedUsers').where(FieldPath.documentId(), 'in', chunk).get()).docs.map((d) => d.id));
    found.push(...chunk.filter((id) => !banned.has(id)));
  }
  // Never return raw public documents.
  return found.slice(0, maxPeople).map((id) => publicProfile(id, candidates.get(id)!.data));
}
