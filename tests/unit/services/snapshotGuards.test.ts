/**
 * Firestore runs snapshot callbacks from a timer: an exception thrown there is uncaught and closes a release build.
 * These tests feed the REAL listeners of firestoreSyncService with malformed documents and check that they neither
 * throw nor lose the good documents next to the bad one (audit security-1, security-2, gap-clock-skew-2).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ next: [] as Array<(snap: unknown) => unknown> }));
const callable = vi.hoisted(() => vi.fn());

vi.mock('@/services/firebase', () => ({ db: {}, auth: {}, firebaseApp: {}, functions: {} }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => callable }));
vi.mock('firebase/firestore', () => {
  const ref = () => ({});
  return {
    doc: ref, collection: ref, query: ref, where: ref, orderBy: ref, startAt: ref, endAt: ref, limit: ref,
    setDoc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), writeBatch: vi.fn(),
    runTransaction: vi.fn(), arrayUnion: vi.fn(), increment: vi.fn(), deleteField: vi.fn(), serverTimestamp: vi.fn(),
    // onSnapshot(query, next, error) or onSnapshot(query, options, next, error)
    onSnapshot: vi.fn((...args: unknown[]) => {
      fs.next.push((typeof args[1] === 'function' ? args[1] : args[2]) as (snap: unknown) => unknown);
      return () => {};
    }),
  };
});
vi.mock('@/services/cryptoService', () => ({ cryptoService: { decryptMessage: vi.fn(async (p: string) => `plain:${p}`) } }));

import { firestoreSyncService as svc } from '@/services/firestoreSyncService';

const docOf = (id: string, data: unknown) => ({ id, data: () => data, metadata: { hasPendingWrites: false } });
const snapOf = (docs: unknown[]) => ({ docs, forEach: (fn: (d: unknown) => void) => docs.forEach(fn), metadata: { fromCache: false } });
const lastListener = () => fs.next[fs.next.length - 1];
const throwing = { id: 'boom', data: () => { throw new Error('unreadable'); }, metadata: { hasPendingWrites: false } };

beforeEach(() => {
  fs.next = [];
});

describe('meetups listener', () => {
  const good = { id: 'm1', title: 'Настілки', creatorId: 'alice', participants: { alice: { userId: 'alice', role: 'host', status: 'going' } }, endsAt: 1 };

  it('keeps the good meetup and drops the one with a null participant, without throwing', () => {
    const cb = vi.fn();
    svc.subscribeToMeetups(cb);
    const bad = { ...good, id: 'm2', participants: { z: null, y: 1 } };
    expect(() => lastListener()(snapOf([docOf('m1', good), docOf('m2', bad), docOf('m3', null), throwing]))).not.toThrow();
    const ids = (cb.mock.calls[0][0] as Array<{ id: string; participants: unknown[] }>).map((m) => [m.id, m.participants.length]);
    expect(ids).toEqual([['m1', 1], ['m2', 0]]);
  });

  it('a callback that throws is contained (the listener keeps working for the next snapshot)', () => {
    const cb = vi.fn().mockImplementationOnce(() => { throw new Error('consumer bug'); });
    svc.subscribeToMeetups(cb);
    expect(() => lastListener()(snapOf([docOf('m1', good)]))).not.toThrow();
    lastListener()(snapOf([docOf('m1', good)]));
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe('chat inbox listener', () => {
  it('drops chats that would kill the inbox, keeps the rest', () => {
    const cb = vi.fn();
    svc.subscribeToMyChats('alice', cb);
    const ok = { members: ['alice', 'bob'], isGroup: false, lastCipherPayload: 'x' };
    expect(() =>
      lastListener()(snapOf([docOf('dm_alice_bob', ok), docOf('grp_m_1', { members: ['alice', 'mallory'], isGroup: true, participants: 1, lastCipherPayload: 7 }), docOf('bad', 'x'), throwing]))
    ).not.toThrow();
    const chats = cb.mock.calls[0][0] as Array<{ id: string; participants?: unknown; lastCipherPayload?: unknown }>;
    expect(chats.map((c) => c.id)).toEqual(['dm_alice_bob', 'grp_m_1']);
    expect(chats[1].participants).toBeUndefined();
    expect(chats[1].lastCipherPayload).toBeUndefined();
  });
});

describe('message listener', () => {
  const change = (id: string, data: Record<string, unknown>) => ({
    type: 'added',
    doc: { id, data: () => data, metadata: { hasPendingWrites: false } },
  });
  const msgSnap = (changes: unknown[]) => ({ docChanges: () => changes, metadata: { fromCache: false } });
  const ts = (ms: number) => ({ toMillis: () => ms });
  const msg = (id: string, at: unknown, over: Record<string, unknown> = {}) => ({ id, senderId: 'bob', senderName: 'Bob', cipherPayload: id, type: 'text', createdAt: at, ...over });

  it('orders by server time, not by the order the snapshot lists them', async () => {
    const onMessages = vi.fn();
    svc.subscribeToEncryptedChat('dm_alice_bob', 'alice', onMessages);
    await lastListener()(msgSnap([change('c', msg('c', ts(3000))), change('a', msg('a', ts(1000))), change('b', msg('b', ts(2000)))]));
    await vi.waitFor(() => expect(onMessages).toHaveBeenCalled());
    expect((onMessages.mock.calls[0][0] as Array<{ id: string }>).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('a forged createdAt (a number) or a broken message no longer breaks the history', async () => {
    const onMessages = vi.fn();
    svc.subscribeToEncryptedChat('dm_alice_bob', 'alice', onMessages);
    const listener = lastListener();
    expect(() =>
      listener(msgSnap([
        change('a', msg('a', ts(1000))),
        change('n', msg('n', 12345)),
        change('x', msg('x', ts(2000), { senderId: 7 })),
        change('y', msg('y', ts(2500), { senderName: { x: 1 }, cipherPayload: 99 })),
      ]))
    ).not.toThrow();
    await vi.waitFor(() => expect(onMessages).toHaveBeenCalled());
    const got = onMessages.mock.calls[0][0] as Array<{ id: string; senderName: string; text: string }>;
    expect(got.map((m) => m.id)).toEqual(['n', 'a', 'y']); // unknown time sorts first; the sender-less one is dropped
    expect(got.find((m) => m.id === 'y')).toMatchObject({ senderName: '' });
  });
});

describe('nearby people listener', () => {
  it('skips malformed server profiles and uses no invented preferences', async () => {
    const cb = vi.fn();
    const ok = { id: 'bob', name: 'Bob', lat: 50.451, lng: 30.521, preferredDrinks: ['craft', 'poison', 3], paymentRule: 'free_money' };
    callable.mockResolvedValueOnce({ data: [ok, { id: 'm', name: { evil: 1 }, lat: 50.45, lng: 30.52 }, { id: 'n', name: 'NoLoc' }] });
    const stop = svc.subscribeToPublicBuddies('alice', { lat: 50.45, lng: 30.52 }, cb);
    await vi.waitFor(() => expect(cb).toHaveBeenCalled());
    stop();
    const people = cb.mock.calls.at(-1)![0] as Array<{ id: string; preferredDrinks: string[]; paymentRule: string }>;
    expect(people.map((p) => p.id)).toEqual(['bob']);
    expect(people[0].preferredDrinks).toEqual(['craft']);
    expect(people[0].paymentRule).toBe('not_specified');
  });
});

describe('live tables listener', () => {
  it('keeps text fields as text (no "__proto__" object can reach tr())', () => {
    const cb = vi.fn();
    svc.subscribeToLiveHangouts({ lat: 50.45, lng: 30.52 } as never, cb);
    const later = Date.now() + 3600_000;
    const table = { userId: 'bob', userName: 'Bob', barName: 'Squat', expiresAt: later, drinkPreference: { a: 1 }, locationArea: ['x'] };
    expect(() => lastListener()(snapOf([docOf('h1', table), docOf('h2', { userId: 5, expiresAt: later }), throwing]))).not.toThrow();
    const tables = cb.mock.calls[0][0] as Array<{ id: string; drinkPreference: unknown; locationArea: unknown }>;
    expect(tables.map((t) => t.id)).toEqual(['h1']);
    expect(typeof tables[0].drinkPreference).toBe('string');
    expect(typeof tables[0].locationArea).toBe('string');
  });
});
