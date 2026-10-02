import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Badge, Button, Card, Icon, IconButton, Row, Sheet } from './ui';
import { colors, radius, spacing, typography } from '../theme';
import { BuddyProfile } from '../types';
import { DRINK_METADATA, MOOD_METADATA, PAYMENT_METADATA } from '../data/mockData';
import { formatDistance } from '../services/geoService';
import { useTr } from '../hooks/useT';

export interface BuddyActions {
  onOpenChat: (buddy: BuddyProfile) => void;
  onToggleFriend: (buddy: BuddyProfile) => void;
  onToast: (buddy: BuddyProfile) => void;
  onReport: (buddy: BuddyProfile) => void;
  onDetails: (buddy: BuddyProfile) => void;
}

const DrinkBadges = ({ buddy, max = 3 }: { buddy: BuddyProfile; max?: number }) => {
  const tr = useTr();
  return (
  <Row style={{ flexWrap: 'wrap', gap: 6 }}>
    {buddy.preferredDrinks.slice(0, max).map((d) => {
      const meta = DRINK_METADATA[d];
      return meta ? <Badge key={d} label={`${meta.icon} ${tr(meta.label)}`} color={meta.color} bg={colors.surfaceHigh} /> : null;
    })}
  </Row>
  );
};

/** Full-width card used by the feed and deck views */
export const BuddyCard = React.memo(({ buddy, actions }: { buddy: BuddyProfile; actions: BuddyActions }) => {
  const tr = useTr();
  return (
  <Card style={{ gap: spacing.md }}>
    <Pressable accessibilityRole="button" accessibilityLabel={tr('Профіль {name}', { name: buddy.name })} onPress={() => actions.onDetails(buddy)}>
      <Row style={{ gap: spacing.md }}>
        <Avatar uri={buddy.avatar} name={buddy.name} size={60} online={buddy.online} />
        <View style={{ flex: 1, gap: 2 }}>
          <Row>
            <Text style={typography.heading} numberOfLines={1}>
              {buddy.name}, {buddy.age}
            </Text>
            {buddy.isFriend && <Icon name="user-check" size={14} color={colors.green} />}
          </Row>
          <Text style={typography.small} numberOfLines={1}>
            📍 {buddy.locationName} • {formatDistance(buddy.distanceKm)}
          </Text>
          <Text style={[typography.small, { color: colors.amberSoft }]} numberOfLines={1}>
            {MOOD_METADATA[buddy.currentMood]?.emoji} {tr(MOOD_METADATA[buddy.currentMood]?.label ?? '')}
          </Text>
        </View>
      </Row>
    </Pressable>

    {buddy.tagline ? <Text style={[typography.body, { fontStyle: 'italic' }]}>«{buddy.tagline}»</Text> : null}
    {buddy.activeCheckIn && (
      <View style={styles.checkIn}>
        <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700' }}>{tr('🟢 Зараз у {bar}', { bar: buddy.activeCheckIn.barName })}</Text>
        {!!buddy.activeCheckIn.note && <Text style={typography.small}>{buddy.activeCheckIn.note}</Text>}
      </View>
    )}

    <DrinkBadges buddy={buddy} />
    <Text style={typography.tiny}>{tr(PAYMENT_METADATA[buddy.paymentRule]?.badge ?? '')}</Text>

    <Row style={{ justifyContent: 'space-between' }}>
      <Button label={tr('Будьмо!')} icon="zap" small onPress={() => actions.onToast(buddy)} style={{ flex: 1 }} />
      <Button label={tr('Написати')} icon="message-circle" small variant="secondary" onPress={() => actions.onOpenChat(buddy)} style={{ flex: 1 }} />
      <IconButton
        icon={buddy.isFriend ? 'user-check' : 'user-plus'}
        label={buddy.isFriend ? tr('Прибрати з друзів') : tr('Додати в друзі')}
        color={buddy.isFriend ? colors.green : colors.text}
        onPress={() => actions.onToggleFriend(buddy)}
      />
      <IconButton icon="flag" label={tr('Поскаржитись')} color={colors.textDim} onPress={() => actions.onReport(buddy)} />
    </Row>
  </Card>
);
});

/** Compact tile for the 2-column grid view */
export const BuddyTile = React.memo(({ buddy, actions }: { buddy: BuddyProfile; actions: BuddyActions }) => {
  const tr = useTr();
  return (
  <Pressable accessibilityRole="button" accessibilityLabel={tr('Профіль {name}', { name: buddy.name })} onPress={() => actions.onDetails(buddy)} style={styles.tile}>
    <Avatar uri={buddy.avatar} name={buddy.name} size={64} online={buddy.online} />
    <Text style={typography.heading} numberOfLines={1}>
      {buddy.name}, {buddy.age}
    </Text>
    <Text style={typography.tiny} numberOfLines={1}>
      {formatDistance(buddy.distanceKm)} • {buddy.locationName}
    </Text>
    <Button label={tr('Будьмо!')} small onPress={() => actions.onToast(buddy)} style={{ alignSelf: 'stretch' }} />
  </Pressable>
);
});

/** Full profile details: bio, drinks, topics, favorite bars */
export const BuddySheet = ({ buddy, actions, onClose }: { buddy: BuddyProfile | null; actions: BuddyActions; onClose: () => void }) => {
  const tr = useTr();
  return (
  <Sheet visible={!!buddy} onClose={onClose} title={buddy?.name ?? ''}>
    {buddy && (
      <View style={{ gap: spacing.md }}>
        <Row style={{ gap: spacing.md }}>
          <Avatar uri={buddy.avatar} name={buddy.name} size={72} online={buddy.online} />
          <View style={{ flex: 1 }}>
            <Text style={typography.heading}>
              {buddy.name}, {buddy.age}
            </Text>
            <Text style={typography.small}>📍 {buddy.locationName}</Text>
            {buddy.levelTitle && <Badge label={tr('Рівень {level} • {levelTitle}', { level: buddy.level ?? 1, levelTitle: buddy.levelTitle })} />}
          </View>
        </Row>
        {!!buddy.tagline && <Text style={typography.body}>«{buddy.tagline}»</Text>}
        {!!buddy.bio && <Text style={typography.small}>{buddy.bio}</Text>}
        <DrinkBadges buddy={buddy} max={8} />
        {buddy.talkTopics.length > 0 && <Text style={typography.small}>💬 {buddy.talkTopics.join(' • ')}</Text>}
        {buddy.favoriteBars.length > 0 && <Text style={typography.small}>🍻 {buddy.favoriteBars.join(', ')}</Text>}
        <Text style={typography.small}>{tr(PAYMENT_METADATA[buddy.paymentRule]?.label ?? '')}</Text>
        <Row>
          <Button
            label={tr('Написати')}
            icon="message-circle"
            onPress={() => {
              onClose();
              actions.onOpenChat(buddy);
            }}
            style={{ flex: 1 }}
          />
          <Button
            label={buddy.isFriend ? tr('У друзях') : tr('В друзі')}
            icon={buddy.isFriend ? 'user-check' : 'user-plus'}
            variant="secondary"
            onPress={() => actions.onToggleFriend(buddy)}
            style={{ flex: 1 }}
          />
        </Row>
      </View>
    )}
  </Sheet>
);
};

const styles = StyleSheet.create({
  checkIn: { backgroundColor: colors.greenBg, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
