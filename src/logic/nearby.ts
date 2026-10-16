import { distanceBetween, geohashForLocation, geohashQueryBounds } from 'geofire-common';
import type { BuddyProfile } from '../types';

/**
 * "People nearby": what the discovery list asks Firestore for. Decisions:
 *   radius 3 km, at most 50 profiles, people without a location are not shown.
 *   No presence is recorded (2026-10-16): nobody is shown as online or inactive.
 */
export const NEARBY_RADIUS_KM = 3;
export const NEARBY_MAX_PROFILES = 50;

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
