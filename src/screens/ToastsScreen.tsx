import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, typography } from '../theme';
import { Button, Card, Chip, IconButton, Row } from '../components/ui';
import { ALL_TOASTS, getRandomToast, TOAST_CATEGORIES, ToastItem } from '../data/toastsData';
import { useAppDispatch } from '../store/hooks';
import { sendMessage } from '../store/thunks/social';
import { recordCheckIn } from '../store/thunks/gamification';
import type { RootScreenProps } from '../navigation/types';
import { useTr } from '../hooks/useT';

/** Toast library. Opened from a chat it sends the picked toast as a "cheers" message. */
export const ToastsScreen = ({ navigation, route }: RootScreenProps<'Toasts'>) => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const chatId = route.params?.chatId;
  const [category, setCategory] = useState<ToastItem['category'] | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toasts = useMemo(() => (category === 'all' ? ALL_TOASTS : ALL_TOASTS.filter((t) => t.category === category)), [category]);

  const send = (toast: ToastItem) => {
    if (!chatId) return;
    dispatch(sendMessage({ chatId, text: `${toast.emoji} ${toast.text}`, type: 'cheers' }));
    dispatch(recordCheckIn({ barName: tr('Барний тост'), note: toast.text, type: 'cheers_toast' }));
    navigation.goBack();
  };

  const copy = async (toast: ToastItem) => {
    await Clipboard.setStringAsync(toast.text);
    setCopiedId(toast.id);
    setTimeout(() => setCopiedId((id) => (id === toast.id ? null : id)), 2000);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
        {TOAST_CATEGORIES.map((c) => (
          <Chip key={c.id} emoji={c.emoji} label={tr(c.label)} selected={category === c.id} onPress={() => setCategory(c.id)} />
        ))}
      </ScrollView>

      <FlatList
        data={toasts}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListHeaderComponent={
          <Button
            label={tr('Випадковий тост')}
            icon="shuffle"
            variant="secondary"
            onPress={() => {
              const random = getRandomToast(category);
              if (chatId) send(random);
              else copy(random);
            }}
          />
        }
        renderItem={({ item }) => (
          <Card style={{ gap: spacing.sm }}>
            <Text style={typography.body}>
              {item.emoji} {item.text}
            </Text>
            <Text style={typography.tiny}>{item.categoryLabel}</Text>
            <Row style={{ justifyContent: 'flex-end' }}>
              <IconButton icon={copiedId === item.id ? 'check' : 'copy'} label={tr('Копіювати тост')} onPress={() => copy(item)} />
              {chatId && <Button label={tr('Надіслати')} icon="send" small onPress={() => send(item)} />}
            </Row>
          </Card>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
});
