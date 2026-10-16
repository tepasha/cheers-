import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthUser } from '../../types';
import { createGuestUser, isSessionValid, SESSION_DURATION_MS } from '../../logic/session';
import { calculateAge } from '../../utils/ageUtils';

interface AuthState {
  user: AuthUser;
  /** Who the locally stored chats/friends/etc. belong to; survives logout so the next sign-in can tell if it is the same person */
  dataOwnerId: string | null;
  /** True once the private profile was looked up (or the birth date is known): only then a missing birth date means "ask" */
  birthDateChecked: boolean;
  /**
   * The account whose server claims last confirmed it as eligible on this device. Lets that account open offline on
   * what is stored here; the claims are checked again once the network is back (thunks/auth.ts).
   */
  eligibleUid?: string | null;
}

const initialState: AuthState = { user: createGuestUser(), dataOwnerId: null, birthDateChecked: false };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loggedIn(state, action: PayloadAction<AuthUser>) {
      if (state.user.id !== action.payload.id) state.birthDateChecked = false;
      if (action.payload.birthDate) state.birthDateChecked = true;
      state.user = action.payload;
      state.dataOwnerId = action.payload.id;
    },
    loggedOut(state) {
      state.user = createGuestUser();
      state.birthDateChecked = false;
    },
    birthDateLookedUp(state) {
      state.birthDateChecked = true;
    },
    /** The server's claims for `uid` arrived (thunks/auth.ts): remember whether they confirmed the account */
    claimsChecked(state, action: PayloadAction<{ uid: string; eligible: boolean }>) {
      const { uid, eligible } = action.payload;
      if (eligible) state.eligibleUid = uid;
      else if (state.eligibleUid === uid) state.eligibleUid = null;
    },
    /** Extends the 36h rolling session. Expiry itself is enforced by thunks, which also sign out of Firebase. */
    sessionTouched(state, action: PayloadAction<number | undefined>) {
      const now = action.payload ?? Date.now();
      if (!isSessionValid(state.user, now)) return;
      state.user.sessionExpiresAt = now + SESSION_DURATION_MS;
      state.user.lastActiveAt = now;
    },
    profileUpdated(state, action: PayloadAction<Partial<AuthUser>>) {
      Object.assign(state.user, action.payload);
      if (action.payload.birthDate) {
        const age = calculateAge(action.payload.birthDate);
        if (age !== null) state.user.age = age;
      }
    },
  },
});

export const { loggedIn, loggedOut, sessionTouched, profileUpdated, birthDateLookedUp, claimsChecked } = authSlice.actions;
export default authSlice.reducer;
