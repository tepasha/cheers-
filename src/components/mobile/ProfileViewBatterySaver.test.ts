import { describe, it, expect, beforeEach } from 'vitest';
import { batterySaverService } from '../../services/batterySaverService';

describe('ProfileView Battery Saver Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    batterySaverService.setBatterySaver(false);
  });

  it('starts with standard polling and update intervals by default', () => {
    expect(batterySaverService.isBatterySaverEnabled()).toBe(false);
    expect(batterySaverService.getLocationPollingInterval()).toBe(15000);
    expect(batterySaverService.getRealtimeSyncInterval()).toBe(10000);
    expect(batterySaverService.getGeolocationOptions().enableHighAccuracy).toBe(true);
  });

  it('reduces frequency of location polling and real-time updates when toggled ON', () => {
    // User clicks the toggle in ProfileView
    batterySaverService.toggle();

    expect(batterySaverService.isBatterySaverEnabled()).toBe(true);
    // Polling throttled to 90s (from 15s)
    expect(batterySaverService.getLocationPollingInterval()).toBe(90000);
    // Real-time updates throttled to 60s (from 10s)
    expect(batterySaverService.getRealtimeSyncInterval()).toBe(60000);
    // GPS switched to low-power mode (avoiding satellite hardware battery drain)
    expect(batterySaverService.getGeolocationOptions().enableHighAccuracy).toBe(false);
    expect(batterySaverService.getGeolocationOptions().maximumAge).toBe(300000);
  });

  it('restores normal high-accuracy polling and live sync when toggled OFF', () => {
    batterySaverService.setBatterySaver(true);
    expect(batterySaverService.isBatterySaverEnabled()).toBe(true);

    batterySaverService.toggle();
    expect(batterySaverService.isBatterySaverEnabled()).toBe(false);
    expect(batterySaverService.getLocationPollingInterval()).toBe(15000);
    expect(batterySaverService.getRealtimeSyncInterval()).toBe(10000);
    expect(batterySaverService.getGeolocationOptions().enableHighAccuracy).toBe(true);
  });
});
