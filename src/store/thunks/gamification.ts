import { queueSync } from './outbox';
import type { AppThunk } from '../hooks';
import { gamificationStateSet } from '../slices/gamificationSlice';
import { applyBonusXp, applyCheckIn, CheckInInput, CheckInResult } from '../../logic/gamification';
import { selectGamification } from '../selectors';
import { sounds } from '../../services/soundService';

export const recordCheckIn =
  (data: CheckInInput): AppThunk<CheckInResult> =>
  (dispatch, getState) => {
    const state = getState();
    const userId = state.auth.user.id;
    const result = applyCheckIn(selectGamification(state), data);

    dispatch(gamificationStateSet({ userId, state: result.updatedState }));
    if (result.didLevelUp) sounds.playMatchCheer();
    else sounds.playClink();
    dispatch(queueSync('syncGamification', 'gamification', [userId, result.updatedState]));
    return result;
  };

export const addBonusXp =
  (amount: number, _reason?: string): AppThunk<{ didLevelUp: boolean }> =>
  (dispatch, getState) => {
    const state = getState();
    const userId = state.auth.user.id;
    const { updatedState, didLevelUp } = applyBonusXp(selectGamification(state), amount);

    dispatch(gamificationStateSet({ userId, state: updatedState }));
    if (didLevelUp) sounds.playMatchCheer();
    else sounds.playClink();
    dispatch(queueSync('syncGamification', 'gamification', [userId, updatedState]));
    return { didLevelUp };
  };
