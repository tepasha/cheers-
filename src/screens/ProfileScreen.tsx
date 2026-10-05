import React, { useEffect, useState } from 'react';
import { MIN_AGE } from '../logic/session';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '../theme';
import { Avatar, Badge, Button, Card, Chip, Field, IconButton, Row, SectionTitle, Sheet } from '../components/ui';
import { OfflineBanner, ScreenHeader } from '../components/shell';
import { GamificationCard } from '../components/GamificationCard';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectLocation, selectSettings, selectUser } from '../store/selectors';
import { profileUpdated } from '../store/slices/authSlice';
import { batterySaverSet, languageChosen, pushSettingsUpdated, ruBlockSimulationSet } from '../store/slices/settingsSlice';
import { locationUpdated } from '../store/slices/locationSlice';
import { removeFavoriteVenue } from '../store/thunks/favorites';
import { deleteAccount, logout } from '../store/thunks/auth';
import { describeAuthError } from '../services/authService';
import { SUPPORTED_LANGUAGES } from '../services/i18nService';
import { analyticsService } from '../services/analyticsService';
import { requestDeviceLocation } from '../services/locationService';
import { disablePush, registerPush } from '../store/thunks/push';
import { LegalLinks } from '../components/LegalLinks';
import { formatJoinedAt, formatRemainingSession } from '../logic/session';
import { calculateAge } from '../utils/ageUtils';
import { isoToDateInput, parseBirthDateInput } from '../logic/dateInput';
import { useT } from '../hooks/useT';
import { useTr } from '../hooks/useT';
import { ph } from '../services/i18nService';

const SUPPORT_LINKS = [
  { label: ph('Технічна підтримка в Telegram'), icon: 'send' as const, url: 'https://t.me/cheers_support_bot' },
  { label: 'support@budmo.ua', icon: 'mail' as const, url: 'mailto:support@budmo.ua' },
  { label: ph('Підтримати розробника 🍺'), icon: 'heart' as const, url: 'https://send.monobank.ua/jar/budmo' },
];

export const ProfileScreen = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const t = useT();
  const user = useAppSelector(selectUser);
  const settings = useAppSelector(selectSettings);
  const location = useAppSelector(selectLocation);
  const favorites = useAppSelector((s) => s.favorites.items);
  const blockedCount = useAppSelector((s) => s.safety.blockedUsers.length);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const toggleBattery = (enabled: boolean) => {
    dispatch(batterySaverSet(enabled));
    analyticsService.trackBatterySaver(enabled);
  };

  const toggleSystemNotifications = async (enabled: boolean) => {
    if (!enabled) {
      await dispatch(disablePush());
      return;
    }
    const status = await dispatch(registerPush({ ask: true }));
    if (status === 'denied') Alert.alert(tr('Сповіщення вимкнені'), tr('Дозвольте сповіщення для «Будьмо!» у налаштуваннях пристрою.'));
    else if (status === 'unavailable') Alert.alert(tr('Сповіщення недоступні'), tr('На цьому пристрої або в цій збірці push-сповіщення поки не працюють.'));
  };

  const useRealLocation = async () => {
    const real = await requestDeviceLocation(!settings.batterySaver);
    if (real) dispatch(locationUpdated(real));
    else Alert.alert(tr('Немає доступу до геолокації'), tr('Дозвольте доступ до місцезнаходження в налаштуваннях пристрою.'));
  };

  const confirmLogout = () =>
    Alert.alert(tr('Вийти з профілю?'), tr('Дані на пристрої збережуться, але сесію буде завершено.'), [
      { text: tr('Скасувати'), style: 'cancel' },
      { text: tr('Вийти'), style: 'destructive', onPress: () => dispatch(logout()) },
    ]);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <OfflineBanner />
      <ScreenHeader title={t('tab_profile')} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}>
        <Card style={{ gap: spacing.md }}>
          <Row style={{ gap: spacing.md }}>
            <Avatar uri={user.avatar} name={user.name} size={64} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={typography.title}>{user.name || tr('Без імені')}</Text>
              <Text style={typography.small}>{user.email}</Text>
              {user.age != null && <Text style={typography.small}>{tr('Вік: {age}', { age: user.age })}</Text>}
            </View>
            <IconButton icon="edit-2" label={tr('Редагувати профіль')} onPress={() => setEditing(true)} />
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            <Badge label={tr('Сесія: {time}', { time: formatRemainingSession(user.sessionExpiresAt, now, settings.language) })} color={colors.textMuted} bg={colors.surfaceHigh} />
            {user.joinedAt && <Badge label={tr('З нами: {joinedAt}', { joinedAt: formatJoinedAt(user.joinedAt, settings.language) })} color={colors.textMuted} bg={colors.surfaceHigh} />}
          </Row>
        </Card>

        <SectionTitle>{tr('Гейміфікація')}</SectionTitle>
        <GamificationCard />

        <SectionTitle>{tr('Мова')}</SectionTitle>
        <Row style={{ flexWrap: 'wrap' }}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <Chip
              key={l.code}
              emoji={l.flag}
              label={l.nativeName}
              selected={settings.language === l.code}
              onPress={() => {
                dispatch(languageChosen(l.code));
                analyticsService.trackLanguageChange(l.code, 'manual');
              }}
            />
          ))}
        </Row>
        <Text style={[typography.tiny, { marginTop: 6 }]}>{tr(settings.languageHint)}</Text>

        <SectionTitle>{tr('Геолокація')}</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <Text style={typography.body}>{tr(location.locationName)}</Text>
          <Text style={typography.tiny}>
            {location.isSimulated ? tr('Обраний район (можна змінити на вкладці «Мапа»)') : tr('GPS • точність ±{accuracyMeters} м • {lastUpdated}', { accuracyMeters: location.accuracyMeters, lastUpdated: location.lastUpdated })}
          </Text>
          <Button label={tr('Використовувати мій GPS')} icon="crosshair" small variant="secondary" onPress={useRealLocation} />
        </Card>

        <SectionTitle>{tr('Налаштування')}</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <SettingRow title={tr('Економія батареї')} subtitle={tr('Рідший GPS та оновлення в реальному часі')} value={settings.batterySaver} onChange={toggleBattery} />
          <SettingRow title={tr('Банер у застосунку')} subtitle={tr('Показувати сповіщення зверху екрана')} value={settings.push.bannerEnabled} onChange={(v) => dispatch(pushSettingsUpdated({ bannerEnabled: v }))} />
          <SettingRow title={tr('Вібрація')} subtitle={tr('Відгук на події та сповіщення')} value={settings.push.vibrateEnabled} onChange={(v) => dispatch(pushSettingsUpdated({ vibrateEnabled: v, soundEnabled: v }))} />
          <SettingRow title={tr('Системні сповіщення')} subtitle={tr('Показувати у шторці пристрою')} value={settings.push.webPushEnabled} onChange={toggleSystemNotifications} />
        </Card>

        <SectionTitle>{tr('Улюблені заклади ({count})', { count: favorites.length })}</SectionTitle>
        {favorites.length === 0 ? (
          <Text style={typography.small}>{tr('Додавай заклади в улюблені на мапі — вони з’являться тут.')}</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {favorites.map((f) => (
              <Card key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body}>{f.name}</Text>
                  <Text style={typography.tiny}>
                    {f.area} • {f.category}
                  </Text>
                </View>
                <IconButton icon="trash-2" label={tr('Прибрати {name}', { name: f.name })} color={colors.textDim} onPress={() => dispatch(removeFavoriteVenue(f.id))} />
              </Card>
            ))}
          </View>
        )}

        <SectionTitle>{tr('Безпека')}</SectionTitle>
        <Button label={tr('Заблоковані користувачі ({blockedCount})', { blockedCount })} icon="shield-off" variant="secondary" onPress={() => navigation.navigate('BlockedUsers')} />

        <SectionTitle>{tr('Підтримка')}</SectionTitle>
        <View style={{ gap: spacing.sm }}>
          {SUPPORT_LINKS.map((l) => (
            <Button key={l.url} label={tr(l.label)} icon={l.icon} variant="secondary" onPress={() => Linking.openURL(l.url)} />
          ))}
        </View>

        <View style={{ marginTop: spacing.sm }}>
          <LegalLinks />
        </View>

        {__DEV__ && (
          <>
            <SectionTitle>{tr('Тестування (лише в розробці)')}</SectionTitle>
            <Card>
              <SettingRow
                title={tr('Симуляція гео-блокування РФ')}
                subtitle={tr('Показує екран блокування (для перевірки)')}
                value={settings.simulateRuBlock}
                onChange={(v) => dispatch(ruBlockSimulationSet(v))}
              />
            </Card>
          </>
        )}

        <Button label={tr('Вийти')} icon="log-out" variant="danger" onPress={confirmLogout} style={{ marginTop: spacing.xl }} />
        <Button label={tr('Видалити акаунт')} icon="trash-2" variant="ghost" small onPress={() => setDeleting(true)} style={{ marginTop: spacing.sm }} />
      </ScrollView>

      {editing && <EditProfileSheet onClose={() => setEditing(false)} />}
      {deleting && <DeleteAccountSheet onClose={() => setDeleting(false)} />}
    </SafeAreaView>
  );
};

const SettingRow = ({ title, subtitle, value, onChange }: { title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void }) => (
  <Row style={{ justifyContent: 'space-between' }}>
    <View style={{ flex: 1 }}>
      <Text style={typography.body}>{title}</Text>
      <Text style={typography.tiny}>{subtitle}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      accessibilityLabel={title}
      trackColor={{ false: colors.surfaceHigh, true: colors.amber }}
      thumbColor={colors.text}
    />
  </Row>
);

/** Mounted only while editing, so the form always starts from the current profile */
const EditProfileSheet = ({ onClose }: { onClose: () => void }) => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const [name, setName] = useState(user.name);
  const [birth, setBirth] = useState(user.birthDate ? isoToDateInput(user.birthDate) : '');

  const birthIso = birth.trim() ? parseBirthDateInput(birth) : user.birthDate ?? null;
  const age = birthIso ? calculateAge(birthIso) : null;
  const birthError = birth.trim() && (!birthIso || age === null || age < MIN_AGE) ? tr('Вкажіть дату як ДД.ММ.РРРР ({MIN_AGE}+)', { MIN_AGE }) : null;

  const save = () => {
    if (birthError) return;
    dispatch(profileUpdated({ name: name.trim() || user.name, ...(birthIso ? { birthDate: birthIso } : {}) }));
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={tr('Редагувати профіль')} footer={<Button label={tr('Зберегти')} icon="check" disabled={!!birthError} onPress={save} />}>
      <Field label={tr('ІМ’Я')} value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label={tr('ДАТА НАРОДЖЕННЯ (ДД.ММ.РРРР)')} value={birth} onChangeText={setBirth} keyboardType="numbers-and-punctuation" placeholder="15.05.1998" />
      {!!birthError && <Text style={{ color: colors.red, fontSize: 12 }}>{birthError}</Text>}
    </Sheet>
  );
};

/** Permanent deletion; asks for the password again (Firebase requires a recent sign-in for this) */
const DeleteAccountSheet = ({ onClose }: { onClose: () => void }) => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await dispatch(deleteAccount(password));
      // The auth listener returns the app to the sign-in screen
    } catch (err) {
      setError(tr(describeAuthError(err)));
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={tr('Видалити акаунт')}
      footer={<Button label={tr('Видалити назавжди')} icon="trash-2" variant="danger" loading={busy} disabled={!password} onPress={confirm} />}
    >
      <Text style={[typography.small, { marginBottom: spacing.md, lineHeight: 18 }]}>
        {tr('Профіль, улюблені заклади, друзі та приватні дані будуть видалені без можливості відновлення. Надіслані вами повідомлення залишаться в чатах у зашифрованому вигляді.')}
      </Text>
      <Field label={tr('ПІДТВЕРДІТЬ ПАРОЛЬ')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      {!!error && <Text style={{ color: colors.red, fontSize: 12 }}>{error}</Text>}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
});
