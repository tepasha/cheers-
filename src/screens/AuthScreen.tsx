import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import appIcon from '../../assets/logo.png'; // 256 px copy: the 1024 px store icon would cost 1 MB of bundle
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, FieldError, SegmentedControl } from '../components/ui';
import { BirthDatePicker } from '../components/BirthDatePicker';
import { colors, radius, spacing, typography } from '../theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { authNoticeSet, authOperationSet } from '../store/slices/uiSlice';
import { profileUpdated } from '../store/slices/authSlice';
import { prefillGoogleBirthDate } from '../store/thunks/auth';
import { authErrorField, authService, describeAuthError } from '../services/authService';
import { firebaseConfigured } from '../services/firebase';
import { analyticsService } from '../services/analyticsService';
import { calculateAge } from '../utils/ageUtils';
import { parseBirthDateInput } from '../logic/dateInput';
import { MIN_AGE, isValidEmail, validatePassword } from '../logic/session';
import { useTr } from '../hooks/useT';
import { LegalLinks } from '../components/LegalLinks';
import { AppleSignInButton } from '../components/AppleSignInButton';
import { isAppleSignInAvailable } from '../services/appleSignIn';
import { isGoogleSignInConfigured } from '../services/googleSignIn';
import { SupportButton } from '../components/SupportButton';
import { reportAppError } from '../services/appErrors';

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
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  // Field errors appear after the first submit attempt, then follow the input as it is corrected
  const [showErrors, setShowErrors] = useState(false);
  // A rejection from Firebase about what was typed, shown under that field until the field changes
  const [serverError, setServerError] = useState<{ field: 'email' | 'password'; text: string } | null>(null);

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
        ? tr('Оберіть дату народження')
        : age === null
          ? tr('Некоректна дата народження')
          : age < MIN_AGE
            ? tr('Додаток доступний з {MIN_AGE} років', { MIN_AGE })
            : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const shown = (field: keyof typeof errors) =>
    (showErrors ? errors[field] : null) ?? (serverError?.field === field ? serverError.text : null);

  const editEmail = (value: string) => {
    setEmail(value);
    setServerError(null);
  };
  const editPassword = (value: string) => {
    setPassword(value);
    setServerError(null);
  };
  /** Errors about the typed credentials go under the field; anything else (network, server) to the error screen */
  const showAuthError = (err: unknown) => {
    const field = authErrorField(err);
    if (field) setServerError({ field, text: tr(describeAuthError(err)) });
    else reportAppError(err, { message: tr(describeAuthError(err)) });
  };

  const underageNotice = useAppSelector((s) => s.ui.authNotice === 'underage');
  useEffect(() => {
    if (!underageNotice) return;
    dispatch(authNoticeSet(null));
    reportAppError(tr('Ще трохи треба почекати, вік користування застосунком {MIN_AGE}', { MIN_AGE }));
  }, [underageNotice, dispatch, tr]);

  // Sign in with Apple exists on iOS 13+ only (App Store Guideline 4.8 asks for it next to Google)
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    void isAppleSignInAvailable().then((ok) => alive && setAppleAvailable(ok));
    return () => {
      alive = false;
    };
  }, []);

  /** Google or Apple: the auth listener signs the person in; a new account is asked for its birth date next */
  const providerSignIn = async (method: 'google' | 'apple') => {
    setInfo(null);
    dispatch(authNoticeSet(null));
    if (!firebaseConfigured) {
      reportAppError(tr('Демо-режим: Firebase не налаштовано, вхід недоступний. Заповніть .env (див. .env.example).'));
      return;
    }
    setBusy(true);
    dispatch(authOperationSet(true));
    try {
      if (method === 'google') {
        const result = await authService.loginWithGoogle();
        if (result?.birthDate) dispatch(prefillGoogleBirthDate(result.user.uid, result.birthDate));
        if (result) analyticsService.trackEvent(result.isNewUser ? 'sign_up' : 'login', { method });
        else setInfo(tr('Вікно Google закрилося без завершення входу. Якщо ви його не закривали, перевірте налаштування Google-входу'));
      } else {
        const result = await authService.loginWithApple();
        if (result) {
          analyticsService.trackEvent(result.isNewUser ? 'sign_up' : 'login', { method });
          // Apple tells the name once, after the auth listener has already run: hand it to the profile now
          if (result.fullName) dispatch(profileUpdated({ name: result.fullName.slice(0, 60) }));
        }
      }
    } catch (err) {
      reportAppError(err, { message: tr(describeAuthError(err)) });
    } finally {
      setBusy(false);
      dispatch(authOperationSet(false));
    }
  };

  const submit = async () => {
    setInfo(null);
    setServerError(null);
    dispatch(authNoticeSet(null));
    if (hasErrors) { setShowErrors(true); return; }
    if (!firebaseConfigured) {
      reportAppError(tr('Демо-режим: Firebase не налаштовано, вхід недоступний. Заповніть .env (див. .env.example).'));
      return;
    }

    setBusy(true);
    dispatch(authOperationSet(true));
    try {
      if (registering && birthIso) {
        await authService.register({ email, password, name, birthDate: birthIso });
        // The auth listener signs the user in; keep the details they just typed
        dispatch(profileUpdated({ name: name.trim(), birthDate: birthIso, serverEligible: true }));
        analyticsService.trackEvent('sign_up', { method: 'email' });
      } else {
        await authService.login(email, password);
        analyticsService.trackEvent('login', { method: 'email' });
      }
    } catch (err) {
      showAuthError(err);
    } finally {
      setBusy(false);
      dispatch(authOperationSet(false));
    }
  };

  const forgotPassword = async () => {
    setInfo(null);
    if (!isValidEmail(email)) {
      setServerError({ field: 'email', text: tr('Введіть email, на який надіслати лист') });
      return;
    }
    setBusy(true);
    try {
      await authService.resetPassword(email);
      setInfo(tr('Якщо акаунт існує, ми надіслали лист для відновлення пароля'));
    } catch (err) {
      // Keep account existence private while still showing transport/configuration failures on the error screen.
      if ((err as { code?: string })?.code === 'auth/user-not-found') setInfo(tr('Якщо акаунт існує, ми надіслали лист для відновлення пароля'));
      else reportAppError(err, { message: tr(describeAuthError(err)) });
    } finally {
      setBusy(false);
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
            setInfo(null);
            setShowErrors(false);
            setServerError(null);
          }}
          options={[
            { value: 'login', label: tr('Вхід') },
            { value: 'register', label: tr('Реєстрація') },
          ]}
        />
        <View style={{ height: spacing.lg }} />

        {registering && (
          <>
            <Field label={tr('ІМ’Я')} value={name} onChangeText={setName} placeholder={tr('Як до тебе звертатись')} autoCapitalize="words" maxLength={40} error={shown('name')} />
          </>
        )}
        <Field
          label="EMAIL"
          value={email}
          onChangeText={editEmail}
          error={shown('email')}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Field
          label={tr('ПАРОЛЬ')}
          value={password}
          onChangeText={editPassword}
          error={shown('password')}
          placeholder={registering ? tr('Щонайменше 8 символів, літери й цифри') : tr('Ваш пароль')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={registering ? 'new-password' : 'current-password'}
          textContentType={registering ? 'newPassword' : 'password'}
        />
        {registering && (
          <>
            <BirthDatePicker value={birthInput} onChange={setBirthInput} disabled={busy} />
            <FieldError message={shown('birth')} style={styles.underPicker} />
            {age !== null && age >= MIN_AGE && <Text style={styles.hint}>{tr('Вік: {age}', { age })}</Text>}
          </>
        )}

        {!!info && <Text style={[styles.hint, { marginBottom: spacing.md }]}>{info}</Text>}

        <Button label={registering ? tr('Створити акаунт') : tr('Увійти')} icon="arrow-right" onPress={submit} loading={busy} />
        {isGoogleSignInConfigured(Platform.OS) && (
          <Button label={tr('Увійти через Google')} icon="log-in" variant="secondary" onPress={() => providerSignIn('google')} disabled={busy} style={{ marginTop: spacing.sm }} />
        )}
        {appleAvailable && <AppleSignInButton onPress={() => providerSignIn('apple')} disabled={busy} />}
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
        <SupportButton />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, gap: 2 },
  hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  logo: { width: 84, height: 84, borderRadius: radius.xl },
  hint: { color: colors.green, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md },
  // The picker keeps its own bottom margin: pull the message up to it, as the hint does
  underPicker: { marginTop: -spacing.sm, marginBottom: spacing.md },
});
