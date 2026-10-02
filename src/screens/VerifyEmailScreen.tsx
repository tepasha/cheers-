import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout, refreshEmailVerification } from '../store/thunks/auth';
import { authService, describeAuthError } from '../services/authService';
import { useTr } from '../hooks/useT';

const RESEND_COOLDOWN_S = 60;

/** Shown after sign-up until the email link is followed. Firestore rules refuse unverified accounts. */
export const VerifyEmailScreen = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const email = useAppSelector((s) => s.auth.user.email);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'error' | 'info' } | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const check = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const verified = await dispatch(refreshEmailVerification());
      if (!verified) setMessage({ text: tr('Email ще не підтверджено. Перейдіть за посиланням у листі'), kind: 'info' });
    } catch (err) {
      setMessage({ text: tr(describeAuthError(err)), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setMessage(null);
    try {
      await authService.resendVerification();
      setCooldown(RESEND_COOLDOWN_S);
      setMessage({ text: tr('Лист надіслано повторно'), kind: 'info' });
    } catch (err) {
      setMessage({ text: tr(describeAuthError(err)), kind: 'error' });
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Text style={{ fontSize: 56, textAlign: 'center' }}>✉️</Text>
      <Text style={[typography.title, { textAlign: 'center' }]}>{tr('Підтвердіть email')}</Text>
      <Text style={[typography.small, { textAlign: 'center', lineHeight: 18 }]}>
        {tr('Ми надіслали лист на {email}. Перейдіть за посиланням у ньому, а потім поверніться сюди. Перевірте також папку «Спам».', { email: email || tr('вашу пошту') })}
      </Text>

      <Card style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Button label={tr('Я підтвердив(ла)')} icon="check" onPress={check} loading={busy} />
        <Button
          label={cooldown > 0 ? tr('Надіслати ще раз ({cooldown} с)', { cooldown }) : tr('Надіслати лист ще раз')}
          variant="secondary"
          icon="send"
          disabled={cooldown > 0}
          onPress={resend}
        />
        {!!message && (
          <Text style={{ color: message.kind === 'error' ? colors.red : colors.textMuted, fontSize: 12, textAlign: 'center' }} accessibilityRole="alert">
            {message.text}
          </Text>
        )}
      </Card>

      <Button label={tr('Вийти')} variant="ghost" icon="log-out" onPress={() => dispatch(logout())} style={{ marginTop: spacing.lg }} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl, gap: spacing.md },
});
