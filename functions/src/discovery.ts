import type { Firestore } from 'firebase-admin/firestore';
import { distanceBetween, geohashQueryBounds } from 'geofire-common';
import { HttpsError } from 'firebase-functions/v2/https';

const radiusKm = 3;
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
  const snaps = await Promise.all(bounds.map(([start, end]) => db.collection('users').orderBy('geohash').startAt(start).endAt(end).limit(100).get()));
  const candidates = new Map<string, FirebaseFirestore.DocumentData>();
  snaps.forEach((snap) => snap.forEach((doc) => {
    const d = doc.data();
    if (doc.id !== uid && d.shareLocation === true && typeof d.lat === 'number' && typeof d.lng === 'number' && distanceBetween([lat, lng], [d.lat, d.lng]) <= radiusKm) candidates.set(doc.id, d);
  }));
  const ids = [...candidates.keys()];
  if (!ids.length) return [];
  // Apply both directions of blocking before the result cap, and never return raw public documents.
  const blocks = await db.getAll(...ids.flatMap((id) => [db.doc(`users/${id}/blocks/${uid}`), db.doc(`users/${uid}/blocks/${id}`), db.doc(`bannedUsers/${id}`)]));
  return ids.filter((_, i) => !blocks[3 * i].exists && !blocks[3 * i + 1].exists && !blocks[3 * i + 2].exists)
    .sort((a, b) => distanceBetween([lat, lng], [candidates.get(a)!.lat, candidates.get(a)!.lng]) - distanceBetween([lat, lng], [candidates.get(b)!.lat, candidates.get(b)!.lng]))
    .slice(0, 50).map((id) => publicProfile(id, candidates.get(id)!));
}
