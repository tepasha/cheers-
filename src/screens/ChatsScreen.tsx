import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme';
import { Avatar, Button, Chip, EmptyState, Field, IconButton, Row, SectionTitle, Sheet } from '../components/ui';
import { OfflineBanner, ScreenHeader } from '../components/shell';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectBuddies, selectVisibleChatThreads } from '../store/selectors';
import { MAX_GROUP_MEMBERS } from '../logic/chats';
import { createGroupChat, deleteChat } from '../store/thunks/social';
import { ChatParticipant, ChatThread } from '../types';
import { useTr } from '../hooks/useT';

const GROUP_EMOJIS = ['🍻', '🍺', '🥂', '🍷', '🎲', '💻', '🎷', '⚽'];

export const ChatsScreen = () => {
  const tr = useTr();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const buddies = useAppSelector(selectBuddies);
  const [creating, setCreating] = useState(false);

  const visibleThreads = useAppSelector(selectVisibleChatThreads);

  const confirmDelete = (t: ChatThread) =>
    Alert.alert(tr('Видалити чат?'), tr('Розмову «{name}» буде прибрано з цього пристрою. Інші учасники її збережуть.', { name: (t.isGroup ? t.groupName : t.buddy.name) ?? '' }), [
      { text: tr('Скасувати'), style: 'cancel' },
      { text: tr('Видалити'), style: 'destructive', onPress: () => dispatch(deleteChat(t.id)) },
    ]);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <OfflineBanner />
      <ScreenHeader title={tr('Чати')} right={<IconButton icon="users" label={tr('Створити груповий чат')} onPress={() => setCreating(true)} />} />
      <FlatList
        data={visibleThreads}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={
          <EmptyState
            emoji="💬"
            title={tr('Розмов поки немає')}
            subtitle={tr('Піднімай келихи з кимось на вкладці «Пошук» або створи груповий чат.')}
            action={<Button label={tr('Груповий чат')} small variant="secondary" icon="users" onPress={() => setCreating(true)} />}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('Чат {name}', { name: (item.isGroup ? item.groupName : item.buddy.name) ?? '' })}
            onPress={() => navigation.navigate('ChatRoom', { chatId: item.id })}
            onLongPress={() => confirmDelete(item)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
          >
            <Avatar
              uri={item.isGroup ? undefined : item.buddy.avatar}
              name={item.isGroup ? item.groupAvatar || item.groupName : item.buddy.name}
              size={52}
              online={item.isGroup ? undefined : item.buddy.online}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[typography.heading, { flex: 1 }]} numberOfLines={1}>
                  {item.isGroup ? `${item.groupAvatar ?? '👥'} ${item.groupName}` : item.buddy.name}
                </Text>
                <Text style={typography.tiny}>{item.lastMessageTime}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[typography.small, { flex: 1 }]} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
                {item.unreadCount > 0 && (
                  <View style={styles.unread}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                )}
              </Row>
            </View>
          </Pressable>
        )}
      />

      <CreateGroupSheet
        visible={creating}
        candidates={buddies.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, online: b.online }))}
        onClose={() => setCreating(false)}
        onCreate={(data) => {
          const thread = dispatch(createGroupChat(data));
          setCreating(false);
          navigation.navigate('ChatRoom', { chatId: thread.id });
        }}
      />
    </SafeAreaView>
  );
};

const CreateGroupSheet = ({
  visible,
  candidates,
  onClose,
  onCreate,
}: {
  visible: boolean;
  candidates: ChatParticipant[];
  onClose: () => void;
  onCreate: (data: { name: string; topic: string; avatar: string; participants: ChatParticipant[] }) => void;
}) => {
  const tr = useTr();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [avatar, setAvatar] = useState(GROUP_EMOJIS[0]);
  const [selected, setSelected] = useState<string[]>([]);

  const reset = () => {
    setName('');
    setTopic('');
    setAvatar(GROUP_EMOJIS[0]);
    setSelected([]);
  };
  const canCreate = name.trim().length > 0;

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title={tr('Новий груповий чат')}
      footer={
        <Button
          label={tr('Створити')}
          icon="check"
          disabled={!canCreate}
          onPress={() => {
            onCreate({
              name: name.trim(),
              topic: topic.trim() || tr('Посиденьки'),
              avatar,
              participants: candidates.filter((c) => selected.includes(c.id)).map((c) => ({ ...c, role: 'member' as const })),
            });
            reset();
          }}
        />
      }
    >
      <Field label={tr('НАЗВА')} value={name} onChangeText={setName} placeholder={tr('Напр. П’ятниця на Подолі')} maxLength={40} />
      <Field label={tr('ТЕМА')} value={topic} onChangeText={setTopic} placeholder={tr('Про що говоримо')} maxLength={60} />
      <Text style={typography.label}>{tr('ІКОНКА')}</Text>
      <Row style={{ flexWrap: 'wrap', marginTop: 6 }}>
        {GROUP_EMOJIS.map((e) => (
          <Chip key={e} label={e} selected={avatar === e} onPress={() => setAvatar(e)} />
        ))}
      </Row>
      <SectionTitle>{tr('Учасники')}</SectionTitle>
      <Text style={[typography.tiny, { marginBottom: spacing.sm }]}>{tr('Максимум учасників у групі: {count}', { count: MAX_GROUP_MEMBERS })}</Text>
      {candidates.length === 0 ? (
        <Text style={typography.small}>{tr('Поки нікого запросити — людей можна буде додати пізніше.')}</Text>
      ) : (
        candidates.map((c) => {
          const on = selected.includes(c.id);
          return (
            <Pressable
              key={c.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => setSelected((s) => (on ? s.filter((x) => x !== c.id) : s.length < MAX_GROUP_MEMBERS - 1 ? [...s, c.id] : s))}
              style={[styles.pick, on && { borderColor: colors.amber, backgroundColor: colors.amberBg }]}
            >
              <Avatar uri={c.avatar} name={c.name} size={36} />
              <Text style={[typography.body, { flex: 1 }]}>{c.name}</Text>
            </Pressable>
          );
        })
      )}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: colors.onAmber, fontSize: 11, fontWeight: '800' },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
