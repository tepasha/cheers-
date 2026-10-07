/**
 * Utilities for calculating and formatting age from a date of birth
 */

export function calculateAge(birthDateStr?: string | null, now: Date = new Date()): number | null {
  if (!birthDateStr) return null;
  const parts = birthDateStr.split('-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    const birthDate = new Date(year, month, day);
    if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month || birthDate.getDate() !== day) return null;
    return calculateFromDate(birthDate, now);
  }
  return null;
}

function calculateFromDate(birthDate: Date, today: Date): number | null {
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  if (age < 0 || age > 120) return null;
  return age;
}
