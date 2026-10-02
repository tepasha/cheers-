import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { personalDataReset } from '../actions';
import { PushNotificationItem } from '../../types';

const MAX_STORED = 30;

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: { items: [] as PushNotificationItem[] },
  reducers: {
    notificationReceived(state, action: PayloadAction<PushNotificationItem>) {
      state.items = [action.payload, ...state.items].slice(0, MAX_STORED);
    },
    notificationRead(state, action: PayloadAction<string>) {
      const item = state.items.find((n) => n.id === action.payload);
      if (item) item.isRead = true;
    },
    allNotificationsRead(state) {
      state.items.forEach((n) => {
        n.isRead = true;
      });
    },
    notificationsCleared(state) {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(personalDataReset, () => ({ items: [] as PushNotificationItem[] }));
  },
});

export const { notificationReceived, notificationRead, allNotificationsRead, notificationsCleared } =
  notificationsSlice.actions;
export default notificationsSlice.reducer;
