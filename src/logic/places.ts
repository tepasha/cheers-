import { asNumber, asString, oneOf } from './cloudData';
import { distanceKmBetween, type GeoPoint } from './nearby';
import { ph } from '../services/i18nService';

/**
 * Bars, pubs and restaurants from Google Places for the map (callable nearbyVenues, functions/src/places.ts).
 * Decisions: kept in memory for the session only (Places content may not be cached), asked again when the map moves
 * far enough, and hidden where a curated venue already stands.
 */
export type PlaceKind = 'bar' | 'pub' | 'restaurant';

export interface PlaceVenue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  address: string;
  rating?: number;
  ratingCount?: number;
  openNow?: boolean;
  mapsUrl: string;
}

/** Pin hues free from the curated categories, people, tables and "you are here" (Android tints by hue only) */
export const PLACE_KIND_CONFIG: Record<PlaceKind, { label: string; icon: string; pinColor: string }> = {
  bar: { label: ph('Бар'), icon: '🍸', pinColor: '#06b6d4' },
  pub: { label: ph('Паб'), icon: '🍻', pinColor: '#d946ef' },
  restaurant: { label: ph('Ресторан'), icon: '🍽️', pinColor: '#ef4444' },
};

export const MIN_PLACES_RADIUS_M = 300;
export const MAX_PLACES_RADIUS_M = 2000;
/** Markers kept while the map is panned around; the oldest go first */
export const MAX_KEPT_PLACES = 200;
/** A curated venue within this distance stands for the same place */
const SAME_PLACE_M = 40;

export interface PlacesQuery extends GeoPoint {
  radiusM: number;
}

/** What the server sent, checked like any other cloud data; malformed entries are dropped */
export function readPlaceVenues(value: unknown): PlaceVenue[] {
  if (!Array.isArray(value)) return [];
  const out: PlaceVenue[] = [];
  for (const raw of value as Record<string, unknown>[]) {
    const lat = asNumber(raw?.lat);
    const lng = asNumber(raw?.lng);
    const id = asString(raw?.id);
    const name = asString(raw?.name);
    const mapsUrl = asString(raw?.mapsUrl);
    if (lat === undefined || lng === undefined || !id || !name || !mapsUrl.startsWith('https://')) continue;
    const rating = asNumber(raw.rating);
    const ratingCount = asNumber(raw.ratingCount);
    out.push({
      id,
      name,
      lat,
      lng,
      kind: oneOf(raw.kind, ['bar', 'pub', 'restaurant'] as const, 'bar'),
      address: asString(raw.address),
      ...(rating !== undefined ? { rating } : {}),
      ...(ratingCount !== undefined ? { ratingCount } : {}),
      ...(typeof raw.openNow === 'boolean' ? { openNow: raw.openNow } : {}),
      mapsUrl,
    });
  }
  return out;
}

/** The search circle for a visible map area: half its height, within 300 m–2 km */
export function placesQueryFor(region: { latitude: number; longitude: number; latitudeDelta: number }): PlacesQuery {
  const halfHeightM = (region.latitudeDelta * 111_320) / 2;
  return {
    lat: region.latitude,
    lng: region.longitude,
    radiusM: Math.round(Math.min(MAX_PLACES_RADIUS_M, Math.max(MIN_PLACES_RADIUS_M, halfHeightM))),
  };
}

/** Asked again only when the map moved over a third of the last circle or zoomed by half or more: every call is billed */
export function shouldRefetchPlaces(last: PlacesQuery | null, next: PlacesQuery): boolean {
  if (!last) return true;
  const movedM = distanceKmBetween(last, next) * 1000;
  const zoom = next.radiusM / last.radiusM;
  return movedM > last.radiusM / 3 || zoom >= 1.5 || zoom <= 2 / 3;
}

/** New results first, then what was already on the map, without repeats and capped */
export function mergePlaces(kept: PlaceVenue[], fresh: PlaceVenue[], max = MAX_KEPT_PLACES): PlaceVenue[] {
  const ids = new Set(fresh.map((p) => p.id));
  return [...fresh, ...kept.filter((p) => !ids.has(p.id))].slice(0, max);
}

/** Google places that a curated venue already marks (same spot) are left out so the pins do not stack */
export function withoutCurated(places: PlaceVenue[], curated: GeoPoint[]): PlaceVenue[] {
  return places.filter((p) => !curated.some((c) => distanceKmBetween(p, c) * 1000 < SAME_PLACE_M));
}
