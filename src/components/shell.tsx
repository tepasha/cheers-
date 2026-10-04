import React, { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme';
import { Avatar, Button, Icon, IconButton, Sheet } from './ui';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectActiveBanner, selectIsOnline, selectUnreadNotificationsCount } from '../store/selectors';
import { notificationRead } from '../store/slices/notificationsSlice';
import { dismissBanner } from '../store/thunks/notifications';
import { navigateFromNotification } from '../navigation/ref';
import { acknowledgeEndedTable, renewHangout } from '../store/thunks/lifecycle';
import { useTr } from '../hooks/useT';

export const OfflineBanner = () => {
  const tr = useTr();
  const isOnline = useAppSelector(selectIsOnline);
  if (isOnline) return null;
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <Icon name="wifi-off" size={14} color={colors.amberSoft} />
      <Text style={styles.offlineText}>{tr('Зв’язок втрачено • дані збережено локально')}</Text>
    </View>
  );
};

/** Top bar for tab screens: title, optional subtitle and the notification bell */
export const ScreenHeader = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) => {
  const tr = useTr();
  const navigation = useNavigation();
  const unread = useAppSelector(selectUnreadNotificationsCount);
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={typography.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={typography.small} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      <IconButton icon="bell" label={tr('Сповіщення')} badge={unread} onPress={() => navigation.navigate('Notifications')} />
    </View>
  );
};

/** Heads-up banner for a freshly received notification; auto-dismissed by the thunk after 6s */
export const PushBanner = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const active = useAppSelector(selectActiveBanner);
  const insets = useSafeAreaInsets();

  // The banner stays mounted while it slides out, so what is shown lags `active` by one animation
  const [banner, setBanner] = useState(active);
  const [progress] = useState(() => new Animated.Value(0));
  if (active && active !== banner) setBanner(active); // adopting a new banner while rendering is the supported pattern
  useEffect(() => {
    Animated.timing(progress, { toValue: active ? 1 : 0, duration: active ? 200 : 160, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
      if (finished && !active) setBanner(null);
    });
  }, [active, progress]);

  if (!banner) return null;

  const open = () => {
    dispatch(notificationRead(banner.id));
    dispatch(dismissBanner());
    navigateFromNotification(banner);
  };

  return (
    <Animated.View
      style={[
        styles.banner,
        { top: insets.top + spacing.sm, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] },
      ]}
      pointerEvents="box-none"
    >
      <Pressable accessibilityRole="button" accessibilityLabel={banner.title} onPress={open} style={styles.bannerInner}>
        <Avatar uri={banner.avatar} name={banner.buddyName || banner.title} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={styles.bannerBody} numberOfLines={2}>
            {banner.body}
          </Text>
        </View>
        <IconButton icon="x" label={tr('Закрити')} onPress={() => dispatch(dismissBanner())} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: colors.amberBg,
  },
  offlineText: { color: colors.amberSoft, fontSize: 11, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  banner: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 100 },
  bannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.amber,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  bannerTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
  bannerBody: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});

/**
 * "This meetup has ended": shown when a table the user hosted or joined runs out of its 4 hours.
 * The host can bring it back; guests just acknowledge.
 */
export const EndedTableModal = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const table = useAppSelector((s) => s.ui.endedTables[0] ?? null);
  const myId = useAppSelector((s) => s.auth.user.id);
  const [renewing, setRenewing] = useState(false);
  const isHost = !!table && table.userId === myId;

  return (
    <Sheet visible={!!table} onClose={() => table && dispatch(acknowledgeEndedTable(table.id))} title={tr('Ця зустріч закінчилась')}>
      {table && (
        <View style={{ gap: spacing.md }}>
          <Text style={typography.body}>{tr('Столик у «{barName}» завершився: столики живуть 4 години.', { barName: table.barName })}</Text>
          {isHost && <Text style={typography.small}>{tr('Ви можете відновити столик ще на 4 години.')}</Text>}
          {isHost && (
            <Button
              label={tr('Відновити столик')}
              icon="rotate-ccw"
              loading={renewing}
              onPress={async () => {
                setRenewing(true);
                const ok = await dispatch(renewHangout(table));
                setRenewing(false);
                if (!ok) dispatch(acknowledgeEndedTable(table.id));
              }}
            />
          )}
          <Button label={isHost ? tr('Закрити') : tr('Зрозуміло')} variant="secondary" onPress={() => dispatch(acknowledgeEndedTable(table.id))} />
        </View>
      )}
    </Sheet>
  );
};
