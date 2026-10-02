import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../theme';
import { Avatar, Badge, Button, Card, Chip, Field, Icon, IconButton, Row, SectionTitle, Sheet } from '../components/ui';
import { OfflineBanner } from '../components/shell';
import { ReportSheet, ReportTarget } from '../components/ReportSheet';
import { SosSheet } from '../components/SosSheet';
import { useChatSync } from '../hooks/useChatSync';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { makeSelectChat, selectBuddies } from '../store/selectors';
import { chatOpened } from '../store/slices/uiSlice';
import { addGroupParticipants, deleteChat, respondToProposal, sendMessage } from '../store/thunks/social';
import { blockUser } from '../store/thunks/safety';
import { GOOGLE_MAPS_VENUES } from '../data/venuesData';
import { MAX_GROUP_MEMBERS } from '../logic/chats';
import { cryptoService } from '../services/cryptoService';
import { Message } from '../types';
import type { RootScreenProps } from '../navigation/types';
import { useTr } from '../hooks/useT';
import { usePushOptIn } from '../hooks/usePushOptIn';
import { ph } from '../services/i18nService';

const QUICK_TIMES = [ph('Сьогодні о 19:00'), ph('Сьогодні о 20:30'), ph('Завтра о 19:00'), ph('У п’ятницю о 20:00')];

export const ChatRoomScreen = ({ navigation, route }: RootScreenProps<'ChatRoom'>) => {
  const tr = useTr();
  const { chatId } = route.params;
  const dispatch = useAppDispatch();
  const selectChat = useMemo(() => makeSelectChat(chatId), [chatId]);
  const chat = useAppSelector(selectChat);
  const buddies = useAppSelector(selectBuddies);
  const myId = useAppSelector((s) => s.auth.user.id);

  useChatSync(chatId);
  usePushOptIn();

  // Tell the inbox which chat is on screen so its incoming messages do not raise an unread badge
  useEffect(() => {
    dispatch(chatOpened(chatId));
    return () => {
      dispatch(chatOpened(null));
    };
  }, [dispatch, chatId]);

  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState<null | 'menu' | 'proposal' | 'security' | 'group'>(null);
  const [showSos, setShowSos] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  // Newest first: the list is inverted so the conversation sticks to the bottom
  const data = useMemo(() => (chat ? [...chat.messages].reverse() : []), [chat]);

  if (!chat) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={typography.heading}>{tr('Чат не знайдено')}</Text>
          <Button label={tr('Назад')} variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const title = chat.isGroup ? `${chat.groupAvatar ?? '👥'} ${chat.groupName}` : chat.buddy.name;
  const subtitle = chat.isGroup
    ? `${tr('Учасників: {count}', { count: (chat.participants?.length ?? 0) + 1 })}${chat.groupTopic ? ` • ${chat.groupTopic}` : ''}`
    : chat.buddy.online
      ? tr('онлайн')
      : tr('офлайн');

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    dispatch(sendMessage({ chatId, text }));
    setDraft('');
  };

  const interlocutor = chat.isGroup ? undefined : { id: chat.buddy.id, name: chat.buddy.name };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <OfflineBanner />
      <View style={styles.header}>
        <IconButton icon="arrow-left" label={tr('Назад')} onPress={() => navigation.goBack()} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={chat.isGroup ? tr('Інформація про групу') : tr('Профіль {name}', { name: chat.buddy.name })}
          onPress={() => chat.isGroup && setSheet('group')}
          style={styles.headerTitle}
        >
          <Avatar uri={chat.isGroup ? undefined : chat.buddy.avatar} name={chat.isGroup ? chat.groupName : chat.buddy.name} size={38} online={chat.isGroup ? undefined : chat.buddy.online} />
          <View style={{ flex: 1 }}>
            <Text style={typography.heading} numberOfLines={1}>
              {title}
            </Text>
            <Text style={typography.tiny} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </Pressable>
        <IconButton icon="shield" label={tr('Шифрування')} onPress={() => setSheet('security')} />
        <IconButton icon="alert-triangle" label="SOS" color={colors.red} onPress={() => setShowSos(true)} />
        <IconButton icon="more-vertical" label={tr('Меню')} onPress={() => setSheet('menu')} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          inverted
          data={data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isGroup={!!chat.isGroup}
              myId={myId}
              onProposal={(status) => dispatch(respondToProposal(chatId, item.id, status))}
            />
          )}
          ListEmptyComponent={<Text style={[typography.small, { textAlign: 'center', transform: [{ scaleY: -1 }] }]}>{tr('Почніть розмову 🍻')}</Text>}
        />

        <View style={styles.composer}>
          <IconButton icon="zap" label={tr('Надіслати тост')} color={colors.amberSoft} onPress={() => navigation.navigate('Toasts', { chatId })} />
          <IconButton icon="map-pin" label={tr('Запропонувати місце')} onPress={() => setSheet('proposal')} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={tr('Повідомлення…')}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            multiline
            maxLength={1000}
            accessibilityLabel={tr('Повідомлення')}
          />
          <IconButton icon="send" label={tr('Надіслати')} color={draft.trim() ? colors.amber : colors.textDim} onPress={send} />
        </View>
      </KeyboardAvoidingView>

      <ProposalSheet
        visible={sheet === 'proposal'}
        defaultBar={chat.buddy.favoriteBars[0]}
        onClose={() => setSheet(null)}
        onSend={(barName, address, time) => {
          dispatch(
            sendMessage({
              chatId,
              text: tr('Запропонував зустріч у {barName}', { barName }),
              type: 'location_proposal',
              proposalData: { barName, address, time, status: 'pending' },
            })
          );
          setSheet(null);
        }}
      />

      <SecuritySheet visible={sheet === 'security'} chatId={chatId} lastCipher={[...chat.messages].reverse().find((m) => m.cipherPayload)?.cipherPayload} onClose={() => setSheet(null)} />

      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={tr('Дії з чатом')}>
        <View style={{ gap: spacing.sm }}>
          {interlocutor && (
            <>
              <Button
                label={tr('Поскаржитись')}
                icon="flag"
                variant="secondary"
                onPress={() => {
                  setSheet(null);
                  setReportTarget({ id: chat.buddy.id, name: chat.buddy.name, avatar: chat.buddy.avatar, type: 'chat' });
                }}
              />
              <Button
                label={tr('Заблокувати')}
                icon="slash"
                variant="danger"
                onPress={() => {
                  dispatch(blockUser(chat.buddy.id, chat.buddy.name, chat.buddy.avatar));
                  setSheet(null);
                  navigation.goBack();
                }}
              />
            </>
          )}
          <Button
            label={tr('Видалити чат')}
            icon="trash-2"
            variant="danger"
            onPress={() => {
              setSheet(null);
              Alert.alert(tr('Видалити чат?'), tr('Розмову буде прибрано з цього пристрою. Інші учасники її збережуть.'), [
                { text: tr('Скасувати'), style: 'cancel' },
                {
                  text: tr('Видалити'),
                  style: 'destructive',
                  onPress: () => {
                    dispatch(deleteChat(chatId));
                    navigation.goBack();
                  },
                },
              ]);
            }}
          />
        </View>
      </Sheet>

      <GroupSheet
        visible={sheet === 'group'}
        onClose={() => setSheet(null)}
        title={chat.groupName ?? tr('Група')}
        topic={chat.groupTopic}
        participants={chat.participants ?? []}
        room={Math.max(0, MAX_GROUP_MEMBERS - (chat.memberIds?.length ?? (chat.participants?.length ?? 0) + 1))}
        // Only the creator may change membership (firestore.rules enforce it as well)
        candidates={chat.createdBy === myId ? buddies.filter((b) => !(chat.participants ?? []).some((p) => p.id === b.id)) : []}
        onAdd={(ids) =>
          dispatch(
            addGroupParticipants(
              chatId,
              buddies.filter((b) => ids.includes(b.id)).map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, online: b.online, role: 'member' as const }))
            )
          )
        }
      />

      <SosSheet visible={showSos} onClose={() => setShowSos(false)} interlocutor={interlocutor} />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </SafeAreaView>
  );
};

const MessageBubble = React.memo(
  ({
    message,
    isGroup,
    myId,
    onProposal,
  }: {
    message: Message;
    isGroup: boolean;
    myId: string;
    onProposal: (status: 'accepted' | 'declined') => void;
  }) => {
  const tr = useTr();
    const mine = message.isMe || message.senderId === myId;
    const system = message.senderId === 'system';

    if (system) {
      return (
        <View style={{ alignItems: 'center' }}>
          <Text style={[typography.tiny, styles.system]}>{message.text}</Text>
        </View>
      );
    }

    const meta = (
      <Text style={[styles.time, mine && { textAlign: 'right' }]}>
        {tr(message.timestamp)}
        {message.hasPendingWrites ? ` • ${tr('надсилається')}` : ''}
      </Text>
    );

    if (message.type === 'location_proposal' && message.proposalData) {
      const p = message.proposalData;
      return (
        <View style={[styles.bubbleWrap, mine && { alignItems: 'flex-end' }]}>
          <Card style={{ gap: spacing.sm, maxWidth: '85%' }}>
            <Text style={typography.label}>{tr('ПРОПОЗИЦІЯ ЗУСТРІЧІ')}</Text>
            <Text style={typography.heading}>{p.barName}</Text>
            <Text style={typography.small}>
              📍 {p.address} • 🕒 {p.time}
            </Text>
            {p.status === 'pending' && !mine ? (
              <Row>
                <Button label={tr('Прийняти')} small icon="check" onPress={() => onProposal('accepted')} style={{ flex: 1 }} />
                <Button label={tr('Відхилити')} small variant="secondary" onPress={() => onProposal('declined')} style={{ flex: 1 }} />
              </Row>
            ) : (
              <Badge
                label={p.status === 'accepted' ? tr('✅ Прийнято') : p.status === 'declined' ? tr('❌ Відхилено') : tr('⏳ Очікує відповіді')}
                color={p.status === 'accepted' ? colors.green : p.status === 'declined' ? colors.red : colors.amberSoft}
                bg={p.status === 'accepted' ? colors.greenBg : p.status === 'declined' ? colors.redBg : colors.amberBg}
              />
            )}
          </Card>
          {meta}
        </View>
      );
    }

    const isCheers = message.type === 'cheers';
    const isAudio = message.type === 'audio' || !!message.audioUrl;

    return (
      <View style={[styles.bubbleWrap, mine && { alignItems: 'flex-end' }]}>
        {isGroup && !mine && (
          <Text style={[typography.tiny, { marginLeft: 4 }]}>{message.senderName}</Text>
        )}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, isCheers && styles.bubbleCheers]}>
          {isAudio ? (
            <Row>
              <Icon name="mic" size={16} color={mine ? colors.onAmber : colors.textMuted} />
              <Text style={[typography.small, mine && { color: colors.onAmber }]}>{tr('Голосове повідомлення (відтворення з’явиться згодом)')}</Text>
            </Row>
          ) : (
            <Text style={[typography.body, mine && { color: colors.onAmber }]}>{message.text}</Text>
          )}
        </View>
        {meta}
      </View>
    );
  }
);

const ProposalSheet = ({
  visible,
  defaultBar,
  onClose,
  onSend,
}: {
  visible: boolean;
  defaultBar?: string;
  onClose: () => void;
  onSend: (barName: string, address: string, time: string) => void;
}) => {
  const tr = useTr();
  const [bar, setBar] = useState(defaultBar ?? '');
  const [address, setAddress] = useState('');
  const [time, setTime] = useState(() => tr(QUICK_TIMES[1]));
  const kyiv = useMemo(() => GOOGLE_MAPS_VENUES.filter((v) => v.cityId === 'kyiv').slice(0, 12), []);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={tr('Запропонувати місце')}
      footer={<Button label={tr('Надіслати пропозицію')} icon="send" disabled={!bar.trim()} onPress={() => onSend(bar.trim(), address.trim() || tr('Київ'), time.trim())} />}
    >
      <Text style={typography.label}>{tr('ПОПУЛЯРНІ ЗАКЛАДИ')}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: spacing.sm }}>
        {kyiv.map((v) => (
          <Chip
            key={v.id}
            label={v.name}
            selected={bar === v.name}
            onPress={() => {
              setBar(v.name);
              setAddress(`${v.district}, ${v.address}`);
            }}
          />
        ))}
      </Row>
      <Field label={tr('ЗАКЛАД')} value={bar} onChangeText={setBar} placeholder={tr('Назва бару')} />
      <Field label={tr('АДРЕСА')} value={address} onChangeText={setAddress} placeholder={tr('Вулиця, район')} />
      <Text style={typography.label}>{tr('КОЛИ')}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: spacing.sm }}>
        {QUICK_TIMES.map((t) => (
          <Chip key={t} label={tr(t)} selected={time === tr(t)} onPress={() => setTime(tr(t))} />
        ))}
      </Row>
      <Field label={tr('АБО СВІЙ ЧАС')} value={time} onChangeText={setTime} />
    </Sheet>
  );
};

const SecuritySheet = ({ visible, chatId, lastCipher, onClose }: { visible: boolean; chatId: string; lastCipher?: string; onClose: () => void }) => {
  const tr = useTr();
  const info = cryptoService.getRoomFingerprint(chatId);
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('🔒 Шифрування чату')}>
      <Card style={{ gap: spacing.sm }}>
        <Text style={typography.small}>{tr('Алгоритм: {algorithm} • {keyLength}', { algorithm: info.algorithm, keyLength: info.keyLength })}</Text>
        <Text style={typography.small}>{tr('Протокол: {protocol}', { protocol: info.protocol })}</Text>
        <Text style={[typography.body, { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }]}>{tr('Відбиток: {fingerprint}', { fingerprint: info.fingerprint })}</Text>
      </Card>
      <SectionTitle>{tr('Останнє повідомлення у хмарі')}</SectionTitle>
      <Card>
        <Text selectable style={[typography.tiny, { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }]}>
          {lastCipher ?? tr('Щойно надіслані повідомлення з’являться тут у зашифрованому вигляді.')}
        </Text>
      </Card>
      <Text style={[typography.tiny, { marginTop: spacing.md, lineHeight: 15 }]}>
        {tr('Повідомлення шифруються на пристрої перед збереженням у Firestore. Ключ кімнати виводиться з її ідентифікатора, тому це захист даних у сховищі, а не наскрізне шифрування між користувачами.')}
      </Text>
    </Sheet>
  );
};

const GroupSheet = ({
  visible,
  onClose,
  title,
  topic,
  participants,
  candidates,
  room,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  topic?: string;
  participants: { id: string; name: string; avatar: string; role?: string }[];
  candidates: { id: string; name: string; avatar: string }[];
  /** How many more people the group can take (groups hold at most MAX_GROUP_MEMBERS) */
  room: number;
  onAdd: (ids: string[]) => void;
}) => {
  const tr = useTr();
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        selected.length > 0 ? (
          <Button
            label={tr('Додати ({count})', { count: selected.length })}
            icon="user-plus"
            onPress={() => {
              onAdd(selected);
              setSelected([]);
            }}
          />
        ) : undefined
      }
    >
      {!!topic && <Text style={typography.small}>{tr('Тема: {topic}', { topic })}</Text>}
      <SectionTitle>{tr('Учасники ({count})', { count: participants.length + 1 })}</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        {participants.map((p) => (
          <Row key={p.id}>
            <Avatar uri={p.avatar} name={p.name} size={36} />
            <Text style={[typography.body, { flex: 1 }]}>{p.name}</Text>
            {p.role === 'admin' && <Badge label={tr('адмін')} />}
          </Row>
        ))}
      </View>
      {candidates.length > 0 && (
        <>
          <SectionTitle>{tr('Додати людей')}</SectionTitle>
          <View style={{ gap: spacing.sm }}>
            {candidates.map((c) => {
              const on = selected.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => setSelected((s) => (on ? s.filter((x) => x !== c.id) : s.length < room ? [...s, c.id] : s))}
                  style={[styles.pick, on && { borderColor: colors.amber, backgroundColor: colors.amberBg }]}
                >
                  <Avatar uri={c.avatar} name={c.name} size={32} />
                  <Text style={[typography.body, { flex: 1 }]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bubbleWrap: { gap: 2, alignItems: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.amber, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surfaceHigh, borderBottomLeftRadius: 4 },
  bubbleCheers: { borderWidth: 1, borderColor: colors.amberSoft },
  time: { fontSize: 10, color: colors.textDim, marginHorizontal: 4 },
  system: { backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
  },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
