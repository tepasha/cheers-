import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Badge, Button, Card, Row, Sheet } from './ui';
import { spacing, typography } from '../theme';
import { XP_RULES } from './GamificationCard';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { gamificationTourSeenSet } from '../store/slices/settingsSlice';
import { useTr } from '../hooks/useT';

const SHOW_DELAY_MS = 1200;

/** One-time onboarding explaining points and levels, shown shortly after the first launch */
export const GamificationTour = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const seen = useAppSelector((s) => s.settings.gamificationTourSeen);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (seen) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [seen]);

  const close = () => {
    setVisible(false);
    dispatch(gamificationTourSeenSet(true));
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={tr('Бали та рівні 🏆')}
      footer={
        <Row style={{ paddingTop: spacing.sm }}>
          <Button label={tr('Зрозуміло')} variant="secondary" onPress={close} style={{ flex: 1 }} />
          <Button
            label={tr('До профілю')}
            icon="arrow-right"
            onPress={() => {
              close();
              navigation.navigate('Tabs', { screen: 'Profile' });
            }}
            style={{ flex: 1 }}
          />
        </Row>
      }
    >
      <Text style={[typography.small, { marginBottom: spacing.md }]}>
        {tr('Заробляй XP за живе спілкування: піднімай рівень, відкривай бейджі та переваги.')}
      </Text>
      <Card style={{ gap: 8 }}>
        {XP_RULES.map((r) => (
          <Row key={r.label} style={{ justifyContent: 'space-between' }}>
            <Text style={typography.body}>{tr(r.label)}</Text>
            <Badge label={`${r.xp} XP`} />
          </Row>
        ))}
      </Card>
    </Sheet>
  );
};
