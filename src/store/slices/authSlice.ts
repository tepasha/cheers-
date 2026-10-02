import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthUser } from '../../types';
import { createGuestUser, isSessionValid, SESSION_DURATION_MS } from '../../logic/session';
import { calculateAge } from '../../utils/ageUtils';

interface AuthState {
  user: AuthUser;
  /** Who the locally stored chats/friends/etc. belong to; survives logout so the next sign-in can tell if it is the same person */
  dataOwnerId: string | null;
}

const initialState: AuthState = { user: createGuestUser(), dataOwnerId: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loggedIn(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.dataOwnerId = action.payload.id;
    },
    loggedOut(state) {
      state.user = createGuestUser();
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

export const { loggedIn, loggedOut, sessionTouched, profileUpdated } = authSlice.actions;
export default authSlice.reducer;
