import { describe, expect, it, vi } from 'vitest';
import { FIELD_MASK, MAX_RADIUS_M, MIN_RADIUS_M, nearbyArea, placeKind, readPlaces, searchNearbyVenues } from '../../../functions/src/places';

const place = (over: Record<string, unknown> = {}) => ({
  id: 'ChIJabc',
  displayName: { text: 'Punkcraft Pub', languageCode: 'uk' },
  location: { latitude: 50.46, longitude: 30.52 },
  primaryType: 'pub',
  types: ['pub', 'bar', 'restaurant', 'food', 'point_of_interest'],
  shortFormattedAddress: 'вул. Ігорівська, 14а',
  googleMapsUri: 'https://maps.google.com/?cid=1',
  rating: 4.7,
  userRatingCount: 1980,
  currentOpeningHours: { openNow: true },
  ...over,
});

describe('nearbyArea', () => {
  it('requires a real point', () => {
    expect(() => nearbyArea({ lat: 'x', lng: 30 })).toThrow();
    expect(() => nearbyArea({ lat: 91, lng: 30 })).toThrow();
    expect(() => nearbyArea(null)).toThrow();
  });

  it('clamps the radius and falls back to Ukrainian for an unknown language', () => {
    expect(nearbyArea({ lat: 50, lng: 30, radiusM: 10, language: 'fr' })).toEqual({ lat: 50, lng: 30, radiusM: MIN_RADIUS_M, language: 'uk' });
    expect(nearbyArea({ lat: 50, lng: 30, radiusM: 50_000, language: 'de' }).radiusM).toBe(MAX_RADIUS_M);
    expect(nearbyArea({ lat: 50, lng: 30 }).radiusM).toBe(1000);
  });
});

describe('placeKind', () => {
  it('trusts the primary type first', () => {
    expect(placeKind('italian_restaurant', ['bar'])).toBe('restaurant');
    expect(placeKind('wine_bar', [])).toBe('bar');
  });

  it('otherwise prefers pub, then bar, then restaurant from the other types', () => {
    expect(placeKind('night_club', ['restaurant', 'bar', 'pub'])).toBe('pub');
    expect(placeKind(undefined, ['restaurant', 'bar'])).toBe('bar');
    expect(placeKind(undefined, ['cafe', 'restaurant'])).toBe('restaurant');
    expect(placeKind('cafe', ['cafe', 'store'])).toBeNull();
  });
});

describe('readPlaces', () => {
  it('keeps only what the map shows', () => {
    expect(readPlaces({ places: [place()] })).toEqual([
      {
        id: 'ChIJabc',
        name: 'Punkcraft Pub',
        lat: 50.46,
        lng: 30.52,
        kind: 'pub',
        address: 'вул. Ігорівська, 14а',
        rating: 4.7,
        ratingCount: 1980,
        openNow: true,
        mapsUrl: 'https://maps.google.com/?cid=1',
      },
    ]);
  });

  it('drops places without a name, a position or a matching type, and omits missing facts', () => {
    const out = readPlaces({
      places: [
        place({ displayName: undefined }),
        place({ location: { latitude: 'x' } }),
        place({ primaryType: 'cafe', types: ['cafe'] }),
        place({ id: 'ok', rating: undefined, userRatingCount: undefined, currentOpeningHours: undefined, googleMapsUri: 'javascript:alert(1)' }),
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).not.toHaveProperty('rating');
    expect(out[0]).not.toHaveProperty('openNow');
    expect(out[0].mapsUrl).toBe('https://www.google.com/maps/place/?q=place_id:ok');
  });

  it('reads an empty answer as no places', () => {
    expect(readPlaces({})).toEqual([]);
    expect(readPlaces(null)).toEqual([]);
  });
});

describe('searchNearbyVenues', () => {
  const area = { lat: 50.46, lng: 30.52, radiusM: 800, language: 'uk' };

  const answer = (places: unknown[], status = 200) => new Response(JSON.stringify({ places }), { status });
  const bodyOf = (call: unknown) => JSON.parse((call as [string, RequestInit])[1].body as string);

  it('asks for drinks and for restaurants separately in the circle, billed to the project', async () => {
    const fetchImpl = vi.fn(async () => answer([place()]));
    await searchNearbyVenues(fetchImpl as unknown as typeof fetch, 'token', 'proj', area);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchNearby');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token');
    expect(headers['X-Goog-User-Project']).toBe('proj');
    expect(headers['X-Goog-FieldMask']).toBe(FIELD_MASK);
    const [drinks, food] = fetchImpl.mock.calls.map(bodyOf);
    expect(drinks.includedTypes).toEqual(['bar', 'pub', 'wine_bar']);
    expect(food).toMatchObject({ includedTypes: ['restaurant'], excludedTypes: ['fast_food_restaurant', 'lodging'] });
    expect(drinks.languageCode).toBe('uk');
    expect(drinks.locationRestriction.circle).toEqual({ center: { latitude: 50.46, longitude: 30.52 }, radius: 800 });
  });

  it('lists bars first and a place found by both searches once', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) =>
      bodyOf([_url, init]).includedTypes.includes('bar')
        ? answer([place({ id: 'bar1' }), place({ id: 'both' })])
        : answer([place({ id: 'both', primaryType: 'restaurant' }), place({ id: 'food1', primaryType: 'restaurant' })])
    );
    const out = await searchNearbyVenues(fetchImpl as unknown as typeof fetch, 't', 'p', area);
    expect(out.map((p) => p.id)).toEqual(['bar1', 'both', 'food1']);
  });

  it('keeps the places of one search when the other fails, and fails only when both do', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const half = vi.fn(async (_url: string, init: RequestInit) =>
      bodyOf([_url, init]).includedTypes.includes('bar') ? answer([place()]) : new Response('denied', { status: 403 })
    );
    expect(await searchNearbyVenues(half as unknown as typeof fetch, 't', 'p', area)).toHaveLength(1);
    const none = vi.fn(async () => new Response('denied', { status: 403 }));
    await expect(searchNearbyVenues(none as unknown as typeof fetch, 't', 'p', area)).rejects.toMatchObject({ code: 'unavailable' });
    error.mockRestore();
  });
});
