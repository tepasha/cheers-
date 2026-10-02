/**
 * How long things live. The numbers are product decisions; functions/src/lifecycle.ts holds the same values for the
 * server-side cleanup, and a test keeps the two copies identical.
 *
 *   table (hangout)  live for 4 hours from the moment it is posted, then it disappears from every feed;
 *                    its host may bring it back for another 4 hours (a modal offers it when the table ends)
 *   meetup           listed until 24 hours after its start, then archived (kept for a further 30 days, then deleted)
 */
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const HANGOUT_TTL_MS = 4 * HOUR;
export const MEETUP_ARCHIVE_AFTER_MS = DAY;
export const MEETUP_RETENTION_MS = 30 * DAY;

/** Rules accept an expiry at most this far ahead of the server clock (4 h + a little client clock skew) */
export const HANGOUT_MAX_TTL_MS = HANGOUT_TTL_MS + 5 * 60 * 1000;
/** Meetups can be planned this far ahead; keeps `endsAt` from being used to park a document forever */
export const MEETUP_MAX_PLANNING_MS = 90 * DAY;

export const hangoutExpiresAt = (now: number): number => now + HANGOUT_TTL_MS;

/** A hangout without an expiry predates this rule; it is treated as expired, not as immortal */
export const isHangoutExpired = (h: { expiresAt?: number }, now: number): boolean => typeof h.expiresAt !== 'number' || h.expiresAt <= now;

/** When a meetup leaves the lists: 24 h after its start, or 24 h after it was created when no start time is known */
export const meetupEndsAt = (dateTimeIso: string | undefined, now: number): number => {
  const start = dateTimeIso ? Date.parse(dateTimeIso) : NaN;
  return (Number.isFinite(start) ? start : now) + MEETUP_ARCHIVE_AFTER_MS;
};

/** Same, for a meetup that may come from an older build without `endsAt`; null when it cannot be known */
export const meetupArchiveTime = (m: { endsAt?: number; dateTimeIso?: string }): number | null => {
  if (typeof m.endsAt === 'number') return m.endsAt;
  const start = m.dateTimeIso ? Date.parse(m.dateTimeIso) : NaN;
  return Number.isFinite(start) ? start + MEETUP_ARCHIVE_AFTER_MS : null;
};

export const isMeetupArchived = (m: { endsAt?: number; dateTimeIso?: string }, now: number): boolean => {
  const end = meetupArchiveTime(m);
  return end !== null && end <= now;
};
