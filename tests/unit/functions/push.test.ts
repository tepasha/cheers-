import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  composeNotification,
  EXPO_BATCH_SIZE,
  MAX_DEVICES_PER_USER,
  notifyChatMessage,
  type ChatDoc,
  type Device,
  type ExpoMessage,
  type ExpoTicket,
  type PushDeps,
} from '../../../functions/src/push';
import { sendToExpo } from '../../../functions/src/expo';

const dm: ChatDoc = { members: ['alice', 'bob'] };
const msg = (over = {}) => ({ id: 'm1', senderId: 'alice', senderName: 'Alice', type: 'text', ...over });
const dev = (uid: string, n = 1, language: Device['language'] = 'uk'): Device => ({
  id: `${uid}_${String(n).padStart(3, '0')}`,
  uid,
  token: `ExponentPushToken[${uid}${n}]`,
  language,
});

function makeDeps(over: Partial<PushDeps> & { chat?: ChatDoc | null; devices?: Device[]; blocked?: string[] } = {}) {
  const sent: ExpoMessage[][] = [];
  const { chat, devices, blocked, ...overrides } = over;
  const deps: PushDeps = {
    getChat: async () => (chat === undefined ? dm : chat),
    blockedSenders: async (ids) => new Set(ids.filter((i) => (blocked ?? []).includes(i))),
    getDevices: async (ids) => (devices ?? []).filter((d) => ids.includes(d.uid)),
    send: async (messages) => {
      sent.push(messages);
      return messages.map((): ExpoTicket => ({ status: 'ok', id: 'x' }));
    },
    removeDevices: vi.fn(async () => {}),
    ...overrides,
  };
  return { deps, sent };
}

describe('composeNotification', () => {
  it('uses the sender name and a generic line in the device language, never message content', () => {
    expect(composeNotification(dm, msg(), 'en')).toEqual({ title: 'Alice', body: 'New message' });
    expect(composeNotification(dm, msg(), 'pl').body).toBe('Nowa wiadomość');
    expect(composeNotification(dm, msg(), 'de').body).toBe('Neue Nachricht');
    expect(composeNotification(dm, msg(), 'uk').body).toBe('Нове повідомлення');
  });

  it('falls back to Ukrainian for an unknown language and to a generic name when the sender has none', () => {
    expect(composeNotification(dm, msg({ senderName: '' }), 'fr')).toEqual({ title: 'Хтось', body: 'Нове повідомлення' });
  });

  it('describes the message type', () => {
    expect(composeNotification(dm, msg({ type: 'location_proposal' }), 'en').body).toMatch(/meeting up/);
    expect(composeNotification(dm, msg({ type: 'proposal_response' }), 'en').body).toMatch(/proposal/);
    expect(composeNotification(dm, msg({ type: 'cheers' }), 'en').body).toMatch(/glass/);
    expect(composeNotification(dm, msg({ type: 'audio' }), 'en').body).toBe('Voice message');
    expect(composeNotification(dm, msg({ type: 'something-new' }), 'en').body).toBe('New message');
  });

  it('titles a group by its name and puts the sender in the body', () => {
    const group: ChatDoc = { members: ['alice', 'bob', 'carol'], isGroup: true, groupName: 'Friday beers' };
    expect(composeNotification(group, msg(), 'en')).toEqual({ title: 'Friday beers', body: 'Alice: New message' });
    expect(composeNotification({ ...group, groupName: '' }, msg(), 'en')).toEqual({ title: 'Alice', body: 'New message' });
  });

  it('flattens whitespace and caps the name so a hostile name cannot bloat the push', () => {
    const { title } = composeNotification(dm, msg({ senderName: `  Al\n\nice ${'x'.repeat(200)}` }), 'en');
    expect(title).not.toMatch(/\n/);
    expect(title.length).toBeLessThanOrEqual(60);
  });
});

describe('notifyChatMessage', () => {
  it('sends to the other members only, with the chat id for the tap', async () => {
    const { deps, sent } = makeDeps({ devices: [dev('alice'), dev('bob', 1, 'en')] });
    const result = await notifyChatMessage(deps, 'dm_alice_bob', msg());
    expect(result).toEqual({ sent: 1, skippedBlocked: 0, removedDevices: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0][0]).toMatchObject({
      to: 'ExponentPushToken[bob1]',
      title: 'Alice',
      body: 'New message',
      data: { type: 'chat_message', chatId: 'dm_alice_bob' },
      channelId: 'messages',
    });
  });

  it('never notifies someone who blocked the sender', async () => {
    const { deps, sent } = makeDeps({ devices: [dev('bob')], blocked: ['bob'] });
    const result = await notifyChatMessage(deps, 'c', msg());
    expect(result.skippedBlocked).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it('does nothing for a missing chat or a sender who is not a member', async () => {
    const devices = [dev('bob')];
    const a = makeDeps({ chat: null, devices });
    expect((await notifyChatMessage(a.deps, 'c', msg())).sent).toBe(0);
    const b = makeDeps({ devices });
    expect((await notifyChatMessage(b.deps, 'c', msg({ senderId: 'mallory' }))).sent).toBe(0);
    expect(a.sent.length + b.sent.length).toBe(0);
  });

  it('sends nothing when nobody registered a device', async () => {
    const { deps, sent } = makeDeps({ devices: [] });
    expect((await notifyChatMessage(deps, 'c', msg())).sent).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('localizes per device, so one person with two phones can get two languages', async () => {
    const { deps, sent } = makeDeps({ devices: [dev('bob', 1, 'en'), dev('bob', 2, 'de')] });
    await notifyChatMessage(deps, 'c', msg());
    expect(sent[0].map((m) => m.body)).toEqual(['New message', 'Neue Nachricht']);
  });

  it('caps the devices per person', async () => {
    const devices = Array.from({ length: MAX_DEVICES_PER_USER + 3 }, (_, i) => dev('bob', i + 1));
    const { deps, sent } = makeDeps({ devices });
    await notifyChatMessage(deps, 'c', msg());
    expect(sent[0]).toHaveLength(MAX_DEVICES_PER_USER);
  });

  it('ignores devices of people who are not recipients', async () => {
    const { deps, sent } = makeDeps({ getDevices: async () => [dev('stranger'), dev('bob')] });
    await notifyChatMessage(deps, 'c', msg());
    expect(sent[0].map((m) => m.to)).toEqual(['ExponentPushToken[bob1]']);
  });

  it('splits large groups into batches of at most 100', async () => {
    const members = ['alice', ...Array.from({ length: 29 }, (_, i) => `u${i}`)];
    const devices = members.slice(1).flatMap((uid) => Array.from({ length: MAX_DEVICES_PER_USER }, (_, n) => dev(uid, n + 1)));
    const { deps, sent } = makeDeps({ chat: { members, isGroup: true, groupName: 'G' }, devices });
    const result = await notifyChatMessage(deps, 'c', msg());
    expect(result.sent).toBe(29 * MAX_DEVICES_PER_USER);
    expect(sent.length).toBeGreaterThan(1);
    expect(sent.every((b) => b.length <= EXPO_BATCH_SIZE)).toBe(true);
  });

  it('removes devices Expo reports as unregistered, and only those', async () => {
    const { deps } = makeDeps({
      devices: [dev('bob', 1), dev('bob', 2)],
      send: async () => [{ status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'ok' }],
    });
    const result = await notifyChatMessage(deps, 'c', msg());
    expect(result).toMatchObject({ sent: 1, removedDevices: 1 });
    expect(deps.removeDevices).toHaveBeenCalledWith(['bob_001']);
  });

  it('keeps a device on other errors (they may be temporary)', async () => {
    const { deps } = makeDeps({
      devices: [dev('bob')],
      send: async () => [{ status: 'error', details: { error: 'MessageRateExceeded' } }],
    });
    expect(await notifyChatMessage(deps, 'c', msg())).toMatchObject({ sent: 0, removedDevices: 0 });
    expect(deps.removeDevices).not.toHaveBeenCalled();
  });
});

describe('sendToExpo', () => {
  const withServer = async (handler: (body: any) => { status?: number; json: unknown }) => {
    const seen: { body: any; headers: any }[] = [];
    const server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = JSON.parse(raw);
        seen.push({ body, headers: req.headers });
        const { status = 200, json } = handler(body);
        res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(json));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/send`;
    return { url, seen, close: () => new Promise((r) => server.close(r)) };
  };
  const message = (to: string): ExpoMessage => ({
    to, title: 't', body: 'b', data: { type: 'chat_message', chatId: 'c' }, sound: 'default', channelId: 'messages', priority: 'high', ttl: 60,
  });

  it('posts the batch as JSON and returns the tickets in order', async () => {
    const s = await withServer((body) => ({ json: { data: body.map(() => ({ status: 'ok', id: 'e' })) } }));
    const tickets = await sendToExpo([message('a'), message('b')], { url: s.url });
    expect(tickets).toHaveLength(2);
    expect(s.seen[0].body.map((m: ExpoMessage) => m.to)).toEqual(['a', 'b']);
    expect(s.seen[0].headers.authorization).toBeUndefined();
    await s.close();
  });

  it('sends the access token when configured', async () => {
    const s = await withServer((body) => ({ json: { data: body.map(() => ({ status: 'ok' })) } }));
    await sendToExpo([message('a')], { url: s.url, accessToken: 'secret' });
    expect(s.seen[0].headers.authorization).toBe('Bearer secret');
    await s.close();
  });

  it('throws on an HTTP error or a response that does not match the batch', async () => {
    const bad = await withServer(() => ({ status: 500, json: {} }));
    await expect(sendToExpo([message('a')], { url: bad.url })).rejects.toThrow(/HTTP 500/);
    await bad.close();
    const short = await withServer(() => ({ json: { data: [] } }));
    await expect(sendToExpo([message('a')], { url: short.url })).rejects.toThrow(/one ticket/);
    await short.close();
  });
});
