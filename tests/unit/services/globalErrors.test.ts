import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ enable: vi.fn(), disable: vi.fn(), defaultOptions: { allRejections: true, onUnhandled: () => {}, onHandled: () => {} } }));
vi.mock('promise/setimmediate/rejection-tracking', () => ({ default: { enable: mocks.enable, disable: mocks.disable } }));
vi.mock('react-native/Libraries/promiseRejectionTrackingOptions', () => ({ default: mocks.defaultOptions }));
import { installGlobalErrorHandlers } from '@/services/globalErrors';
import { installGlobalErrorHandlers as installWebHandlers } from '@/services/globalErrors.web';
import { clearAppError, getAppError } from '@/services/appErrors';

beforeEach(() => { clearAppError(); vi.clearAllMocks(); vi.stubGlobal('__DEV__', false); });
afterEach(() => { clearAppError(); vi.unstubAllGlobals(); });

describe('global error handlers', () => {
  it('routes native event-handler throws and Hermes unhandled promises, then restores the previous handler', () => {
    const previous = vi.fn();
    let handler = previous as (error: unknown) => void;
    const enable = vi.fn();
    const disable = vi.fn();
    vi.stubGlobal('ErrorUtils', { getGlobalHandler: () => handler, setGlobalHandler: (next: typeof handler) => { handler = next; } });
    vi.stubGlobal('HermesInternal', { hasPromise: () => true, enablePromiseRejectionTracker: enable, disablePromiseRejectionTracker: disable });
    const stop = installGlobalErrorHandlers();
    handler(new Error('Event handler failed'));
    expect(getAppError()?.error.message).toBe('Event handler failed');
    expect(getAppError()?.restart).toBe(true);
    clearAppError();
    enable.mock.calls[0][0].onUnhandled(1, new Error('Unhandled promise'));
    expect(getAppError()?.error.message).toBe('Unhandled promise');
    stop();
    expect(handler).toBe(previous);
    expect(disable).toHaveBeenCalledOnce();
  });

  it('supports the non-Hermes Promise implementation and restores developer tracking', () => {
    vi.stubGlobal('HermesInternal', undefined);
    vi.stubGlobal('__DEV__', true);
    const stop = installGlobalErrorHandlers();
    mocks.enable.mock.calls[0][0].onUnhandled(2, 'Rejected');
    expect(getAppError()?.error.message).toBe('Rejected');
    stop();
    expect(mocks.enable).toHaveBeenLastCalledWith(mocks.defaultOptions);
  });

  it('routes browser exceptions and unhandled rejections and removes both listeners', () => {
    const browser = new EventTarget();
    vi.stubGlobal('window', browser);
    const stop = installWebHandlers();
    const error = Object.assign(new Event('error', { cancelable: true }), { error: new Error('Browser failed') });
    browser.dispatchEvent(error);
    expect(error.defaultPrevented).toBe(true);
    expect(getAppError()?.error.message).toBe('Browser failed');
    clearAppError();
    browser.dispatchEvent(Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason: new Error('Rejected browser action') }));
    expect(getAppError()?.error.message).toBe('Rejected browser action');
    stop();
    clearAppError();
    browser.dispatchEvent(error);
    expect(getAppError()).toBeNull();
  });
});
