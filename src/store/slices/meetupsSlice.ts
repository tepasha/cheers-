import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { personalDataReset } from '../actions';
import { GroupMeetup } from '../../types';
import { isMeetupArchived } from '../../logic/lifecycle';

const meetupsSlice = createSlice({
  name: 'meetups',
  initialState: { items: [] as GroupMeetup[] },
  reducers: {
    /** A complete server snapshot removes deleted events, while preserving unsaved creations. */
    meetupsReconciled(state, action: PayloadAction<{ items: GroupMeetup[]; pendingIds: string[] }>) {
      const byId = new Map(state.items.filter((m) => action.payload.pendingIds.includes(m.id)).map((m) => [m.id, m]));
      action.payload.items.forEach((m) => byId.set(m.id, m));
      state.items = Array.from(byId.values());
    },
    meetupUpserted(state, action: PayloadAction<GroupMeetup>) {
      const idx = state.items.findIndex((m) => m.id === action.payload.id);
      if (idx === -1) state.items.unshift(action.payload);
      else state.items[idx] = action.payload;
    },
    /** Merge a Firestore snapshot into local state; the cloud copy wins on conflicts */
    meetupsMerged(state, action: PayloadAction<GroupMeetup[]>) {
      const byId = new Map(state.items.map((m) => [m.id, m]));
      action.payload.forEach((m) => byId.set(m.id, m));
      state.items = Array.from(byId.values());
    },
    /** Drops meetups that are over (24 h after the start). They stay in the cloud archive for 30 days. */
    archivedMeetupsPruned(state, action: PayloadAction<number>) {
      const live = state.items.filter((m) => !isMeetupArchived(m, action.payload));
      if (live.length !== state.items.length) state.items = live;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(personalDataReset, () => ({ items: [] as GroupMeetup[] }));
  },
});

export const { meetupUpserted, meetupsMerged, meetupsReconciled, archivedMeetupsPruned } = meetupsSlice.actions;
export default meetupsSlice.reducer;
