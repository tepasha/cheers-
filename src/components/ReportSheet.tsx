import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Field, Sheet } from './ui';
import { colors, radius, spacing, typography } from '../theme';
import { REPORT_CATEGORIES } from '../data/safetyData';
import { ReportCategory, ReportTargetType } from '../types';
import { useAppDispatch } from '../store/hooks';
import { submitReport } from '../store/thunks/safety';
import { useTr } from '../hooks/useT';

export interface ReportTarget {
  id: string;
  name: string;
  avatar?: string;
  type: ReportTargetType;
  contextId?: string;
}

/** Report for moderator review, optionally block the target on this account. */
export const ReportSheet = ({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) =>
  // Mounted per target so the form always starts empty
  target ? <ReportForm key={target.id} target={target} onClose={onClose} /> : null;

const ReportForm = ({ target, onClose }: { target: ReportTarget; onClose: () => void }) => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [comment, setComment] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);

  const send = () => {
    if (!category) return;
    dispatch(
      submitReport({
        targetId: target.id,
        targetType: target.type,
        contextId: target.contextId,
        targetName: target.name,
        targetAvatar: target.avatar,
        category,
        comment,
        shouldBlockUser: alsoBlock,
      })
    );
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={tr('Скарга на {name}', { name: target.name })}
      footer={<Button label={tr('Надіслати скаргу')} icon="flag" variant="danger" onPress={send} disabled={!category} />}
    >
      <View style={{ gap: spacing.sm }}>
        {REPORT_CATEGORIES.map((c) => {
          const selected = c.id === category;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setCategory(c.id)}
              style={[styles.option, selected && { borderColor: colors.red, backgroundColor: colors.redBg }]}
            >
              <Text style={{ fontSize: 22 }}>{c.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{tr(c.title)}</Text>
                <Text style={typography.tiny}>{tr(c.description)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: spacing.md }} />
      <Field label={tr('КОМЕНТАР (НЕОБОВ’ЯЗКОВО)')} value={comment} onChangeText={setComment} maxLength={500} multiline placeholder={tr('Що сталося?')} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: alsoBlock }} onPress={() => setAlsoBlock((v) => !v)} style={styles.checkRow}>
        <View style={[styles.checkbox, alsoBlock && { backgroundColor: colors.amber, borderColor: colors.amber }]} />
        <Text style={typography.body}>{tr('Також заблокувати користувача')}</Text>
      </Pressable>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.textDim },
});
