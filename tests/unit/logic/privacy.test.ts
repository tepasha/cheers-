import { describe, expect, it } from 'vitest';
import { coarseCoordinate } from '@/logic/privacy';

describe('coarseCoordinate', () => {
  it('rounds to a 0.02 degree grid; nearby movements do not change the published area', () => {
    expect(coarseCoordinate(50.45008)).toBe(50.46);
    expect(coarseCoordinate(50.45009)).toBe(50.46);
    expect(coarseCoordinate(50.47012)).toBe(50.48);
    expect(coarseCoordinate(50.45001)).toBe(coarseCoordinate(50.45004)); // a couple of metres: one published value
    expect(coarseCoordinate(50.45)).toBe(coarseCoordinate(50.4504));
  });

  it('never publishes more than the grid: no extra digits survive', () => {
    for (const n of [50.123456789, 30.987654321, -0.000123]) {
      const out = coarseCoordinate(n);
      expect(Math.abs(out * 50 - Math.round(out * 50))).toBeLessThan(1e-6);
    }
  });
});
