/**
 * Battery Saver tuning. When enabled the app polls location less often, never uses the power-hungry high-accuracy GPS,
 * refreshes the people nearby less often and keeps the live table/meetup feeds to the screens that show them.
 */
export interface BatterySaverConfig {
  locationIntervalMs: number;
  /** How old the people nearby may get while a screen shows them before discoverNearby is called again */
  peopleRefreshMs: number;
  /** Live tables and meetups only while Hangouts or the Map is on screen (else: whenever the app is in the foreground) */
  feedsOnlyInView: boolean;
  enableHighAccuracy: boolean;
  maximumAgeMs: number;
  gpsTimeoutMs: number;
}

export function getBatterySaverConfig(enabled: boolean): BatterySaverConfig {
  if (enabled) {
    return {
      locationIntervalMs: 90000,
      peopleRefreshMs: 5 * 60 * 1000,
      feedsOnlyInView: true,
      enableHighAccuracy: false,
      maximumAgeMs: 300000,
      gpsTimeoutMs: 15000,
    };
  }

  return {
    locationIntervalMs: 15000,
    peopleRefreshMs: 2 * 60 * 1000,
    feedsOnlyInView: false,
    enableHighAccuracy: true,
    maximumAgeMs: 10000,
    gpsTimeoutMs: 10000,
  };
}
