import { describe, expect, it } from 'vitest';
import {
  INACTIVE_AFTER_MS,
  NEARBY_MAX_PROFILES,
  NEARBY_RADIUS_KM,
  ONLINE_WITHIN_MS,
  distanceKmBetween,
  isInactive,
  isOnline,
  nearbyQueryBounds,
  pickNearby,
  publicGeohash,
  snapToQueryGrid,
} from '@/logic/nearby';
import type { BuddyProfile } from '@/types';

const KYIV = { lat: 50.45, lng: 30.52 };
/** A point `km` due north of Kyiv */
const north = (km: number) => ({ lat: KYIV.lat + km / 111.19, lng: KYIV.lng });

const profile = (id: string, at: { lat: number; lng: number }): BuddyProfile =>
  ({ id, name: id, coordinates: at, distanceKm: 0, online: true } as unknown as BuddyProfile);

const inBounds = (hash: string, bounds: Array<[string, string]>) => bounds.some(([a, b]) => hash >= a && hash <= b);

describe('nearby query bounds', () => {
  it('cover everyone within the 3 km radius (checked around the whole circle)', () => {
    const bounds = nearbyQueryBounds(KYIV);
    for (let deg = 0; deg < 360; deg += 15) {
      for (const km of [0.1, 1, 2.5, 2.99]) {
        const rad = (deg * Math.PI) / 180;
        const at = { lat: KYIV.lat + (km * Math.cos(rad)) / 111.19, lng: KYIV.lng + (km * Math.sin(rad)) / (111.19 * Math.cos((KYIV.lat * Math.PI) / 180)) };
        expect(inBounds(publicGeohash(at.lat, at.lng), bounds), `${deg}° ${km} km`).toBe(true);
      }
    }
  });

  it('still cover the radius when the query is centred on the coarse grid, not on the real position', () => {
    const real = { lat: 50.4561, lng: 30.5247 };
    const centre = { lat: snapToQueryGrid(real.lat), lng: snapToQueryGrid(real.lng) };
    const bounds = nearbyQueryBounds(centre);
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const at = { lat: real.lat + (2.95 * Math.cos(rad)) / 111.19, lng: real.lng + (2.95 * Math.sin(rad)) / (111.19 * Math.cos((real.lat * Math.PI) / 180)) };
      expect(inBounds(publicGeohash(at.lat, at.lng), bounds), `${deg}°`).toBe(true);
    }
  });

  it('is a handful of ranges, not a scan', () => {
    expect(nearbyQueryBounds(KYIV).length).toBeLessThanOrEqual(9);
  });

  it('does not include far away places', () => {
    expect(inBounds(publicGeohash(49.84, 24.03), nearbyQueryBounds(KYIV))).toBe(false); // Lviv
  });
});

describe('pickNearby', () => {
  it('keeps profiles inside the radius, nearest first, with distances filled in', () => {
    const out = pickNearby([profile('far', north(2.5)), profile('near', north(0.3)), profile('mid', north(1))], KYIV);
    expect(out.map((p) => p.id)).toEqual(['near', 'mid', 'far']);
    expect(out[0].distanceKm).toBeCloseTo(0.3, 1);
  });

  it('drops people outside the radius', () => {
    expect(pickNearby([profile('out', north(NEARBY_RADIUS_KM + 2))], KYIV)).toEqual([]);
  });

  it('shows at most 50, and they are the nearest 50', () => {
    const many = Array.from({ length: 80 }, (_, i) => profile(`p${i}`, north(0.01 * (80 - i)))); // p79 is the nearest
    const out = pickNearby(many, KYIV);
    expect(out).toHaveLength(NEARBY_MAX_PROFILES);
    expect(out[0].id).toBe('p79');
    expect(out.map((p) => p.id)).not.toContain('p0');
  });

  it('does not mutate its input', () => {
    const input = [profile('a', north(1))];
    pickNearby(input, KYIV);
    expect(input[0].distanceKm).toBe(0);
  });
});

describe('presence', () => {
  const now = Date.UTC(2026, 9, 10, 12);
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('online within 15 minutes of the last visit', () => {
    expect(isOnline(ago(ONLINE_WITHIN_MS - 1000), now)).toBe(true);
    expect(isOnline(ago(ONLINE_WITHIN_MS + 1000), now)).toBe(false);
    expect(isOnline(undefined, now)).toBe(false);
  });

  it('inactive after a week away, and when nothing is known', () => {
    expect(isInactive(ago(INACTIVE_AFTER_MS - 1000), now)).toBe(false);
    expect(isInactive(ago(INACTIVE_AFTER_MS + 1000), now)).toBe(true);
    expect(isInactive(undefined, now)).toBe(true);
    expect(isInactive('garbage', now)).toBe(true);
  });
});

describe('geometry helpers', () => {
  it('snaps to a ~550 m grid and measures distances', () => {
    expect(snapToQueryGrid(50.4561)).toBeCloseTo(50.455, 6);
    expect(distanceKmBetween(KYIV, north(1))).toBeCloseTo(1, 1);
  });

  it('the stored geohash is fine enough to tell neighbouring 20 m cells apart from far places', () => {
    expect(publicGeohash(50.45, 30.52)).toHaveLength(9);
    expect(publicGeohash(50.45, 30.52).slice(0, 5)).toBe(publicGeohash(50.4502, 30.5202).slice(0, 5));
  });
});
