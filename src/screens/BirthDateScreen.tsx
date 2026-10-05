import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import { useAppDispatch } from '../store/hooks';
import { logout, submitBirthDate } from '../store/thunks/auth';
import { parseBirthDateInput } from '../logic/dateInput';
import { MIN_AGE } from '../logic/session';
import { useTr } from '../hooks/useT';

/**
 * Shown after a first Google sign-in (Google does not tell us the birth date) and to any account that has none yet.
 * Too young: the account is removed and the sign-in screen says to wait until {MIN_AGE}.
 */
export const BirthDateScreen = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const iso = parseBirthDateInput(input);
    if (!iso) {
      setError(tr('Вкажіть дату у форматі ДД.ММ.РРРР'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await dispatch(submitBirthDate(iso));
      if (result === 'invalid') setError(tr('Некоректна дата народження'));
      // 'too_young': the account is gone and the sign-in screen takes over; 'ok': the app opens
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl * 2, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
          <Text style={[typography.title, { fontSize: 24 }]}>{tr('Ще один крок')}</Text>
          <Text style={typography.small}>{tr('Застосунок доступний з {MIN_AGE} років. Вкажіть дату народження, щоб продовжити.', { MIN_AGE })}</Text>
        </View>

        <Field
          label={tr('ДАТА НАРОДЖЕННЯ')}
          value={input}
          onChangeText={setInput}
          placeholder={tr('ДД.ММ.РРРР')}
          keyboardType="numbers-and-punctuation"
        />
        {!!error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Button label={tr('Продовжити')} icon="arrow-right" onPress={submit} loading={busy} />
        <Button label={tr('Вийти')} variant="ghost" small onPress={() => dispatch(logout())} disabled={busy} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, gap: 2 },
  error: { color: colors.red, fontSize: 12, marginBottom: spacing.md },
});
