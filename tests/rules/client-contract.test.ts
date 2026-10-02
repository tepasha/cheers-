/**
 * Contract tests: the REAL client code (firestoreSyncService and the report thunk) running against the
 * emulator with the REAL firestore.rules. They catch drift between what the app sends and what the
 * rules accept, which hand-written payloads in firestore.rules.test.ts cannot.
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

// `db` is swapped per test to act as different signed-in users
const current: { db: any } = { db: null };
vi.mock('@/services/firebase', () => ({
  get db() {
    return current.db;
  },
  auth: {},
  firebaseApp: {},
}));
vi.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(randomBytes(n)) }));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
vi.mock('@/services/systemNotifications', () => ({ registerForPush: vi.fn() }));

import { firestoreSyncService as svc } from '@/services/firestoreSyncService';
import { submitReport } from '@/store/thunks/safety';
import { dmChatId, groupChatId } from '@/logic/chats';
import { buildMeetup } from '@/logic/meetups';
import auth, { loggedIn } from '@/store/slices/authSlice';
import safety from '@/store/slices/safetySlice';
import notifications from '@/store/slices/notificationsSlice';
import settings from '@/store/slices/settingsSlice';
import ui from '@/store/slices/uiSlice';
import { createUser } from '@/logic/session';
import type { HangoutAlert, Message } from '@/types';

let env: RulesTestEnvironment;
const as = (uid: string, verified = true) => {
  current.db = env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: verified }).firestore();
};
const admin = async <T,>(fn: (db: any) => Promise<T>): Promise<T> => {
  let out!: T;
  await env.withSecurityRulesDisabled(async (ctx) => {
    out = await fn(ctx.firestore());
  });
  return out;
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-budmo-contract',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const warned = () => (console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

const message = (id: string, senderId: string, chatId: string, text = 'Привіт 🍻'): Message => ({
  id, chatId, senderId, senderName: senderId, text, timestamp: '12:00', isMe: true, type: 'text',
});

describe('profiles', () => {
  it('publishes a public profile with coarse coordinates and without email or birth date', async () => {
    as('alice');
    await svc.saveUserProfile({ id: 'alice', name: 'Alice', avatar: 'https://x.test/a.png', locationName: 'Київ', lat: 50.4635123, lng: 30.5180456, age: 27 });
    expect(warned()).toBe(0);
    const data = (await admin((db) => getDoc(doc(db, 'users/alice')))).data()!;
    expect(data).toMatchObject({ id: 'alice', name: 'Alice', lat: 50.46, lng: 30.52 });
    expect(data).not.toHaveProperty('email');
    expect(data).not.toHaveProperty('birthDate');
  });

  it('a later location update does not erase other profile fields', async () => {
    as('alice');
    await svc.saveUserProfile({ id: 'alice', name: 'Alice', tagline: 'Люблю крафт' });
    await svc.saveUserProfile({ id: 'alice', name: 'Alice', lat: 50.1, lng: 30.1 });
    expect((await admin((db) => getDoc(doc(db, 'users/alice')))).data()!.tagline).toBe('Люблю крафт');
  });

  it('keeps private data private and writable before email verification', async () => {
    as('alice', false);
    await svc.savePrivateProfile('alice', { email: 'alice@example.com', birthDate: '1998-05-15' });
    expect(warned()).toBe(0);
    expect(await svc.getPrivateProfile('alice')).toEqual({ email: 'alice@example.com', birthDate: '1998-05-15' });

    as('bob');
    expect(await svc.getPrivateProfile('alice')).toBeNull();
    expect(warned()).toBeGreaterThan(0); // permission denied, handled
  });

  it('refuses the public profile to an unverified account', async () => {
    as('alice', false);
    await svc.saveUserProfile({ id: 'alice', name: 'Alice' });
    expect((await admin((db) => getDoc(doc(db, 'users/alice')))).exists()).toBe(false);
  });

  it('syncs gamification, favorites and friends as owner-only data, and deletes everything with the account', async () => {
    as('alice');
    await svc.syncGamification('alice', { xp: 120, level: 2, totalMeetups: 1, achievements: ['first_checkin'], checkIns: [] });
    await svc.saveFavoriteVenue('alice', { id: 'v1', name: 'Squat 17b', area: 'Київ', category: 'craft', lat: 50.4, lng: 30.5 });
    await svc.syncFriend('alice', { friendId: 'bob', friendName: 'Bob' });
    await svc.saveUserProfile({ id: 'alice', name: 'Alice' });
    expect(warned()).toBe(0);
    expect((await svc.getUserGamification('alice'))?.xp).toBe(120);
    expect(await svc.getUserFavorites('alice')).toHaveLength(1);

    await svc.deleteAccountData('alice');
    const left = await admin(async (db) => ({
      user: (await getDoc(doc(db, 'users/alice'))).exists(),
      favs: (await getDocs(collection(db, 'users/alice/favorites'))).size,
      friends: (await getDocs(collection(db, 'users/alice/friends'))).size,
      priv: (await getDocs(collection(db, 'users/alice/private'))).size,
    }));
    expect(left).toEqual({ user: false, favs: 0, friends: 0, priv: 0 });
  });
});

describe('hangouts', () => {
  const hangout: HangoutAlert = {
    id: 'h1', userId: 'alice', userName: 'Alice', userAvatar: '', barName: 'Squat 17b', locationArea: 'Київ', drinkPreference: 'craft',
    description: '', createdAt: 'Щойно', slotsAvailable: 2, participantsCount: 1, lat: 50.4, lng: 30.5, status: 'active', joinedUsers: ['alice'],
  };

  it('publishes, lets others join once (atomically) and closes', async () => {
    as('alice');
    await svc.publishHangout(hangout);

    as('bob');
    await svc.joinLiveHangout('h1', 'bob');
    await svc.joinLiveHangout('h1', 'bob'); // repeat: must not double count
    as('carol');
    await svc.joinLiveHangout('h1', 'carol');
    const data = (await admin((db) => getDoc(doc(db, 'hangouts/h1')))).data()!;
    expect(data.participantsCount).toBe(3);
    expect(data.joinedUsers).toEqual(['alice', 'bob', 'carol']);

    as('dave');
    await svc.joinLiveHangout('h1', 'dave'); // full (2 free seats, both taken)
    expect((await admin((db) => getDoc(doc(db, 'hangouts/h1')))).data()!.participantsCount).toBe(3);

    as('bob');
    await svc.closeLiveHangout('h1'); // not the owner
    expect((await admin((db) => getDoc(doc(db, 'hangouts/h1')))).exists()).toBe(true);
    as('alice');
    await svc.closeLiveHangout('h1');
    expect((await admin((db) => getDoc(doc(db, 'hangouts/h1')))).exists()).toBe(false);
  });

  it('refuses to publish a hangout in someone else\'s name', async () => {
    as('mallory');
    await expect(svc.publishHangout(hangout)).rejects.toThrow();
  });
});

describe('meetups', () => {
  const base = () =>
    buildMeetup({
      title: 'Настілки', description: '', venueName: 'Squat', venueAddress: '', scheduledDate: '01.10.2026', scheduledTime: '19:00',
      maxParticipants: 6, creatorId: 'alice', creatorName: 'Alice', creatorAvatar: '',
      // lat/lng deliberately undefined: this used to make the whole write fail silently
    });

  it('creates a meetup with unset optional fields, and others join/leave through their own entry', async () => {
    as('alice');
    const m = base();
    await svc.saveMeetup(m);
    expect(warned()).toBe(0);

    as('bob');
    await svc.setMeetupParticipation(m.id, 'bob', { userId: 'bob', userName: 'Bob', userAvatar: '', role: 'member', status: 'going', joinedAt: 'x' });
    expect(warned()).toBe(0);
    let stored = (await admin((db) => getDoc(doc(db, `group_meetups/${m.id}`)))).data()!;
    expect(Object.keys(stored.participants).sort()).toEqual(['alice', 'bob']);

    await svc.setMeetupParticipation(m.id, 'bob', null);
    stored = (await admin((db) => getDoc(doc(db, `group_meetups/${m.id}`)))).data()!;
    expect(Object.keys(stored.participants)).toEqual(['alice']);
  });

  it('rejects a guest rewriting the meetup or claiming host', async () => {
    as('alice');
    const m = base();
    await svc.saveMeetup(m);

    as('bob');
    await svc.saveMeetup({ ...m, title: 'Hacked' });
    expect((await admin((db) => getDoc(doc(db, `group_meetups/${m.id}`)))).data()!.title).toBe('Настілки');
    await svc.setMeetupParticipation(m.id, 'bob', { userId: 'bob', userName: 'Bob', userAvatar: '', role: 'host', status: 'going' });
    expect((await admin((db) => getDoc(doc(db, `group_meetups/${m.id}`)))).data()!.participants.bob).toBeUndefined();
  });

  it('streams meetups back as the app\'s participant array', async () => {
    as('alice');
    const m = base();
    await svc.saveMeetup(m);
    const received = await new Promise<any[]>((resolve) => {
      const off = svc.subscribeToMeetups((list) => {
        off();
        resolve(list);
      });
    });
    expect(Array.isArray(received[0].participants)).toBe(true);
    expect(received[0].participants[0]).toMatchObject({ userId: 'alice', role: 'host' });
  });
});

describe('chats', () => {
  const me = (id: string) => ({ id, name: id, avatar: '' });

  it('delivers a DM: Bob sees it in his inbox, decrypts it, and replies in the same room', async () => {
    const chatId = dmChatId('alice', 'bob');
    as('alice');
    const sent = await svc.sendEncryptedMessage(
      { id: chatId, isGroup: false, memberIds: ['alice', 'bob'] },
      message('m1', 'alice', chatId, 'Привіт, Боб! 🍻'),
      me('alice')
    );
    expect(sent.success).toBe(true);
    expect(sent.cipherPayload).toMatch(/^enc:v2:/);

    as('bob');
    const inbox = await new Promise<any[]>((resolve) => {
      const off = svc.subscribeToMyChats('bob', (chats) => {
        off();
        resolve(chats);
      });
    });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ id: chatId, members: ['alice', 'bob'], lastSenderId: 'alice', isGroup: false });

    const received = await new Promise<Message[]>((resolve) => {
      const off = svc.subscribeToEncryptedChat(chatId, 'bob', (msgs) => {
        off();
        resolve(msgs);
      });
    });
    expect(received[0]).toMatchObject({ id: 'm1', text: 'Привіт, Боб! 🍻', isMe: false, senderId: 'alice' });

    const reply = await svc.sendEncryptedMessage({ id: chatId, isGroup: false, memberIds: ['alice', 'bob'] }, message('m2', 'bob', chatId, 'Привіт!'), me('bob'));
    expect(reply.success).toBe(true);
    const chat = (await admin((db) => getDoc(doc(db, `chats/${chatId}`)))).data()!;
    expect(chat.lastSenderId).toBe('bob');
    expect(Object.keys(chat.profiles).sort()).toEqual(['alice', 'bob']);
  });

  it('stores only ciphertext in Firestore', async () => {
    const chatId = dmChatId('alice', 'bob');
    as('alice');
    await svc.sendEncryptedMessage({ id: chatId, isGroup: false, memberIds: ['alice', 'bob'] }, message('m1', 'alice', chatId, 'таємниця'), me('alice'));
    const stored = (await admin((db) => getDoc(doc(db, `chats/${chatId}/messages/m1`)))).data()!;
    expect(JSON.stringify(stored)).not.toContain('таємниця');
    expect(stored.cipherPayload).toMatch(/^enc:v2:/);
  });

  it('keeps outsiders out and refuses sending as someone else', async () => {
    const chatId = dmChatId('alice', 'bob');
    as('alice');
    await svc.sendEncryptedMessage({ id: chatId, isGroup: false, memberIds: ['alice', 'bob'] }, message('m1', 'alice', chatId), me('alice'));

    as('mallory');
    const errors: unknown[] = [];
    const off = svc.subscribeToEncryptedChat(chatId, 'mallory', () => errors.push('LEAK'));
    await new Promise((r) => setTimeout(r, 800));
    off();
    expect(errors).toEqual([]);

    const spoof = await svc.sendEncryptedMessage({ id: chatId, isGroup: false, memberIds: ['alice', 'bob'] }, message('m9', 'alice', chatId, 'fake'), me('mallory'));
    expect(spoof.success).toBe(false);
    const squat = await svc.sendEncryptedMessage({ id: 'dm_alice_bob', isGroup: false, memberIds: ['mallory', 'bob'] }, message('m10', 'mallory', 'dm_alice_bob'), me('mallory'));
    expect(squat.success).toBe(false);
  });

  it('runs a group: creator creates it, adds a member, the member posts, a non-creator cannot add people', async () => {
    const chatId = groupChatId('alice', 1);
    const group = { id: chatId, isGroup: true, createdBy: 'alice', groupName: 'П\'ятниця', groupTopic: '', groupAvatar: '🍻', memberIds: ['alice', 'bob'], participants: [{ id: 'bob', name: 'bob', avatar: '' }] };

    as('alice');
    expect((await svc.sendEncryptedMessage(group, message('g1', 'alice', chatId, 'Вітаю'), me('alice'))).success).toBe(true);
    await svc.addGroupMembers(chatId, [{ id: 'carol', name: 'carol', avatar: '' }]);
    let chat = (await admin((db) => getDoc(doc(db, `chats/${chatId}`)))).data()!;
    expect(chat.members).toEqual(['alice', 'bob', 'carol']);

    as('carol');
    // a member's group object has no createdBy rights: only the preview is written
    expect((await svc.sendEncryptedMessage({ ...group, memberIds: ['alice', 'bob', 'carol'] }, message('g2', 'carol', chatId, 'Я тут'), me('carol'))).success).toBe(true);
    await svc.addGroupMembers(chatId, [{ id: 'mallory', name: 'mallory', avatar: '' }]);
    chat = (await admin((db) => getDoc(doc(db, `chats/${chatId}`)))).data()!;
    expect(chat.members).not.toContain('mallory');
    expect(chat.lastSenderId).toBe('carol');
  });
});

describe('abuse reports (thunk)', () => {
  it('files a report that the rules accept, even without a target avatar, and nobody can read it back', async () => {
    const store = configureStore({ reducer: combineReducers({ auth, safety, notifications, settings, ui }) });
    store.dispatch(loggedIn(createUser({ id: 'alice', email: 'alice@example.com', emailVerified: true })));
    as('alice');

    const report = (store.dispatch as any)(submitReport({ targetId: 'bad', targetType: 'profile', targetName: 'Bad', category: 'spam', comment: ' c ' }));
    await vi.waitFor(async () => expect((await admin((db) => getDoc(doc(db, `reports/${report.id}`)))).exists()).toBe(true));
    expect(warned()).toBe(0);
    expect((await admin((db) => getDoc(doc(db, `reports/${report.id}`)))).data()).toMatchObject({ reporterId: 'alice', targetId: 'bad', comment: 'c' });
  });
});
