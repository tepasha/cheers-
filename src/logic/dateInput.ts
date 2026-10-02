/** Parsing/formatting helpers for typed dates ("ДД.ММ.РРРР") and times ("ГГ:ХХ") */

export function parseDateInput(input: string): { year: number; month: number; day: number } | null {
  const m = input.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return { year, month, day };
}

export function parseTimeInput(input: string): { hours: number; minutes: number } | null {
  const m = input.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** Combines typed date + time into an ISO timestamp in the device time zone; null when either is invalid */
export function toIsoDateTime(dateInput: string, timeInput: string): string | null {
  const date = parseDateInput(dateInput);
  const time = parseTimeInput(timeInput);
  if (!date || !time) return null;
  return new Date(date.year, date.month - 1, date.day, time.hours, time.minutes).toISOString();
}

export function formatDateInput(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** "15.05.1998" (typed) -> "1998-05-15" (stored); null when it is not a real calendar date */
export function parseBirthDateInput(input: string): string | null {
  const d = parseDateInput(input);
  if (!d) return null;
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/** "1998-05-15" (stored) -> "15.05.1998" (shown in inputs) */
export function isoToDateInput(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : '';
}
