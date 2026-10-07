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
import { captureSession } from '../sessionGuard';
import { authErrorSet } from '../slices/uiSlice';
import { asString, asStringList, DRINK_TYPES, MOOD_TYPES, PAYMENT_RULES, oneOf } from '../../logic/cloudData';
import type { DrinkType } from '../../types';

const providerOf = (fb: User): 'google' | 'apple' | 'email' => {
  const ids = (fb.providerData ?? []).map((p) => p.providerId);
  if (ids.includes('password')) return 'email';
  if (ids.includes('apple.com')) return 'apple';
  return ids.includes('google.com') ? 'google' : 'email';
};

/** Accounts created by earlier builds stored a DiceBear URL as their avatar; drop it so the name is no longer sent out */
const withoutHostedPlaceholder = (avatar: string) => (/(^|\/\/)api\.dicebear\.com\//.test(avatar) ? '' : avatar);

/**
 * Signs out of Firebase. The push device is removed first, while the account can still write: afterwards the
 * phone would keep showing this person's chat notifications to whoever holds it.
 */
export const endSession =
  (expectedUid?: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const uid = expectedUid ?? getState().auth.user.id;
    const releasing = dispatch(releaseDevice());
    dispatch(loggedOut());
    await releasing;
    await authService.logout(uid);
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
          avatar: fb.photoURL || (sameUser && prev.provider !== 'google' ? withoutHostedPlaceholder(prev.avatar) : ''),
          emailVerified: fb.emailVerified,
          provider: providerOf(fb),
          birthDate: sameUser ? prev.birthDate : undefined,
          joinedAt: sameUser ? prev.joinedAt : undefined,
        })
      )
    );
    dispatch(authReady());
    dispatch(authErrorSet(false));
    const current = captureSession(getState);

    analyticsService.setUser(fb.uid, { provider: providerOf(fb) });
    const withClaims = typeof fb.getIdTokenResult === 'function';
    if (withClaims) dispatch(profileUpdated({ serverEligible: false }));
    void Promise.all([
      firestoreSyncService.getPrivateProfile(fb.uid),
      firestoreSyncService.getUserProfile(fb.uid),
      withClaims ? fb.getIdTokenResult(true) : Promise.resolve(null),
    ]).then(([privateProfile, publicProfile, token]) => {
      if (!current()) return;
      dispatch(profileUpdated({
        ...(privateProfile?.birthDate ? { birthDate: privateProfile.birthDate } : {}),
        ...(publicProfile ? {
          tagline: asString(publicProfile.tagline), bio: asString(publicProfile.bio),
          preferredDrinks: asStringList(publicProfile.preferredDrinks, 8).filter((value): value is DrinkType => (DRINK_TYPES as readonly string[]).includes(value)),
          currentMood: oneOf(publicProfile.currentMood, MOOD_TYPES, 'not_specified'), paymentRule: oneOf(publicProfile.paymentRule, PAYMENT_RULES, 'not_specified'),
        } : {}),
        ...(token ? { emailVerified: token.claims.email_verified === true, serverEligible: token.claims.age_21 === true, termsVersion: typeof token.claims.terms_version === 'string' ? token.claims.terms_version : undefined } : {}),
      }));
      dispatch(birthDateLookedUp());
      void dispatch(reviewAge());
    }).catch(() => { if (current()) dispatch(authErrorSet(true)); });
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
  async (dispatch, getState) => {
    dispatch(authNoticeSet('underage'));
    const owner = getState().auth.user.id;
    await authService.removeAccountAfterAgeRejection();
    if (getState().auth.dataOwnerId !== owner) return;
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
    const current = captureSession(getState);
    await authService.completeOnboarding(birthIso);
    if (!current()) return 'invalid';
    await firestoreSyncService.savePrivateProfile(user.id, { email: user.email });
    if (!current()) return 'invalid';
    dispatch(profileUpdated({ birthDate: birthIso, serverEligible: true }));
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
      await dispatch(endSession(userId));
    } catch (err) {
      console.warn('Sign out failed:', err);
    }
  };

/** Re-checks the verification flag after the user followed the email link. Resolves true when verified. */
export const refreshEmailVerification =
  (): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const current = captureSession(getState);
    const verified = await authService.refreshVerification();
    if (!current()) return false;
    if (verified) dispatch(profileUpdated({ emailVerified: true }));
    return verified;
  };

/** `password` for an email account; a Google account confirms through the Google dialog instead */
export const deleteAccount =
  (password?: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const owner = getState().auth.user.id;
    await authService.deleteAccount(password);
    if (getState().auth.dataOwnerId !== owner) return;
    analyticsService.trackEvent('account_deleted');
    dispatch(personalDataReset());
    dispatch(loggedOut());
  };
