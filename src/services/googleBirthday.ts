import { calculateAge } from '../utils/ageUtils';

export const GOOGLE_BIRTHDAY_SCOPE = 'https://www.googleapis.com/auth/user.birthday.read';

/** People may expose only month/day. Never invent a year for the age gate. */
export function parseGoogleBirthday(person: unknown): string | null {
  const birthdays = (person as { birthdays?: unknown } | null)?.birthdays;
  if (!Array.isArray(birthdays)) return null;
  const ordered = [...birthdays].sort((a, b) => Number(b?.metadata?.primary === true) - Number(a?.metadata?.primary === true));
  for (const birthday of ordered) {
    const { year, month, day } = birthday?.date ?? {};
    if (![year, month, day].every(Number.isInteger)) continue;
    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (calculateAge(iso) !== null) return iso;
  }
  return null;
}

/** An optional profile lookup must not prevent sign-in or retain the OAuth token. */
export async function fetchGoogleBirthday(accessToken?: string): Promise<string | null> {
  if (!accessToken) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('https://people.googleapis.com/v1/people/me?personFields=birthdays', {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
    });
    return response.ok ? parseGoogleBirthday(await response.json()) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
