import outbox from '@/store/slices/outboxSlice';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

vi.mock('@/services/firebase', () => ({ db: {}, auth: {}, firebaseApp: {} }));
vi.mock('@/services/firestoreSyncService', () => ({
  firestoreSyncService: { renewHangout: vi.fn() },
}));

import auth, { loggedIn } from '@/store/slices/authSlice';
import hangouts, { hangoutsSynced } from '@/store/slices/hangoutsSlice';
import meetups, { meetupsMerged } from '@/store/slices/meetupsSlice';
import ui, { endedTablesNoticed } from '@/store/slices/uiSlice';
import { personalDataReset } from '@/store/actions';
import { createUser } from '@/logic/session';
import { firestoreSyncService } from '@/services/firestoreSyncService';
import { acknowledgeEndedTable, pruneExpiredContent, renewHangout, syncHangouts } from '@/store/thunks/lifecycle';
import type { HangoutAlert } from '@/types';
import type { RootState } from '@/store/index';

const rootReducer = combineReducers({ outbox, auth, hangouts, meetups, ui });
function makeStore() {
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(loggedIn(createUser({ id: 'me', email: 'me@b.co', name: 'Me', emailVerified: true })));
  return store;
}
type TestStore = ReturnType<typeof makeStore>;
const st = (s: TestStore) => s.getState() as unknown as RootState;
const run = <R,>(s: TestStore, thunk: unknown) => (s.dispatch as unknown as (t: unknown) => R)(thunk);

const HOUR = 3600_000;
const table = (id: string, over: Partial<HangoutAlert> = {}): HangoutAlert =>
  ({ id, userId: 'host', userName: 'Host', userAvatar: '', barName: 'Squat', locationArea: '', drinkPreference: '', description: '', createdAt: 'x', slotsAvailable: 2, participantsCount: 1, joinedUsers: ['host'], expiresAt: Date.now() + HOUR, ...over });

const renew = vi.mocked(firestoreSyncService.renewHangout);
beforeEach(() => vi.clearAllMocks());

describe('the "this meetup ended" notice', () => {
  it('goes to the host and to guests who took a seat, when the table runs out on screen', () => {
    const s = makeStore();
    const hostedByMe = table('mine', { userId: 'me', joinedUsers: ['me'], expiresAt: Date.now() - 1000 });
    const joined = table('joined', { joinedUsers: ['host', 'me'], expiresAt: Date.now() - 1000 });
    const stranger = table('stranger', { expiresAt: Date.now() - 1000 });
    s.dispatch(hangoutsSynced([hostedByMe, joined, stranger, table('live')]));

    run(s, pruneExpiredContent());
    expect(st(s).ui.endedTables.map((h) => h.id)).toEqual(['mine', 'joined']);
    expect(st(s).hangouts.items.map((h) => h.id)).toEqual(['live']);
  });

  it('is raised once per table, even if the timer fires again', () => {
    const s = makeStore();
    s.dispatch(endedTablesNoticed([table('t', { userId: 'me' })]));
    s.dispatch(endedTablesNoticed([table('t', { userId: 'me' })]));
    expect(st(s).ui.endedTables).toHaveLength(1);
  });

  it('is raised when a snapshot arrives without a table of mine whose time is up', () => {
    const s = makeStore();
    s.dispatch(hangoutsSynced([table('mine', { userId: 'me', joinedUsers: ['me'], expiresAt: Date.now() - 1000 }), table('other')]));
    run(s, syncHangouts([table('other')])); // the query no longer returns the expired one
    expect(st(s).ui.endedTables.map((h) => h.id)).toEqual(['mine']);
    expect(st(s).hangouts.items.map((h) => h.id)).toEqual(['other']);
  });

  it('is NOT raised for a table the host closed before its time, or for older tables without an expiry', () => {
    const s = makeStore();
    s.dispatch(hangoutsSynced([table('closed', { userId: 'me', joinedUsers: ['me'] }), table('legacy', { userId: 'me', joinedUsers: ['me'], expiresAt: undefined })]));
    run(s, syncHangouts([]));
    expect(st(s).ui.endedTables).toEqual([]);
  });

  it('is dropped when another person signs in on the phone', () => {
    const s = makeStore();
    s.dispatch(endedTablesNoticed([table('t', { userId: 'me' })]));
    s.dispatch(personalDataReset());
    expect(st(s).ui.endedTables).toEqual([]);
  });

  it('can be acknowledged', () => {
    const s = makeStore();
    s.dispatch(endedTablesNoticed([table('a', { userId: 'me' }), table('b', { userId: 'me' })]));
    run(s, acknowledgeEndedTable('a'));
    expect(st(s).ui.endedTables.map((h) => h.id)).toEqual(['b']);
  });
});

describe('meetups leave the list by themselves', () => {
  it('a meetup whose day after the start has passed is pruned by the timer', () => {
    const s = makeStore();
    s.dispatch(meetupsMerged([{ id: 'old', creatorId: 'c', endsAt: Date.now() - 1000 } as never, { id: 'new', creatorId: 'c', endsAt: Date.now() + HOUR } as never]));
    run(s, pruneExpiredContent());
    expect(st(s).meetups.items.map((m) => m.id)).toEqual(['new']);
  });
});

describe('renewing a table', () => {
  it('lets the host bring their table back for another 4 hours', async () => {
    const s = makeStore();
    const mine = table('mine', { userId: 'me', joinedUsers: ['me'], expiresAt: Date.now() - 1000 });
    s.dispatch(endedTablesNoticed([mine]));
    const newExpiry = Date.now() + 4 * HOUR;
    renew.mockResolvedValue(newExpiry);

    expect(await run<Promise<boolean>>(s, renewHangout(mine))).toBe(true);
    expect(st(s).ui.endedTables).toEqual([]);
    expect(st(s).hangouts.items.find((h) => h.id === 'mine')?.expiresAt).toBe(newExpiry);
  });

  it('is for the host only', async () => {
    const s = makeStore();
    const theirs = table('theirs', { userId: 'host', expiresAt: Date.now() - 1000 });
    expect(await run<Promise<boolean>>(s, renewHangout(theirs))).toBe(false);
    expect(renew).not.toHaveBeenCalled();
  });

  it('reports failure without pretending the table is back', async () => {
    const s = makeStore();
    const mine = table('mine', { userId: 'me', joinedUsers: ['me'], expiresAt: Date.now() - 1000 });
    renew.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await run<Promise<boolean>>(s, renewHangout(mine))).toBe(false);
    expect(st(s).hangouts.items).toEqual([]);
  });
});
