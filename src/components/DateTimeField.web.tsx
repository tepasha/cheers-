import React from 'react';
import { Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { useAppSelector } from '../store/hooks';
import { LOCALE_BY_LANG } from '../services/i18nService';
import { formatDateInput, isoToDateInput, parseBirthDateInput, parseTimeInput } from '../logic/dateInput';
import { formatPickerValue, pickerValue } from '../logic/datePicker';
import type { DateTimeFieldProps } from './DateTimeField.types';

export const DateTimeField = ({
  label, value, onChange, mode = 'date', disabled, minimumDate, maximumDate,
}: DateTimeFieldProps) => {
  const language = useAppSelector((s) => s.settings.language);
  const browserValue = mode === 'date' ? parseBirthDateInput(value) ?? ''
    : parseTimeInput(value) ? formatPickerValue(pickerValue(value, 'time', new Date()), 'time') : '';
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[typography.label, { marginBottom: 6 }]}>{label}</Text>
      {React.createElement('input', {
        type: mode,
        'aria-label': label,
        lang: LOCALE_BY_LANG[language],
        value: browserValue,
        min: mode === 'date' && minimumDate ? parseBirthDateInput(formatDateInput(minimumDate)) : undefined,
        max: mode === 'date' && maximumDate ? parseBirthDateInput(formatDateInput(maximumDate)) : undefined,
        disabled,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          if (!disabled && event.target.validity.valid) {
            onChange(mode === 'date' ? isoToDateInput(event.target.value) : event.target.value);
          }
        },
        style: {
          width: '100%', minWidth: 0, minHeight: 44, boxSizing: 'border-box', colorScheme: 'dark',
          backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
          borderRadius: radius.md, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
          opacity: disabled ? 0.45 : 1,
        },
      })}
    </View>
  );
};
