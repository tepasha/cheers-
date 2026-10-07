/** Arbitrary profile/message URLs must never make another device contact a tracking endpoint. */
export function safeAvatarUri(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)googleusercontent\.com$/.test(url.hostname) ? value : undefined;
  } catch { return undefined; }
}
