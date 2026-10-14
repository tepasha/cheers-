import { reportAppError } from './appErrors';

/** Browser errors and unhandled promises use the same screen as explicitly handled failures. */
export function installGlobalErrorHandlers() {
  const error = (event: ErrorEvent) => {
    event.preventDefault();
    reportAppError(event.error ?? event.message, { restart: true });
  };
  const rejection = (event: PromiseRejectionEvent) => {
    event.preventDefault();
    reportAppError(event.reason, { restart: true });
  };
  window.addEventListener('error', error);
  window.addEventListener('unhandledrejection', rejection);
  return () => {
    window.removeEventListener('error', error);
    window.removeEventListener('unhandledrejection', rejection);
  };
}
