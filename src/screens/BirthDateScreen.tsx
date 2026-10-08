import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import { BirthDatePicker } from '../components/BirthDatePicker';
import { colors, spacing, typography } from '../theme';
import { useAppDispatch } from '../store/hooks';
import { logout, submitBirthDate } from '../store/thunks/auth';
import { parseBirthDateInput } from '../logic/dateInput';
import { MIN_AGE } from '../logic/session';
import { useTr } from '../hooks/useT';
import { LegalLinks } from '../components/LegalLinks';
import { describeAuthError } from '../services/authService';
import { useAppSelector } from '../store/hooks';
import { isoToDateInput } from '../logic/dateInput';

/**
 * Confirms a date supplied by Google, or asks for one when unavailable. Terms acceptance is always explicit.
 * Too young: the account is removed and the sign-in screen says to wait until {MIN_AGE}.
 */
export const BirthDateScreen = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const birthDate = useAppSelector((s) => s.auth.user.birthDate);
  const [input, setInput] = useState(birthDate ? isoToDateInput(birthDate) : '');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!accepted || busy) return;
    const iso = parseBirthDateInput(input);
    if (!iso) {
      setError(tr('Оберіть дату народження'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await dispatch(submitBirthDate(iso));
      if (result === 'invalid') setError(tr('Некоректна дата народження'));
      // 'too_young': the account is gone and the sign-in screen takes over; 'ok': the app opens
    } catch (err) {
      setError(tr(describeAuthError(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl * 2, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
          <Text style={[typography.title, { fontSize: 24 }]}>{tr('Ще один крок')}</Text>
          <Text style={typography.small}>{birthDate
            ? tr('Застосунок доступний з {MIN_AGE} років. Перевірте дату народження та прийміть правила, щоб продовжити.', { MIN_AGE })
            : tr('Застосунок доступний з {MIN_AGE} років. Вкажіть дату народження, щоб продовжити.', { MIN_AGE })}</Text>
        </View>

        <BirthDatePicker value={input} onChange={(value) => { setInput(value); setError(null); }} disabled={busy} />
        {!!error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <LegalLinks />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted((v) => !v)} style={{ paddingVertical: spacing.md }}><Text style={typography.body}>{accepted ? '☑ ' : '☐ '}{tr('Я приймаю правила та політику конфіденційності')}</Text></Pressable>
        <Button label={tr('Продовжити')} icon="arrow-right" onPress={submit} loading={busy} disabled={!accepted || busy} />
        <Button label={tr('Вийти')} variant="ghost" small onPress={() => dispatch(logout())} disabled={busy} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, gap: 2 },
  error: { color: colors.red, fontSize: 12, marginBottom: spacing.md },
});
