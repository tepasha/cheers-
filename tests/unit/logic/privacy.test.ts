import { describe, expect, it } from 'vitest';
import { coarseCoordinate } from '@/logic/privacy';

describe('coarseCoordinate', () => {
  it('rounds to a 0.0002 degree grid (about 20 m), so tiny movements do not change what is published', () => {
    expect(coarseCoordinate(50.45008)).toBe(50.45);
    expect(coarseCoordinate(50.45009)).toBe(50.45);
    expect(coarseCoordinate(50.45012)).toBe(50.4502);
    expect(coarseCoordinate(50.45001)).toBe(coarseCoordinate(50.45004)); // a couple of metres: one published value
    expect(coarseCoordinate(50.45)).not.toBe(coarseCoordinate(50.4504)); // ~45 m: a different value
  });

  it('never publishes more than the grid: no extra digits survive', () => {
    for (const n of [50.123456789, 30.987654321, -0.000123]) {
      const out = coarseCoordinate(n);
      expect(Math.abs(out * 5000 - Math.round(out * 5000))).toBeLessThan(1e-6);
    }
  });
});
