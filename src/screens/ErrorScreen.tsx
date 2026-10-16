import React, { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import errorCat from '../../assets/illustrations/error-cat.webp';
import { Button } from '../components/ui';
import { tr as translate } from '../services/i18nService';
import { supportContactUri } from '../services/support';
import { colors, radius, spacing } from '../theme';
import type { AppLanguage } from '../types';

interface Props {
  error: Error;
  message?: string;
  lang: AppLanguage;
  onRetry: () => void;
}

/** Uses no navigation or cloud services, so reporting still works when the app shell has crashed. */
export function ErrorScreen({ error, message: explanation, lang, onRetry }: Props) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [feedback, setFeedback] = useState<'copy-failed' | 'support-failed' | null>(null);
  const tr = (text: string) => translate(text, lang);
  const message = error.message?.trim() || tr('Невідома помилка застосунку');
  const diagnostic = `${error.name || 'Error'}: ${message}`;
  const code = (error as Error & { code?: string }).code;
  const report = [explanation, diagnostic, code].filter(Boolean).join('\n');
  const compact = (explanation || diagnostic).replace(/\s+/g, ' ');
  const summary = compact.length > 200 ? `${compact.slice(0, 199)}…` : compact;

  const copy = async () => {
    setCopying(true);
    setCopied(false);
    setFeedback(null);
    try {
      const success = await Clipboard.setStringAsync(report);
      if (success) setCopied(true);
      else setFeedback('copy-failed');
    } catch {
      setFeedback('copy-failed');
    } finally {
      setCopying(false);
    }
  };

  const contactSupport = async () => {
    if (!supportContactUri) return;
    setFeedback(null);
    try {
      await Linking.openURL(supportContactUri);
    } catch {
      setFeedback('support-failed');
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl,
          paddingLeft: insets.left + spacing.xl, paddingRight: insets.right + spacing.xl },
      ]}
    >
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{tr('Щось пішло не так')}</Text>
        <Image source={errorCat} style={styles.cat} resizeMode="contain" accessible={false} />

        <View style={styles.errorCard}>
          <Text style={styles.errorLabel}>{tr('Повідомлення про помилку')}</Text>
          <Text selectable accessibilityRole="alert" style={styles.errorMessage}>{summary}</Text>
          <Button
            label={copied ? tr('Скопійовано') : tr('Копіювати')}
            icon={copied ? 'check' : 'copy'}
            variant="secondary"
            small
            loading={copying}
            onPress={copy}
            style={styles.copyButton}
          />
        </View>

        <Text style={styles.hint}>{tr('можете скопіювати повідомлення та написати розробнику')}</Text>
        <View style={styles.actions}>
          <Button label={tr('Технічна підтримка')} icon="help-circle" onPress={contactSupport} disabled={!supportContactUri} />
          <Button label={tr('Спробувати ще раз')} icon="refresh-cw" variant="ghost" onPress={onRetry} />
        </View>
        {!supportContactUri && <Text style={styles.hint}>{tr('Контакт підтримки ще не налаштовано.')}</Text>}
        {feedback && (
          <Text accessibilityRole="alert" style={styles.feedback}>
            {feedback === 'copy-failed'
              ? tr('Не вдалося скопіювати. Виділіть текст повідомлення та скопіюйте вручну.')
              : tr('Не вдалося відкрити підтримку. Спробуйте ще раз.')}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 400, alignItems: 'center', gap: spacing.md },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 34 },
  cat: { width: '100%', maxWidth: 240, height: 240 },
  errorCard: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  errorLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  errorMessage: { color: colors.text, fontSize: 14, lineHeight: 21 },
  copyButton: { alignSelf: 'flex-start', marginTop: spacing.xs },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: spacing.sm },
  actions: { width: '100%', gap: spacing.xs, marginTop: spacing.xs },
  feedback: { color: colors.red, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
