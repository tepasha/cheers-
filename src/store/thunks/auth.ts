import type { User } from 'firebase/auth';
import type { AppThunk } from '../hooks';
import { loggedIn, loggedOut, profileUpdated, sessionTouched } from '../slices/authSlice';
import { authReady } from '../slices/uiSlice';
import { personalDataReset } from '../actions';
import { createUser, isSessionValid } from '../../logic/session';
import { authService } from '../../services/authService';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { analyticsService } from '../../services/analyticsService';
import { sounds } from '../../services/soundService';
import { releaseDevice } from './push';

/** Accounts created by earlier builds stored a DiceBear URL as their avatar; drop it so the name is no longer sent out */
const withoutHostedPlaceholder = (avatar: string) => (/(^|\/\/)api\.dicebear\.com\//.test(avatar) ? '' : avatar);

/**
 * Signs out of Firebase. The push device is removed first, while the account can still write: afterwards the
 * phone would keep showing this person's chat notifications to whoever holds it.
 */
export const endSession =
  (): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    if (getState().settings.push.deviceToken) await dispatch(releaseDevice());
    await authService.logout();
  };

/**
 * Firebase is the source of truth for who is signed in; Redux mirrors it. Called by the auth listener
 * on launch and on every sign-in/out. A null user means signed out.
 */
export const handleFirebaseUser =
  (fb: User | null): AppThunk =>
  (dispatch, getState) => {
    if (!fb) {
      if (getState().auth.user.isLoggedIn) dispatch(loggedOut());
      dispatch(authReady());
      return;
    }

    const { user: prev, dataOwnerId } = getState().auth;
    const sameUser = prev.id === fb.uid;

    // 36h inactivity policy: a returning session that sat unused too long must sign in again
    if (sameUser && prev.isLoggedIn && !isSessionValid(prev)) {
      void dispatch(endSession());
      return;
    }

    // A different person on the same device must not inherit the previous account's chats and friends
    if (dataOwnerId && dataOwnerId !== fb.uid) dispatch(personalDataReset());

    dispatch(
      loggedIn(
        createUser({
          id: fb.uid,
          email: fb.email ?? '',
          name: fb.displayName || (sameUser ? prev.name : ''),
          avatar: fb.photoURL || (sameUser && prev.provider === 'email' ? withoutHostedPlaceholder(prev.avatar) : ''),
          emailVerified: fb.emailVerified,
          birthDate: sameUser ? prev.birthDate : undefined,
          joinedAt: sameUser ? prev.joinedAt : undefined,
        })
      )
    );
    dispatch(authReady());

    // Birth date lives in the private profile; restore it on a fresh device
    if (!(sameUser && prev.birthDate)) {
      void firestoreSyncService.getPrivateProfile(fb.uid).then((p) => {
        if (p?.birthDate) dispatch(profileUpdated({ birthDate: p.birthDate }));
      });
    }

    analyticsService.setUser(fb.uid, { provider: 'email' });
  };

/** Extends the rolling session, or signs out for real (Firebase too) when it already expired */
export const touchSession = (): AppThunk => (dispatch, getState) => {
  const { user } = getState().auth;
  if (!user.isLoggedIn) return;
  if (!isSessionValid(user)) {
    void dispatch(endSession());
    return;
  }
  dispatch(sessionTouched(undefined));
};

export const enforceSessionExpiry = (): AppThunk => (dispatch, getState) => {
  const { user } = getState().auth;
  if (user.isLoggedIn && !isSessionValid(user)) void dispatch(endSession());
};

export const logout =
  (): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const userId = getState().auth.user.id;
    sounds.playClink();
    analyticsService.trackEvent('logout', { user_id: userId });
    analyticsService.setUser(null);
    // The listener resets Redux once Firebase confirms; do it now too so the UI does not wait on the network
    dispatch(loggedOut());
    try {
      await dispatch(endSession());
    } catch (err) {
      console.warn('Sign out failed:', err);
    }
  };

/** Re-checks the verification flag after the user followed the email link. Resolves true when verified. */
export const refreshEmailVerification =
  (): AppThunk<Promise<boolean>> =>
  async (dispatch) => {
    const verified = await authService.refreshVerification();
    if (verified) dispatch(profileUpdated({ emailVerified: true }));
    return verified;
  };

export const deleteAccount =
  (password: string): AppThunk<Promise<void>> =>
  async (dispatch) => {
    await authService.deleteAccount(password);
    analyticsService.trackEvent('account_deleted');
    dispatch(personalDataReset());
    dispatch(loggedOut());
  };
