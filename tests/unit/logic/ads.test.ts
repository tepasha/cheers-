import { describe, expect, it } from 'vitest';
import { isAdSlot, withAdSlots, type AdSlot } from '../../../src/logic/ads';

const cards = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}` }));
const layout = (items: ({ id: string } | AdSlot)[]) => items.map((x) => (isAdSlot(x) ? `ad${x.adSlot}` : x.id));

describe('withAdSlots', () => {
  it('puts a slot after every N cards', () => {
    expect(layout(withAdSlots(cards(11), 5))).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'ad1', 'c6', 'c7', 'c8', 'c9', 'c10', 'ad2', 'c11']);
  });

  it('adds nothing to a list shorter than the interval, or an empty one', () => {
    expect(layout(withAdSlots(cards(9), 10))).toEqual(cards(9).map((c) => c.id));
    expect(withAdSlots([], 5)).toEqual([]);
  });

  it('keeps slot numbers by position, so a changed list does not remount loaded banners', () => {
    const before = withAdSlots(cards(10), 10).filter(isAdSlot);
    const after = withAdSlots(cards(14).slice(3), 10).filter(isAdSlot);
    expect(before).toEqual([{ adSlot: 1 }]);
    expect(after).toEqual([{ adSlot: 1 }]);
  });
});
