import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme';
import { Avatar, Badge, Button, EmptyState, Icon, IconButton, Row, SegmentedControl, Sheet } from '../components/ui';
import { OfflineBanner, ScreenHeader } from '../components/shell';
import { BuddyCard, BuddySheet, BuddyTile } from '../components/BuddyViews';
import { FilterSheet } from '../components/FilterSheet';
import { ReportSheet, ReportTarget } from '../components/ReportSheet';
import { useAppSelector } from '../store/hooks';
import { selectBuddies } from '../store/selectors';
import { BuddyProfile, FilterSettings } from '../types';
import { countActiveFilters, DEFAULT_FILTERS, filterBuddies } from '../logic/buddyFilters';
import { useBuddyActions } from '../hooks/useBuddyActions';
import { analyticsService } from '../services/analyticsService';
import { useTr } from '../hooks/useT';

type ViewMode = 'feed' | 'grid' | 'deck';

export const DiscoverScreen = () => {
  const tr = useTr();
  const navigation = useNavigation();
  const buddies = useAppSelector(selectBuddies);
  const locationName = useAppSelector((s) => s.location.current.locationName);

  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [deckIndex, setDeckIndex] = useState(0);
  // A new filter set restarts the deck from the first card
  const updateFilters = useCallback((next: FilterSettings) => {
    setFilters(next);
    setDeckIndex(0);
  }, []);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [matched, setMatched] = useState<{ buddy: BuddyProfile; chatId: string } | null>(null);

  const visible = useMemo(() => filterBuddies(buddies, filters), [buddies, filters]);
  const activeCount = countActiveFilters(filters);
  const details = detailsId ? buddies.find((b) => b.id === detailsId) ?? null : null;

  useEffect(() => {
    const q = filters.searchQuery?.trim();
    if (!q) return;
    const timer = setTimeout(() => analyticsService.trackSearch(q, visible.length, 'buddies'), 800);
    return () => clearTimeout(timer);
  }, [filters.searchQuery, visible.length]);

  const onReport = useCallback(
    (b: BuddyProfile) => setReportTarget({ id: b.id, name: b.name, avatar: b.avatar, type: 'profile' }),
    []
  );
  const onDetails = useCallback((b: BuddyProfile) => setDetailsId(b.id), []);
  const onMatched = useCallback((buddy: BuddyProfile, chatId: string) => setMatched({ buddy, chatId }), []);
  const actions = useBuddyActions({ onReport, onDetails, onMatched });

  const deckBuddy = visible[deckIndex];

  const renderList = () => {
    if (visible.length === 0) {
      return (
        <EmptyState
          emoji="🔍"
          title={buddies.length === 0 ? tr('Поки нікого поруч') : tr('Нікого за цими фільтрами')}
          subtitle={
            buddies.length === 0
              ? tr('Коли хтось зареєструється, він з’явиться тут. Створи клич на вкладці «Кличі», щоб покликати компанію.')
              : tr('Спробуй збільшити відстань або скинути фільтри.')
          }
          action={activeCount > 0 ? <Button label={tr('Скинути фільтри')} small variant="secondary" onPress={() => updateFilters(DEFAULT_FILTERS)} /> : undefined}
        />
      );
    }

    if (viewMode === 'deck') {
      if (!deckBuddy) {
        return (
          <EmptyState
            emoji="🎉"
            title={tr('Ти переглянув усіх')}
            subtitle={tr('Повернись пізніше або змініть фільтри.')}
            action={<Button label={tr('Почати спочатку')} small onPress={() => setDeckIndex(0)} />}
          />
        );
      }
      return (
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Text style={[typography.small, { textAlign: 'center' }]}>
            {tr('{current} з {total}', { current: deckIndex + 1, total: visible.length })}
          </Text>
          <BuddyCard buddy={deckBuddy} actions={actions} />
          <Row style={{ justifyContent: 'center', gap: spacing.xl }}>
            <Button label={tr('Пропустити')} variant="secondary" icon="x" onPress={() => setDeckIndex((i) => i + 1)} style={{ flex: 1 }} />
            <Button
              label={tr('Будьмо!')}
              icon="zap"
              onPress={() => {
                actions.onToast(deckBuddy);
                setDeckIndex((i) => i + 1);
              }}
              style={{ flex: 1 }}
            />
          </Row>
        </View>
      );
    }

    if (viewMode === 'grid') {
      return (
        <FlatList
          key="grid"
          data={visible}
          keyExtractor={(b) => b.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          renderItem={({ item }) => <BuddyTile buddy={item} actions={actions} />}
        />
      );
    }

    return (
      <FlatList
        key="feed"
        data={visible}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        renderItem={({ item }) => <BuddyCard buddy={item} actions={actions} />}
        initialNumToRender={6}
        windowSize={7}
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <OfflineBanner />
      <ScreenHeader
        title={tr('Пошук компанії')}
        subtitle={tr('{count} поруч • {locationName}', { count: visible.length, locationName: tr(locationName) })}
        right={<IconButton icon="sliders" label={tr('Фільтри')} active={activeCount > 0} badge={activeCount} onPress={() => setShowFilters(true)} />}
      />
      <View style={styles.controls}>
        <View style={styles.search}>
          <Icon name="search" size={16} color={colors.textDim} />
          <TextInput
            value={filters.searchQuery}
            onChangeText={(searchQuery) => updateFilters({ ...filters, searchQuery })}
            placeholder={tr('Ім’я, інтерес, бар…')}
            placeholderTextColor={colors.textDim}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel={tr('Пошук')}
          />
        </View>
        <SegmentedControl<ViewMode>
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'feed', label: tr('Стрічка') },
            { value: 'grid', label: tr('Сітка') },
            { value: 'deck', label: tr('Стопка') },
          ]}
        />
      </View>

      <View style={{ flex: 1 }}>{renderList()}</View>

      <FilterSheet visible={showFilters} filters={filters} onChange={updateFilters} onClose={() => setShowFilters(false)} resultsCount={visible.length} />
      <BuddySheet buddy={details} actions={actions} onClose={() => setDetailsId(null)} />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />

      <Sheet visible={!!matched} onClose={() => setMatched(null)} title={tr('Будьмо! 🍻')}>
        {matched && (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
            <Avatar uri={matched.buddy.avatar} name={matched.buddy.name} size={84} />
            <Text style={typography.heading}>{tr('У вас новий спільний келих з {name}!', { name: matched.buddy.name })}</Text>
            <Badge label={tr('+30 XP за тост')} />
            <Row style={{ alignSelf: 'stretch' }}>
              <Button label={tr('Далі')} variant="secondary" onPress={() => setMatched(null)} style={{ flex: 1 }} />
              <Button
                label={tr('Написати тост')}
                icon="message-circle"
                onPress={() => {
                  const chatId = matched.chatId;
                  setMatched(null);
                  navigation.navigate('ChatRoom', { chatId });
                }}
                style={{ flex: 1 }}
              />
            </Row>
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  controls: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14 },
});
