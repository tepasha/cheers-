import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HangoutAlert, PushNotificationItem } from '../../types';
import { personalDataReset, identityRedacted } from '../actions';
import { loggedIn, loggedOut, profileUpdated } from './authSlice';

/** Transient UI state that must not survive an app restart (never persisted) */
interface UiState {
  sessionGeneration: number;
  inboxGeneration: number;
  inboxReady: boolean;
  authError: boolean;
  authOperation: boolean;
  activeBanner: PushNotificationItem | null;
  isOnline: boolean;
  /** false until Firebase has reported the initial auth state (restored session or none) */
  authReady: boolean;
  /** Chat currently on screen, so incoming messages for it do not raise an unread badge */
  openChatId: string | null;
  /** Chat a tapped push notification asked for; consumed once the navigator and the session are ready */
  pendingChatId: string | null;
  /** Tables the user hosted or joined that just ended, waiting for the "this meetup ended" modal (oldest first) */
  endedTables: HangoutAlert[];
  /** Why the person is back on the sign-in screen (shown there once) */
  authNotice: 'underage' | null;
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: { sessionGeneration: 0, inboxGeneration: 0, inboxReady: false, authError: false, authOperation: false, activeBanner: null, isOnline: true, authReady: false, openChatId: null, pendingChatId: null, endedTables: [], authNotice: null } as UiState,
  reducers: {
    inboxSyncStarted(state) { state.inboxGeneration += 1; },
    inboxReady(state) { state.inboxReady = true; },
    authErrorSet(state, action: PayloadAction<boolean>) { state.authError = action.payload; },
    authOperationSet(state, action: PayloadAction<boolean>) { state.authOperation = action.payload; },
    bannerShown(state, action: PayloadAction<PushNotificationItem>) {
      state.activeBanner = action.payload;
    },
    bannerDismissed(state) {
      state.activeBanner = null;
    },
    chatOpened(state, action: PayloadAction<string | null>) {
      state.openChatId = action.payload;
    },
    authNoticeSet(state, action: PayloadAction<'underage' | null>) {
      state.authNotice = action.payload;
    },
    endedTablesNoticed(state, action: PayloadAction<HangoutAlert[]>) {
      const known = new Set(state.endedTables.map((h) => h.id));
      state.endedTables.push(...action.payload.filter((h) => !known.has(h.id)));
    },
    endedTableAcknowledged(state, action: PayloadAction<string>) {
      state.endedTables = state.endedTables.filter((h) => h.id !== action.payload);
    },
    chatOpenRequested(state, action: PayloadAction<string | null>) {
      state.pendingChatId = action.payload;
    },
    authReady(state) {
      state.authReady = true;
    },
    networkStatusChanged(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Another person signing in must not see the previous one's "table ended" notices
    builder.addCase(personalDataReset, (state) => {
      state.endedTables = [];
      state.activeBanner = null;
      state.openChatId = null;
      state.pendingChatId = null;
      state.inboxReady = false;
      state.sessionGeneration += 1;
    });
    builder.addCase(loggedOut, (state) => {
      state.sessionGeneration += 1;
      state.activeBanner = null;
      state.openChatId = null;
      state.pendingChatId = null;
      state.inboxReady = false;
      state.authError = false;
    });
    builder.addCase(loggedIn, (state) => { state.sessionGeneration += 1; state.inboxReady = false; });
    // A completed onboarding invalidates older profile/token lookups made before the callable finished.
    builder.addCase(profileUpdated, (state, { payload }) => { if (payload.serverEligible === true) state.sessionGeneration += 1; });
    builder.addCase(identityRedacted, (state, { payload: uid }) => { if (state.activeBanner?.buddyId === uid) state.activeBanner = null; });
  },
});

export const { bannerShown, bannerDismissed, networkStatusChanged, authReady, chatOpened, chatOpenRequested, endedTablesNoticed, endedTableAcknowledged, authNoticeSet } = uiSlice.actions;
export const { inboxSyncStarted, inboxReady, authErrorSet, authOperationSet } = uiSlice.actions;
export default uiSlice.reducer;
