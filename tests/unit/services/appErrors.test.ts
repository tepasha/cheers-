import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureAppErrorReporter, clearAppError, getAppError, handleAppAction, normalizeAppError, reportAppError, retryAppError, setAppErrorSession, subscribeAppErrors } from '@/services/appErrors';

beforeEach(() => { clearAppError(); setAppErrorSession('account-a:1'); });
afterEach(() => clearAppError());

describe('application error routing', () => {
  it('keeps the displayed error stable and queues distinct concurrent failures once', async () => {
    const listener = vi.fn();
    const stop = subscribeAppErrors(listener);
    reportAppError(new Error('First'));
    const first = getAppError()!;
    const retry = vi.fn();
    reportAppError(new Error('Second'), { retry });
    reportAppError(new Error('Second'), { retry });
    expect(getAppError()).toBe(first);
    expect(listener).toHaveBeenCalledOnce();
    await retryAppError(first.id);
    expect(getAppError()?.error.message).toBe('Second');
    await retryAppError(getAppError()!.id);
    expect(retry).toHaveBeenCalledOnce();
    expect(getAppError()).toBeNull();
    stop();
  });

  it('dismisses a failed form action without automatically repeating its mutation', async () => {
    reportAppError({ code: 'auth/invalid-credential', message: 'Wrong password' }, { message: 'Please check your credentials' });
    expect(getAppError()?.error).toMatchObject({ code: 'auth/invalid-credential', message: 'Wrong password' });
    await retryAppError(getAppError()!.id);
    expect(getAppError()).toBeNull();
  });

  it('routes synchronous exceptions and rejected button handlers to the same screen', async () => {
    handleAppAction(() => { throw 'Synchronous failure'; });
    expect(getAppError()?.error.message).toBe('Synchronous failure');
    clearAppError();
    handleAppAction(() => Promise.reject(new Error('Asynchronous failure')));
    await Promise.resolve();
    expect(getAppError()?.error.message).toBe('Asynchronous failure');
  });

  it('shows a failed explicit retry again and ignores a stale retry id', async () => {
    const retry = vi.fn().mockRejectedValue(new Error('Still offline'));
    reportAppError(new Error('Offline'), { retry });
    const first = getAppError()!;
    await retryAppError(first.id);
    expect(getAppError()?.error.message).toBe('Still offline');
    await retryAppError(first.id);
    expect(retry).toHaveBeenCalledOnce();
  });

  it('clears queued diagnostics on a session change and discards old async results', async () => {
    const report = captureAppErrorReporter();
    reportAppError(new Error('Account A'));
    reportAppError(new Error('Queued account A'));
    let fail!: (error: Error) => void;
    handleAppAction(() => new Promise((_resolve, reject) => { fail = reject; }));
    setAppErrorSession('account-b:2');
    report(new Error('Late result from A'));
    fail(new Error('Late rejected action from A'));
    await Promise.resolve();
    expect(getAppError()).toBeNull();
  });

  it('ignores cancelled sign-ins and normalizes non-Error thrown values', () => {
    reportAppError({ code: 'auth/cancelled' });
    expect(getAppError()).toBeNull();
    expect(normalizeAppError(null)).toBeInstanceOf(Error);
    expect(normalizeAppError('Problem').message).toBe('Problem');
  });
});
