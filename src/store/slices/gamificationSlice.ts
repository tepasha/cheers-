import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserGamificationState } from '../../types';

interface GamificationState {
  byUser: Record<string, UserGamificationState>;
}

const gamificationSlice = createSlice({
  name: 'gamification',
  initialState: { byUser: {} } as GamificationState,
  reducers: {
    gamificationStateSet(state, action: PayloadAction<{ userId: string; state: UserGamificationState }>) {
      state.byUser[action.payload.userId] = action.payload.state;
    },
  },
});

export const { gamificationStateSet } = gamificationSlice.actions;
export default gamificationSlice.reducer;
