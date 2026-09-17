import { GroupMeetup, MeetupParticipant, BuddyProfile } from '../types';
import { sounds } from './soundService';
import { gamificationService } from './gamificationService';
import { pushNotificationService } from './pushNotificationService';
import { db } from './firebase';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';

const STORAGE_KEY = 'budmo_scheduled_group_meetups_v1';

export const INITIAL_GROUP_MEETUPS: GroupMeetup[] = [
  {
    id: 'meetup-catan-squat17b',
    title: '🎲 Крафтовий вечір & настілки (Catan + Кодові імена)',
    description: 'Беремо настілку Catan та Кодові імена! Замовляємо сидр та крафтовий ель у затишному дворику на Подолі. Хто любить настілки чи просто хоче поспілкуватися — велкам!',
    venueName: 'Squat 17b',
    venueAddress: 'Поділ, вул. Терещенківська, 17б',
    scheduledDate: 'Сьогодні',
    scheduledTime: '19:30',
    dateTimeIso: new Date(Date.now() + 3.5 * 3600 * 1000).toISOString(),
    drinkPreference: 'Крафтове пиво & Сидр',
    maxParticipants: 6,
    topicTag: 'Настілки & Крафт',
    creatorId: 'buddy-1',
    creatorName: 'Богдан',
    creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
    status: 'upcoming',
    lat: 50.4415,
    lng: 30.514,
    createdAt: 'Сьогодні, 14:20',
    participants: [
      {
        userId: 'buddy-1',
        userName: 'Богдан',
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
        role: 'host',
        status: 'going',
        joinedAt: '14:20',
      },
      {
        userId: 'buddy-2',
        userName: 'Софія',
        userAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
        role: 'member',
        status: 'going',
        joinedAt: '15:10',
      },
      {
        userId: 'buddy-3',
        userName: 'Тарас',
        userAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=80',
        role: 'member',
        status: 'going',
        joinedAt: '16:05',
      },
      {
        userId: 'buddy-4',
        userName: 'Олена',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80',
        role: 'member',
        status: 'invited',
        joinedAt: '16:30',
      },
    ],
  },
  {
    id: 'meetup-it-punkcraft',
    title: "💻 П'ятничний IT-мітап: React Native, AI & дегустація IPA",
    description: "Традиційний п'ятничний збір інженерів та дизайнерів. Говоримо про запуск додатків, AI агентів, архітектуру та відпочиваємо після насиченого спринту.",
    venueName: 'Punkcraft',
    venueAddress: 'Поділ, вул. Ігорівська, 14',
    scheduledDate: "П'ятниця, 18 вересня",
    scheduledTime: '20:00',
    dateTimeIso: new Date(Date.now() + 2 * 86400 * 1000).toISOString(),
    drinkPreference: 'Крафтовий IPA & DIPA',
    maxParticipants: 8,
    topicTag: 'IT & Розробка',
    creatorId: 'buddy-5',
    creatorName: 'Максим',
    creatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
    status: 'upcoming',
    lat: 50.4608,
    lng: 30.5218,
    createdAt: 'Вчора, 18:00',
    participants: [
      {
        userId: 'buddy-5',
        userName: 'Максим',
        userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
        role: 'host',
        status: 'going',
        joinedAt: 'Вчора',
      },
      {
        userId: 'buddy-1',
        userName: 'Богдан',
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
        role: 'member',
        status: 'going',
        joinedAt: 'Вчора',
      },
      {
        userId: 'buddy-6',
        userName: 'Андрій',
        userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80',
        role: 'member',
        status: 'going',
        joinedAt: 'Сьогодні, 11:00',
      },
    ],
  },
  {
    id: 'meetup-wine-winbar',
    title: '🍷 Винний вечір & дегустація оранжів',
    description: 'Замовляємо дегустаційний сет українських та європейських помаранчевих вин, сирне плато. Неспішні бесіди про подорожі та кіно.',
    venueName: 'Win Bar',
    venueAddress: 'Поділ, вул. Хорива, 16/7',
    scheduledDate: 'Субота, 19 вересня',
    scheduledTime: '18:30',
    dateTimeIso: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
    drinkPreference: 'Сухе біле / Оранж',
    maxParticipants: 5,
    topicTag: 'Вино & Енологія',
    creatorId: 'buddy-2',
    creatorName: 'Софія',
    creatorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
    status: 'upcoming',
    lat: 50.467,
    lng: 30.5145,
    createdAt: 'Сьогодні, 10:15',
    participants: [
      {
        userId: 'buddy-2',
        userName: 'Софія',
        userAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
        role: 'host',
        status: 'going',
        joinedAt: '10:15',
      },
      {
        userId: 'buddy-4',
        userName: 'Олена',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80',
        role: 'member',
        status: 'going',
        joinedAt: '12:40',
      },
      {
        userId: 'buddy-7',
        userName: 'Катерина',
        userAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80',
        role: 'member',
        status: 'invited',
        joinedAt: '13:00',
      },
    ],
  },
];

class GroupMeetupService {
  private meetups: GroupMeetup[] = [];
  private listeners: Array<(meetups: GroupMeetup[]) => void> = [];
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.meetups = parsed;
        } else {
          this.meetups = [...INITIAL_GROUP_MEETUPS];
        }
      } else {
        this.meetups = [...INITIAL_GROUP_MEETUPS];
        this.saveLocal();
      }
    } catch {
      this.meetups = [...INITIAL_GROUP_MEETUPS];
    }

    // Try listening to Cloud Firestore
    this.setupFirestoreSync();
  }

  private saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.meetups));
    } catch (e) {
      console.warn('Could not cache group meetups in localStorage', e);
    }
  }

  private notify() {
    this.saveLocal();
    const copy = [...this.meetups];
    this.listeners.forEach((l) => {
      try {
        l(copy);
      } catch (err) {
        console.error('Group meetup listener error:', err);
      }
    });
  }

  private setupFirestoreSync() {
    try {
      const meetupsCol = collection(db, 'group_meetups');
      onSnapshot(
        meetupsCol,
        (snapshot) => {
          if (snapshot.empty) return;
          const cloudMeetups: GroupMeetup[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as GroupMeetup;
            if (data && data.id) {
              cloudMeetups.push(data);
            }
          });

          if (cloudMeetups.length > 0) {
            // Merge with local items
            const map = new Map<string, GroupMeetup>();
            this.meetups.forEach((m) => map.set(m.id, m));
            cloudMeetups.forEach((m) => map.set(m.id, m));
            this.meetups = Array.from(map.values());
            this.notify();
          }
        },
        (error) => {
          console.warn('[Firestore] group_meetups sync warning:', error);
        }
      );
    } catch (err) {
      console.warn('Could not setup Firestore sync for group_meetups:', err);
    }
  }

  public getMeetups(): GroupMeetup[] {
    return [...this.meetups];
  }

  public getMeetupById(id: string): GroupMeetup | undefined {
    return this.meetups.find((m) => m.id === id);
  }

  /**
   * Create a new scheduled group meetup
   */
  public createMeetup(params: {
    title: string;
    description: string;
    venueName: string;
    venueAddress: string;
    scheduledDate: string;
    scheduledTime: string;
    drinkPreference?: string;
    maxParticipants: number;
    creatorId?: string;
    creatorName?: string;
    creatorAvatar?: string;
    lat?: number;
    lng?: number;
    topicTag?: string;
    invitedBuddies?: BuddyProfile[];
  }): GroupMeetup {
    const creatorId = params.creatorId || 'me';
    const creatorName = params.creatorName || 'Павло (Ви)';
    const creatorAvatar =
      params.creatorAvatar ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80';

    const participants: MeetupParticipant[] = [
      {
        userId: creatorId,
        userName: creatorName,
        userAvatar: creatorAvatar,
        role: 'host',
        status: 'going',
        joinedAt: 'Організатор',
      },
    ];

    // Add initial invited buddies
    if (params.invitedBuddies && params.invitedBuddies.length > 0) {
      params.invitedBuddies.forEach((b) => {
        participants.push({
          userId: b.id,
          userName: b.name,
          userAvatar: b.avatar,
          role: 'member',
          status: 'invited',
          joinedAt: 'Запрошено',
        });
      });
    }

    const newMeetup: GroupMeetup = {
      id: `meetup-${Date.now()}`,
      title: params.title.trim(),
      description: params.description.trim(),
      venueName: params.venueName.trim(),
      venueAddress: params.venueAddress.trim(),
      scheduledDate: params.scheduledDate.trim(),
      scheduledTime: params.scheduledTime.trim(),
      drinkPreference: params.drinkPreference?.trim() || 'Келих за смаком',
      maxParticipants: params.maxParticipants || 6,
      participants,
      creatorId,
      creatorName,
      creatorAvatar,
      status: 'upcoming',
      lat: params.lat,
      lng: params.lng,
      createdAt: 'Щойно',
      topicTag: params.topicTag || 'Зустріч',
    };

    this.meetups.unshift(newMeetup);
    this.notify();

    // Sound effect
    sounds.playMatchCheer();

    // Reward XP
    gamificationService.addBonusXp(creatorId, 75, `Заплановано групову зустріч «${newMeetup.title}»`);

    // Dispatch notification
    pushNotificationService.dispatch({
      title: '🗓️ Нова групова зустріч запланована!',
      body: `«${newMeetup.title}» у закладі ${newMeetup.venueName}`,
      subtitle: `${newMeetup.scheduledDate} о ${newMeetup.scheduledTime} (+75 XP)`,
      type: 'meetup_invite',
      venueName: newMeetup.venueName,
      actionText: 'Переглянути',
    });

    // Sync to Firestore
    this.syncToFirestore(newMeetup);

    return newMeetup;
  }

  /**
   * Invite more people to an existing scheduled meetup
   */
  public inviteBuddies(
    meetupId: string,
    buddies: BuddyProfile[],
    inviterName: string = 'Ви'
  ): { count: number; updatedMeetup: GroupMeetup | null } {
    const meetup = this.meetups.find((m) => m.id === meetupId);
    if (!meetup) return { count: 0, updatedMeetup: null };

    let addedCount = 0;
    const existingIds = new Set(meetup.participants.map((p) => p.userId));

    buddies.forEach((buddy) => {
      if (!existingIds.has(buddy.id)) {
        meetup.participants.push({
          userId: buddy.id,
          userName: buddy.name,
          userAvatar: buddy.avatar,
          role: 'member',
          status: 'invited',
          joinedAt: 'Запрошено щойно',
        });
        existingIds.add(buddy.id);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      this.notify();
      sounds.playClink();

      // Bonus XP for community building (+20 XP per invited friend)
      gamificationService.addBonusXp(
        'me',
        addedCount * 20,
        `Запрошено ${addedCount} друзів до зустрічі «${meetup.title}»`
      );

      // Trigger Push notification
      const names = buddies.slice(0, 2).map((b) => b.name).join(', ') + (buddies.length > 2 ? ` та ще ${buddies.length - 2}` : '');
      pushNotificationService.dispatch({
        title: `👥 Додано людей до зустрічі (${addedCount})!`,
        body: `${inviterName} запросив(ла) ${names} до «${meetup.title}»`,
        subtitle: `${meetup.venueName} • ${meetup.scheduledDate} о ${meetup.scheduledTime}`,
        type: 'meetup_invite',
        venueName: meetup.venueName,
        actionText: 'Переглянути',
      });

      this.syncToFirestore(meetup);
    }

    return { count: addedCount, updatedMeetup: meetup };
  }

  /**
   * Join a meetup (mark current user as 'going')
   */
  public joinMeetup(
    meetupId: string,
    user: { userId: string; userName: string; userAvatar: string }
  ): boolean {
    const meetup = this.meetups.find((m) => m.id === meetupId);
    if (!meetup) return false;

    const existing = meetup.participants.find((p) => p.userId === user.userId);
    if (existing) {
      existing.status = 'going';
      existing.joinedAt = 'Підтверджено';
    } else {
      // Check max capacity
      const goingCount = meetup.participants.filter((p) => p.status === 'going').length;
      if (goingCount >= meetup.maxParticipants) {
        return false;
      }

      meetup.participants.push({
        userId: user.userId,
        userName: user.userName,
        userAvatar: user.userAvatar,
        role: 'member',
        status: 'going',
        joinedAt: 'Щойно',
      });
    }

    this.notify();
    sounds.playClink();

    // Reward XP
    gamificationService.addBonusXp(
      user.userId,
      35,
      `Приєднався до групової зустрічі «${meetup.title}»`
    );

    // Push notification
    pushNotificationService.dispatch({
      title: '🍻 Ви приєдналися до групової зустрічі!',
      body: `«${meetup.title}» у ${meetup.venueName}`,
      subtitle: `${meetup.scheduledDate} о ${meetup.scheduledTime} (+35 XP)`,
      type: 'meetup_joined',
      venueName: meetup.venueName,
    });

    this.syncToFirestore(meetup);
    return true;
  }

  /**
   * Leave a meetup
   */
  public leaveMeetup(meetupId: string, userId: string): boolean {
    const meetup = this.meetups.find((m) => m.id === meetupId);
    if (!meetup) return false;

    // Filter out user or mark declined
    meetup.participants = meetup.participants.filter((p) => p.userId !== userId);
    this.notify();
    sounds.playTap();
    this.syncToFirestore(meetup);
    return true;
  }

  /**
   * Remove participant (e.g. host kick or decline)
   */
  public removeParticipant(meetupId: string, userId: string): boolean {
    return this.leaveMeetup(meetupId, userId);
  }

  /**
   * Cancel meetup (by host)
   */
  public cancelMeetup(meetupId: string): boolean {
    const meetup = this.meetups.find((m) => m.id === meetupId);
    if (!meetup) return false;

    meetup.status = 'cancelled';
    this.notify();
    sounds.playTap();
    this.syncToFirestore(meetup);
    return true;
  }

  /**
   * Generate an .ics calendar file data URI for Google / Apple / Outlook calendar
   */
  public generateIcsFile(meetup: GroupMeetup): string {
    const now = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;

    // Try parsing date or fallback to tomorrow
    let startIso = meetup.dateTimeIso ? new Date(meetup.dateTimeIso) : new Date(Date.now() + 4 * 3600 * 1000);
    if (isNaN(startIso.getTime())) {
      startIso = new Date(Date.now() + 4 * 3600 * 1000);
    }
    const endIso = new Date(startIso.getTime() + 2.5 * 3600 * 1000); // 2.5 hours

    const startStr = `${startIso.getUTCFullYear()}${pad(startIso.getUTCMonth() + 1)}${pad(startIso.getUTCDate())}T${pad(startIso.getUTCHours())}${pad(startIso.getUTCMinutes())}00Z`;
    const endStr = `${endIso.getUTCFullYear()}${pad(endIso.getUTCMonth() + 1)}${pad(endIso.getUTCDate())}T${pad(endIso.getUTCHours())}${pad(endIso.getUTCMinutes())}00Z`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Budmo//GroupMeetups//UK',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${meetup.id}@budmo.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:🍻 ${meetup.title}`,
      `DESCRIPTION:${meetup.description}\\nФормат: ${meetup.drinkPreference || 'Келих'}\\nОрганізатор: ${meetup.creatorName}`,
      `LOCATION:${meetup.venueName}, ${meetup.venueAddress}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`;
  }

  /**
   * Download .ics event for user's calendar app
   */
  public downloadCalendarEvent(meetup: GroupMeetup) {
    try {
      const uri = this.generateIcsFile(meetup);
      const link = document.createElement('a');
      link.href = uri;
      link.setAttribute('download', `${meetup.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      sounds.playClink();
    } catch (e) {
      console.warn('Calendar download error:', e);
    }
  }

  private async syncToFirestore(meetup: GroupMeetup) {
    try {
      const docRef = doc(db, 'group_meetups', meetup.id);
      await setDoc(docRef, {
        ...meetup,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Firestore] Group meetup sync warning:', err);
    }
  }

  public subscribe(listener: (meetups: GroupMeetup[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.meetups]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const groupMeetupService = new GroupMeetupService();
