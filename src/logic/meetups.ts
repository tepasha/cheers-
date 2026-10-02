import { ph, tr } from '../services/i18nService';
import type { AppLanguage } from '../types';
import { meetupEndsAt } from './lifecycle';
import { GroupMeetup, MeetupParticipant, BuddyProfile } from '../types';

export interface CreateMeetupInput {
  title: string;
  description: string;
  venueName: string;
  venueAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  dateTimeIso?: string;
  drinkPreference?: string;
  maxParticipants: number;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  lat?: number;
  lng?: number;
  topicTag?: string;
  invitedBuddies?: BuddyProfile[];
}

export interface Attendee {
  userId: string;
  userName: string;
  userAvatar: string;
}

export function buildMeetup(params: CreateMeetupInput, now = Date.now()): GroupMeetup {
  const participants: MeetupParticipant[] = [
    {
      userId: params.creatorId,
      userName: params.creatorName,
      userAvatar: params.creatorAvatar,
      role: 'host',
      status: 'going',
      joinedAt: ph('Організатор'),
    },
    ...(params.invitedBuddies ?? []).map(
      (b): MeetupParticipant => ({
        userId: b.id,
        userName: b.name,
        userAvatar: b.avatar,
        role: 'member',
        status: 'invited',
        joinedAt: ph('Запрошено'),
      })
    ),
  ];

  return {
    id: `meetup-${now}`,
    title: params.title.trim(),
    description: params.description.trim(),
    venueName: params.venueName.trim(),
    venueAddress: params.venueAddress.trim(),
    scheduledDate: params.scheduledDate.trim(),
    scheduledTime: params.scheduledTime.trim(),
    dateTimeIso: params.dateTimeIso,
    endsAt: meetupEndsAt(params.dateTimeIso, now),
    drinkPreference: params.drinkPreference?.trim() || ph('Келих за смаком'),
    maxParticipants: params.maxParticipants || 6,
    participants,
    creatorId: params.creatorId,
    creatorName: params.creatorName,
    creatorAvatar: params.creatorAvatar,
    status: 'upcoming',
    lat: params.lat,
    lng: params.lng,
    createdAt: ph('Щойно'),
    topicTag: params.topicTag || ph('Зустріч'),
  };
}

/** Adds buddies that are not yet participants. `count` is how many were actually added. */
export function addInvitees(meetup: GroupMeetup, buddies: BuddyProfile[]): { meetup: GroupMeetup; count: number } {
  const existingIds = new Set(meetup.participants.map((p) => p.userId));
  const added: MeetupParticipant[] = [];

  buddies.forEach((buddy) => {
    if (existingIds.has(buddy.id)) return;
    existingIds.add(buddy.id);
    added.push({
      userId: buddy.id,
      userName: buddy.name,
      userAvatar: buddy.avatar,
      role: 'member',
      status: 'invited',
      joinedAt: ph('Запрошено щойно'),
    });
  });

  if (added.length === 0) return { meetup, count: 0 };
  return { meetup: { ...meetup, participants: [...meetup.participants, ...added] }, count: added.length };
}

/** Marks the user as going. Returns null when the meetup is full. */
export function joinMeetup(meetup: GroupMeetup, user: Attendee): GroupMeetup | null {
  const existing = meetup.participants.find((p) => p.userId === user.userId);

  if (existing) {
    return {
      ...meetup,
      participants: meetup.participants.map((p) =>
        p.userId === user.userId ? { ...p, status: 'going', joinedAt: ph('Підтверджено') } : p
      ),
    };
  }

  const goingCount = meetup.participants.filter((p) => p.status === 'going').length;
  if (goingCount >= meetup.maxParticipants) return null;

  return {
    ...meetup,
    participants: [
      ...meetup.participants,
      {
        userId: user.userId,
        userName: user.userName,
        userAvatar: user.userAvatar,
        role: 'member',
        status: 'going',
        joinedAt: ph('Щойно'),
      },
    ],
  };
}

export function leaveMeetup(meetup: GroupMeetup, userId: string): GroupMeetup {
  return { ...meetup, participants: meetup.participants.filter((p) => p.userId !== userId) };
}

export function cancelMeetup(meetup: GroupMeetup): GroupMeetup {
  return { ...meetup, status: 'cancelled' };
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const icsStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

/** iCalendar (.ics) document for a meetup, importable by Google / Apple / Outlook calendars */
export function generateIcsContent(meetup: GroupMeetup, now = new Date(), lang: AppLanguage = 'uk'): string {
  let start = meetup.dateTimeIso ? new Date(meetup.dateTimeIso) : new Date(now.getTime() + 4 * 3600 * 1000);
  if (isNaN(start.getTime())) start = new Date(now.getTime() + 4 * 3600 * 1000);
  const end = new Date(start.getTime() + 2.5 * 3600 * 1000);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Budmo//GroupMeetups//UK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${meetup.id}@budmo.app`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:🍻 ${meetup.title}`,
    `DESCRIPTION:${meetup.description}\\n${tr('Формат: {drink}', lang, { drink: tr(meetup.drinkPreference || ph('Келих'), lang) })}\\n${tr('Організатор: {name}', lang, { name: meetup.creatorName })}`,
    `LOCATION:${meetup.venueName}, ${meetup.venueAddress}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Firestore shape: participants keyed by uid, so rules can confine each person to their own entry */
export type CloudMeetup = Omit<GroupMeetup, 'participants'> & { participants: Record<string, MeetupParticipant> };

export function meetupToCloud(meetup: GroupMeetup): CloudMeetup {
  return {
    ...meetup,
    participants: Object.fromEntries(meetup.participants.map((p) => [p.userId, p])),
  };
}

export function meetupFromCloud(data: CloudMeetup): GroupMeetup {
  const participants = Object.values(data.participants ?? {});
  // Host first, then in join order as stored; a stable order keeps the UI from jumping between snapshots
  participants.sort((a, b) => Number(b.role === 'host') - Number(a.role === 'host'));
  return { ...data, participants };
}
