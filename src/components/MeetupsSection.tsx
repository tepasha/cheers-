import { dialogs as Alert } from '../services/dialogs';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Avatar, Badge, Button, Card, Chip, EmptyState, Field, Icon, IconButton, Row, SectionTitle, Sheet } from './ui';
import type { ReportTarget } from './ReportSheet';
import { colors, radius, spacing, typography } from '../theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectBuddies, selectLocation, selectMeetups } from '../store/selectors';
import { cancelMeetup, createMeetup, inviteToMeetup, joinMeetup, leaveMeetup } from '../store/thunks/meetups';
import { BuddyProfile, GroupMeetup } from '../types';
import { GOOGLE_MAPS_VENUES } from '../data/venuesData';
import { addDays, formatDateInput, toIsoDateTime } from '../logic/dateInput';
import { addMeetupToCalendar } from '../services/calendarService';
import { useTr } from '../hooks/useT';
import { InlineAd, useCanRequestAds } from './AdBanner';
import { MEETUPS_AD_EVERY, isAdSlot, withAdSlots } from '../logic/ads';
import { ph } from '../services/i18nService';

const STATUS_LABEL: Record<GroupMeetup['status'], string> = {
  upcoming: ph('Заплановано'),
  ongoing: ph('Триває'),
  past: ph('Завершено'),
  cancelled: ph('Скасовано'),
};

export const MeetupsSection = ({ onReport }: { onReport: (t: ReportTarget) => void }) => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const meetups = useAppSelector(selectMeetups);
  const myId = useAppSelector((s) => s.auth.user.id);
  const lang = useAppSelector((s) => s.settings.language);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  const active = useMemo(() => meetups.filter((m) => m.status === 'upcoming' || m.status === 'ongoing'), [meetups]);
  const canRequestAds = useCanRequestAds();
  const rows = useMemo(() => (canRequestAds ? withAdSlots(active, MEETUPS_AD_EVERY) : active), [active, canRequestAds]);

  const join = (m: GroupMeetup) => {
    if (!dispatch(joinMeetup(m.id))) Alert.alert(tr('Немає місць'), tr('У цій зустрічі вже всі місця зайняті.'));
  };

  const calendar = async (m: GroupMeetup) => {
    try {
      if (!(await addMeetupToCalendar(m, lang))) Alert.alert(tr('Недоступно'), tr('Поділитися файлом на цьому пристрої неможливо.'));
    } catch {
      Alert.alert(tr('Помилка'), tr('Не вдалося створити файл календаря.'));
    }
  };

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(m) => (isAdSlot(m) ? `ad-${m.adSlot}` : m.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={<Button label={tr('Запланувати зустріч')} icon="calendar" onPress={() => setCreating(true)} />}
        ListEmptyComponent={<EmptyState emoji="🗓️" title={tr('Запланованих зустрічей немає')} subtitle={tr('Створи зустріч, вибери заклад і час та запроси друзів.')} />}
        renderItem={({ item: m }) => {
          if (isAdSlot(m)) return <InlineAd />;
          const me = m.participants.find((p) => p.userId === myId);
          const going = m.participants.filter((p) => p.status === 'going');
          const host = m.creatorId === myId;
          return (
            <Card style={{ gap: spacing.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[typography.heading, { flex: 1 }]} numberOfLines={2}>
                  {m.title}
                </Text>
                <Badge label={tr(STATUS_LABEL[m.status])} />
              </Row>
              <Text style={typography.small}>
                📍 {m.venueName}
                {m.venueAddress ? ` • ${m.venueAddress}` : ''}
              </Text>
              <Text style={typography.small}>
                🕒 {tr('{date} о {time}', { date: m.scheduledDate, time: m.scheduledTime })} • 🍺 {tr(m.drinkPreference ?? '')}
              </Text>
              {!!m.description && <Text style={typography.body}>{m.description}</Text>}
              <Row style={{ flexWrap: 'wrap' }}>
                {m.participants.slice(0, 8).map((p) => (
                  <Avatar key={p.userId} uri={p.userAvatar} name={p.userName} size={28} online={p.status === 'going'} />
                ))}
                <Text style={typography.tiny}>
                  {tr('Підтвердили: {going}/{max}', { going: going.length, max: m.maxParticipants })}
                </Text>
              </Row>
              <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {!host && (
                  <IconButton icon="flag" label={tr('Поскаржитись')} color={colors.textDim} onPress={() => onReport({ id: m.creatorId, name: m.creatorName, avatar: m.creatorAvatar, type: 'group_meetup', contextId: m.id })} />
                )}
                <IconButton icon="calendar" label={tr('Додати в календар')} onPress={() => calendar(m)} />
                {host && <IconButton icon="user-plus" label={tr('Запросити')} onPress={() => setInviting(m.id)} />}
                {host ? (
                  <Button label={tr('Скасувати')} small variant="danger" onPress={() => dispatch(cancelMeetup(m.id))} />
                ) : me?.status === 'going' ? (
                  <Button label={tr('Не піду')} small variant="secondary" onPress={() => dispatch(leaveMeetup(m.id))} />
                ) : (
                  <Button label={tr('Я піду')} small icon="check" onPress={() => join(m)} />
                )}
              </Row>
            </Card>
          );
        }}
      />
      {creating && <CreateMeetupSheet onClose={() => setCreating(false)} />}
      {inviting && <InviteSheet meetupId={inviting} onClose={() => setInviting(null)} />}
    </>
  );
};

/** Mounted only while open, so the form and "today" are fresh every time */
const CreateMeetupSheet = ({ onClose }: { onClose: () => void }) => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const buddies = useAppSelector(selectBuddies);
  const location = useAppSelector(selectLocation);
  const today = useMemo(() => new Date(), []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [date, setDate] = useState(() => formatDateInput(addDays(new Date(), 1)));
  const [time, setTime] = useState('19:00');
  const [drink, setDrink] = useState('');
  const [max, setMax] = useState('6');
  const [invited, setInvited] = useState<string[]>([]);

  const venues = useMemo(
    () =>
      [...GOOGLE_MAPS_VENUES]
        .map((v) => ({ v, d: Math.hypot(v.lat - location.lat, v.lng - location.lng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 10)
        .map(({ v }) => v),
    [location.lat, location.lng]
  );

  const iso = toIsoDateTime(date, time);
  const maxNum = Math.min(30, Math.max(2, parseInt(max, 10) || 6));
  const valid = title.trim() && venue.trim() && iso;

  const submit = () => {
    if (!iso) return;
    dispatch(
      createMeetup({
        title,
        description,
        venueName: venue,
        venueAddress: address,
        scheduledDate: date,
        scheduledTime: time,
        dateTimeIso: iso,
        drinkPreference: drink,
        maxParticipants: maxNum,
        lat: coords?.lat,
        lng: coords?.lng,
        invitedBuddies: buddies.filter((b) => invited.includes(b.id)),
      })
    );
    setTitle('');
    setDescription('');
    setInvited([]);
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={tr('Нова зустріч')} footer={<Button label={tr('Створити (+75 XP)')} icon="check" disabled={!valid} onPress={submit} />}>
      <Field label={tr('НАЗВА')} value={title} onChangeText={setTitle} placeholder={tr('Напр. Настілки у Squat 17b')} maxLength={60} />
      <Field label={tr('ОПИС')} value={description} onChangeText={setDescription} multiline maxLength={240} />
      <Text style={typography.label}>{tr('ЗАКЛАДИ ПОРУЧ')}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: spacing.sm }}>
        {venues.map((v) => (
          <Chip
            key={v.id}
            label={v.name}
            selected={venue === v.name}
            onPress={() => {
              setVenue(v.name);
              setAddress(`${v.district}, ${v.address}`);
              setCoords({ lat: v.lat, lng: v.lng });
            }}
          />
        ))}
      </Row>
      <Field label={tr('ЗАКЛАД')} value={venue} onChangeText={(t) => { setVenue(t); setCoords(null); }} />
      <Field label={tr('АДРЕСА')} value={address} onChangeText={setAddress} />
      <Text style={typography.label}>{tr('ДАТА')}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: spacing.sm }}>
        {[0, 1, 2, 7].map((offset) => {
          const d = formatDateInput(addDays(today, offset));
          return <Chip key={offset} label={offset === 0 ? tr('Сьогодні') : offset === 1 ? tr('Завтра') : offset === 2 ? tr('Післязавтра') : tr('Через тиждень')} selected={date === d} onPress={() => setDate(d)} />;
        })}
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <Field label={tr('ДАТА (ДД.ММ.РРРР)')} value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={tr('ЧАС (ГГ:ХХ)')} value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
        </View>
      </Row>
      {!iso && <Text style={{ color: colors.red, fontSize: 12, marginBottom: spacing.sm }}>{tr('Перевірте формат дати та часу')}</Text>}
      <Field label={tr('ЩО П’ЄМО')} value={drink} onChangeText={setDrink} placeholder={tr('Келих за смаком')} />
      <Field label={tr('МАКС. УЧАСНИКІВ (2–30)')} value={max} onChangeText={setMax} keyboardType="number-pad" />
      {buddies.length > 0 && (
        <>
          <SectionTitle>{tr('Запросити')}</SectionTitle>
          <PeoplePicker people={buddies} selected={invited} onChange={setInvited} />
        </>
      )}
    </Sheet>
  );
};

const InviteSheet = ({ meetupId, onClose }: { meetupId: string; onClose: () => void }) => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const buddies = useAppSelector(selectBuddies);
  const meetup = useAppSelector((s) => s.meetups.items.find((m) => m.id === meetupId));
  const [selected, setSelected] = useState<string[]>([]);

  const candidates = meetup ? buddies.filter((b) => !meetup.participants.some((p) => p.userId === b.id)) : [];

  return (
    <Sheet
      visible
      onClose={onClose}
      title={tr('Запросити людей')}
      footer={
        <Button
          label={tr('Запросити ({count})', { count: selected.length })}
          icon="send"
          disabled={selected.length === 0}
          onPress={() => {
            dispatch(inviteToMeetup(meetupId, buddies.filter((b) => selected.includes(b.id))));
            onClose();
          }}
        />
      }
    >
      {candidates.length === 0 ? <Text style={typography.small}>{tr('Немає нових людей для запрошення.')}</Text> : <PeoplePicker people={candidates} selected={selected} onChange={setSelected} />}
    </Sheet>
  );
};

const PeoplePicker = ({ people, selected, onChange }: { people: BuddyProfile[]; selected: string[]; onChange: (ids: string[]) => void }) => (
  <View style={{ gap: spacing.sm }}>
    {people.map((b) => {
      const on = selected.includes(b.id);
      return (
        <Pressable
          key={b.id}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: on }}
          onPress={() => onChange(on ? selected.filter((x) => x !== b.id) : [...selected, b.id])}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.sm,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: on ? colors.amber : colors.border,
            backgroundColor: on ? colors.amberBg : 'transparent',
          }}
        >
          <Avatar uri={b.avatar} name={b.name} size={34} />
          <Text style={[typography.body, { flex: 1 }]}>{b.name}</Text>
          {on && <Icon name="check" size={16} color={colors.amberSoft} />}
        </Pressable>
      );
    })}
  </View>
);
