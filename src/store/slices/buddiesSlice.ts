import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BuddyProfile } from '../../types';

/** Live public profiles streamed from Firestore. Distances/friend flags are derived in selectors. */
const buddiesSlice = createSlice({
  name: 'buddies',
  initialState: { items: [] as BuddyProfile[] },
  reducers: {
    buddiesSynced(state, action: PayloadAction<BuddyProfile[]>) {
      state.items = action.payload;
    },
  },
});

export const { buddiesSynced } = buddiesSlice.actions;
export default buddiesSlice.reducer;
