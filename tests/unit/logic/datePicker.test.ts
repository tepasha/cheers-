import { describe, expect, it } from 'vitest';
import { calendarDay, formatPickerValue, pickerValue } from '@/logic/datePicker';
import { toIsoDateTime } from '@/logic/dateInput';

describe('picker dates in the device time zone', () => {
  it('preserves a leap-day birthday without converting it through UTC', () => {
    const date = pickerValue('29.02.2000', 'date', new Date(2026, 9, 8));
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2000, 1, 29]);
    expect(formatPickerValue(date, 'date')).toBe('29.02.2000');
  });

  it('uses the fallback for empty or invalid dates without changing it', () => {
    const fallback = new Date(2008, 9, 8, 19, 30);
    for (const value of ['', '31.02.2000']) {
      expect(pickerValue(value, 'date', fallback)).toEqual(calendarDay(fallback));
    }
    expect(fallback.getHours()).toBe(19);
  });

  it('clamps existing dates to the available calendar days', () => {
    const minimum = new Date(2026, 9, 8, 15, 45);
    const maximum = new Date(2026, 9, 20, 9, 30);
    const fallback = new Date(2026, 9, 9);
    expect(pickerValue('07.10.2026', 'date', fallback, minimum, maximum)).toEqual(calendarDay(minimum));
    expect(pickerValue('21.10.2026', 'date', fallback, minimum, maximum)).toEqual(calendarDay(maximum));
    expect(pickerValue('08.10.2026', 'date', fallback, minimum, maximum)).toEqual(calendarDay(minimum));
  });

  it('formats midnight and keeps the selected local time in the saved timestamp', () => {
    const date = pickerValue('0:05', 'time', new Date(2026, 9, 8, 19, 30));
    expect(formatPickerValue(date, 'time')).toBe('00:05');
    const saved = new Date(toIsoDateTime(formatPickerValue(date, 'date'), formatPickerValue(date, 'time'))!);
    expect([saved.getDate(), saved.getHours(), saved.getMinutes()]).toEqual([8, 0, 5]);
  });
});
