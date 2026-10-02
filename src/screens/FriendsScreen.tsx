import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme';
import { Avatar, Badge, Button, Card, EmptyState, Icon, IconButton, Row } from '../components/ui';
import { OfflineBanner, ScreenHeader } from '../components/shell';
import { BuddySheet } from '../components/BuddyViews';
import { ReportSheet, ReportTarget } from '../components/ReportSheet';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectFriends } from '../store/selectors';
import { removeFriend } from '../store/thunks/social';
import { BuddyProfile } from '../types';
import { formatDistance } from '../services/geoService';
import { useBuddyActions } from '../hooks/useBuddyActions';
import { useTr } from '../hooks/useT';

export const FriendsScreen = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const friends = useAppSelector(selectFriends);
  const [query, setQuery] = useState('');
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const onReport = useCallback(
    (b: BuddyProfile) => setReportTarget({ id: b.id, name: b.name, avatar: b.avatar, type: 'profile' }),
    []
  );
  const onDetails = useCallback((b: BuddyProfile) => setDetailsId(b.id), []);
  const actions = useBuddyActions({ onReport, onDetails });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? friends.filter((f) => `${f.name} ${f.tagline} ${f.locationName}`.toLowerCase().includes(q)) : friends;
  }, [friends, query]);

  const confirmRemove = (f: BuddyProfile) =>
    Alert.alert(tr('Прибрати з друзів?'), tr('{name} більше не буде у вашому списку друзів.', { name: f.name }), [
      { text: tr('Скасувати'), style: 'cancel' },
      { text: tr('Прибрати'), style: 'destructive', onPress: () => dispatch(removeFriend(f.id)) },
    ]);

  const details = detailsId ? friends.find((f) => f.id === detailsId) ?? null : null;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <OfflineBanner />
      <ScreenHeader title={tr('Друзі')} subtitle={tr('{count} у списку', { count: friends.length })} />

      {friends.length > 0 && (
        <View style={styles.search}>
          <Icon name="search" size={16} color={colors.textDim} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tr('Пошук серед друзів')}
            placeholderTextColor={colors.textDim}
            style={styles.searchInput}
            accessibilityLabel={tr('Пошук серед друзів')}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={
          <EmptyState
            emoji="🤝"
            title={friends.length === 0 ? tr('Друзів поки немає') : tr('Нікого не знайдено')}
            subtitle={friends.length === 0 ? tr('Додавай людей у друзі на вкладці «Пошук» і отримуй +50 XP.') : undefined}
            action={
              friends.length === 0 ? <Button label={tr('Знайти компанію')} small onPress={() => navigation.navigate('Tabs', { screen: 'Discover' })} /> : undefined
            }
          />
        }
        renderItem={({ item }) => (
          <Card>
            <Row style={{ gap: spacing.md }}>
              <Avatar uri={item.avatar} name={item.name} size={52} online={item.online} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={typography.heading} numberOfLines={1} onPress={() => onDetails(item)}>
                  {item.name}
                </Text>
                <Text style={typography.small} numberOfLines={1}>
                  📍 {item.locationName} • {formatDistance(item.distanceKm)}
                </Text>
                {item.activeCheckIn ? (
                  <Badge label={tr('🟢 у {barName}', { barName: item.activeCheckIn.barName })} color={colors.green} bg={colors.greenBg} />
                ) : (
                  <Text style={typography.tiny}>{item.online ? tr('Онлайн') : tr('Офлайн')}</Text>
                )}
              </View>
              <IconButton icon="message-circle" label={tr('Написати {name}', { name: item.name })} onPress={() => actions.onOpenChat(item)} />
              <IconButton icon="user-x" label={tr('Прибрати {name}', { name: item.name })} color={colors.textDim} onPress={() => confirmRemove(item)} />
            </Row>
          </Card>
        )}
      />

      <BuddySheet buddy={details} actions={actions} onClose={() => setDetailsId(null)} />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14 },
});
