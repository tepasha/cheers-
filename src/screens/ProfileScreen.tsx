import { dialogs as Alert } from '../services/dialogs';
import Constants from 'expo-constants';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { MIN_AGE } from '../logic/session';
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '../theme';
import { Avatar, Badge, Button, Card, Chip, Field, IconButton, Row, SectionTitle, Sheet } from '../components/ui';
import { OfflineBanner, ScreenHeader } from '../components/shell';
import { GamificationCard } from '../components/GamificationCard';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectLocation, selectSettings, selectUser } from '../store/selectors';
import { profileUpdated } from '../store/slices/authSlice';
import { batterySaverSet, languageChosen, pushSettingsUpdated, ruBlockSimulationSet, locationSharingSet } from '../store/slices/settingsSlice';
import { locationUpdated } from '../store/slices/locationSlice';
import { removeFavoriteVenue } from '../store/thunks/favorites';
import { deleteAccount, logout } from '../store/thunks/auth';
import { CANCELLED, describeAuthError, authService } from '../services/authService';
import { firestoreSyncService } from '../services/firestoreSyncService';
import { SUPPORTED_LANGUAGES } from '../services/i18nService';
import { analyticsService } from '../services/analyticsService';
import { adsService } from '../services/ads';
import { requestDeviceLocation } from '../services/locationService';
import { disablePush, registerPush } from '../store/thunks/push';
import { LegalLinks } from '../components/LegalLinks';
import { formatJoinedAt, formatRemainingSession } from '../logic/session';
import { calculateAge } from '../utils/ageUtils';
import { isoToDateInput, parseBirthDateInput } from '../logic/dateInput';
import { useT } from '../hooks/useT';
import { useTr } from '../hooks/useT';
import { ph } from '../services/i18nService';
import { DRINK_METADATA, MOOD_METADATA, PAYMENT_METADATA } from '../data/mockData';
import type { DrinkType, MoodType, PaymentEtiquette } from '../types';
import { captureSession } from '../store/sessionGuard';
import { store } from '../store';
import imageLicenses from '../data/imageLicenses.json';

const support = Constants.expoConfig?.extra?.support;
const SUPPORT_LINKS = [
  ...(typeof support?.url === 'string' && support.url.startsWith('https://') ? [{ label: ph('Технічна підтримка'), icon: 'send' as const, url: support.url }] : []),
  ...(typeof support?.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support.email) ? [{ label: support.email, icon: 'mail' as const, url: `mailto:${support.email}` }] : []),
  ...(typeof support?.donationUrl === 'string' && support.donationUrl.startsWith('https://') ? [{ label: ph('Підтримати розробника 🍺'), icon: 'heart' as const, url: support.donationUrl }] : []),
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
  // Google's consent rules (EEA/UK) require a way to change the ad consent choice later
  const adsPrivacyOptions = useSyncExternalStore(adsService.subscribe, adsService.getState).privacyOptionsRequired;
  const blockedCount = useAppSelector((s) => s.safety.blockedUsers.length);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [licensesVisible, setLicensesVisible] = useState(false);
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
          <SettingRow title={tr('Показувати мене поруч')} subtitle={tr('Лише з GPS: інші бачать приблизний район, а не точну позицію.')} value={settings.shareLocation} onChange={async (enabled) => {
            const current = captureSession(store.getState);
            if (enabled && (location.isSimulated || location.status !== 'active')) { Alert.alert(tr('Геолокація'), tr('Спочатку увімкніть GPS. Обраний район не публікується як ваша позиція.')); return; }
            try {
              await firestoreSyncService.saveUserProfile({ id: user.id, name: user.name, shareLocation: enabled, ...(enabled ? { lat: location.lat, lng: location.lng } : {}) });
              if (current()) dispatch(locationSharingSet(enabled));
            } catch (err) { if (current()) Alert.alert(tr('Геолокація'), tr(describeAuthError(err))); }
          }} />
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
          {adsPrivacyOptions && <Button label={tr('Налаштування реклами')} icon="sliders" small variant="secondary" onPress={() => void adsService.showPrivacyOptions().catch(() => {})} />}
          <Button label={tr('Ліцензії зображень')} icon="file-text" small variant="secondary" onPress={() => setLicensesVisible(true)} />
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
      {licensesVisible && <Sheet visible title={tr('Ліцензії зображень')} onClose={() => setLicensesVisible(false)}>
        <Text style={typography.body}>{imageLicenses.name}</Text>
        <Text style={typography.small}>{imageLicenses.attribution}</Text>
        <Text style={typography.tiny} selectable>{imageLicenses.license}</Text>
      </Sheet>}
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
  const [tagline, setTagline] = useState(user.tagline ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [drinks, setDrinks] = useState<DrinkType[]>(user.preferredDrinks ?? []);
  const [mood, setMood] = useState<MoodType>(user.currentMood ?? 'not_specified');
  const [payment, setPayment] = useState<PaymentEtiquette>(user.paymentRule ?? 'not_specified');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const birthIso = birth.trim() ? parseBirthDateInput(birth) : user.birthDate ?? null;
  const age = birthIso ? calculateAge(birthIso) : null;
  const birthError = birth.trim() && (!birthIso || age === null || age < MIN_AGE) ? tr('Вкажіть дату як ДД.ММ.РРРР ({MIN_AGE}+)', { MIN_AGE }) : null;

  const save = async () => {
    if (birthError || busy) return;
    setBusy(true); setError('');
    const current = captureSession(store.getState);
    try {
      await authService.updatePersonalProfile(name.trim() || user.name, birthIso !== user.birthDate ? birthIso ?? undefined : undefined);
      if (!current()) return;
      const details = { tagline: tagline.trim(), bio: bio.trim(), preferredDrinks: drinks, currentMood: mood, paymentRule: payment };
      await firestoreSyncService.saveUserProfile({ id: user.id, name: name.trim() || user.name, ...details });
      if (!current()) return;
      dispatch(profileUpdated({ name: name.trim() || user.name, ...details, ...(birthIso ? { birthDate: birthIso } : {}) }));
      onClose();
    } catch (err) { setError(tr(describeAuthError(err))); }
    finally { setBusy(false); }
  };

  return (
    <Sheet visible onClose={onClose} title={tr('Редагувати профіль')} footer={<Button label={tr('Зберегти')} icon="check" loading={busy} disabled={!!birthError || busy} onPress={save} />}>
      <Field label={tr('ІМ’Я')} value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" />
      <Field label={tr('ДАТА НАРОДЖЕННЯ (ДД.ММ.РРРР)')} value={birth} onChangeText={setBirth} keyboardType="numbers-and-punctuation" placeholder="15.05.1998" />
      <Field label={tr('Короткий опис')} value={tagline} onChangeText={setTagline} maxLength={140} />
      <Field label={tr('Про мене')} value={bio} onChangeText={setBio} maxLength={500} multiline />
      <SectionTitle>{tr('Напої')}</SectionTitle>
      <Row style={{ flexWrap: 'wrap' }}>{(Object.keys(DRINK_METADATA) as DrinkType[]).map((drink) => <Chip key={drink} label={tr(DRINK_METADATA[drink].label)} selected={drinks.includes(drink)} onPress={() => setDrinks((previous) => previous.includes(drink) ? previous.filter((d) => d !== drink) : [...previous, drink])} />)}</Row>
      <SectionTitle>{tr('Настрій')}</SectionTitle>
      <Row style={{ flexWrap: 'wrap' }}>{(Object.keys(MOOD_METADATA) as MoodType[]).map((value) => <Chip key={value} label={tr(MOOD_METADATA[value].label)} selected={mood === value} onPress={() => setMood(value)} />)}</Row>
      <SectionTitle>{tr('Оплата')}</SectionTitle>
      <Row style={{ flexWrap: 'wrap' }}>{(Object.keys(PAYMENT_METADATA) as PaymentEtiquette[]).map((value) => <Chip key={value} label={tr(PAYMENT_METADATA[value].label)} selected={payment === value} onPress={() => setPayment(value)} />)}</Row>
      {!!birthError && <Text style={{ color: colors.red, fontSize: 12 }}>{birthError}</Text>}
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.red }}>{error}</Text>}
    </Sheet>
  );
};

/**
 * Permanent deletion. The person proves it is them again: the password for an email account, the Google dialog for a
 * Google account (it has no password). The server then removes their data everywhere and the account itself.
 */
const DeleteAccountSheet = ({ onClose }: { onClose: () => void }) => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const provider = useAppSelector((s) => s.auth.user.provider);
  const viaGoogle = provider === 'google';
  const viaApple = provider === 'apple';
  const noPassword = viaGoogle || viaApple;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await dispatch(deleteAccount(noPassword ? undefined : password));
      // The auth listener returns the app to the sign-in screen
    } catch (err) {
      if ((err as { code?: string }).code !== CANCELLED) setError(tr(describeAuthError(err)));
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={tr('Видалити акаунт')}
      footer={
        <Button
          label={viaGoogle ? tr('Підтвердити через Google і видалити') : viaApple ? tr('Підтвердити через Apple і видалити') : tr('Видалити назавжди')}
          icon="trash-2"
          variant="danger"
          loading={busy}
          disabled={!noPassword && !password}
          onPress={confirm}
        />
      }
    >
      <Text style={[typography.small, { marginBottom: spacing.md, lineHeight: 18 }]}>
        {tr('Профіль, улюблені заклади, друзі, блокування, ваші столики й зустрічі та приватні дані будуть видалені без можливості відновлення. Надіслані повідомлення залишаться в чатах у зашифрованому вигляді, але без вашого імені та фото.')}
      </Text>
      {viaGoogle ? (
        <Text style={[typography.small, { marginBottom: spacing.md, lineHeight: 18 }]}>{tr('Щоб підтвердити, що це ви, увійдіть у свій акаунт Google ще раз.')}</Text>
      ) : viaApple ? (
        <Text style={[typography.small, { marginBottom: spacing.md, lineHeight: 18 }]}>{tr('Щоб підтвердити, що це ви, увійдіть через Apple ще раз.')}</Text>
      ) : (
        <Field label={tr('ПІДТВЕРДІТЬ ПАРОЛЬ')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      )}
      {!!error && <Text style={{ color: colors.red, fontSize: 12 }}>{error}</Text>}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
});
