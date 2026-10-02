import { describe, expect, it } from 'vitest';
import { isSameItem, reuseUnchanged } from '@/utils/reuse';

interface Item {
  id: string;
  name: string;
  tags: string[];
  distanceKm?: number;
}
const item = (id: string, over: Partial<Item> = {}): Item => ({ id, name: `n${id}`, tags: ['a'], ...over });

describe('isSameItem', () => {
  it('compares nested values by content and honours the ignore list', () => {
    expect(isSameItem(item('1'), item('1'))).toBe(true);
    expect(isSameItem(item('1'), item('1', { tags: ['b'] }))).toBe(false);
    expect(isSameItem(item('1', { distanceKm: 1 }), item('1', { distanceKm: 2 }))).toBe(false);
    expect(isSameItem(item('1', { distanceKm: 1 }), item('1', { distanceKm: 2 }), ['distanceKm'])).toBe(true);
  });
});

describe('reuseUnchanged', () => {
  it('keeps the previous object for unchanged items and takes the new one for changed items', () => {
    const prev = [item('1'), item('2')];
    const next = [item('1'), item('2', { name: 'renamed' })];
    const out = reuseUnchanged(prev, next);
    expect(out[0]).toBe(prev[0]);
    expect(out[1]).toBe(next[1]);
  });

  it('returns the previous list itself when nothing changed', () => {
    const prev = [item('1'), item('2')];
    expect(reuseUnchanged(prev, [item('1'), item('2')])).toBe(prev);
  });

  it('follows the new order, additions and removals', () => {
    const prev = [item('1'), item('2')];
    const out = reuseUnchanged(prev, [item('3'), item('2')]);
    expect(out.map((i) => i.id)).toEqual(['3', '2']);
    expect(out[1]).toBe(prev[1]);
    expect(reuseUnchanged(prev, [item('2'), item('1')])).not.toBe(prev); // reordered: a new list, same objects
    expect(reuseUnchanged(prev, [item('2'), item('1')])[0]).toBe(prev[1]);
  });

  it('ignores fields that are recomputed elsewhere (distances)', () => {
    const prev = [item('1', { distanceKm: 1 })];
    expect(reuseUnchanged(prev, [item('1', { distanceKm: 9 })], ['distanceKm'])).toBe(prev);
  });
});
