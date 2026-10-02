import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { personalDataReset } from '../actions';
import { BlockedUserRecord, UserReport } from '../../types';

interface SafetyState {
  blockedUsers: BlockedUserRecord[];
  reports: UserReport[];
  reportCounts: Record<string, number>;
  /** Account whose cloud block list has been merged into this device (null = never synced) */
  cloudSyncedFor: string | null;
}

const safetySlice = createSlice({
  name: 'safety',
  initialState: { blockedUsers: [], reports: [], reportCounts: {}, cloudSyncedFor: null } as SafetyState,
  reducers: {
    userBlocked(state, action: PayloadAction<BlockedUserRecord>) {
      if (state.blockedUsers.some((u) => u.userId === action.payload.userId)) return;
      state.blockedUsers.unshift(action.payload);
    },
    userUnblocked(state, action: PayloadAction<string>) {
      state.blockedUsers = state.blockedUsers.filter((u) => u.userId !== action.payload);
    },
    /**
     * The cloud list is the source of truth, so unblocking on another device propagates here. The first sync
     * for an account merges instead (union), so blocks made before this feature existed are not lost.
     */
    blocksSynced(state, action: PayloadAction<{ userId: string; records: BlockedUserRecord[]; merge: boolean }>) {
      const { userId, records, merge } = action.payload;
      if (merge) {
        const known = new Set(state.blockedUsers.map((u) => u.userId));
        state.blockedUsers.push(...records.filter((r) => !known.has(r.userId)));
      } else {
        state.blockedUsers = records;
      }
      state.cloudSyncedFor = userId;
    },
    reportFiled(state, action: PayloadAction<UserReport>) {
      state.reports.unshift(action.payload);
      const id = action.payload.targetId;
      state.reportCounts[id] = (state.reportCounts[id] || 0) + 1;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(personalDataReset, () => ({ blockedUsers: [], reports: [], reportCounts: {}, cloudSyncedFor: null } as SafetyState));
  },
});

export const { userBlocked, userUnblocked, blocksSynced, reportFiled } = safetySlice.actions;
export default safetySlice.reducer;
