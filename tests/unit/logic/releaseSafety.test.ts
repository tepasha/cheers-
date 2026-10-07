import { describe, expect, it } from 'vitest';
import { calculateAge } from '@/utils/ageUtils';
import { isRussianCoordinate } from '@/logic/territory';
import { normalizePersistedState } from '@/store/persistMigration';
import meetups, { meetupsReconciled } from '@/store/slices/meetupsSlice';
import type { GroupMeetup } from '@/types';
import type { PersistedState } from 'redux-persist';
import { contentAllowed } from '@/logic/contentPolicy';

describe('release safety regressions', () => {
  it('filters explicit threats while accepting ordinary conversation', () => {
    expect(contentAllowed('I WILL KILL YOU')).toBe(false);
    expect(contentAllowed('child\u200B porn')).toBe(false);
    expect(contentAllowed('Have a nice evening!')).toBe(true);
  });
  it('rejects impossible calendar dates instead of normalising them to an adult birthday', () => {
    for (const date of ['1990-02-31', '1990-13-01', '1990-00-01', '1990-04-31', '1990-2-01', '2001-02-29']) {
      expect(calculateAge(date, new Date(2026, 9, 7))).toBeNull();
    }
    expect(calculateAge('2000-02-29', new Date(2026, 9, 7))).toBe(26);
    expect(calculateAge('2005-10-08', new Date(2026, 9, 7))).toBe(20);
    expect(calculateAge('2005-10-07', new Date(2026, 9, 7))).toBe(21);
  });

  it('keeps Crimea and neighbouring countries outside the Russian territorial restriction', () => {
    for (const [lat, lng] of [[44.95, 34.1], [50.45, 30.52], [41.72, 44.8], [51.17, 71.45], [53.9, 27.56], [39.92, 32.85]]) {
      expect(isRussianCoordinate(lat, lng)).toBe(false);
    }
    for (const [lat, lng] of [[55.75, 37.62], [59.94, 30.31], [43.11, 131.87]]) {
      expect(isRussianCoordinate(lat, lng), `${lat}, ${lng}`).toBe(true);
    }
  });

  it('makes interrupted persisted writes retryable and requires fresh server eligibility', () => {
    const saved = { _persist: { version: 1, rehydrated: true }, auth: { user: { serverEligible: true } }, settings: { shareLocation: true }, outbox: { jobs: [{ id: 'pending', status: 'sending', nextAt: 123 }] } };
    const next = normalizePersistedState(saved as unknown as PersistedState) as unknown as typeof saved;
    expect(next.auth.user.serverEligible).toBe(false);
    expect(next.settings.shareLocation).toBe(false);
    expect(next.outbox.jobs[0]).toMatchObject({ id: 'pending', status: 'queued', nextAt: 0 });
    expect(saved.outbox.jobs[0].status).toBe('sending');
  });

  it('removes a server-deleted meetup while retaining an offline creation', () => {
    const state = { items: [{ id: 'deleted' }, { id: 'pending' }, { id: 'updated', title: 'old' }] as GroupMeetup[] };
    const next = meetups(state, meetupsReconciled({ items: [{ id: 'updated', title: 'new' }] as GroupMeetup[], pendingIds: ['pending'] }));
    expect(next.items.map((m) => m.id)).toEqual(['pending', 'updated']);
    expect(next.items[1].title).toBe('new');
  });
});
