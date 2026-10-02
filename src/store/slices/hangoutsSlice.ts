import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HangoutAlert } from '../../types';

const hangoutsSlice = createSlice({
  name: 'hangouts',
  initialState: { items: [] as HangoutAlert[] },
  reducers: {
    hangoutsSynced(state, action: PayloadAction<HangoutAlert[]>) {
      state.items = action.payload;
    },
    hangoutPublished(state, action: PayloadAction<HangoutAlert>) {
      state.items = [action.payload, ...state.items.filter((h) => h.id !== action.payload.id)];
    },
    hangoutJoined(state, action: PayloadAction<{ hangoutId: string; userId: string }>) {
      const hangout = state.items.find((h) => h.id === action.payload.hangoutId);
      if (!hangout) return;
      const joined = hangout.joinedUsers ?? [];
      if (joined.includes(action.payload.userId)) return;
      hangout.participantsCount += 1;
      hangout.joinedUsers = [...joined, action.payload.userId];
    },
    hangoutClosed(state, action: PayloadAction<string>) {
      state.items = state.items.filter((h) => h.id !== action.payload);
    },
  },
});

export const { hangoutsSynced, hangoutPublished, hangoutJoined, hangoutClosed } = hangoutsSlice.actions;
export default hangoutsSlice.reducer;
