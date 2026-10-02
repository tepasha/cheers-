import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { personalDataReset } from '../actions';
import { BuddyProfile } from '../../types';

interface FriendsState {
  ids: string[];
  /** Last known profile of every friend so the list still renders while they are offline */
  profiles: Record<string, BuddyProfile>;
}

const friendsSlice = createSlice({
  name: 'friends',
  initialState: { ids: [], profiles: {} } as FriendsState,
  reducers: {
    friendAdded(state, action: PayloadAction<BuddyProfile>) {
      const buddy = action.payload;
      if (state.ids.includes(buddy.id)) return;
      state.ids.push(buddy.id);
      state.profiles[buddy.id] = { ...buddy, isFriend: true };
    },
    friendRemoved(state, action: PayloadAction<string>) {
      state.ids = state.ids.filter((id) => id !== action.payload);
      delete state.profiles[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(personalDataReset, () => ({ ids: [], profiles: {} } as FriendsState));
  },
});

export const { friendAdded, friendRemoved } = friendsSlice.actions;
export default friendsSlice.reducer;
