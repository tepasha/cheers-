/**
 * Decodes a ring written by scripts/encode-boundary.mjs: Google's polyline encoding of integer deltas, here in
 * millionths of a degree. Dividing the integer by the scale gives the very same number the JSON source had.
 */
export function decodeRing(encoded: string, scale = 1e6): number[][] {
  const ring: number[][] = [];
  let i = 0;
  const next = (): number => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  let x = 0;
  let y = 0;
  while (i < encoded.length) {
    x += next();
    y += next();
    ring.push([x / scale, y / scale]);
  }
  return ring;
}
