import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyticsService } from './analyticsService';

describe('analyticsService (Google Analytics GA4 integration)', () => {
  beforeEach(() => {
    // Reset global dataLayer if present
    if (typeof window !== 'undefined') {
      window.dataLayer = [];
    }
  });

  it('should have a valid measurement ID configured', () => {
    const measurementId = analyticsService.getMeasurementId();
    expect(measurementId).toBeDefined();
    expect(measurementId.startsWith('G-')).toBe(true);
  });

  it('should initialize and push gtag script and configurations', async () => {
    const initResult = await analyticsService.init();
    expect(initResult).toBe(true);

    if (typeof window !== 'undefined') {
      expect(window.dataLayer).toBeDefined();
      expect(typeof window.gtag).toBe('function');
    }
  });

  it('should track custom events and retain them in recent events list', () => {
    const initialEventsCount = analyticsService.getRecentEvents().length;

    analyticsService.trackEvent('custom_test_event', { foo: 'bar', test_id: 123 });

    const events = analyticsService.getRecentEvents();
    expect(events.length).toBeGreaterThan(initialEventsCount);
    expect(events[0].name).toBe('custom_test_event');
    expect(events[0].params).toEqual({ foo: 'bar', test_id: 123 });
  });

  it('should track tab navigation', () => {
    analyticsService.trackTabSwitch('discover', 'radar');

    const latest = analyticsService.getRecentEvents()[0];
    expect(latest.name).toBe('tab_switched');
    expect(latest.params?.previous_tab).toBe('discover');
    expect(latest.params?.active_tab).toBe('radar');
  });

  it('should track venue interactions and favorites', () => {
    analyticsService.trackVenueView('venue-podil-1', 'Бар Дерево', 'Craft Beer');
    let latest = analyticsService.getRecentEvents()[0];
    expect(latest.name).toBe('select_content');
    expect(latest.params?.item_id).toBe('venue-podil-1');

    analyticsService.trackVenueFavorite('venue-podil-1', 'Бар Дерево', true);
    latest = analyticsService.getRecentEvents()[0];
    expect(latest.name).toBe('add_to_wishlist');
  });

  it('should track battery saver toggling', () => {
    analyticsService.trackBatterySaver(true);
    const latest = analyticsService.getRecentEvents()[0];
    expect(latest.name).toBe('battery_saver_toggle');
    expect(latest.params?.enabled).toBe(true);
    expect(latest.params?.mode).toBe('low_power_90s');
  });

  it('should track language selection', () => {
    analyticsService.trackLanguageChange('en', 'manual');
    const latest = analyticsService.getRecentEvents()[0];
    expect(latest.name).toBe('change_language');
    expect(latest.params?.language).toBe('en');
  });

  it('should notify subscribers when events occur', () => {
    const subscriber = vi.fn();
    const unsub = analyticsService.subscribe(subscriber);

    analyticsService.trackEvent('subscriber_probe', { ping: 'pong' });
    expect(subscriber).toHaveBeenCalled();
    expect(subscriber.mock.calls[0][0].name).toBe('subscriber_probe');

    unsub();
  });
});
