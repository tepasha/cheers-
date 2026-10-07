import type { AppThunk } from '../hooks';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { captureSession } from '../sessionGuard';
import { OUTBOX_LIMIT, syncChanged, syncCompleted, syncQueued, syncRetried, type SyncJob, type SyncMethod } from '../slices/outboxSlice';
import { messageDeliveryChanged, messagesReceived } from '../slices/chatsSlice';
import type { Message } from '../../types';
import { pushNotification } from './notifications';
import { trFor } from './lang';

const running = new WeakSet<object>();
let sequence = 0;
export const queueSync = (method: SyncMethod, key: string, args: unknown[], message?: SyncJob['message']): AppThunk<boolean> => (dispatch, getState) => {
  const state = getState();
  if (!state.auth.user.isLoggedIn) return false;
  if ((state.outbox?.jobs.length ?? 0) >= OUTBOX_LIMIT && !state.outbox.jobs.some((j) => j.key === key && j.owner === state.auth.user.id)) {
    const tr = trFor(getState);
    dispatch(pushNotification({ type: 'system', title: tr('Не вдалося виконати дію. Спробуйте пізніше'), body: tr('Зміни ще не збережено. Перевірте з’єднання й повторіть спробу.') }));
    return false;
  }
  const job: SyncJob = { id: `sync-${Date.now()}-${++sequence}`, owner: state.auth.user.id, key, method, args, message, status: 'queued', attempts: 0, nextAt: 0 };
  dispatch(syncQueued(job));
  void dispatch(flushOutbox());
  return true;
};

export const flushOutbox = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  if (running.has(getState)) return;
  const current = captureSession(getState);
  if (!current() || !getState().ui.isOnline) return;
  running.add(getState);
  try {
    while (current() && getState().ui.isOnline) {
      const job = getState().outbox?.jobs.find((j) => j.owner === getState().auth.user.id && j.status === 'queued' && j.nextAt <= Date.now());
      if (!job) break;
      const attempts = job.attempts + 1;
      dispatch(syncChanged({ id: job.id, status: 'sending', attempts }));
      if (job.message) dispatch(messageDeliveryChanged({ ...job.message, status: 'sending' }));
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const method = firestoreSyncService[job.method] as (...args: unknown[]) => Promise<unknown>;
        const result = await Promise.race([
          method(...job.args),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('Timed out'), { code: 'unavailable' })), 15000); }),
        ]);
        if (result && typeof result === 'object' && 'success' in result && result.success === false) throw Object.assign(new Error('Write rejected'), { code: 'errorCode' in result ? result.errorCode : 'unavailable' });
        if (!current()) return;
        // A newer edit to the same resource may have replaced this job while it was in flight.
        if (!getState().outbox.jobs.some((j) => j.id === job.id)) continue;
        dispatch(syncCompleted(job.id));
        if (job.message && result && typeof result === 'object' && 'cipherPayload' in result && typeof result.cipherPayload === 'string') {
          dispatch(messagesReceived({ chatId: job.message.chatId, messages: [{ ...job.args[1] as Message, cipherPayload: result.cipherPayload }] }));
        }
        if (job.message) dispatch(messageDeliveryChanged({ ...job.message, status: 'sent' }));
      } catch (error) {
        if (!current()) return;
        const code = String((error as { code?: unknown })?.code ?? '');
        const permanent = /permission-denied|invalid-argument|not-found|already-exists/.test(code) || attempts >= 5;
        dispatch(syncChanged({ id: job.id, status: permanent ? 'failed' : 'queued', nextAt: Date.now() + Math.min(60000, 2000 * 2 ** attempts) }));
        if (job.message) dispatch(messageDeliveryChanged({ ...job.message, status: permanent ? 'failed' : 'queued' }));
      } finally {
        if (timer) clearTimeout(timer);
        // A refreshed auth token or a logout can end this worker while its job is in flight.
        // Keep that owner's job retryable; personalDataReset has already removed it on account switches.
        if (!current() && getState().outbox.jobs.some((j) => j.id === job.id && j.status === 'sending')) {
          dispatch(syncChanged({ id: job.id, status: 'queued', nextAt: 0 }));
        }
      }
    }
  } finally { running.delete(getState); }
};

export const retryOutbox = (): AppThunk => (dispatch) => { dispatch(syncRetried()); void dispatch(flushOutbox()); };
