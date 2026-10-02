/**
 * Battery Saver tuning. When enabled the app polls location less often, throttles realtime
 * Firestore updates and avoids the power-hungry high-accuracy GPS chip.
 */
export interface BatterySaverConfig {
  locationIntervalMs: number;
  realtimeSyncIntervalMs: number;
  enableHighAccuracy: boolean;
  maximumAgeMs: number;
  gpsTimeoutMs: number;
}

export function getBatterySaverConfig(enabled: boolean): BatterySaverConfig {
  if (enabled) {
    return {
      locationIntervalMs: 90000,
      realtimeSyncIntervalMs: 60000,
      enableHighAccuracy: false,
      maximumAgeMs: 300000,
      gpsTimeoutMs: 15000,
    };
  }

  return {
    locationIntervalMs: 15000,
    realtimeSyncIntervalMs: 10000,
    enableHighAccuracy: true,
    maximumAgeMs: 10000,
    gpsTimeoutMs: 10000,
  };
}
