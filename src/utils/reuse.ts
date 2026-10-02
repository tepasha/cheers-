/**
 * Firestore snapshots rebuild every item as a new object, even when only one document changed. Keeping the previous
 * object for unchanged items preserves identity, so memoized selectors and React.memo rows skip the work.
 */
const sameValue = (a: unknown, b: unknown): boolean =>
  a === b || (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b));

export function isSameItem<T extends object>(a: T, b: T, ignore: readonly string[] = []): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => !ignore.includes(k)));
  for (const key of keys) {
    if (!sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

/**
 * `next`, with every item that equals its counterpart in `prev` (matched by id) replaced by that counterpart.
 * Returns `prev` itself when nothing changed at all, so even the list keeps its identity.
 */
export function reuseUnchanged<T extends { id: string }>(prev: readonly T[], next: readonly T[], ignore: readonly string[] = []): readonly T[] {
  const before = new Map(prev.map((item) => [item.id, item]));
  const merged = next.map((item) => {
    const old = before.get(item.id);
    return old && isSameItem(old, item, ignore) ? old : item;
  });
  return merged.length === prev.length && merged.every((item, i) => item === prev[i]) ? prev : merged;
}
