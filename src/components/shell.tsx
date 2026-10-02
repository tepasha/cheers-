import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme';
import { Avatar, Icon, IconButton } from './ui';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectActiveBanner, selectIsOnline, selectUnreadNotificationsCount } from '../store/selectors';
import { notificationRead } from '../store/slices/notificationsSlice';
import { dismissBanner } from '../store/thunks/notifications';
import { navigateFromNotification } from '../navigation/ref';
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
  const banner = useAppSelector(selectActiveBanner);
  const insets = useSafeAreaInsets();
  if (!banner) return null;

  const open = () => {
    dispatch(notificationRead(banner.id));
    dispatch(dismissBanner());
    navigateFromNotification(banner);
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(160)}
      style={[styles.banner, { top: insets.top + spacing.sm }]}
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
