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

export function formatAgeWithUnit(age: number): string {
  const mod10 = age % 10;
  const mod100 = age % 100;
  if (mod100 >= 11 && mod100 <= 14) {
    return `${age} років`;
  }
  if (mod10 === 1) {
    return `${age} рік`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${age} роки`;
  }
  return `${age} років`;
}

export function formatBirthDateUkrainian(dateStr?: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const months = [
      'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
      'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
    ];
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 0 && m < 12) {
      return `${d} ${months[m]} ${y} р.`;
    }
  }
  return dateStr;
}
