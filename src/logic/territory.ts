import { EXCLUDED, RUSSIA } from '../data/russiaBoundaryEncoded';
import { decodeRing } from './polyline';

/**
 * A horizontal ray at latitude `lat` can only be crossed by edges whose latitude range reaches it, so each ring keeps its
 * edges bucketed into bands of this many degrees. The test is the same even-odd rule over the same edges; it just no
 * longer walks all ~37 000 border vertices on every position update.
 */
const BAND_DEGREES = 0.25;
const bandOf = (lat: number) => Math.floor(lat / BAND_DEGREES);

interface RingIndex {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  /** Per band from bandOf(minLat), the edges reaching into it as flat [x, y, prevX, prevY, …]; built on first use */
  bands?: number[][];
}

const indexes = new WeakMap<number[][], RingIndex>();

function ringIndex(ring: number[][]): RingIndex {
  let index = indexes.get(ring);
  if (!index) {
    index = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };
    for (let i = 0; i < ring.length; i++) {
      const x = ring[i][0], y = ring[i][1];
      if (y < index.minLat) index.minLat = y;
      if (y > index.maxLat) index.maxLat = y;
      if (x < index.minLng) index.minLng = x;
      if (x > index.maxLng) index.maxLng = x;
    }
    indexes.set(ring, index);
  }
  return index;
}

function edgesNear(ring: number[][], index: RingIndex, lat: number): number[] {
  const first = bandOf(index.minLat);
  if (!index.bands) {
    const bands: number[][] = Array.from({ length: bandOf(index.maxLat) - first + 1 }, () => []);
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const x = ring[i][0], y = ring[i][1], px = ring[j][0], py = ring[j][1];
      for (let b = bandOf(Math.min(y, py)); b <= bandOf(Math.max(y, py)); b++) bands[b - first].push(x, y, px, py);
    }
    index.bands = bands;
  }
  return index.bands[bandOf(lat) - first];
}

/** Offline country polygons; never infer a border from the phone's chosen timezone. */
function inRing(lng: number, lat: number, ring: number[][]): boolean {
  const index = ringIndex(ring);
  // Outside the bounding box no edge can toggle the result (or, west of it, every crossing toggles it an even number of times)
  if (lat < index.minLat || lat > index.maxLat || lng < index.minLng || lng > index.maxLng) return false;
  const edges = edgesNear(ring, index, lat);
  let inside = false;
  for (let k = 0; k < edges.length; k += 4) {
    const x = edges[k], y = edges[k + 1], px = edges[k + 2], py = edges[k + 3];
    if ((y > lat) !== (py > lat) && lng < ((px - x) * (lat - y)) / (py - y) + x) inside = !inside;
  }
  return inside;
}

type Polygon = number[][][];
let decoded: { russia: Polygon[]; excluded: Polygon[] } | null = null;

/** The border, decoded on the first check rather than at startup (data/russiaBoundaryEncoded.ts) */
function borders() {
  if (!decoded) decoded = { russia: RUSSIA.polygons.map((p) => p.map((ring) => decodeRing(ring))), excluded: EXCLUDED.polygons.map((p) => p.map((ring) => decodeRing(ring))) };
  return decoded;
}

const inPolygon = (lng: number, lat: number, polygon: Polygon) => inRing(lng, lat, polygon[0]) && !polygon.slice(1).some((hole) => inRing(lng, lat, hole));

export function isRussianCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  const { russia, excluded } = borders();
  if (excluded.some((polygon) => inPolygon(lng, lat, polygon))) return false;
  return russia.some((polygon) => inPolygon(lng, lat, polygon));
}
