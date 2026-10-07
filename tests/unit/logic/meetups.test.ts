import { describe, it, expect } from 'vitest';
import { addInvitees, buildMeetup, cancelMeetup, generateIcsContent, joinMeetup, leaveMeetup } from '@/logic/meetups';
import { BuddyProfile } from '@/types';

const buddy = (id: string): BuddyProfile => ({
  id,
  name: `Buddy ${id}`,
  avatar: '',
  age: 25,
  tagline: '',
  bio: '',
  locationName: '',
  distanceKm: 1,
  coordinates: { lat: 0, lng: 0 },
  preferredDrinks: [],
  paymentRule: 'split_50_50',
  currentMood: 'chill_talk',
  favoriteBars: [],
  talkTopics: [],
  online: true,
});

const base = () =>
  buildMeetup(
    {
      title: '  Настілки ',
      description: 'desc',
      venueName: 'Squat 17b',
      venueAddress: 'Київ',
      scheduledDate: '01.10.2026',
      scheduledTime: '19:00',
      dateTimeIso: '2026-10-01T16:00:00.000Z',
      maxParticipants: 2,
      creatorId: 'host',
      creatorName: 'Host',
      creatorAvatar: '',
      invitedBuddies: [buddy('a')],
    },
    1000
  );

describe('meetup logic', () => {
  it('is archived 24 hours after its start, or 24 hours after creation when no time was chosen', () => {
    expect(base().endsAt).toBe(Date.parse('2026-10-01T16:00:00.000Z') + 24 * 3600_000);
    const undated = buildMeetup({ title: 'x', description: '', venueName: '', venueAddress: '', scheduledDate: '', scheduledTime: '', maxParticipants: 2, creatorId: 'h', creatorName: 'H', creatorAvatar: '' }, 5000);
    expect(undated.endsAt).toBe(5000 + 24 * 3600_000);
  });

  it('builds a meetup with the host going and invitees invited', () => {
    const m = base();
    expect(m.id).toBe('meetup-1000');
    expect(m.title).toBe('Настілки');
    expect(m.participants.map((p) => [p.userId, p.role, p.status])).toEqual([
      ['host', 'host', 'going'],
      ['a', 'member', 'invited'],
    ]);
  });

  it('invites only new people and reports the real count', () => {
    const { meetup, count } = addInvitees({ ...base(), maxParticipants: 3 }, [buddy('a'), buddy('b'), buddy('b')]);
    expect(count).toBe(1);
    expect(meetup.participants).toHaveLength(3);
  });

  it('returns the same object when nobody new is invited', () => {
    const m = base();
    expect(addInvitees(m, [buddy('a')]).meetup).toBe(m);
  });

  it('confirms an invited user without hitting the capacity check', () => {
    const joined = joinMeetup({ ...base(), endsAt: Date.now() + 86400000 }, { userId: 'a', userName: 'A', userAvatar: '' });
    expect(joined?.participants.find((p) => p.userId === 'a')?.status).toBe('going');
  });

  it('refuses new attendees once the meetup is full', () => {
    const full = joinMeetup({ ...base(), endsAt: Date.now() + 86400000 }, { userId: 'a', userName: 'A', userAvatar: '' })!; // host + a = 2 = max
    expect(joinMeetup(full, { userId: 'z', userName: 'Z', userAvatar: '' })).toBeNull();
  });

  it('does not mutate the original when joining', () => {
    const m = base();
    joinMeetup(m, { userId: 'a', userName: 'A', userAvatar: '' });
    expect(m.participants.find((p) => p.userId === 'a')?.status).toBe('invited');
  });

  it('removes a participant on leave and marks cancelled', () => {
    expect(leaveMeetup(base(), 'a').participants.map((p) => p.userId)).toEqual(['host']);
    expect(cancelMeetup(base()).status).toBe('cancelled');
  });

  it('generates a valid iCalendar document', () => {
    const ics = generateIcsContent(base(), new Date('2026-09-30T10:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261001T160000Z');
    expect(ics).toContain('DTEND:20261001T183000Z');
    expect(ics).toContain('UID:meetup-1000@budmo.app');
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
  });
});
