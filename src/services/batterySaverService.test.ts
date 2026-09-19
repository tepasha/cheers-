import { describe, it, expect, beforeEach, vi } from 'vitest';
import { batterySaverService } from './batterySaverService';

describe('batterySaverService', () => {
  beforeEach(() => {
    batterySaverService.setBatterySaver(false);
  });

  it('should initialize with battery saver disabled by default', () => {
    expect(batterySaverService.isBatterySaverEnabled()).toBe(false);
  });

  it('should toggle battery saver mode on and off', () => {
    const newState = batterySaverService.toggle();
    expect(newState).toBe(true);
    expect(batterySaverService.isBatterySaverEnabled()).toBe(true);

    const revertedState = batterySaverService.toggle();
    expect(revertedState).toBe(false);
    expect(batterySaverService.isBatterySaverEnabled()).toBe(false);
  });

  it('should adjust location and realtime intervals based on mode', () => {
    batterySaverService.setBatterySaver(false);
    const standardConfig = batterySaverService.getConfig();
    expect(standardConfig.locationIntervalMs).toBe(15000);
    expect(standardConfig.realtimeSyncIntervalMs).toBe(10000);
    expect(standardConfig.enableHighAccuracy).toBe(true);

    batterySaverService.setBatterySaver(true);
    const saverConfig = batterySaverService.getConfig();
    expect(saverConfig.locationIntervalMs).toBe(90000);
    expect(saverConfig.realtimeSyncIntervalMs).toBe(60000);
    expect(saverConfig.enableHighAccuracy).toBe(false);
    expect(saverConfig.maximumAgeMs).toBe(300000);
  });

  it('should return correct geolocation options for battery saver', () => {
    batterySaverService.setBatterySaver(true);
    const options = batterySaverService.getGeolocationOptions();
    expect(options.enableHighAccuracy).toBe(false);
    expect(options.maximumAge).toBe(300000);

    batterySaverService.setBatterySaver(false);
    const highAccuracyOptions = batterySaverService.getGeolocationOptions();
    expect(highAccuracyOptions.enableHighAccuracy).toBe(true);
  });

  it('should notify subscribers when battery saver status changes', () => {
    const listener = vi.fn();
    const unsub = batterySaverService.subscribe(listener);

    batterySaverService.setBatterySaver(true);
    expect(listener).toHaveBeenCalledWith(true);

    batterySaverService.setBatterySaver(false);
    expect(listener).toHaveBeenCalledWith(false);

    unsub();
    batterySaverService.setBatterySaver(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
