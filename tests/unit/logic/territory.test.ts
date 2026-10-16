import { describe, expect, it } from 'vitest';
import boundary from '@/data/russiaBoundary.json';
import { isRussianCoordinate } from '@/logic/territory';
import { decodeRing } from '@/logic/polyline';
import { EXCLUDED, RUSSIA } from '@/data/russiaBoundaryEncoded';
import { buildModule, encodeRing } from '../../../scripts/encode-boundary.mjs';
import { readFileSync } from 'node:fs';

/** The check before the band index: every edge of every ring, on every call */
function inRingByWalk(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i];
    const [px, py] = ring[j];
    if ((y > lat) !== (py > lat) && lng < ((px - x) * (lat - y)) / (py - y) + x) inside = !inside;
  }
  return inside;
}

function isRussianByWalk(lat: number, lng: number): boolean {
  for (const area of boundary.exclusions.geometries) {
    const polygons = area.type === 'Polygon' ? [area.coordinates as unknown as number[][][]] : area.coordinates as unknown as number[][][][];
    if (polygons.some((polygon) => inRingByWalk(lng, lat, polygon[0]) && !polygon.slice(1).some((hole) => inRingByWalk(lng, lat, hole)))) return false;
  }
  return boundary.geometry.coordinates.some((polygon) =>
    inRingByWalk(lng, lat, polygon[0]) && !polygon.slice(1).some((hole) => inRingByWalk(lng, lat, hole))
  );
}

/** Border areas where a wrong answer would block a real user or let one through */
const AREAS: Array<{ name: string; lat: [number, number]; lng: [number, number] }> = [
  { name: 'Ukraine north-east / Belarus', lat: [49.5, 53], lng: [30, 41] },
  { name: 'Donbas and the Azov coast', lat: [46.5, 49.5], lng: [36, 41] },
  { name: 'Crimea and the Kerch strait', lat: [44.3, 46.3], lng: [32.4, 37.5] },
  { name: 'Kaliningrad, Poland, Lithuania', lat: [53.8, 55.6], lng: [19.4, 23] },
  { name: 'Georgia and the Caucasus', lat: [41, 44.5], lng: [39.5, 48] },
  { name: 'Chukotka across the antimeridian', lat: [64, 70], lng: [170, 180] },
];
const STEPS = 18;

describe('the band index of the border polygons', () => {
  it('answers exactly like walking every edge, across the border areas', () => {
    let checked = 0;
    for (const area of AREAS) {
      for (let i = 0; i <= STEPS; i++) {
        for (let j = 0; j <= STEPS; j++) {
          const lat = area.lat[0] + ((area.lat[1] - area.lat[0]) * i) / STEPS + 0.00037 * j;
          const lng = area.lng[0] + ((area.lng[1] - area.lng[0]) * j) / STEPS + 0.00041 * i;
          expect(isRussianCoordinate(lat, lng), `${area.name}: ${lat}, ${lng}`).toBe(isRussianByWalk(lat, lng));
          checked++;
        }
      }
    }
    expect(checked).toBe(AREAS.length * (STEPS + 1) ** 2);
  });

  it('gives the same answer when asked again (the index is built once)', () => {
    for (const [lat, lng] of [[50.45, 30.52], [55.75, 37.62], [44.95, 34.1], [54.71, 20.51]]) {
      expect(isRussianCoordinate(lat, lng)).toBe(isRussianCoordinate(lat, lng));
      expect(isRussianCoordinate(lat, lng)).toBe(isRussianByWalk(lat, lng));
    }
  });
});

describe('the border in the app bundle (data/russiaBoundaryEncoded.ts)', () => {
  const polygonsOf = (g: { type: string; coordinates: unknown }) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][];

  it('decodes to exactly the coordinates of the JSON source, ring by ring', () => {
    const decode = (polygons: string[][]) => polygons.map((p) => p.map((ring) => decodeRing(ring)));
    expect(decode(RUSSIA.polygons)).toEqual(polygonsOf(boundary.geometry));
    expect(decode(EXCLUDED.polygons)).toEqual(boundary.exclusions.geometries.flatMap((g) => polygonsOf(g)));
    expect(RUSSIA.source).toBe(boundary.source);
  });

  it('is up to date with the JSON (node scripts/encode-boundary.mjs regenerates it)', () => {
    // git may check the module out with CRLF (core.autocrlf)
    expect(readFileSync('src/data/russiaBoundaryEncoded.ts', 'utf8').replace(/\r\n/g, '\n')).toBe(buildModule(boundary));
  });

  it('refuses a coordinate it could not give back exactly', () => {
    expect(() => encodeRing([[30.1234567, 50]])).toThrow();
    expect(decodeRing(encodeRing([[-179.999999, -89.5], [179.999999, 89.5], [0, 0]]))).toEqual([[-179.999999, -89.5], [179.999999, 89.5], [0, 0]]);
  });
});
