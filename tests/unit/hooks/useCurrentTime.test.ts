import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCurrentTime } from '@/hooks/useCurrentTime';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let mounted: ReactTestRenderer;
afterEach(() => {
  if (mounted) act(() => mounted.unmount());
  vi.useRealTimers();
});

describe('scheduling form clock', () => {
  it('updates across midnight and cleans up the timer when the form closes', () => {
    vi.useFakeTimers();
    const start = new Date(2026, 9, 8, 23, 59, 45).getTime();
    vi.setSystemTime(start);
    let now = 0;
    const Harness = () => { now = useCurrentTime(); return null; };
    act(() => { mounted = create(createElement(Harness)); });
    expect(now).toBe(start);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(new Date(now).getDate()).toBe(9);
    expect(now).toBe(start + 30_000);
    act(() => mounted.unmount());
    expect(vi.getTimerCount()).toBe(0);
  });
});
