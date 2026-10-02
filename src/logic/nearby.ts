import { distanceBetween, geohashForLocation, geohashQueryBounds } from 'geofire-common';
import type { BuddyProfile } from '../types';

/**
 * "People nearby": what the discovery list asks Firestore for. Decisions:
 *   radius 3 km, at most 50 profiles, people without a location are not shown,
 *   people who have not opened the app for a week are shown but marked "inactive".
 */
export const NEARBY_RADIUS_KM = 3;
export const NEARBY_MAX_PROFILES = 50;
export const INACTIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const ONLINE_WITHIN_MS = 15 * 60 * 1000;
/** How often an open app tells Firestore it is still here (one small write per 10 minutes) */
export const PRESENCE_INTERVAL_MS = 10 * 60 * 1000;

/** Geohash precision stored on the public profile: 9 characters is a cell of a few metres, finer than the 20 m grid */
const GEOHASH_LENGTH = 9;
/** Each range query returns at most this many profiles; the 50 nearest are picked from the merged result */
export const PER_RANGE_LIMIT = 100;

/**
 * The query is centred on a coarse grid (about 550 m) so walking does not re-subscribe on every step; the search
 * circle is widened by this much so people just inside 3 km of the real position are still fetched.
 */
export const QUERY_GRID_DEGREES = 0.005;
const QUERY_MARGIN_KM = 0.7;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export const snapToQueryGrid = (n: number): number => Math.round(n / QUERY_GRID_DEGREES) * QUERY_GRID_DEGREES;

/** The geohash written to a public profile (always derived from the already coarsened coordinates) */
export const publicGeohash = (lat: number, lng: number): string => geohashForLocation([lat, lng], GEOHASH_LENGTH);

/** `[start, end]` geohash ranges covering the search circle around `center` */
export const nearbyQueryBounds = (center: GeoPoint): Array<[string, string]> =>
  geohashQueryBounds([center.lat, center.lng], (NEARBY_RADIUS_KM + QUERY_MARGIN_KM) * 1000) as Array<[string, string]>;

export const distanceKmBetween = (a: GeoPoint, b: GeoPoint): number => distanceBetween([a.lat, a.lng], [b.lat, b.lng]);

/** Profiles inside the radius, nearest first, capped. People without coordinates never get here. */
export function pickNearby(profiles: BuddyProfile[], center: GeoPoint): BuddyProfile[] {
  return profiles
    .map((p) => ({ p, km: distanceKmBetween(center, p.coordinates) }))
    .filter(({ km }) => km <= NEARBY_RADIUS_KM + QUERY_MARGIN_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, NEARBY_MAX_PROFILES)
    .map(({ p, km }) => ({ ...p, distanceKm: km }));
}

const seenAt = (lastSeenAt: string | undefined): number | null => {
  const t = lastSeenAt ? Date.parse(lastSeenAt) : NaN;
  return Number.isFinite(t) ? t : null;
};

/** A profile with no recorded visit (older builds) is treated as inactive rather than as present */
export const isInactive = (lastSeenAt: string | undefined, now: number): boolean => {
  const t = seenAt(lastSeenAt);
  return t === null || now - t > INACTIVE_AFTER_MS;
};

export const isOnline = (lastSeenAt: string | undefined, now: number): boolean => {
  const t = seenAt(lastSeenAt);
  return t !== null && now - t <= ONLINE_WITHIN_MS;
};
