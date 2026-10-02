import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { personalDataReset } from '../actions';
import { GroupMeetup } from '../../types';

const meetupsSlice = createSlice({
  name: 'meetups',
  initialState: { items: [] as GroupMeetup[] },
  reducers: {
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
  },
  extraReducers: (builder) => {
    builder.addCase(personalDataReset, () => ({ items: [] as GroupMeetup[] }));
  },
});

export const { meetupUpserted, meetupsMerged } = meetupsSlice.actions;
export default meetupsSlice.reducer;
