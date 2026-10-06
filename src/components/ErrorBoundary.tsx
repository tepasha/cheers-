import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tr } from '../services/i18nService';
import { useAppSelector } from '../store/hooks';
import { colors, spacing } from '../theme';
import type { AppLanguage } from '../types';
import { Button } from './ui';

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

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] render failed:', error, info.componentStack);
  }

  private retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    const { lang, children } = this.props;
    if (!this.state.error) return <React.Fragment key={this.state.attempt}>{children}</React.Fragment>;
    return (
      <View style={styles.root} accessibilityRole="alert">
        <Text style={styles.emoji}>🍺</Text>
        <Text style={styles.title}>{tr('Щось пішло не так', lang)}</Text>
        <Text style={styles.body}>{tr('Застосунок натрапив на помилку. Ваші дані збережені, спробуйте ще раз.', lang)}</Text>
        <Button label={tr('Спробувати ще раз', lang)} onPress={this.retry} icon="refresh-cw" />
      </View>
    );
  }
}

/** The boundary in the user's language. Mount it inside the store Provider. */
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const lang = useAppSelector((s) => s.settings.language);
  return <Boundary lang={lang}>{children}</Boundary>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emoji: { fontSize: 44 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginBottom: spacing.sm },
});
