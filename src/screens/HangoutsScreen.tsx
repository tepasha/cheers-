import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '../theme';
import { Avatar, Badge, Button, Card, Chip, EmptyState, Field, IconButton, Row, SegmentedControl, Sheet } from '../components/ui';
import { OfflineBanner, ScreenHeader } from '../components/shell';
import { ReportSheet, ReportTarget } from '../components/ReportSheet';
import { MeetupsSection } from '../components/MeetupsSection';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectBuddies, selectHangouts, selectLocation } from '../store/selectors';
import { closeHangout, joinHangout, openDirectChat, publishHangout } from '../store/thunks/social';
import { HangoutAlert } from '../types';
import { GOOGLE_MAPS_VENUES } from '../data/venuesData';
import { useTr } from '../hooks/useT';

type Tab = 'live' | 'scheduled';
type Filter = 'all' | 'nearby';

const NEARBY_KM = 2;
const SLOT_OPTIONS = [1, 2, 3, 4, 5, 6];

export const HangoutsScreen = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const hangouts = useAppSelector(selectHangouts);
  const buddies = useAppSelector(selectBuddies);
  const user = useAppSelector((s) => s.auth.user);
  const [tab, setTab] = useState<Tab>('live');
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const visible = useMemo(
    () => (filter === 'nearby' ? hangouts.filter((h) => (h.distanceKm ?? 999) <= NEARBY_KM) : hangouts),
    [hangouts, filter]
  );

  const chatWithHost = useCallback(
    (h: HangoutAlert) => {
      const host = buddies.find((b) => b.id === h.userId);
      if (!host) {
        Alert.alert(tr('Недоступно'), tr('Профіль організатора зараз не в мережі.'));
        return;
      }
      navigation.navigate('ChatRoom', { chatId: dispatch(openDirectChat(host)) });
    },
    [buddies, dispatch, navigation, tr]
  );

  const confirmClose = (h: HangoutAlert) =>
    Alert.alert(tr('Закрити клич?'), tr('«{barName}» зникне з карти та стрічки.', { barName: h.barName }), [
      { text: tr('Скасувати'), style: 'cancel' },
      { text: tr('Закрити'), style: 'destructive', onPress: () => dispatch(closeHangout(h.id)) },
    ]);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <OfflineBanner />
      <ScreenHeader
        title={tr('Кличі')}
        subtitle={tab === 'live' ? tr('{count} активних столиків', { count: hangouts.length }) : tr('Заплановані зустрічі')}
        right={tab === 'live' ? <IconButton icon="plus-circle" label={tr('Створити клич')} color={colors.amber} onPress={() => setCreating(true)} /> : undefined}
      />
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'live', label: tr('🟢 Зараз') },
            { value: 'scheduled', label: tr('🗓️ Заплановані') },
          ]}
        />
        {tab === 'live' && (
          <Row>
            <Chip label={tr('Усі')} selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label={tr('Поруч (до {NEARBY_KM} км)', { NEARBY_KM })} selected={filter === 'nearby'} onPress={() => setFilter('nearby')} />
          </Row>
        )}
      </View>

      {tab === 'scheduled' ? (
        <MeetupsSection onReport={setReportTarget} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(h) => h.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              emoji="🍻"
              title={tr('Активних кличів немає')}
              subtitle={tr('Будь першим — створи клич і запроси людей до свого столика.')}
              action={<Button label={tr('Створити клич')} icon="plus" small onPress={() => setCreating(true)} />}
            />
          }
          renderItem={({ item: h }) => {
            const mine = h.userId === user.id;
            const joined = mine || (h.joinedUsers ?? []).includes(user.id);
            const free = Math.max(0, h.slotsAvailable - Math.max(0, h.participantsCount - 1));
            return (
              <Card style={{ gap: spacing.sm }}>
                <Row style={{ gap: spacing.md }}>
                  <Avatar uri={h.userAvatar} name={h.userName} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.heading} numberOfLines={1}>
                      {h.barName}
                    </Text>
                    <Text style={typography.small} numberOfLines={1}>
                      {h.userName} • {tr(h.locationArea)}
                      {h.distanceFormatted ? ` • ${h.distanceFormatted}` : ''}
                    </Text>
                  </View>
                  <Badge label={free > 0 ? tr('{free} місц.', { free }) : tr('Повно')} color={free > 0 ? colors.green : colors.red} bg={free > 0 ? colors.greenBg : colors.redBg} />
                </Row>
                <Text style={typography.small}>🍺 {tr(h.drinkPreference)}</Text>
                {!!h.description && <Text style={typography.body}>{h.description}</Text>}
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={typography.tiny}>{tr('За столиком: {count}', { count: h.participantsCount })}</Text>
                  <Row>
                    {!mine && <IconButton icon="flag" label={tr('Поскаржитись')} color={colors.textDim} onPress={() => setReportTarget({ id: h.userId, name: h.userName, avatar: h.userAvatar, type: 'hangout' })} />}
                    {!mine && <IconButton icon="message-circle" label={tr('Написати організатору')} onPress={() => chatWithHost(h)} />}
                    {mine ? (
                      <Button label={tr('Закрити')} small variant="danger" icon="x" onPress={() => confirmClose(h)} />
                    ) : (
                      <Button label={joined ? tr('Ви за столиком') : tr('Приєднатись')} small icon={joined ? 'check' : 'log-in'} disabled={joined || free === 0} onPress={() => dispatch(joinHangout(h.id))} />
                    )}
                  </Row>
                </Row>
              </Card>
            );
          }}
        />
      )}

      <CreateHangoutSheet visible={creating} onClose={() => setCreating(false)} />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </SafeAreaView>
  );
};

const CreateHangoutSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const location = useAppSelector(selectLocation);
  const [bar, setBar] = useState('');
  const [area, setArea] = useState('');
  const [drink, setDrink] = useState(tr('Крафтове пиво & Сидр'));
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState(2);
  const [venueCoords, setVenueCoords] = useState<{ lat: number; lng: number } | null>(null);

  const nearbyVenues = useMemo(
    () =>
      [...GOOGLE_MAPS_VENUES]
        .map((v) => ({ v, d: Math.hypot(v.lat - location.lat, v.lng - location.lng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 10)
        .map(({ v }) => v),
    [location.lat, location.lng]
  );

  const reset = () => {
    setBar('');
    setArea('');
    setDescription('');
    setSlots(2);
    setVenueCoords(null);
  };

  const publish = () => {
    const coords = venueCoords ?? { lat: location.lat, lng: location.lng };
    dispatch(
      publishHangout({
        id: `hangout-${Date.now()}`,
        userId: user.id,
        userName: user.name || tr('Користувач'),
        userAvatar: user.avatar,
        barName: bar.trim(),
        locationArea: area.trim() || location.locationName,
        drinkPreference: drink.trim() || tr('Келих за настроєм'),
        description: description.trim(),
        createdAt: tr('Щойно'),
        slotsAvailable: slots,
        participantsCount: 1,
        lat: coords.lat,
        lng: coords.lng,
        status: 'active',
        isLive: true,
        joinedUsers: [user.id],
      })
    );
    reset();
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={tr('Новий клич')}
      footer={<Button label={tr('Опублікувати')} icon="radio" disabled={!bar.trim()} onPress={publish} />}
    >
      <Text style={typography.label}>{tr('ЗАКЛАДИ ПОРУЧ')}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: spacing.sm }}>
        {nearbyVenues.map((v) => (
          <Chip
            key={v.id}
            label={v.name}
            selected={bar === v.name}
            onPress={() => {
              setBar(v.name);
              setArea(`${v.cityName}, ${v.district}`);
              setVenueCoords({ lat: v.lat, lng: v.lng });
            }}
          />
        ))}
      </Row>
      <Field label={tr('ЗАКЛАД')} value={bar} onChangeText={(t) => { setBar(t); setVenueCoords(null); }} placeholder={tr('напр. Squat 17b, Win Bar…')} />
      <Field label={tr('РАЙОН')} value={area} onChangeText={setArea} placeholder={location.locationName} />
      <Field label={tr('ЩО П’ЄМО')} value={drink} onChangeText={setDrink} />
      <Field label={tr('ОПИС')} value={description} onChangeText={setDescription} multiline placeholder={tr('Де сидимо, яка атмосфера, що обговорюємо…')} maxLength={240} />
      <Text style={typography.label}>{tr('ВІЛЬНИХ МІСЦЬ')}</Text>
      <Row style={{ marginTop: 6 }}>
        {SLOT_OPTIONS.map((n) => (
          <Chip key={n} label={String(n)} selected={slots === n} onPress={() => setSlots(n)} />
        ))}
      </Row>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
});
