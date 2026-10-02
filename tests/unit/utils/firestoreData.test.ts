import { describe, it, expect } from 'vitest';
import { omitUndefined } from '@/utils/firestoreData';

describe('omitUndefined', () => {
  it('drops undefined at any depth, keeps null/0/false/empty', () => {
    expect(omitUndefined({ a: 1, b: undefined, c: null, d: 0, e: false, f: '', g: { h: undefined, i: 2 }, j: [{ k: undefined, l: 1 }] })).toEqual({
      a: 1,
      c: null,
      d: 0,
      e: false,
      f: '',
      g: { i: 2 },
      j: [{ l: 1 }],
    });
  });

  it('leaves non-plain objects (dates, special values) untouched', () => {
    const d = new Date();
    expect(omitUndefined({ d }).d).toBe(d);
  });

  it('does not mutate its input', () => {
    const input = { a: undefined, b: { c: undefined } };
    omitUndefined(input);
    expect(Object.keys(input)).toEqual(['a', 'b']);
  });
});
