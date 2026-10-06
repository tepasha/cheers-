/**
 * Shared collections are written by other clients, so what the app reads from them is untrusted. These readers must
 * turn any document (a null participant, a number where text belongs, a missing field) into either a well-formed
 * value or null, and never throw: before them, one malformed meetup crashed the app of every user (audit security-1).
 */
import { describe, expect, it } from 'vitest';
import { readCloudChat, readCloudHangout, readCloudMeetup, readEach, readMeetupParticipant, timeMillis } from '@/logic/cloudData';

const entry = (uid: string, over: Record<string, unknown> = {}) => ({ userId: uid, userName: uid, userAvatar: '', role: 'member', status: 'going', ...over });
const meetup = (over: Record<string, unknown> = {}) => ({
  id: 'm1', title: 'Настілки', description: '', venueName: 'Squat', venueAddress: '', scheduledDate: '01.10.2026', scheduledTime: '19:00',
  maxParticipants: 6, participants: { alice: entry('alice', { role: 'host' }), bob: entry('bob') }, creatorId: 'alice', creatorName: 'Alice',
  creatorAvatar: '', status: 'upcoming', createdAt: 'x', endsAt: 123, ...over,
});

// The values an attacker can put where an object or text is expected
const JUNK: unknown[] = [null, undefined, 0, 1, '', 'x', true, [], [null], {}, { toString: 1 }, Symbol('s'), () => 1, NaN];

describe('meetups', () => {
  it('reads a well-formed meetup, host first', () => {
    const m = readCloudMeetup(meetup())!;
    expect(m.participants.map((p) => p.userId)).toEqual(['alice', 'bob']);
    expect(m.participants[0].role).toBe('host');
    expect(m.endsAt).toBe(123);
  });

  it('skips malformed participant entries instead of crashing (the null-participant attack)', () => {
    const m = readCloudMeetup(meetup({ participants: { alice: entry('alice', { role: 'host' }), z: null, y: 1, x: 'host', w: [], v: { role: 'host' } } }))!;
    expect(m.participants.map((p) => p.userId)).toEqual(['alice']);
  });

  it('does not believe an entry that claims another uid than its key, or a self-declared host', () => {
    const m = readCloudMeetup(meetup({ participants: { alice: entry('alice', { role: 'host' }), mallory: entry('alice'), eve: entry('eve', { role: 'host' }) } }))!;
    expect(m.participants.map((p) => [p.userId, p.role])).toEqual([['alice', 'host'], ['eve', 'member']]);
  });

  it('normalises unknown roles and statuses', () => {
    expect(readMeetupParticipant(entry('bob', { role: 'admin', status: 'lol' }), 'bob')).toMatchObject({ role: 'member', status: 'invited' });
  });

  it('returns null for a document without identity, and never throws on junk anywhere', () => {
    expect(readCloudMeetup(meetup({ id: 5 }))).toBeNull();
    expect(readCloudMeetup(meetup({ title: { t: 1 } }))).toBeNull();
    for (const junk of JUNK) {
      expect(() => readCloudMeetup(junk)).not.toThrow();
      for (const field of ['participants', 'title', 'venueName', 'maxParticipants', 'status', 'lat', 'creatorName', 'endsAt']) {
        expect(() => readCloudMeetup(meetup({ [field]: junk }))).not.toThrow();
      }
    }
  });

  it('every text field the screens render is a string', () => {
    const m = readCloudMeetup(meetup({ venueName: 5, creatorName: { x: 1 }, drinkPreference: ['x'], maxParticipants: 'many', status: 'weird' }))!;
    expect(m.venueName).toBe('');
    expect(m.creatorName).toBe('');
    expect(m.drinkPreference).toBeUndefined();
    expect(m.maxParticipants).toBe(6);
    expect(m.status).toBe('upcoming');
  });
});

describe('chats', () => {
  const chat = (over: Record<string, unknown> = {}) => ({
    members: ['alice', 'bob'], isGroup: false, profiles: { bob: { name: 'Bob', avatar: '' } }, lastCipherPayload: 'enc:v2:a:b',
    lastSenderId: 'bob', lastMessageTime: '12:00', updatedAt: 'n', ...over,
  });

  it('reads a well-formed chat', () => {
    expect(readCloudChat('dm_alice_bob', chat(), 'alice')).toMatchObject({ id: 'dm_alice_bob', members: ['alice', 'bob'], isGroup: false });
  });

  it('survives the inbox-killing documents (audit security-2): participants:1, a numeric preview, a profile string', () => {
    const c = readCloudChat('grp_x_1', chat({ isGroup: true, participants: 1, lastCipherPayload: 42, profiles: { bob: 'Bob' } }), 'alice')!;
    expect(c.participants).toBeUndefined();
    expect(c.lastCipherPayload).toBeUndefined();
    expect(c.profiles).toEqual({});
  });

  it('drops participant items that are not people, and duplicate or non-string members', () => {
    const c = readCloudChat('grp_x_1', chat({ isGroup: true, members: ['alice', 'bob', 'bob', 7, null], participants: [null, 1, { id: 'bob', name: 5 }] }), 'alice')!;
    expect(c.members).toEqual(['alice', 'bob']);
    expect(c.participants).toEqual([{ id: 'bob', name: '', avatar: '', role: 'member' }]);
  });

  it('refuses a chat this user is not in, or one without two members', () => {
    expect(readCloudChat('c', chat({ members: ['bob', 'carol'] }), 'alice')).toBeNull();
    expect(readCloudChat('c', chat({ members: ['alice'] }), 'alice')).toBeNull();
    expect(readCloudChat('c', chat({ members: 'alice,bob' }), 'alice')).toBeNull();
  });

  it('never throws on junk', () => {
    for (const junk of JUNK) {
      expect(() => readCloudChat('c', junk, 'alice')).not.toThrow();
      for (const field of ['members', 'participants', 'profiles', 'lastCipherPayload', 'groupName', 'isGroup']) {
        expect(() => readCloudChat('c', chat({ [field]: junk }), 'alice')).not.toThrow();
      }
    }
  });
});

describe('tables', () => {
  const table = (over: Record<string, unknown> = {}) => ({
    userId: 'alice', userName: 'Alice', barName: 'Squat', drinkPreference: 'craft', expiresAt: 999, joinedUsers: ['alice'], ...over,
  });

  it('keeps text fields as text and seats as a list of ids', () => {
    const h = readCloudHangout('h1', table({ drinkPreference: { __proto__: 1 }, joinedUsers: ['alice', 3, null, 'bob'], lat: 'x' }))!;
    expect(h.drinkPreference).toBe('');
    expect(h.joinedUsers).toEqual(['alice', 'bob']);
    expect(h.lat).toBeUndefined();
  });

  it('needs an owner and a numeric expiry', () => {
    expect(readCloudHangout('h1', table({ userId: 1 }))).toBeNull();
    expect(readCloudHangout('h1', table({ expiresAt: 'later' }))).toBeNull();
  });

  it('never throws on junk', () => {
    for (const junk of JUNK) expect(() => readCloudHangout('h', junk)).not.toThrow();
  });
});

describe('helpers', () => {
  it('readEach keeps going past an item that throws', () => {
    expect(readEach([1, 2, 3], (n) => {
      if (n === 2) throw new Error('bad');
      return n * 10;
    })).toEqual([10, 30]);
  });

  it('timeMillis reads a server Timestamp and a legacy ISO string, and gives 0 for anything else', () => {
    expect(timeMillis({ toMillis: () => 1234 })).toBe(1234);
    expect(timeMillis('1970-01-01T00:00:01.000Z')).toBe(1000);
    for (const junk of [null, 5, 'nonsense', {}, { toMillis: () => 'x' }]) expect(timeMillis(junk)).toBe(0);
  });
});
