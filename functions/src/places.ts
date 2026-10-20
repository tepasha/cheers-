import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Bars, pubs and restaurants around a point, from Places API (New) Nearby Search. Nothing is stored: the Google Maps
 * Platform terms allow no caching of Places content except place ids, so every map area is asked afresh (the caller
 * rate-limits it).
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

export interface NearbyArea {
  lat: number;
  lng: number;
  radiusM: number;
  language: string;
}

export const MIN_RADIUS_M = 100;
export const MAX_RADIUS_M = 2000;
/** One page of Nearby Search; the API returns at most 20 */
const MAX_RESULTS = 20;
const LANGUAGES = new Set(['uk', 'en', 'pl', 'de']);
/**
 * Two searches per area: asked together, popular restaurants filled 19 of the 20 places and left one bar (Podil,
 * 2026-10-20). Restaurants leave out fast food and hotels.
 */
export const SEARCHES = [
  { includedTypes: ['bar', 'pub', 'wine_bar'] },
  { includedTypes: ['restaurant'], excludedTypes: ['fast_food_restaurant', 'lodging'] },
];
/**
 * Only what the map card shows. Rating, review count and opening hours put the request in the Enterprise SKU; the
 * rest alone would be Pro.
 */
export const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.primaryType',
  'places.types',
  'places.shortFormattedAddress',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.currentOpeningHours.openNow',
].join(',');

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The callable's input, validated: a point, a radius clamped to 100 m–2 km and one of the app languages */
export function nearbyArea(input: unknown): NearbyArea {
  const data = (input ?? {}) as { lat?: unknown; lng?: unknown; radiusM?: unknown; language?: unknown };
  if (!finite(data.lat) || !finite(data.lng) || Math.abs(data.lat) > 90 || Math.abs(data.lng) > 180) {
    throw new HttpsError('invalid-argument', 'lat and lng are required');
  }
  const radius = finite(data.radiusM) ? data.radiusM : 1000;
  return {
    lat: data.lat,
    lng: data.lng,
    radiusM: Math.round(Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, radius))),
    language: typeof data.language === 'string' && LANGUAGES.has(data.language) ? data.language : 'uk',
  };
}

/** Pub before bar before restaurant, judged by the primary type first: a restaurant that also pours stays a restaurant */
export function placeKind(primaryType: unknown, types: unknown): PlaceKind | null {
  const of = (t: unknown): PlaceKind | null =>
    t === 'pub' ? 'pub' : t === 'bar' || t === 'wine_bar' ? 'bar' : typeof t === 'string' && t.endsWith('restaurant') ? 'restaurant' : null;
  const primary = of(primaryType);
  if (primary) return primary;
  const all = Array.isArray(types) ? types.map(of).filter((k): k is PlaceKind => k !== null) : [];
  return all.find((k) => k === 'pub') ?? all.find((k) => k === 'bar') ?? all[0] ?? null;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Google's response, reduced to what the app shows; places without a name, position or a matching type are dropped */
export function readPlaces(body: unknown): PlaceVenue[] {
  const places = (body as { places?: unknown } | null)?.places;
  if (!Array.isArray(places)) return [];
  const out: PlaceVenue[] = [];
  for (const p of places as Record<string, any>[]) {
    const id = text(p?.id, 200);
    const name = text(p?.displayName?.text, 120);
    const lat = p?.location?.latitude;
    const lng = p?.location?.longitude;
    const kind = placeKind(p?.primaryType, p?.types);
    if (!id || !name || !finite(lat) || !finite(lng) || !kind) continue;
    const mapsUrl = text(p.googleMapsUri, 500);
    out.push({
      id,
      name,
      lat,
      lng,
      kind,
      address: text(p.shortFormattedAddress, 200),
      ...(finite(p.rating) ? { rating: p.rating } : {}),
      ...(finite(p.userRatingCount) ? { ratingCount: p.userRatingCount } : {}),
      ...(typeof p.currentOpeningHours?.openNow === 'boolean' ? { openNow: p.currentOpeningHours.openNow } : {}),
      mapsUrl: mapsUrl.startsWith('https://') ? mapsUrl : `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(id)}`,
    });
  }
  return out;
}

/**
 * The Nearby Searches for an area, authorised as the function's service account (OAuth, billed to `project`), so no
 * API key has to be stored anywhere. Bars come first; a place found by both searches appears once. One failed search
 * still returns the other's places.
 */
export async function searchNearbyVenues(
  fetchImpl: typeof fetch,
  accessToken: string,
  project: string,
  area: NearbyArea
): Promise<PlaceVenue[]> {
  const search = async (types: (typeof SEARCHES)[number]) => {
    const response = await fetchImpl('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Goog-User-Project': project,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        ...types,
        maxResultCount: MAX_RESULTS,
        rankPreference: 'POPULARITY',
        languageCode: area.language,
        locationRestriction: { circle: { center: { latitude: area.lat, longitude: area.lng }, radius: area.radiusM } },
      }),
    });
    if (!response.ok) throw new Error(`searchNearby ${response.status}: ${(await response.text()).slice(0, 500)}`);
    return readPlaces(await response.json());
  };
  const results = await Promise.allSettled(SEARCHES.map(search));
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  failed.forEach((r) => console.error('places search failed', String(r.reason)));
  if (failed.length === results.length) throw new HttpsError('unavailable', 'Places are unavailable right now');
  const byId = new Map<string, PlaceVenue>();
  for (const r of results) if (r.status === 'fulfilled') for (const p of r.value) if (!byId.has(p.id)) byId.set(p.id, p);
  return [...byId.values()];
}
