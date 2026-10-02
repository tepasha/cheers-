/** Server copy of src/logic/lifecycle.ts (a test keeps them equal): what the cleanup job deletes and when */
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const HANGOUT_TTL_MS = 4 * HOUR;
export const MEETUP_ARCHIVE_AFTER_MS = DAY;
export const MEETUP_RETENTION_MS = 30 * DAY;

/** Firestore batches take at most 500 writes */
export const DELETE_BATCH = 400;
/** One run removes at most this many documents per collection; a backlog is finished by the next runs */
export const MAX_DELETES_PER_RUN = 2000;

export interface CleanupDeps {
  /** Ids of documents whose `field` is below `before`, at most `limit` */
  findBefore(collection: string, field: string, before: number, limit: number): Promise<string[]>;
  deleteMany(collection: string, ids: string[]): Promise<void>;
}

export interface CleanupResult {
  hangouts: number;
  meetups: number;
}

async function purge(deps: CleanupDeps, collection: string, field: string, before: number): Promise<number> {
  let removed = 0;
  while (removed < MAX_DELETES_PER_RUN) {
    const ids = await deps.findBefore(collection, field, before, DELETE_BATCH);
    if (ids.length === 0) break;
    await deps.deleteMany(collection, ids);
    removed += ids.length;
    if (ids.length < DELETE_BATCH) break;
  }
  return removed;
}

/**
 * Tables disappear when their `expiresAt` has passed. Meetups are archived at `endsAt` (the clients already stop
 * listing them) and deleted once the 30-day retention after that has passed.
 */
export async function cleanupExpired(deps: CleanupDeps, now: number): Promise<CleanupResult> {
  return {
    hangouts: await purge(deps, 'hangouts', 'expiresAt', now),
    meetups: await purge(deps, 'group_meetups', 'endsAt', now - MEETUP_RETENTION_MS),
  };
}
