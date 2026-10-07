import type { RootState } from './index';

/** An identity plus a session generation: logout/login of the same uid also invalidates work. */
export function captureSession(getState: () => RootState) {
  const state = getState();
  const uid = state.auth.user.id;
  const generation = state.ui.sessionGeneration;
  return () => {
    const current = getState();
    return current.auth.user.isLoggedIn && current.auth.user.id === uid && current.ui.sessionGeneration === generation;
  };
}
