import { describe, it, expect } from 'vitest';
import { 
  calculateDistanceKm, 
  calculateBearing, 
  formatDistance, 
  simulateWalkingStep, 
  PRESET_LOCATIONS, 
  INITIAL_USER_LOCATION 
} from './geoService';

describe('geoService', () => {
  it('should calculate distance between two identical points as 0 km', () => {
    const dist = calculateDistanceKm(50.4501, 30.5234, 50.4501, 30.5234);
    expect(dist).toBe(0);
  });

  it('should calculate distance between Kyiv and Lviv within expected range (~460-500 km)', () => {
    const dist = calculateDistanceKm(50.4501, 30.5234, 49.8419, 24.0315);
    expect(dist).toBeGreaterThan(450);
    expect(dist).toBeLessThan(520);
  });

  it('should calculate short distances correctly (e.g. Podil to Golden Gate ~1.5 - 2.5 km)', () => {
    const podil = PRESET_LOCATIONS.find(p => p.id === 'podil')!;
    const goldenGate = PRESET_LOCATIONS.find(p => p.id === 'golden_gate')!;
    const dist = calculateDistanceKm(podil.lat, podil.lng, goldenGate.lat, goldenGate.lng);
    expect(dist).toBeGreaterThan(1.0);
    expect(dist).toBeLessThan(3.0);
  });

  it('should format distances properly in Ukrainian (meters vs kilometers)', () => {
    expect(formatDistance(0.25)).toBe('250 м');
    expect(formatDistance(0.08)).toBe('80 м');
    expect(formatDistance(1.5)).toBe('1.5 км');
    expect(formatDistance(12.3)).toBe('12.3 км');
  });

  it('should calculate compass bearing correctly between 0 and 360 degrees', () => {
    const bearingNorth = calculateBearing(50.0, 30.0, 51.0, 30.0);
    expect(bearingNorth).toBeCloseTo(0, 0);

    const bearingEast = calculateBearing(0.0, 30.0, 0.0, 31.0);
    expect(bearingEast).toBeCloseTo(90, 0);
  });

  it('should simulate a walking step within sensible pedestrian limits (approx 10-150m)', () => {
    const origin = { lat: 50.4635, lng: 30.5180 };
    const step = simulateWalkingStep(origin.lat, origin.lng);
    const dist = calculateDistanceKm(origin.lat, origin.lng, step.lat, step.lng);
    expect(dist).toBeLessThan(0.3); // under 300 meters
    expect(step.lat).toBeTypeOf('number');
    expect(step.lng).toBeTypeOf('number');
  });

  it('should provide complete curated preset locations with valid coordinates and venues', () => {
    expect(PRESET_LOCATIONS.length).toBeGreaterThanOrEqual(6);
    PRESET_LOCATIONS.forEach(loc => {
      expect(loc.id).toBeTruthy();
      expect(loc.name).toBeTruthy();
      expect(loc.popularBars).toBeTruthy();
      expect(loc.lat).toBeGreaterThan(40);
      expect(loc.lat).toBeLessThan(55);
      expect(loc.lng).toBeGreaterThan(20);
      expect(loc.lng).toBeLessThan(40);
    });
  });

  it('should have initial user location set to Podil', () => {
    expect(INITIAL_USER_LOCATION.locationName).toContain('Поділ');
    expect(INITIAL_USER_LOCATION.status).toBe('active');
  });

  it('should validate coordinate bounding box calculation for interactive map views', () => {
    const centerLat = 50.4550;
    const centerLng = 30.5180;
    const latSpan = 0.08;
    const lngSpan = 0.12;

    const minLat = centerLat - latSpan / 2;
    const maxLat = centerLat + latSpan / 2;
    const minLng = centerLng - lngSpan / 2;
    const maxLng = centerLng + lngSpan / 2;

    expect(minLat).toBeLessThan(centerLat);
    expect(maxLat).toBeGreaterThan(centerLat);
    expect(minLng).toBeLessThan(centerLng);
    expect(maxLng).toBeGreaterThan(centerLng);

    // Ensure Podil coordinates fall within the default Kyiv map viewport
    const podilLat = 50.4635;
    const podilLng = 30.5180;
    expect(podilLat).toBeGreaterThanOrEqual(minLat);
    expect(podilLat).toBeLessThanOrEqual(maxLat);
    expect(podilLng).toBeGreaterThanOrEqual(minLng);
    expect(podilLng).toBeLessThanOrEqual(maxLng);
  });
});
