import type { AppThunk } from '../hooks';
import type { HangoutAlert } from '../../types';
import { expiredHangoutsPruned, hangoutPublished, hangoutsSynced } from '../slices/hangoutsSlice';
import { archivedMeetupsPruned } from '../slices/meetupsSlice';
import { endedTableAcknowledged, endedTablesNoticed } from '../slices/uiSlice';
import { isHangoutExpired } from '../../logic/lifecycle';
import { firestoreSyncService } from '../../services/firestoreSyncService';

/** Tables that ended while this person was part of them (hosted or took a seat): they get the "ended" modal */
const endedAmongMine = (items: HangoutAlert[], myId: string, now: number): HangoutAlert[] =>
  items.filter((h) => typeof h.expiresAt === 'number' && isHangoutExpired(h, now) && (h.userId === myId || !!h.joinedUsers?.includes(myId)));

/** A Firestore snapshot of live tables. A table of mine that is missing from it because its time ran out is announced. */
export const syncHangouts =
  (incoming: HangoutAlert[]): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    const now = Date.now();
    const arrived = new Set(incoming.map((h) => h.id));
    const gone = state.hangouts.items.filter((h) => !arrived.has(h.id));
    const ended = endedAmongMine(gone, state.auth.user.id, now);
    if (ended.length > 0) dispatch(endedTablesNoticed(ended));
    dispatch(hangoutsSynced(incoming));
  };

/** Timer-driven cleanup of what is on screen (the quiet-feed case, where no snapshot arrives) */
export const pruneExpiredContent =
  (now = Date.now()): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    const ended = endedAmongMine(state.hangouts.items, state.auth.user.id, now);
    if (ended.length > 0) dispatch(endedTablesNoticed(ended));
    dispatch(expiredHangoutsPruned(now));
    dispatch(archivedMeetupsPruned(now));
  };

/** The host brings the ended table back for another 4 hours (guests have to take a seat again if it was already removed) */
export const renewHangout =
  (table: HangoutAlert): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    if (getState().auth.user.id !== table.userId) return false;
    dispatch(endedTableAcknowledged(table.id));
    try {
      const expiresAt = await firestoreSyncService.renewHangout(table);
      dispatch(hangoutPublished({ ...table, expiresAt, participantsCount: Math.max(1, table.participantsCount), status: 'active' }));
      return true;
    } catch (err) {
      console.warn('Renewing the table failed:', err);
      return false;
    }
  };

export const acknowledgeEndedTable =
  (tableId: string): AppThunk =>
  (dispatch) => {
    dispatch(endedTableAcknowledged(tableId));
  };
