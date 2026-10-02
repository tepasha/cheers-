import Constants from 'expo-constants';

/**
 * Public legal pages the stores require. They come from the environment (PRIVACY_POLICY_URL, TERMS_URL via
 * app.config.ts), so the app only shows links that really exist.
 */
interface LegalExtra {
  privacyPolicyUrl?: string;
  termsUrl?: string;
}

const extra = (Constants.expoConfig?.extra?.legal ?? {}) as LegalExtra;

/** Only https links are accepted; anything else (typo, javascript:, empty) is treated as not configured */
export const httpsUrlOrNull = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export const legalLinks = {
  privacyPolicy: httpsUrlOrNull(extra.privacyPolicyUrl),
  terms: httpsUrlOrNull(extra.termsUrl),
};
