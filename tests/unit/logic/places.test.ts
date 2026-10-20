import { describe, expect, it } from 'vitest';
import {
  MAX_PLACES_RADIUS_M,
  MIN_PLACES_RADIUS_M,
  mergePlaces,
  placesQueryFor,
  readPlaceVenues,
  shouldRefetchPlaces,
  withoutCurated,
  type PlaceVenue,
} from '@/logic/places';

const venue = (id: string, over: Partial<PlaceVenue> = {}): PlaceVenue => ({
  id,
  name: id,
  lat: 50.46,
  lng: 30.52,
  kind: 'bar',
  address: '',
  mapsUrl: 'https://maps.google.com/?cid=1',
  ...over,
});

describe('readPlaceVenues', () => {
  it('keeps well-formed places and drops the rest', () => {
    const out = readPlaceVenues([
      { id: 'a', name: 'A', lat: 1, lng: 2, kind: 'pub', address: 'x', rating: 4.5, openNow: false, mapsUrl: 'https://m/a' },
      { id: 'b', name: 'B', lat: 'x', lng: 2, mapsUrl: 'https://m/b' },
      { id: 'c', name: 'C', lat: 1, lng: 2, mapsUrl: 'javascript:alert(1)' },
      { id: 'd', name: 'D', lat: 1, lng: 2, kind: 'casino', mapsUrl: 'https://m/d' },
    ]);
    expect(out.map((p) => p.id)).toEqual(['a', 'd']);
    expect(out[0]).toMatchObject({ kind: 'pub', rating: 4.5, openNow: false });
    expect(out[1].kind).toBe('bar');
    expect(readPlaceVenues(null)).toEqual([]);
  });
});

describe('placesQueryFor', () => {
  it('searches half the visible height, within the limits', () => {
    expect(placesQueryFor({ latitude: 50, longitude: 30, latitudeDelta: 0.03 }).radiusM).toBe(1670);
    expect(placesQueryFor({ latitude: 50, longitude: 30, latitudeDelta: 0.001 }).radiusM).toBe(MIN_PLACES_RADIUS_M);
    expect(placesQueryFor({ latitude: 50, longitude: 30, latitudeDelta: 1 }).radiusM).toBe(MAX_PLACES_RADIUS_M);
  });
});

describe('shouldRefetchPlaces', () => {
  const last = { lat: 50.46, lng: 30.52, radiusM: 900 };

  it('asks the first time', () => {
    expect(shouldRefetchPlaces(null, last)).toBe(true);
  });

  it('ignores small pans and zooms', () => {
    expect(shouldRefetchPlaces(last, { ...last, lat: 50.4615 })).toBe(false); // ~170 m
    expect(shouldRefetchPlaces(last, { ...last, radiusM: 1100 })).toBe(false);
  });

  it('asks again after moving over a third of the circle or zooming by half', () => {
    expect(shouldRefetchPlaces(last, { ...last, lat: 50.4635 })).toBe(true); // ~390 m
    expect(shouldRefetchPlaces(last, { ...last, radiusM: 1350 })).toBe(true);
    expect(shouldRefetchPlaces(last, { ...last, radiusM: 600 })).toBe(true);
  });
});

describe('mergePlaces', () => {
  it('puts fresh results first, without repeats, capped', () => {
    const merged = mergePlaces([venue('a'), venue('b')], [venue('b', { name: 'B2' }), venue('c')], 3);
    expect(merged.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(merged[0].name).toBe('B2');
    expect(mergePlaces([venue('a'), venue('b')], [venue('c'), venue('d')], 3).map((p) => p.id)).toEqual(['c', 'd', 'a']);
  });
});

describe('withoutCurated', () => {
  it('hides a Google place standing where a curated venue is', () => {
    const curated = [{ lat: 50.46, lng: 30.52 }];
    const same = venue('same', { lat: 50.4602, lng: 30.5201 }); // ~25 m
    const other = venue('other', { lat: 50.462, lng: 30.52 }); // ~220 m
    expect(withoutCurated([same, other], curated).map((p) => p.id)).toEqual(['other']);
  });
});
