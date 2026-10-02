import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HangoutAlert, PushNotificationItem } from '../../types';
import { personalDataReset } from '../actions';

/** Transient UI state that must not survive an app restart (never persisted) */
interface UiState {
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
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: { activeBanner: null, isOnline: true, authReady: false, openChatId: null, pendingChatId: null, endedTables: [] } as UiState,
  reducers: {
    bannerShown(state, action: PayloadAction<PushNotificationItem>) {
      state.activeBanner = action.payload;
    },
    bannerDismissed(state) {
      state.activeBanner = null;
    },
    chatOpened(state, action: PayloadAction<string | null>) {
      state.openChatId = action.payload;
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
    });
  },
});

export const { bannerShown, bannerDismissed, networkStatusChanged, authReady, chatOpened, chatOpenRequested, endedTablesNoticed, endedTableAcknowledged } = uiSlice.actions;
export default uiSlice.reducer;
