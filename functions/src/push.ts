/**
 * Push notifications for chat messages: the pure core of the Cloud Function. It imports nothing from Firebase so it
 * can be unit-tested with fakes; index.ts wires it to Firestore (Admin SDK) and the Expo Push service.
 *
 * Privacy: a message body is ciphertext on the server and is never decrypted here. The push carries the sender's
 * name and a generic line ("New message"), never the text of the message.
 */

export type Language = 'uk' | 'en' | 'pl' | 'de';

export interface Device {
  id: string;
  uid: string;
  token: string;
  language: Language;
}

export interface ChatDoc {
  members: string[];
  isGroup?: boolean;
  groupName?: string;
}

export interface MessageDoc {
  id: string;
  senderId: string;
  senderName?: string;
  type?: string;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { type: 'chat_message'; chatId: string };
  sound: 'default';
  channelId: string;
  priority: 'high';
  ttl: number;
}

export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface PushDeps {
  getChat(chatId: string): Promise<ChatDoc | null>;
  /** Which of `recipientIds` have blocked `senderId` (they must not be notified about that person) */
  blockedSenders(recipientIds: string[], senderId: string): Promise<Set<string>>;
  getDevices(userIds: string[]): Promise<Device[]>;
  send(messages: ExpoMessage[]): Promise<ExpoTicket[]>;
  removeDevices(deviceIds: string[]): Promise<void>;
}

export interface PushResult {
  sent: number;
  skippedBlocked: number;
  removedDevices: number;
}

/** Expo accepts at most 100 messages per request */
export const EXPO_BATCH_SIZE = 100;
/** A user with many registered devices must not multiply the traffic of one message */
export const MAX_DEVICES_PER_USER = 5;
const TTL_SECONDS = 24 * 60 * 60;
const NAME_MAX = 60;

const TEXT: Record<Language, Record<string, string>> = {
  uk: {
    text: 'Нове повідомлення',
    cheers: 'Підняв(ла) келих за вас 🥂',
    audio: 'Голосове повідомлення',
    location_proposal: 'Пропонує зустрітися 📍',
    proposal_response: 'Відповів(ла) на пропозицію зустрічі',
    someone: 'Хтось',
  },
  en: {
    text: 'New message',
    cheers: 'Raised a glass to you 🥂',
    audio: 'Voice message',
    location_proposal: 'Suggests meeting up 📍',
    proposal_response: 'Replied to the meetup proposal',
    someone: 'Someone',
  },
  pl: {
    text: 'Nowa wiadomość',
    cheers: 'Wznosi za Ciebie toast 🥂',
    audio: 'Wiadomość głosowa',
    location_proposal: 'Proponuje spotkanie 📍',
    proposal_response: 'Odpowiedział(a) na propozycję spotkania',
    someone: 'Ktoś',
  },
  de: {
    text: 'Neue Nachricht',
    cheers: 'Hat mit dir angestoßen 🥂',
    audio: 'Sprachnachricht',
    location_proposal: 'Schlägt ein Treffen vor 📍',
    proposal_response: 'Hat auf den Treffen-Vorschlag geantwortet',
    someone: 'Jemand',
  },
};

const safeLanguage = (l: string | undefined): Language => (l === 'en' || l === 'pl' || l === 'de' ? l : 'uk');

const clean = (value: string | undefined, max = NAME_MAX): string => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Title and body for one device, in that device's language. Never contains message text. */
export function composeNotification(chat: ChatDoc, message: MessageDoc, language: string | undefined): { title: string; body: string } {
  const t = TEXT[safeLanguage(language)];
  const sender = clean(message.senderName) || t.someone;
  const line = t[message.type ?? 'text'] ?? t.text;

  if (chat.isGroup) {
    const group = clean(chat.groupName);
    return { title: group || sender, body: group ? `${sender}: ${line}` : line };
  }
  return { title: sender, body: line };
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Notifies the other members of a chat about a new message. Skips the sender, anyone who blocked the sender, and
 * messages whose author is not a member (rules already forbid those; this is defence in depth). Devices Expo reports
 * as no longer registered are removed so they stop costing requests.
 */
export async function notifyChatMessage(deps: PushDeps, chatId: string, message: MessageDoc): Promise<PushResult> {
  const result: PushResult = { sent: 0, skippedBlocked: 0, removedDevices: 0 };

  const chat = await deps.getChat(chatId);
  if (!chat || !Array.isArray(chat.members) || !chat.members.includes(message.senderId)) return result;

  const candidates = chat.members.filter((m) => m !== message.senderId);
  if (candidates.length === 0) return result;

  const blocked = await deps.blockedSenders(candidates, message.senderId);
  result.skippedBlocked = candidates.filter((c) => blocked.has(c)).length;
  const recipients = candidates.filter((c) => !blocked.has(c));
  if (recipients.length === 0) return result;

  // At most MAX_DEVICES_PER_USER per person, in a stable order
  const perUser = new Map<string, number>();
  const devices = (await deps.getDevices(recipients))
    .filter((d) => recipients.includes(d.uid))
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((d) => {
      const n = (perUser.get(d.uid) ?? 0) + 1;
      perUser.set(d.uid, n);
      return n <= MAX_DEVICES_PER_USER;
    });
  if (devices.length === 0) return result;

  const toRemove: string[] = [];
  for (const batch of chunk(devices, EXPO_BATCH_SIZE)) {
    const messages: ExpoMessage[] = batch.map((d) => ({
      to: d.token,
      ...composeNotification(chat, message, d.language),
      data: { type: 'chat_message', chatId },
      sound: 'default',
      channelId: 'messages',
      priority: 'high',
      ttl: TTL_SECONDS,
    }));

    const tickets = await deps.send(messages);
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'ok') result.sent += 1;
      else if (ticket.details?.error === 'DeviceNotRegistered') toRemove.push(batch[i].id);
    });
  }

  if (toRemove.length > 0) {
    await deps.removeDevices(toRemove);
    result.removedDevices = toRemove.length;
  }
  return result;
}
