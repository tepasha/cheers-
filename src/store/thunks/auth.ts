import type { User } from 'firebase/auth';
import type { AppThunk } from '../hooks';
import { birthDateLookedUp, loggedIn, loggedOut, profileUpdated, sessionTouched } from '../slices/authSlice';
import { authNoticeSet, authReady } from '../slices/uiSlice';
import { personalDataReset } from '../actions';
import { checkAge, createUser, isSessionValid } from '../../logic/session';
import { authService } from '../../services/authService';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { analyticsService } from '../../services/analyticsService';
import { sounds } from '../../services/soundService';
import { releaseDevice } from './push';

const providerOf = (fb: User): 'google' | 'email' => (fb.providerData?.some((p) => p.providerId === 'google.com') ? 'google' : 'email');

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
          // A Google account brings its own profile picture
          avatar: fb.photoURL || (sameUser && prev.provider === 'email' ? withoutHostedPlaceholder(prev.avatar) : ''),
          emailVerified: fb.emailVerified,
          provider: providerOf(fb),
          birthDate: sameUser ? prev.birthDate : undefined,
          joinedAt: sameUser ? prev.joinedAt : undefined,
        })
      )
    );
    dispatch(authReady());

    // Birth date lives in the private profile; restore it on a fresh device. Whoever has none yet (a first Google
    // sign-in) is asked for it before anything else, and everyone's age is held against the minimum.
    if (sameUser && prev.birthDate) {
      void dispatch(reviewAge());
    } else {
      void firestoreSyncService.getPrivateProfile(fb.uid).then((p) => {
        if (getState().auth.user.id !== fb.uid) return; // someone else signed in meanwhile
        if (p?.birthDate) dispatch(profileUpdated({ birthDate: p.birthDate }));
        dispatch(birthDateLookedUp());
        void dispatch(reviewAge());
      });
    }

    analyticsService.setUser(fb.uid, { provider: providerOf(fb) });
  };

/**
 * Holds the signed-in person's birth date against the minimum age. Too young: the account is removed and the sign-in
 * screen explains why. No birth date yet: nothing happens here, the app asks for it (BirthDateScreen).
 */
export const reviewAge =
  (): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const { birthDate } = getState().auth.user;
    if (birthDate && checkAge(birthDate) === 'too_young') await dispatch(rejectUnderage());
  };

export const rejectUnderage =
  (): AppThunk<Promise<void>> =>
  async (dispatch) => {
    dispatch(authNoticeSet('underage'));
    await authService.removeAccountAfterAgeRejection();
    dispatch(personalDataReset());
    dispatch(loggedOut());
  };

/** The birth date a first-time Google user typed in: checked, then stored in the private profile */
export const submitBirthDate =
  (birthIso: string): AppThunk<Promise<'ok' | 'too_young' | 'invalid'>> =>
  async (dispatch, getState) => {
    const check = checkAge(birthIso);
    if (check === 'invalid') return 'invalid';
    if (check === 'too_young') {
      await dispatch(rejectUnderage());
      return 'too_young';
    }
    const { user } = getState().auth;
    await firestoreSyncService.savePrivateProfile(user.id, { email: user.email, birthDate: birthIso });
    dispatch(profileUpdated({ birthDate: birthIso }));
    return 'ok';
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
