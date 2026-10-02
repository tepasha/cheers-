import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: { legal: { privacyPolicyUrl: 'https://example.com/privacy', termsUrl: 'javascript:alert(1)' } } } } }));

import { httpsUrlOrNull, legalLinks } from '@/services/legal';

describe('legal links', () => {
  it('only accepts https URLs', () => {
    expect(httpsUrlOrNull('https://example.com/privacy')).toBe('https://example.com/privacy');
    expect(httpsUrlOrNull('http://example.com')).toBeNull();
    expect(httpsUrlOrNull('javascript:alert(1)')).toBeNull();
    expect(httpsUrlOrNull('not a url')).toBeNull();
    expect(httpsUrlOrNull('')).toBeNull();
    expect(httpsUrlOrNull(undefined)).toBeNull();
  });

  it('exposes the configured pages and drops an unsafe one', () => {
    expect(legalLinks.privacyPolicy).toBe('https://example.com/privacy');
    expect(legalLinks.terms).toBeNull();
  });
});
