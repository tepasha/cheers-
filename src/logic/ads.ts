/** Where in-list ads go: a slot after every N cards. Kept sparse so ads never crowd out what people came for. */
export const HANGOUTS_AD_EVERY = 10;
export const MEETUPS_AD_EVERY = 5;

/** A place for an ad inside a list; `adSlot` counts from 1 and doubles as a stable React key */
export interface AdSlot {
  adSlot: number;
}

export const isAdSlot = <T extends object>(item: T | AdSlot): item is AdSlot => 'adSlot' in item;

/**
 * Inserts an ad slot after every `every` items (after the 10th, the 20th, …). A list shorter than `every` gets
 * none, so a quiet evening with three tables shows no ad among them. Slots are numbered by position, not by the
 * items around them: when the list changes, slot 1 keeps its key and its loaded banner instead of reloading.
 */
export function withAdSlots<T extends object>(items: readonly T[], every: number): (T | AdSlot)[] {
  const out: (T | AdSlot)[] = [];
  items.forEach((item, i) => {
    out.push(item);
    if ((i + 1) % every === 0) out.push({ adSlot: (i + 1) / every });
  });
  return out;
}
