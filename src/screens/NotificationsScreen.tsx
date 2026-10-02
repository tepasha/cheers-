import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme';
import { Avatar, Button, EmptyState, Row } from '../components/ui';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectNotifications } from '../store/selectors';
import { allNotificationsRead, notificationRead, notificationsCleared } from '../store/slices/notificationsSlice';
import { navigateFromNotification } from '../navigation/ref';
import { PushNotificationType } from '../types';
import type { RootScreenProps } from '../navigation/types';
import { useTr } from '../hooks/useT';

const TYPE_EMOJI: Record<PushNotificationType, string> = {
  table_seat: '🍻',
  chat_message: '💬',
  cheers_toast: '🥂',
  hangout_alert: '📣',
  friend_added: '🤝',
  meetup_invite: '🗓️',
  meetup_joined: '✅',
  safety_alert: '🚨',
  system: '🔔',
};

export const NotificationsScreen = ({ navigation }: RootScreenProps<'Notifications'>) => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectNotifications);
  const hasUnread = items.some((n) => !n.isRead);

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      {items.length > 0 && (
        <Row style={styles.toolbar}>
          <Button label={tr('Прочитати все')} small variant="secondary" icon="check-circle" disabled={!hasUnread} onPress={() => dispatch(allNotificationsRead())} style={{ flex: 1 }} />
          <Button label={tr('Очистити')} small variant="danger" icon="trash-2" onPress={() => dispatch(notificationsCleared())} style={{ flex: 1 }} />
        </Row>
      )}
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={<EmptyState emoji="🔔" title={tr('Сповіщень поки немає')} subtitle={tr('Тут з’являться нові повідомлення, гості за столиком та запрошення.')} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => {
              dispatch(notificationRead(item.id));
              if (item.chatId || item.hangoutId || item.venueName || item.buddyId) {
                navigation.goBack();
                navigateFromNotification(item);
              }
            }}
            style={({ pressed }) => [styles.row, !item.isRead && styles.unread, pressed && { opacity: 0.8 }]}
          >
            {item.avatar ? <Avatar uri={item.avatar} name={item.buddyName} size={44} /> : <Text style={{ fontSize: 30, width: 44, textAlign: 'center' }}>{TYPE_EMOJI[item.type]}</Text>}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.body, { fontWeight: item.isRead ? '500' : '700' }]}>{item.title}</Text>
              <Text style={typography.small}>{item.body}</Text>
              {!!item.subtitle && <Text style={typography.tiny}>{item.subtitle}</Text>}
              {!!item.actionText && <Text style={[typography.tiny, { color: colors.amberSoft }]}>{item.actionText} →</Text>}
            </View>
            <Text style={typography.tiny}>{tr(item.timestamp)}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  toolbar: { padding: spacing.lg, paddingBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  unread: { backgroundColor: colors.amberBg },
});
