import { formatDateInput, parseDateInput, parseTimeInput } from './dateInput';

export const calendarDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function pickerValue(
  value: string,
  mode: 'date' | 'time',
  fallback: Date,
  minimumDate?: Date,
  maximumDate?: Date,
): Date {
  if (mode === 'time') {
    const time = parseTimeInput(value);
    const date = new Date(fallback);
    if (time) date.setHours(time.hours, time.minutes, 0, 0);
    return date;
  }
  const parsed = parseDateInput(value);
  let date = parsed ? new Date(parsed.year, parsed.month - 1, parsed.day) : calendarDay(fallback);
  if (minimumDate && date < calendarDay(minimumDate)) date = calendarDay(minimumDate);
  if (maximumDate && date > calendarDay(maximumDate)) date = calendarDay(maximumDate);
  return date;
}

export function formatPickerValue(date: Date, mode: 'date' | 'time'): string {
  return mode === 'date'
    ? formatDateInput(date)
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
