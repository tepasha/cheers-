import { reportAppError } from './appErrors';
import rejectionTracking from 'promise/setimmediate/rejection-tracking';
import nativeTrackingOptions from 'react-native/Libraries/promiseRejectionTrackingOptions';

type Handler = (error: unknown, fatal?: boolean) => void;
type Tracking = { allRejections: boolean; onUnhandled: (id: number, error: unknown) => void; onHandled: (id: number) => void };
type NativeGlobals = typeof globalThis & {
  ErrorUtils?: { getGlobalHandler: () => Handler; setGlobalHandler: (handler: Handler) => void };
  HermesInternal?: {
    hasPromise?: () => boolean;
    enablePromiseRejectionTracker?: (options: Tracking) => void;
    disablePromiseRejectionTracker?: () => void;
  };
};

export function installGlobalErrorHandlers() {
  const runtime = globalThis as NativeGlobals;
  const previous = runtime.ErrorUtils?.getGlobalHandler();
  const handle: Handler = (error) => reportAppError(error, { restart: true });
  runtime.ErrorUtils?.setGlobalHandler(handle);
  const tracking: Tracking = { allRejections: true, onUnhandled: (_id, error) => handle(error), onHandled: () => {} };
  const hermes = runtime.HermesInternal;
  if (hermes?.hasPromise?.()) hermes.enablePromiseRejectionTracker?.(tracking);
  else rejectionTracking.enable(tracking);

  return () => {
    if (previous && runtime.ErrorUtils?.getGlobalHandler() === handle) runtime.ErrorUtils.setGlobalHandler(previous);
    if (hermes?.hasPromise?.()) {
      if (__DEV__) hermes.enablePromiseRejectionTracker?.(nativeTrackingOptions);
      else hermes.disablePromiseRejectionTracker?.();
    } else {
      if (__DEV__) rejectionTracking.enable(nativeTrackingOptions);
      else rejectionTracking.disable();
    }
  };
}
