import boundary from '../data/russiaBoundary.json';

/** Offline country polygons; never infer a border from the phone's chosen timezone. */
function inRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i];
    const [px, py] = ring[j];
    if ((y > lat) !== (py > lat) && lng < ((px - x) * (lat - y)) / (py - y) + x) inside = !inside;
  }
  return inside;
}

export function isRussianCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  for (const area of boundary.exclusions.geometries) {
    const polygons = area.type === 'Polygon' ? [area.coordinates as unknown as number[][][]] : area.coordinates as unknown as number[][][][];
    if (polygons.some((polygon) => inRing(lng, lat, polygon[0]) && !polygon.slice(1).some((hole) => inRing(lng, lat, hole)))) return false;
  }
  return boundary.geometry.coordinates.some((polygon) =>
    inRing(lng, lat, polygon[0]) && !polygon.slice(1).some((hole) => inRing(lng, lat, hole))
  );
}
