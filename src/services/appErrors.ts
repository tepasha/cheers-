export interface AppErrorOptions {
  /** Localized, short explanation; the original diagnostic remains available for copying. */
  message?: string;
  retry?: () => unknown | Promise<unknown>;
  restart?: boolean;
}

export interface AppError extends AppErrorOptions {
  id: number;
  error: Error;
}

let active: AppError | null = null;
let queue: AppError[] = [];
let sequence = 0;
let session = '';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function normalizeAppError(value: unknown): Error {
  if (value instanceof Error) return value;
  const data = value && typeof value === 'object' ? value as { message?: unknown; code?: unknown } : null;
  const message = typeof data?.message === 'string' ? data.message : typeof value === 'string' ? value : 'Unknown application error';
  return Object.assign(new Error(message), typeof data?.code === 'string' ? { code: data.code } : {});
}

const cancelled = (value: unknown) => {
  const code = (value as { code?: unknown } | null)?.code;
  return code === 'auth/cancelled' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
};

/** Keep the displayed message stable, and deduplicate concurrent failures without losing their recovery actions. */
export function reportAppError(value: unknown, options: AppErrorOptions = {}): void {
  if (cancelled(value)) return;
  const error = normalizeAppError(value);
  if ([active, ...queue].some((item) => item && item.error.name === error.name && item.error.message === error.message && item.message === options.message)) return;
  const next = { ...options, id: ++sequence, error };
  if (active) { if (queue.length < 10) queue.push(next); return; }
  active = next;
  notify();
}

export const getAppError = () => active;
export function subscribeAppErrors(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function clearAppError(id?: number): void {
  if (!active || (id !== undefined && active.id !== id)) return;
  active = id === undefined ? null : queue.shift() ?? null;
  if (id === undefined) queue = [];
  notify();
}

/** Invalidates async reporters when the account/session changes. No diagnostics are persisted. */
export function setAppErrorSession(next: string): void {
  if (next === session) return;
  session = next;
  clearAppError();
}

export function captureAppErrorReporter(options: AppErrorOptions = {}) {
  const owner = session;
  return (value: unknown) => { if (session === owner) reportAppError(value, options); };
}

/** Handles synchronous throws and rejected event-handler promises without losing the current form. */
export function handleAppAction(action: () => unknown): void {
  const report = captureAppErrorReporter();
  try { Promise.resolve(action()).catch(report); }
  catch (error) { report(error); }
}

export async function retryAppError(id: number): Promise<void> {
  const failed = active;
  if (!failed || failed.id !== id) return;
  const report = captureAppErrorReporter(failed);
  clearAppError(id);
  try { await failed.retry?.(); }
  catch (error) { report(error); }
}
