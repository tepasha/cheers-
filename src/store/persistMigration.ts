import type { PersistedState } from 'redux-persist';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Run on every hydration: in-flight network work cannot survive a process restart. */
export function normalizePersistedState(state: PersistedState): PersistedState {
  if (!state) return state;
  const next = { ...state } as PersistedState & Record<string, unknown>;
  if (record(next.auth) && record(next.auth.user)) {
    next.auth = { ...next.auth, user: { ...next.auth.user, serverEligible: false } };
  }
  if (record(next.settings) && (state._persist?.version ?? 0) < 2) {
    next.settings = { ...next.settings, shareLocation: false };
  }
  if (record(next.outbox) && Array.isArray(next.outbox.jobs)) {
    // What was last saved per resource stays: it lets an unchanged profile skip its write on the next launch
    const synced = record(next.outbox.synced) ? Object.fromEntries(Object.entries(next.outbox.synced).filter(([, v]) => typeof v === 'string')) : undefined;
    next.outbox = {
      jobs: next.outbox.jobs.slice(-200).filter(record).map((job) => ({ ...job, status: job.status === 'sending' ? 'queued' : job.status, nextAt: job.status === 'sending' ? 0 : job.nextAt })),
      ...(synced ? { synced } : {}),
    };
  }
  if (record(next.chats) && Array.isArray(next.chats.threads)) {
    // The list is newest first: keep the 100 most recent conversations (and the newest 100 messages of each)
    next.chats = { ...next.chats, threads: next.chats.threads.slice(0, 100).filter(record).map((thread) => ({ ...thread, messages: Array.isArray(thread.messages) ? thread.messages.slice(-100) : [] })) };
  }
  if (record(next.notifications) && Array.isArray(next.notifications.items)) next.notifications = { ...next.notifications, items: next.notifications.items.slice(0, 100) };
  return next;
}
