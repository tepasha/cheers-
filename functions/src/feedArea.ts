import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';
import { geohashForLocation } from 'geofire-common';

/**
 * Server copy of src/logic/feedArea.ts (a test keeps them equal). Clients listen to tables and meetups by `geo`, the
 * 4-character geohash of the place; builds before 2026-10-16 do not write it, so the server fills it in.
 */
export const FEED_CELL_PRECISION = 4;

const clampLat = (lat: number) => Math.max(-89.999, Math.min(89.999, lat));
const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

export const feedCellOf = (lat: unknown, lng: unknown): string | undefined =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    ? geohashForLocation([clampLat(lat), wrapLng(lng)], FEED_CELL_PRECISION)
    : undefined;

/** The cell to add to a document without one, or null (it has one, or no coordinates to place it by) */
export function missingFeedCell(data: DocumentData | undefined): string | null {
  if (!data || typeof data.geo === 'string') return null;
  return feedCellOf(data.lat, data.lng) ?? null;
}

/** Adds the cell where it is missing. A document deleted in the meantime (a table closed at once) is left alone. */
export async function tagFeedCell(ref: DocumentReference, data: DocumentData | undefined): Promise<boolean> {
  const geo = missingFeedCell(data);
  if (!geo) return false;
  try {
    await ref.update({ geo });
    return true;
  } catch (error) {
    if ((error as { code?: unknown }).code === 5) return false; // NOT_FOUND
    throw error;
  }
}

/**
 * One pass after the deploy that introduced `geo`: live tables and meetups written before it get their cell. A marker
 * document makes every later run a single read.
 */
export async function backfillFeedCells(db: Firestore, now: number): Promise<{ hangouts: number; meetups: number } | null> {
  const marker = db.doc('internalJobs/feedCellsBackfill');
  if ((await marker.get()).exists) return null;
  const tagAll = async (collection: string, field: string) => {
    const snap = await db.collection(collection).where(field, '>', now).get();
    const tagged = await Promise.all(snap.docs.map((d) => tagFeedCell(d.ref, d.data())));
    return tagged.filter(Boolean).length;
  };
  const result = { hangouts: await tagAll('hangouts', 'expiresAt'), meetups: await tagAll('group_meetups', 'endsAt') };
  await marker.set({ doneAt: now, ...result });
  return result;
}
