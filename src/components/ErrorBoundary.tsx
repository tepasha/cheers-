import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useAppSelector } from '../store/hooks';
import type { AppLanguage } from '../types';
import { captureException } from '../services/telemetry';
import { ErrorScreen } from '../screens/ErrorScreen';
import { clearAppError, getAppError, normalizeAppError, retryAppError, subscribeAppErrors } from '../services/appErrors';
import { installGlobalErrorHandlers } from '../services/globalErrors';
import { ModalHost } from './ModalLayer';

interface Props {
  lang: AppLanguage;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  /** Bumped on retry: the subtree is mounted afresh (including the navigator, so it starts from the first tab) */
  attempt: number;
}

/**
 * Last line of defence for render errors: without it, one exception anywhere in the tree unmounts the whole app and
 * a release build closes. Data from other users is validated where it is read (logic/cloudData), so reaching this
 * screen means a bug, not bad input; the person can carry on with a fresh tree.
 */
class Boundary extends React.Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: normalizeAppError(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    clearAppError();
    captureException(error);
    console.error('[ErrorBoundary] render failed:', error, info.componentStack);
  }

  private retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    const { lang, children } = this.props;
    if (!this.state.error) return <React.Fragment key={this.state.attempt}>{children}</React.Fragment>;
    return <ErrorScreen error={this.state.error} lang={lang} onRetry={this.retry} />;
  }
}

/** The boundary in the user's language. Mount it inside the store Provider. */
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const lang = useAppSelector((s) => s.settings.language);
  const failure = useSyncExternalStore(subscribeAppErrors, getAppError, getAppError);
  const [attempt, setAttempt] = useState(0);
  useEffect(installGlobalErrorHandlers, []);
  useEffect(() => { if (failure) captureException(failure.error); }, [failure]);
  const retry = () => {
    if (!failure) return;
    if (failure.restart) setAttempt((value) => value + 1);
    void retryAppError(failure.id);
  };
  return <Boundary key={attempt} lang={lang}>
    {children}
    <ModalHost override={failure ? <ErrorScreen error={failure.error} message={failure.message} lang={lang} onRetry={retry} /> : undefined} onOverrideClose={retry} />
  </Boundary>;
}
