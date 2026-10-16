import { createSlice, original, PayloadAction } from '@reduxjs/toolkit';
import { BuddyProfile } from '../../types';
import { reuseUnchanged } from '../../utils/reuse';
import { personalDataReset, identityRedacted } from '../actions';

/** Live public profiles streamed from Firestore. Distances/friend flags are derived in selectors. */
const buddiesSlice = createSlice({
  name: 'buddies',
  initialState: { items: [] as BuddyProfile[] },
  reducers: {
    buddiesSynced(state, action: PayloadAction<BuddyProfile[]>) {
      // distanceKm is recomputed in selectors, so it must not make an otherwise identical profile look changed
      const prev = original(state.items) ?? [];
      const next = reuseUnchanged(prev, action.payload, ['distanceKm']) as BuddyProfile[];
      if (next !== prev) state.items = next;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(personalDataReset, () => ({ items: [] }));
    // Repeated by every inbox snapshot: a no-op once the person is gone, so the state (and every list) keeps its identity
    builder.addCase(identityRedacted, (state, { payload: uid }) => { if (state.items.some((b) => b.id === uid)) state.items = state.items.filter((b) => b.id !== uid); });
  },
});

export const { buddiesSynced } = buddiesSlice.actions;
export default buddiesSlice.reducer;
