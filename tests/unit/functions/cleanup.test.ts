import { describe, expect, it } from 'vitest';
import { DELETE_BATCH, MAX_DELETES_PER_RUN, MEETUP_RETENTION_MS, cleanupExpired, type CleanupDeps } from '../../../functions/src/lifecycle';

/** An in-memory store: documents are `{ id, field value }` per collection */
function fakeStore(initial: Record<string, Array<{ id: string; value: number }>>) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, [...v]]));
  const queries: Array<{ collection: string; field: string; before: number; limit: number }> = [];
  const deps: CleanupDeps = {
    async findBefore(collection, field, before, limit) {
      queries.push({ collection, field, before, limit });
      return (data.get(collection) ?? []).filter((d) => d.value < before).slice(0, limit).map((d) => d.id);
    },
    async deleteMany(collection, ids) {
      data.set(collection, (data.get(collection) ?? []).filter((d) => !ids.includes(d.id)));
    },
  };
  return { deps, data, queries };
}

const NOW = 10_000_000_000;
const DAY = 24 * 3600_000;

describe('cleanupExpired', () => {
  it('deletes tables past their expiry and keeps live ones', async () => {
    const { deps, data } = fakeStore({
      hangouts: [{ id: 'old', value: NOW - 1 }, { id: 'edge', value: NOW }, { id: 'live', value: NOW + 3600_000 }],
    });
    const result = await cleanupExpired(deps, NOW);
    expect(result.hangouts).toBe(1);
    expect(data.get('hangouts')!.map((d) => d.id)).toEqual(['edge', 'live']);
  });

  it('keeps an archived meetup for 30 days after it ended, then deletes it', async () => {
    const { deps, data } = fakeStore({
      group_meetups: [
        { id: 'ended-yesterday', value: NOW - DAY },
        { id: 'ended-29-days-ago', value: NOW - 29 * DAY },
        { id: 'ended-31-days-ago', value: NOW - 31 * DAY },
      ],
    });
    const result = await cleanupExpired(deps, NOW);
    expect(result.meetups).toBe(1);
    expect(data.get('group_meetups')!.map((d) => d.id)).toEqual(['ended-yesterday', 'ended-29-days-ago']);
  });

  it('asks for the right fields and cut-offs', async () => {
    const { deps, queries } = fakeStore({});
    await cleanupExpired(deps, NOW);
    expect(queries).toEqual([
      { collection: 'hangouts', field: 'expiresAt', before: NOW, limit: DELETE_BATCH },
      { collection: 'group_meetups', field: 'endsAt', before: NOW - MEETUP_RETENTION_MS, limit: DELETE_BATCH },
    ]);
  });

  it('works through a backlog in batches, but stops at the per-run cap', async () => {
    const many = Array.from({ length: MAX_DELETES_PER_RUN + 500 }, (_, i) => ({ id: `h${i}`, value: 1 }));
    const { deps, data } = fakeStore({ hangouts: many });
    const result = await cleanupExpired(deps, NOW);
    expect(result.hangouts).toBe(MAX_DELETES_PER_RUN);
    expect(data.get('hangouts')).toHaveLength(500); // the next run finishes the job
  });

  it('does nothing on an empty database', async () => {
    const { deps } = fakeStore({});
    expect(await cleanupExpired(deps, NOW)).toEqual({ hangouts: 0, meetups: 0 });
  });
});
