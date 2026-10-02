import { createSlice, original, PayloadAction } from '@reduxjs/toolkit';
import { HangoutAlert } from '../../types';
import { reuseUnchanged } from '../../utils/reuse';
import { isHangoutExpired } from '../../logic/lifecycle';

const hangoutsSlice = createSlice({
  name: 'hangouts',
  initialState: { items: [] as HangoutAlert[] },
  reducers: {
    hangoutsSynced(state, action: PayloadAction<HangoutAlert[]>) {
      const prev = original(state.items) ?? [];
      const next = reuseUnchanged(prev, action.payload, ['distanceKm', 'distanceFormatted']) as HangoutAlert[];
      if (next !== prev) state.items = next;
    },
    /** Drops tables whose 4 hours are over; the snapshot only filters when it arrives, and a quiet feed sends none */
    expiredHangoutsPruned(state, action: PayloadAction<number>) {
      const live = state.items.filter((h) => !isHangoutExpired(h, action.payload));
      if (live.length !== state.items.length) state.items = live;
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

export const { hangoutsSynced, expiredHangoutsPruned, hangoutPublished, hangoutJoined, hangoutClosed } = hangoutsSlice.actions;
export default hangoutsSlice.reducer;
