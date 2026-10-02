/**
 * Utilities for calculating and formatting age from a date of birth
 */

export function calculateAge(birthDateStr?: string | null): number | null {
  if (!birthDateStr) return null;
  const parts = birthDateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    const birthDate = new Date(year, month, day);
    return calculateFromDate(birthDate);
  }
  const d = new Date(birthDateStr);
  if (isNaN(d.getTime())) return null;
  return calculateFromDate(d);
}

function calculateFromDate(birthDate: Date): number | null {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  if (age < 0 || age > 120) return null;
  return age;
}
