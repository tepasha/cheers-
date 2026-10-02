import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectGeoBlock } from '../store/selectors';
import { ruBlockSimulationSet } from '../store/slices/settingsSlice';
import { useTr } from '../hooks/useT';

/** Full-screen, non-dismissable block shown on sanctioned territory */
export const RussiaBlockScreen = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const info = useAppSelector(selectGeoBlock);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Text style={{ fontSize: 56, textAlign: 'center' }}>🔱</Text>
      <Text style={[typography.title, { textAlign: 'center', color: colors.red }]}>{tr('Доступ заборонено')}</Text>
      <Text style={[typography.small, { textAlign: 'center' }]}>403 Forbidden • Sanctioned Territory</Text>

      <Card style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Line label={tr('РЕГІОН')} value={info.detectedCountry ?? '—'} />
        <Line label={tr('ПРИЧИНА')} value={info.reason} />
        <Line label={tr('ТАЙМЗОНА')} value={info.detectedTimezone ?? '—'} />
        <Line label={tr('РОСІЙСЬКА МОВА')} value={tr('ВИКЛЮЧЕНА (BLOCKED)')} valueColor={colors.red} />
      </Card>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Button label={tr('United24 (Підтримка ЗСУ)')} variant="secondary" icon="heart" onPress={() => Linking.openURL('https://u24.gov.ua')} />
        <Button label={tr('Повернись Живим')} variant="secondary" icon="heart" onPress={() => Linking.openURL('https://savelife.in.ua')} />
        {info.isSimulated && (
          <Button
            label={tr('Вимкнути симуляцію блокування РФ')}
            variant="ghost"
            onPress={() => dispatch(ruBlockSimulationSet(false))}
          />
        )}
      </View>
    </ScrollView>
  );
};

const Line = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
  <View style={{ gap: 2 }}>
    <Text style={typography.tiny}>{label}</Text>
    <Text style={[typography.body, valueColor ? { color: valueColor, fontWeight: '700' } : null]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, gap: spacing.sm },
});
