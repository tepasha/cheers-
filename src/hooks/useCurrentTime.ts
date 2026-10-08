import { useEffect, useState } from 'react';

/** Keeps scheduling forms current while they stay open, including across midnight. */
export function useCurrentTime(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
