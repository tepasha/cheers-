import { describe, it, expect, beforeEach } from 'vitest';
import { FavoriteVenueItem } from '../../types';

describe('Favorite Venues Storage & Models', () => {
  const STORAGE_KEY = 'user_favorite_venues_list_v2';

  beforeEach(() => {
    localStorage.clear();
  });

  it('correctly persists and loads favorite venues from localStorage', () => {
    const testVenues: FavoriteVenueItem[] = [
      {
        id: 'test-venue-1',
        name: 'Podil Craft Station',
        area: 'Поділ, Київ',
        category: 'Крафтове пиво',
        lat: 50.465,
        lng: 30.512,
        comment: 'Найкращі крани',
        createdAt: '2026-09-13',
      },
    ];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(testVenues));
    const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Podil Craft Station');
    expect(loaded[0].lat).toBe(50.465);
  });

  it('validates venue coordinates bounds correctly', () => {
    const isValidLat = (lat: number) => !isNaN(lat) && lat >= -90 && lat <= 90;
    const isValidLng = (lng: number) => !isNaN(lng) && lng >= -180 && lng <= 180;

    expect(isValidLat(50.4501)).toBe(true);
    expect(isValidLng(30.5234)).toBe(true);
    expect(isValidLat(120)).toBe(false);
    expect(isValidLng(-200)).toBe(false);
  });
});
