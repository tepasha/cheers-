import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { personalDataReset } from '../actions';

export type SyncMethod = 'sendEncryptedMessage' | 'saveBlock' | 'removeBlock' | 'saveReport' | 'saveFavoriteVenue' | 'removeFavoriteVenue' | 'saveMeetup' | 'setMeetupParticipation' | 'publishHangout' | 'joinLiveHangout' | 'closeLiveHangout' | 'saveUserProfile' | 'syncFriend' | 'removeFriendFromFirestore' | 'syncGamification' | 'addGroupMembers';
export interface SyncJob {
  id: string; owner: string; key: string; method: SyncMethod; args: unknown[];
  status: 'queued' | 'sending' | 'failed'; attempts: number; nextAt: number;
  message?: { chatId: string; id: string };
}
export const OUTBOX_LIMIT = 200;
const outboxSlice = createSlice({
  name: 'outbox', initialState: { jobs: [] as SyncJob[] },
  reducers: {
    syncQueued(state, action: PayloadAction<SyncJob>) {
      state.jobs = state.jobs.filter((j) => j.owner !== action.payload.owner || j.key !== action.payload.key);
      if (state.jobs.length < OUTBOX_LIMIT) state.jobs.push(action.payload);
    },
    syncChanged(state, action: PayloadAction<{ id: string; status: SyncJob['status']; attempts?: number; nextAt?: number }>) {
      const job = state.jobs.find((j) => j.id === action.payload.id);
      if (job) Object.assign(job, action.payload);
    },
    syncCompleted(state, action: PayloadAction<string>) { state.jobs = state.jobs.filter((j) => j.id !== action.payload); },
    syncRetried(state) { state.jobs.forEach((j) => { j.status = 'queued'; j.attempts = 0; j.nextAt = 0; }); },
  },
  extraReducers: (builder) => { builder.addCase(personalDataReset, () => ({ jobs: [] })); },
});
export const { syncQueued, syncChanged, syncCompleted, syncRetried } = outboxSlice.actions;
export default outboxSlice.reducer;
