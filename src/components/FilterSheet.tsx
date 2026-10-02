import React from 'react';
import { Text, View } from 'react-native';
import { Button, Chip, Row, SectionTitle, Sheet } from './ui';
import { colors, spacing, typography } from '../theme';
import { DrinkType, FilterSettings, MoodType } from '../types';
import { DRINK_METADATA, MOOD_METADATA, POPULAR_INTERESTS } from '../data/mockData';
import { DEFAULT_FILTERS, MAX_FILTER_DISTANCE_KM } from '../logic/buddyFilters';
import { useTr } from '../hooks/useT';

const DISTANCE_STEPS = [1, 2, 3, MAX_FILTER_DISTANCE_KM];

const toggle = <T,>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export const FilterSheet = ({
  visible,
  filters,
  onChange,
  onClose,
  resultsCount,
}: {
  visible: boolean;
  filters: FilterSettings;
  onChange: (next: FilterSettings) => void;
  onClose: () => void;
  resultsCount: number;
}) => {
  const tr = useTr();
  return (
  <Sheet
    visible={visible}
    onClose={onClose}
    title={tr('Фільтри пошуку')}
    footer={
      <Row style={{ paddingTop: spacing.sm }}>
        <Button label={tr('Скинути')} variant="secondary" onPress={() => onChange(DEFAULT_FILTERS)} style={{ flex: 1 }} />
        <Button label={tr('Показати ({resultsCount})', { resultsCount })} onPress={onClose} style={{ flex: 2 }} />
      </Row>
    }
  >
    <SectionTitle>{tr('Відстань')}</SectionTitle>
    <Row style={{ flexWrap: 'wrap' }}>
      {DISTANCE_STEPS.map((km) => (
        <Chip
          key={km}
          label={km === MAX_FILTER_DISTANCE_KM ? tr('до {km} км (усі)', { km }) : tr('до {km} км', { km })}
          selected={filters.maxDistance === km}
          onPress={() => onChange({ ...filters, maxDistance: km })}
        />
      ))}
    </Row>

    <SectionTitle>{tr('Що п’ємо')}</SectionTitle>
    <Row style={{ flexWrap: 'wrap' }}>
      {(Object.keys(DRINK_METADATA) as DrinkType[]).map((d) => (
        <Chip
          key={d}
          emoji={DRINK_METADATA[d].icon}
          label={tr(DRINK_METADATA[d].label)}
          selected={filters.drinks.includes(d)}
          onPress={() => onChange({ ...filters, drinks: toggle(filters.drinks, d) })}
        />
      ))}
    </Row>

    <SectionTitle>{tr('Настрій')}</SectionTitle>
    <Row style={{ flexWrap: 'wrap' }}>
      {(Object.keys(MOOD_METADATA) as MoodType[]).map((m) => (
        <Chip
          key={m}
          emoji={MOOD_METADATA[m].emoji}
          label={tr(MOOD_METADATA[m].label)}
          selected={filters.moods.includes(m)}
          onPress={() => onChange({ ...filters, moods: toggle(filters.moods, m) })}
        />
      ))}
    </Row>

    <SectionTitle>{tr('Інтереси')}</SectionTitle>
    <Row style={{ flexWrap: 'wrap' }}>
      {POPULAR_INTERESTS.map((i) => (
        <Chip
          key={i.id}
          emoji={i.emoji}
          label={tr(i.label)}
          selected={filters.interests.includes(i.id)}
          onPress={() => onChange({ ...filters, interests: toggle(filters.interests, i.id) })}
        />
      ))}
    </Row>
    <View style={{ height: spacing.sm }} />
    <Text style={[typography.tiny, { color: colors.textDim }]}>{tr('Фільтри застосовуються одразу.')}</Text>
  </Sheet>
);
};
