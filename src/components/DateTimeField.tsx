import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button, Icon, Row } from './ui';
import { colors, radius, spacing, typography } from '../theme';
import { useTr } from '../hooks/useT';
import { useAppSelector } from '../store/hooks';
import { LOCALE_BY_LANG } from '../services/i18nService';
import { calendarDay, formatPickerValue, pickerValue } from '../logic/datePicker';
import type { DateTimeFieldProps } from './DateTimeField.types';

export const DateTimeField = ({
  label, value, onChange, mode = 'date', placeholder, disabled, minimumDate, maximumDate, defaultValue,
}: DateTimeFieldProps) => {
  const tr = useTr();
  const language = useAppSelector((s) => s.settings.language);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => new Date());
  const androidOpen = useRef(false);

  useEffect(() => {
    const dismiss = () => {
      if (androidOpen.current) {
        androidOpen.current = false;
        void DateTimePickerAndroid.dismiss(mode);
      }
    };
    if (disabled) dismiss();
    return dismiss;
  }, [disabled, mode]);

  const show = () => {
    if (disabled) return;
    Keyboard.dismiss();
    const selected = pickerValue(value, mode, defaultValue ?? new Date(), minimumDate, maximumDate);
    if (Platform.OS === 'android') {
      if (androidOpen.current) return;
      androidOpen.current = true;
      DateTimePickerAndroid.open({
        value: selected,
        mode,
        is24Hour: true,
        minimumDate: mode === 'date' && minimumDate ? calendarDay(minimumDate) : undefined,
        maximumDate: mode === 'date' && maximumDate ? calendarDay(maximumDate) : undefined,
        positiveButton: { label: tr('Готово'), textColor: colors.amber },
        negativeButton: { label: tr('Скасувати') },
        onValueChange: (_event, date) => {
          if (!androidOpen.current) return;
          androidOpen.current = false;
          onChange(formatPickerValue(date, mode));
        },
        onDismiss: () => { androidOpen.current = false; },
      });
    } else {
      setDraft(selected);
      setOpen(true);
    }
  };

  return (
    <View style={styles.field}>
      <Text style={[typography.label, { marginBottom: 6 }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value || placeholder }}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        disabled={disabled}
        onPress={show}
        style={({ pressed }) => [styles.input, { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }]}
      >
        <Text style={[typography.body, { flex: 1, color: value ? colors.text : colors.textDim }]}>
          {value || placeholder || label}
        </Text>
        <Icon name={mode === 'date' ? 'calendar' : 'clock'} color={colors.amberSoft} />
      </Pressable>
      {open && !disabled && Platform.OS !== 'android' && (
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <DateTimePicker
            value={draft}
            mode={mode}
            display="spinner"
            locale={LOCALE_BY_LANG[language]}
            minimumDate={mode === 'date' && minimumDate ? calendarDay(minimumDate) : undefined}
            maximumDate={mode === 'date' && maximumDate ? calendarDay(maximumDate) : undefined}
            themeVariant="dark"
            textColor={colors.text}
            onValueChange={(_event, date) => setDraft(date)}
            style={{ alignSelf: 'stretch' }}
          />
          <Row>
            <Button label={tr('Скасувати')} variant="ghost" onPress={() => setOpen(false)} style={{ flex: 1 }} />
            <Button label={tr('Готово')} onPress={() => { onChange(formatPickerValue(draft, mode)); setOpen(false); }} style={{ flex: 1 }} />
          </Row>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10,
  },
});
