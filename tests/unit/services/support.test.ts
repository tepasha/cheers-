import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: { support: { url: 'http://example.com/help', email: ' help@example.com ', donationUrl: 'https://example.com/jar' } } } } }));

import { emailOrNull, supportContactUri, supportLinks } from '@/services/support';

describe('support links', () => {
  it('only accepts a plausible email address', () => {
    expect(emailOrNull('help@example.com')).toBe('help@example.com');
    expect(emailOrNull('help@example')).toBeNull();
    expect(emailOrNull('not an email')).toBeNull();
    expect(emailOrNull('')).toBeNull();
    expect(emailOrNull(undefined)).toBeNull();
  });

  it('drops a non-https support page and falls back to the email', () => {
    expect(supportLinks).toEqual({ url: null, email: 'help@example.com', donationUrl: 'https://example.com/jar' });
    expect(supportContactUri).toBe('mailto:help@example.com');
  });
});
