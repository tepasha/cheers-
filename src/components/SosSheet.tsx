import React, { useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, Row, SectionTitle, Sheet } from './ui';
import { colors, spacing, typography } from '../theme';
import { SOS_SAFETY_TIPS } from '../data/safetyData';
import { analyticsService } from '../services/analyticsService';
import { useAppDispatch } from '../store/hooks';
import { triggerSosAlert } from '../store/thunks/safety';
import { useTr } from '../hooks/useT';
import { ph } from '../services/i18nService';

const ANGELA_TEXT = ph('Будь ласка, покличте допомогу або викличте таксі. Запитайте Анжелу.');

/** Emergency safety sheet: call 112/102, the "Ask for Angela" bar code phrase, and an optional panic-block */
export const SosSheet = ({
  visible,
  onClose,
  interlocutor,
}: {
  visible: boolean;
  onClose: () => void;
  interlocutor?: { id: string; name: string };
}) => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const [copied, setCopied] = useState(false);
  const [showBig, setShowBig] = useState(false);

  const call = (number: '112' | '102') => {
    analyticsService.trackSosTrigger(number === '112' ? 'call_112' : 'call_angela');
    Linking.openURL(`tel:${number}`);
  };

  const copy = async () => {
    await Clipboard.setStringAsync(tr(ANGELA_TEXT));
    analyticsService.trackSosTrigger('copy_address');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title={tr('🚨 Екстрена безпека')}>
        <Row>
          <Button label={tr('Дзвінок 112')} icon="phone" variant="danger" onPress={() => call('112')} style={{ flex: 1 }} />
          <Button label={tr('Поліція 102')} icon="phone" variant="secondary" onPress={() => call('102')} style={{ flex: 1 }} />
        </Row>

        <SectionTitle>{tr('Кодова фраза для бармена')}</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <Text style={typography.heading}>{tr('«Чи тут Анжела?»')}</Text>
          <Text style={typography.small}>{tr('Персонал допоможе викликати безпечне таксі або вийти без конфлікту.')}</Text>
          <Row>
            <Button label={copied ? tr('Скопійовано') : tr('Копіювати')} icon={copied ? 'check' : 'copy'} small variant="secondary" onPress={copy} style={{ flex: 1 }} />
            <Button label={tr('На весь екран')} icon="maximize" small onPress={() => { analyticsService.trackSosTrigger('call_angela'); setShowBig(true); }} style={{ flex: 1 }} />
          </Row>
        </Card>

        <SectionTitle>{tr('Поради')}</SectionTitle>
        <View style={{ gap: spacing.sm }}>
          {SOS_SAFETY_TIPS.map((tip) => (
            <Card key={tip.title} style={{ gap: 4 }}>
              <Text style={typography.body}>
                {tip.icon} {tr(tip.title)}
              </Text>
              <Text style={typography.small}>{tr(tip.description)}</Text>
            </Card>
          ))}
        </View>

        {interlocutor && (
          <Button
            label={tr('Заблокувати {name} та повідомити', { name: interlocutor.name })}
            icon="shield-off"
            variant="danger"
            style={{ marginTop: spacing.lg }}
            onPress={() => {
              dispatch(triggerSosAlert({ interlocutorId: interlocutor.id, interlocutorName: interlocutor.name }));
              onClose();
            }}
          />
        )}
      </Sheet>

      <Modal visible={showBig} animationType="fade" onRequestClose={() => setShowBig(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Закрити')}
          onPress={() => setShowBig(false)}
          style={{ flex: 1, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}
        >
          <Text style={{ fontSize: 64 }}>🍸</Text>
          <Text style={{ color: colors.onAmber, fontSize: 34, fontWeight: '900', textAlign: 'center', marginTop: spacing.lg }}>
            {tr('«Чи можу я запитати Анжелу?»')}
          </Text>
          <Text style={{ color: colors.onAmber, fontSize: 14, marginTop: spacing.lg, textAlign: 'center' }}>{tr('Торкніться екрана, щоб закрити')}</Text>
        </Pressable>
      </Modal>
    </>
  );
};
