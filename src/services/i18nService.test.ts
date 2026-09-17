import { describe, it, expect } from 'vitest';
import { 
  t, 
  SUPPORTED_LANGUAGES, 
  checkRussianTerritoryRestriction, 
  detectLanguageFromGeo, 
  TRANSLATIONS 
} from './i18nService';

describe('i18nService', () => {
  it('should support Ukrainian, English, Polish and German with appropriate flags', () => {
    const codes = SUPPORTED_LANGUAGES.map(l => l.code);
    expect(codes).toContain('uk');
    expect(codes).toContain('en');
    expect(codes).toContain('pl');
    expect(codes).toContain('de');
    // Ensure Russian is explicitly NOT in supported languages
    expect(codes).not.toContain('ru');
  });

  it('should return correct translations for Ukrainian language', () => {
    expect(t('tab_discover', 'uk')).toBe('Пошук');
    expect(t('tab_radar', 'uk')).toBe('Радар');
    expect(t('tab_hangouts', 'uk')).toBe('Кличі');
    expect(t('tab_profile', 'uk')).toBe('Профіль');
  });

  it('should return correct translations for English language', () => {
    expect(t('tab_discover', 'en')).toBe('Discover');
    expect(t('tab_radar', 'en')).toBe('Radar');
    expect(t('tab_hangouts', 'en')).toBe('Hangouts');
    expect(t('tab_profile', 'en')).toBe('Profile');
  });

  it('should fallback gracefully to Ukrainian or key if translation is missing', () => {
    expect(t('tab_discover', 'unknown_lang' as any)).toBe('Пошук');
    expect(t('completely_non_existent_key_123', 'en')).toBe('completely_non_existent_key_123');
  });

  it('should verify all supported languages have the core tab keys defined', () => {
    const coreKeys = ['tab_discover', 'tab_radar', 'tab_hangouts', 'tab_chats', 'tab_profile'];
    (['uk', 'en', 'pl', 'de'] as const).forEach(lang => {
      coreKeys.forEach(key => {
        expect(TRANSLATIONS[lang][key]).toBeTruthy();
      });
    });
  });

  describe('Russian Federation Geoblock check', () => {
    it('should NOT block coordinates in Kyiv, Ukraine', () => {
      const result = checkRussianTerritoryRestriction({ lat: 50.4501, lng: 30.5234 });
      expect(result.isBlocked).toBe(false);
    });

    it('should NOT block coordinates in Warsaw, Poland', () => {
      const result = checkRussianTerritoryRestriction({ lat: 52.2297, lng: 21.0122 });
      expect(result.isBlocked).toBe(false);
    });

    it('should block coordinates in Moscow (European Russia)', () => {
      const result = checkRussianTerritoryRestriction({ lat: 55.7558, lng: 37.6173 });
      expect(result.isBlocked).toBe(true);
      expect(result.detectedCountry).toContain('Російська Федерація');
    });

    it('should block coordinates in Novosibirsk (Siberian Russia)', () => {
      const result = checkRussianTerritoryRestriction({ lat: 55.0084, lng: 82.9357 });
      expect(result.isBlocked).toBe(true);
    });
  });

  describe('detectLanguageFromGeo', () => {
    it('should detect Ukrainian for coordinates in Ukraine', () => {
      const result = detectLanguageFromGeo({ lat: 50.45, lng: 30.52 });
      expect(result.lang).toBe('uk');
    });

    it('should detect Polish for coordinates in Poland', () => {
      const result = detectLanguageFromGeo({ lat: 52.23, lng: 21.01 });
      expect(result.lang).toBe('pl');
    });

    it('should detect German for coordinates in Germany', () => {
      const result = detectLanguageFromGeo({ lat: 52.52, lng: 13.405 });
      expect(result.lang).toBe('de');
    });
  });
});
