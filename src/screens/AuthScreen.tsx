import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import appIcon from '../../assets/icon.png';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, SegmentedControl } from '../components/ui';
import { colors, radius, spacing, typography } from '../theme';
import { useAppDispatch } from '../store/hooks';
import { profileUpdated } from '../store/slices/authSlice';
import { authService, describeAuthError } from '../services/authService';
import { analyticsService } from '../services/analyticsService';
import { calculateAge } from '../utils/ageUtils';
import { parseBirthDateInput } from '../logic/dateInput';
import { MIN_AGE, isValidEmail, validatePassword } from '../logic/session';
import { useTr } from '../hooks/useT';
import { LegalLinks } from '../components/LegalLinks';

const SUPPORT_URL = 'https://t.me/cheers_support_bot';

type Mode = 'login' | 'register';

export const AuthScreen = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthInput, setBirthInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const birthIso = useMemo(() => parseBirthDateInput(birthInput), [birthInput]);
  const age = birthIso ? calculateAge(birthIso) : null;
  const registering = mode === 'register';

  const errors = {
    email: isValidEmail(email) ? null : tr('Введіть коректний email'),
    password: registering ? validatePassword(password) : password ? null : tr('Введіть пароль'),
    name: registering && !name.trim() ? tr('Вкажіть імʼя') : null,
    birth: !registering
      ? null
      : birthIso === null
        ? tr('Вкажіть дату у форматі ДД.ММ.РРРР')
        : age === null
          ? tr('Некоректна дата народження')
          : age < MIN_AGE
            ? tr('Додаток доступний з {MIN_AGE} років', { MIN_AGE })
            : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    setInfo(null);
    if (hasErrors) return;

    setBusy(true);
    try {
      if (registering && birthIso) {
        await authService.register({ email, password, name, birthDate: birthIso });
        // The auth listener signs the user in; keep the details they just typed
        dispatch(profileUpdated({ name: name.trim(), birthDate: birthIso }));
        analyticsService.trackEvent('sign_up', { method: 'email' });
      } else {
        await authService.login(email, password);
        analyticsService.trackEvent('login', { method: 'email' });
      }
    } catch (err) {
      setError(tr(describeAuthError(err)));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!isValidEmail(email)) {
      setSubmitted(true);
      setError(tr('Введіть email, на який надіслати лист'));
      return;
    }
    setBusy(true);
    try {
      await authService.resetPassword(email);
    } catch {
      // Same message either way: do not reveal whether an account exists for this address
    } finally {
      setBusy(false);
      setInfo(tr('Якщо акаунт існує, ми надіслали лист для відновлення пароля'));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={styles.hero}>
          <Image source={appIcon} style={styles.logo} />
          <Text style={[typography.title, { fontSize: 26 }]}>{tr('Будьмо!')}</Text>
          <Text style={[typography.small, { textAlign: 'center', lineHeight: 18 }]}>
            {tr('Знаходь компанію для посиденьок, створюй спільні сходки та спілкуйся у зашифрованих чатах')}
          </Text>
        </View>

        <SegmentedControl<Mode>
          value={mode}
          onChange={(m) => {
            setMode(m);
            setSubmitted(false);
            setError(null);
            setInfo(null);
          }}
          options={[
            { value: 'login', label: tr('Вхід') },
            { value: 'register', label: tr('Реєстрація') },
          ]}
        />
        <View style={{ height: spacing.lg }} />

        {registering && (
          <>
            <Field label={tr('ІМ’Я')} value={name} onChangeText={setName} placeholder={tr('Як до тебе звертатись')} autoCapitalize="words" maxLength={40} />
            {submitted && errors.name && <Text style={styles.error}>{tr(errors.name)}</Text>}
          </>
        )}
        <Field
          label="EMAIL"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />
        {submitted && errors.email && <Text style={styles.error}>{tr(errors.email)}</Text>}
        <Field
          label={tr('ПАРОЛЬ')}
          value={password}
          onChangeText={setPassword}
          placeholder={registering ? tr('Щонайменше 8 символів, літери й цифри') : tr('Ваш пароль')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={registering ? 'new-password' : 'current-password'}
          textContentType={registering ? 'newPassword' : 'password'}
        />
        {submitted && errors.password && <Text style={styles.error}>{tr(errors.password)}</Text>}
        {registering && (
          <>
            <Field
              label={tr('ДАТА НАРОДЖЕННЯ')}
              value={birthInput}
              onChangeText={setBirthInput}
              placeholder={tr('ДД.ММ.РРРР')}
              keyboardType="numbers-and-punctuation"
            />
            {age !== null && age >= MIN_AGE && <Text style={styles.hint}>{tr('Вік: {age}', { age })}</Text>}
            {(submitted || (birthIso && age !== null && age < MIN_AGE)) && errors.birth && <Text style={styles.error}>{tr(errors.birth)}</Text>}
          </>
        )}

        {!!error && (
          <Text style={[styles.error, { marginBottom: spacing.md }]} accessibilityRole="alert">
            {error}
          </Text>
        )}
        {!!info && <Text style={[styles.hint, { marginBottom: spacing.md }]}>{info}</Text>}

        <Button label={registering ? tr('Створити акаунт') : tr('Увійти')} icon="arrow-right" onPress={submit} loading={busy} />
        {!registering && <Button label={tr('Забули пароль?')} variant="ghost" small onPress={forgotPassword} disabled={busy} style={{ marginTop: spacing.sm }} />}

        <Text style={[typography.tiny, { textAlign: 'center', marginTop: spacing.lg, lineHeight: 15 }]}>
          {registering
            ? tr('Ми надішлемо лист для підтвердження email. Реєструючись, ти підтверджуєш, що тобі виповнилось {MIN_AGE} років.', { MIN_AGE })
            : tr('Вхід захищений Firebase Authentication. Пароль не зберігається на пристрої.')}
        </Text>
        {registering && (
          <Text style={[typography.tiny, { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.sm, lineHeight: 15 }]}>
            {tr('Реєструючись, ти погоджуєшся з Умовами користування та Політикою конфіденційності. Образливий контент і переслідування заборонені: на такі акаунти можна поскаржитися, їх буде заблоковано.')}
          </Text>
        )}
        <LegalLinks />
        <Button label={tr('Підтримка в Telegram')} variant="ghost" icon="send" small onPress={() => Linking.openURL(SUPPORT_URL)} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, gap: 2 },
  hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  logo: { width: 84, height: 84, borderRadius: radius.xl },
  error: { color: colors.red, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md },
  hint: { color: colors.green, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md },
});
