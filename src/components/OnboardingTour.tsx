import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Feather from '@expo/vector-icons/Feather';
import { Badge, Button, Card, Row, Sheet } from './ui';
import { colors, radius, spacing, typography } from '../theme';
import { XP_RULES } from './GamificationCard';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { onboardingSeenSet } from '../store/slices/settingsSlice';
import { useTr } from '../hooks/useT';
import { ph } from '../services/i18nService';

const SHOW_DELAY_MS = 1200;

type Step = { title: string; icon: React.ComponentProps<typeof Feather>['name']; points: string[] };

/** Text-only steps; the points & levels step is rendered separately after them */
const STEPS: Step[] = [
  {
    title: ph('Ласкаво просимо до «Будьмо!» 🍻'),
    icon: 'compass',
    points: [
      ph('«Пошук» і «Мапа» показують людей і заклади поруч. Фільтруй за відстанню та інтересами.'),
      ph('Сподобалась людина? Підніми келих «Будьмо!» — це перший крок до знайомства.'),
    ],
  },
  {
    title: ph('Кличі 📣'),
    icon: 'radio',
    points: [
      ph('Створи клич «Зараз», щоб покликати компанію до свого столика, або заплануй зустріч наперед.'),
      ph('Приєднуйся до чужих кличів — організатор побачить тебе за столиком.'),
    ],
  },
  {
    title: ph('Друзі, чати й безпека 💬'),
    icon: 'message-circle',
    points: [
      ph('Домовляйся про деталі в чатах, надсилай тости й створюй групові чати.'),
      ph('У кожному чаті є кнопка екстреної безпеки, а будь-кого можна заблокувати чи поскаржитись.'),
    ],
  },
];

/** One-time onboarding: what the main tabs do, then how points and levels work. Shown shortly after the first launch. */
export const OnboardingTour = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const seen = useAppSelector((s) => s.settings.onboardingSeen);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (seen) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [seen]);

  const close = () => {
    setVisible(false);
    dispatch(onboardingSeenSet(true));
  };

  const total = STEPS.length + 1;
  const step = STEPS[index];
  const isLast = index === total - 1;

  const dots = (
    <Row style={{ justifyContent: 'center', gap: 6, paddingTop: spacing.sm }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: radius.pill, backgroundColor: i === index ? colors.amber : colors.surfaceHigh }} />
      ))}
    </Row>
  );

  const footer = isLast ? (
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
  ) : (
    <Row style={{ paddingTop: spacing.sm }}>
      <Button label={tr('Пропустити')} variant="secondary" onPress={close} style={{ flex: 1 }} />
      <Button label={tr('Далі')} icon="arrow-right" onPress={() => setIndex(index + 1)} style={{ flex: 1 }} />
    </Row>
  );

  return (
    <Sheet visible={visible} onClose={close} title={step ? tr(step.title) : tr('Бали та рівні 🏆')} footer={<>{dots}{footer}</>}>
      {step ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
            <Feather name={step.icon} size={40} color={colors.amber} />
          </View>
          {step.points.map((p) => (
            <Text key={p} style={typography.body}>
              {tr(p)}
            </Text>
          ))}
        </View>
      ) : (
        <>
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
        </>
      )}
    </Sheet>
  );
};
