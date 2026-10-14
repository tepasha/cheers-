import Constants from 'expo-constants';
import { httpsUrlOrNull } from './legal';

/** Support contacts from the environment (SUPPORT_URL, SUPPORT_EMAIL, DONATION_URL via app.config.ts) */
interface SupportExtra {
  url?: string;
  email?: string;
  donationUrl?: string;
}

const extra = (Constants.expoConfig?.extra?.support ?? {}) as SupportExtra;

export const emailOrNull = (value: string | undefined): string | null => {
  const email = value?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

export const supportLinks = {
  url: httpsUrlOrNull(extra.url),
  email: emailOrNull(extra.email),
  donationUrl: httpsUrlOrNull(extra.donationUrl),
};

/** Where the support button leads: the support page if there is one, otherwise an email; null hides the button */
export const supportContactUri = supportLinks.url ?? (supportLinks.email ? `mailto:${supportLinks.email}` : null);
