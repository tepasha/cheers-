import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = Constants.expoConfig?.extra?.monitoring?.dsn;

Sentry.init({
  dsn: typeof dsn === 'string' ? dsn : undefined,
  enabled: !__DEV__ && typeof dsn === 'string' && !!dsn,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  attachScreenshot: false,
  attachViewHierarchy: false,
  beforeBreadcrumb: () => null,
  beforeSend(event) {
    // Stack frames, build and device information are useful; user content and network payloads are not.
    delete event.user; delete event.request; delete event.extra; delete event.message;
    event.breadcrumbs = [];
    event.exception?.values?.forEach((exception) => { exception.value = exception.type ?? 'Unhandled error'; });
    return event;
  },
});

export const captureException = (error: Error) => Sentry.captureException(error);
export const wrapWithMonitoring = Sentry.wrap;
