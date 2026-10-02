import { describe, expect, it } from 'vitest';
import {
  HANGOUT_MAX_TTL_MS,
  HANGOUT_TTL_MS,
  MEETUP_ARCHIVE_AFTER_MS,
  MEETUP_RETENTION_MS,
  MEETUP_MAX_PLANNING_MS,
  hangoutExpiresAt,
  isHangoutExpired,
  isMeetupArchived,
  meetupArchiveTime,
  meetupEndsAt,
} from '@/logic/lifecycle';
import * as server from '../../../functions/src/lifecycle';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe('lifecycle decisions', () => {
  it('a table lives 4 hours, a meetup is archived 24 hours after it starts, the archive is kept 30 days', () => {
    expect(HANGOUT_TTL_MS).toBe(4 * HOUR);
    expect(MEETUP_ARCHIVE_AFTER_MS).toBe(DAY);
    expect(MEETUP_RETENTION_MS).toBe(30 * DAY);
  });

  it('the server cleanup uses exactly the same numbers as the app', () => {
    expect(server.HANGOUT_TTL_MS).toBe(HANGOUT_TTL_MS);
    expect(server.MEETUP_ARCHIVE_AFTER_MS).toBe(MEETUP_ARCHIVE_AFTER_MS);
    expect(server.MEETUP_RETENTION_MS).toBe(MEETUP_RETENTION_MS);
  });

  it('the rules\' bounds match the constants (4 h + 5 min for tables, 91 days for meetups)', () => {
    expect(HANGOUT_MAX_TTL_MS).toBe(14_700_000); // the literal in firestore.rules
    expect(MEETUP_MAX_PLANNING_MS + DAY).toBe(7_862_400_000); // 90 days of planning + the 24 h until it is archived
  });
});

describe('tables', () => {
  it('expire 4 hours after being posted', () => {
    const posted = 1_000_000;
    const h = { expiresAt: hangoutExpiresAt(posted) };
    expect(isHangoutExpired(h, posted + 4 * HOUR - 1)).toBe(false);
    expect(isHangoutExpired(h, posted + 4 * HOUR)).toBe(true);
  });

  it('a table without an expiry (older build) counts as expired rather than immortal', () => {
    expect(isHangoutExpired({}, 0)).toBe(true);
  });
});

describe('meetups', () => {
  const start = Date.parse('2026-10-10T18:00:00Z');

  it('are archived 24 hours after their start', () => {
    const endsAt = meetupEndsAt('2026-10-10T18:00:00Z', 0);
    expect(endsAt).toBe(start + DAY);
    expect(isMeetupArchived({ endsAt }, start + DAY - 1)).toBe(false);
    expect(isMeetupArchived({ endsAt }, start + DAY)).toBe(true);
  });

  it('without a start time they are archived 24 hours after creation', () => {
    expect(meetupEndsAt(undefined, 5_000)).toBe(5_000 + DAY);
    expect(meetupEndsAt('not a date', 5_000)).toBe(5_000 + DAY);
  });

  it('an older meetup without endsAt falls back to its start time, or stays when nothing is known', () => {
    expect(meetupArchiveTime({ dateTimeIso: '2026-10-10T18:00:00Z' })).toBe(start + DAY);
    expect(isMeetupArchived({ dateTimeIso: '2026-10-10T18:00:00Z' }, start + 2 * DAY)).toBe(true);
    expect(meetupArchiveTime({})).toBeNull();
    expect(isMeetupArchived({}, Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});
