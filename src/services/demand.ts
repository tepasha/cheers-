import { useEffect, useSyncExternalStore } from 'react';

/**
 * What the screens and sheets on view need right now, so app-wide work runs only while something shows its result:
 *   people           the people nearby (discoverNearby): Discover, Map, Friends and the sheets that invite people
 *   feeds            live tables and meetups, when battery saver keeps them to the screens that show them
 *   preciseLocation  high-accuracy GPS: only a map needs more than ~100 m
 * A screen holds a demand while it is focused (hooks/useFocusDemand), a sheet while it is mounted.
 */
export type Demand = 'people' | 'feeds' | 'preciseLocation';

const counts = new Map<Demand, number>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Adds one holder of the demand; the returned function releases it (exactly once) */
export function holdDemand(demand: Demand): () => void {
  counts.set(demand, (counts.get(demand) ?? 0) + 1);
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    counts.set(demand, Math.max(0, (counts.get(demand) ?? 1) - 1));
    notify();
  };
}

export const isDemanded = (demand: Demand): boolean => (counts.get(demand) ?? 0) > 0;

/** True while at least one screen or sheet holds the demand */
export function useDemanded(demand: Demand): boolean {
  return useSyncExternalStore(subscribe, () => isDemanded(demand), () => isDemanded(demand));
}

/** Holds the demand while the component is mounted (and `active`) */
export function useMountDemand(demand: Demand, active = true): void {
  useEffect(() => (active ? holdDemand(demand) : undefined), [demand, active]);
}
