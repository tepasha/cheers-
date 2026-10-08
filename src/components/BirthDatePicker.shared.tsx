import React from 'react';
import { DateTimeField } from './DateTimeField';
import { useTr } from '../hooks/useT';
import { MIN_AGE } from '../logic/session';
import type { BirthDatePickerProps } from './BirthDatePicker.types';

export const BirthDatePicker = (props: BirthDatePickerProps) => {
  const tr = useTr();
  const today = new Date();
  return (
    <DateTimeField
      {...props}
      label={tr('ДАТА НАРОДЖЕННЯ')}
      placeholder={tr('Оберіть дату народження')}
      minimumDate={new Date(today.getFullYear() - 120, today.getMonth(), today.getDate())}
      maximumDate={today}
      defaultValue={new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate())}
    />
  );
};
