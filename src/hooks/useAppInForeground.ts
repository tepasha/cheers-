import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * False while the app sits in the background. `inactive` (the iOS app switcher, a system dialog) still counts as the
 * foreground, so a glance at the control centre does not drop and rebuild the listeners that depend on this.
 */
export function useAppInForeground(): boolean {
  const [foreground, setForeground] = useState(() => AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state !== 'background'));
    return () => sub.remove();
  }, []);
  return foreground;
}
