import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PushNotificationItem } from '../../types';

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
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: { activeBanner: null, isOnline: true, authReady: false, openChatId: null, pendingChatId: null } as UiState,
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
});

export const { bannerShown, bannerDismissed, networkStatusChanged, authReady, chatOpened, chatOpenRequested } = uiSlice.actions;
export default uiSlice.reducer;
