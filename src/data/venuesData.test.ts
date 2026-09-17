import { describe, it, expect } from 'vitest';
import { GOOGLE_MAPS_VENUES, parseGoogleMapsInput, CATEGORY_CONFIG } from './venuesData';

describe('venuesData and Google Maps coordinates', () => {
  it('should have valid coordinates and ratings from Google Maps for all venues', () => {
    expect(GOOGLE_MAPS_VENUES.length).toBeGreaterThanOrEqual(15);

    GOOGLE_MAPS_VENUES.forEach((venue) => {
      // Latitude in Ukraine roughly 44 to 53
      expect(venue.lat).toBeGreaterThan(44);
      expect(venue.lat).toBeLessThan(53);

      // Longitude in Ukraine roughly 22 to 41
      expect(venue.lng).toBeGreaterThan(22);
      expect(venue.lng).toBeLessThan(41);

      // Rating must be valid Google Maps star rating
      expect(venue.rating).toBeGreaterThanOrEqual(4.0);
      expect(venue.rating).toBeLessThanOrEqual(5.0);

      // Review count must be realistic positive number
      expect(venue.reviewCount).toBeGreaterThan(100);

      // Google maps URL must be valid
      expect(venue.googleMapsUrl).toContain('google.com/maps');

      // Category configuration exists
      expect(CATEGORY_CONFIG[venue.category]).toBeDefined();
    });
  });

  it('should parse raw coordinates string correctly', () => {
    const res1 = parseGoogleMapsInput('50.4635, 30.5180');
    expect(res1).not.toBeNull();
    expect(res1?.lat).toBeCloseTo(50.4635);
    expect(res1?.lng).toBeCloseTo(30.5180);

    const res2 = parseGoogleMapsInput('49.8419 24.0322');
    expect(res2).not.toBeNull();
    expect(res2?.lat).toBeCloseTo(49.8419);
    expect(res2?.lng).toBeCloseTo(24.0322);
  });

  it('should parse Google Maps @lat,lng URLs correctly', () => {
    const url = 'https://www.google.com/maps/@50.4418,30.5152,17z/data=!3m1!4b1';
    const res = parseGoogleMapsInput(url);
    expect(res).not.toBeNull();
    expect(res?.lat).toBeCloseTo(50.4418);
    expect(res?.lng).toBeCloseTo(30.5152);
  });

  it('should parse Google Maps query parameter URLs correctly', () => {
    const url = 'https://www.google.com/maps/search/?api=1&query=46.4862,30.7391';
    const res = parseGoogleMapsInput(url);
    expect(res).not.toBeNull();
    expect(res?.lat).toBeCloseTo(46.4862);
    expect(res?.lng).toBeCloseTo(30.7391);
  });

  it('should return null for invalid coordinate strings', () => {
    expect(parseGoogleMapsInput('invalid string')).toBeNull();
    expect(parseGoogleMapsInput('')).toBeNull();
    expect(parseGoogleMapsInput('999, 999')).toBeNull();
  });
});
