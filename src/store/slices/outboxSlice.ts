import { createSlice, current, type PayloadAction } from '@reduxjs/toolkit';
import { personalDataReset } from '../actions';

export type SyncMethod = 'sendEncryptedMessage' | 'saveBlock' | 'removeBlock' | 'saveReport' | 'saveFavoriteVenue' | 'removeFavoriteVenue' | 'saveMeetup' | 'setMeetupParticipation' | 'publishHangout' | 'joinLiveHangout' | 'closeLiveHangout' | 'saveUserProfile' | 'syncFriend' | 'removeFriendFromFirestore' | 'syncGamification' | 'addGroupMembers';
export interface SyncJob {
  id: string; owner: string; key: string; method: SyncMethod; args: unknown[];
  status: 'queued' | 'sending' | 'failed'; attempts: number; nextAt: number;
  message?: { chatId: string; id: string };
}
interface OutboxState {
  jobs: SyncJob[];
  /** The arguments last saved per `syncedKey(owner, key)`, for REMEMBERED_KEYS: an identical write need not be queued again */
  synced?: Record<string, string>;
}
export const OUTBOX_LIMIT = 200;
/** One entry per resource, never per message: the public profile is rewritten whole, so a repeat of it changes nothing */
const REMEMBERED_KEYS = ['profile'];
export const syncedKey = (owner: string, key: string) => `${owner}:${key}`;
const outboxSlice = createSlice({
  name: 'outbox', initialState: { jobs: [] } as OutboxState,
  reducers: {
    syncQueued(state, action: PayloadAction<SyncJob>) {
      state.jobs = state.jobs.filter((j) => j.owner !== action.payload.owner || j.key !== action.payload.key);
      if (state.jobs.length < OUTBOX_LIMIT) state.jobs.push(action.payload);
    },
    syncChanged(state, action: PayloadAction<{ id: string; status: SyncJob['status']; attempts?: number; nextAt?: number }>) {
      const job = state.jobs.find((j) => j.id === action.payload.id);
      if (job) Object.assign(job, action.payload);
    },
    syncCompleted(state, action: PayloadAction<string>) {
      const job = state.jobs.find((j) => j.id === action.payload);
      if (job && REMEMBERED_KEYS.includes(job.key)) state.synced = { ...state.synced, [syncedKey(job.owner, job.key)]: JSON.stringify(current(job).args) };
      state.jobs = state.jobs.filter((j) => j.id !== action.payload);
    },
    syncRetried(state) { state.jobs.forEach((j) => { j.status = 'queued'; j.attempts = 0; j.nextAt = 0; }); },
  },
  extraReducers: (builder) => { builder.addCase(personalDataReset, () => ({ jobs: [] })); },
});
export const { syncQueued, syncChanged, syncCompleted, syncRetried } = outboxSlice.actions;
export default outboxSlice.reducer;
