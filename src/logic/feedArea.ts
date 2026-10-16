import { geohashForLocation } from 'geofire-common';
import type { GeoPoint } from './nearby';

/**
 * Tables and meetups are listened to by area, not country-wide. Each document carries `geo`: the 4-character geohash
 * of its place, a cell of about 20 × 25 km in Ukraine. A client listens to the cell it is in and the eight around it,
 * so everything within at least one cell (~20 km) arrives and nothing from other cities does.
 * functions/src/feedArea.ts computes the same cell for documents written by older builds (a test keeps them equal).
 */
export const FEED_CELL_PRECISION = 4;
/** Size of a cell at that precision: 10 bits of longitude and 10 of latitude */
const CELL_LAT = 180 / 1024;
const CELL_LNG = 360 / 1024;
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

const clampLat = (lat: number) => Math.max(-89.999, Math.min(89.999, lat));
const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

export const feedCell = (lat: number, lng: number): string => geohashForLocation([clampLat(lat), wrapLng(lng)], FEED_CELL_PRECISION);

/** The cell a document belongs to, or undefined when it has no coordinates */
export const feedCellOf = (lat: unknown, lng: unknown): string | undefined =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) ? feedCell(lat, lng) : undefined;

export function cellCenter(cell: string): GeoPoint {
  const lat = [-90, 90];
  const lng = [-180, 180];
  let isLng = true;
  for (const ch of cell) {
    const n = BASE32.indexOf(ch);
    for (let bit = 4; bit >= 0; bit--) {
      const range = isLng ? lng : lat;
      const mid = (range[0] + range[1]) / 2;
      if ((n >> bit) & 1) range[0] = mid;
      else range[1] = mid;
      isLng = !isLng;
    }
  }
  return { lat: (lat[0] + lat[1]) / 2, lng: (lng[0] + lng[1]) / 2 };
}

/** The cell and its eight neighbours: what a client listens to (at most 9 values, within the 30 of an `in` filter) */
export function feedCells(cell: string): string[] {
  const c = cellCenter(cell);
  const cells = new Set<string>();
  for (const dLat of [-1, 0, 1]) for (const dLng of [-1, 0, 1]) cells.add(feedCell(c.lat + dLat * CELL_LAT, c.lng + dLng * CELL_LNG));
  return [...cells];
}

/**
 * The cell to listen around, given the one listened to so far. Leaving it switches only half a cell past its edge
 * (~10 km), so GPS jitter on a cell boundary does not tear the listeners down and back up.
 */
export function nextFeedCell(previous: string | null, at: GeoPoint): string {
  const here = feedCell(at.lat, at.lng);
  if (!previous || previous === here) return here;
  const c = cellCenter(previous);
  return Math.abs(at.lat - c.lat) < CELL_LAT && Math.abs(wrapLng(at.lng - c.lng)) < CELL_LNG ? previous : here;
}
