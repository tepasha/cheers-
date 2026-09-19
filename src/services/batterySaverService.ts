/**
 * Battery Saver Service
 * Manages low-power mode across the app:
 * - Reduces frequency of location polling (from 15s to 90s)
 * - Reduces frequency of real-time cloud updates and Firestore synchronization (from 10s to 60s)
 * - Disables continuous high-accuracy satellite GPS to save battery life
 * - Persists state in localStorage
 */

export interface BatterySaverConfig {
  locationIntervalMs: number;
  realtimeSyncIntervalMs: number;
  enableHighAccuracy: boolean;
  maximumAgeMs: number;
  gpsTimeoutMs: number;
}

const STORAGE_KEY = 'budmo_battery_saver_mode';

class BatterySaverService {
  private isEnabled: boolean = false;
  private listeners: Set<(enabled: boolean) => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          this.isEnabled = stored === 'true';
        }
      } catch (err) {
        console.warn('Could not read battery saver state from localStorage:', err);
      }
    }
  }

  /**
   * Check if Battery Saver is currently active
   */
  isBatterySaverEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Enable or disable Battery Saver mode
   */
  setBatterySaver(enabled: boolean): void {
    if (this.isEnabled === enabled) return;
    this.isEnabled = enabled;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(enabled));
      } catch (err) {
        console.warn('Could not persist battery saver state to localStorage:', err);
      }
    }

    this.notifyListeners();
  }

  /**
   * Toggle Battery Saver mode
   */
  toggle(): boolean {
    this.setBatterySaver(!this.isEnabled);
    return this.isEnabled;
  }

  /**
   * Subscribe to Battery Saver mode changes
   */
  subscribe(callback: (enabled: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((callback) => {
      try {
        callback(this.isEnabled);
      } catch (err) {
        console.error('Error in battery saver listener:', err);
      }
    });
  }

  /**
   * Returns current interval configuration based on battery saver state
   */
  getConfig(): BatterySaverConfig {
    if (this.isEnabled) {
      return {
        locationIntervalMs: 90000, // 90 seconds in battery saver mode
        realtimeSyncIntervalMs: 60000, // 60 seconds sync
        enableHighAccuracy: false, // Low power cell/wifi towers, not power-hungry GPS chip
        maximumAgeMs: 300000, // Accept cached location up to 5 minutes
        gpsTimeoutMs: 15000,
      };
    }

    return {
      locationIntervalMs: 15000, // 15 seconds in standard mode
      realtimeSyncIntervalMs: 10000, // 10 seconds sync
      enableHighAccuracy: true, // High accuracy GPS
      maximumAgeMs: 10000, // Fresh coordinates within 10s
      gpsTimeoutMs: 10000,
    };
  }

  /**
   * Location polling interval in milliseconds
   */
  getLocationPollingInterval(): number {
    return this.getConfig().locationIntervalMs;
  }

  /**
   * Real-time sync interval in milliseconds
   */
  getRealtimeSyncInterval(): number {
    return this.getConfig().realtimeSyncIntervalMs;
  }

  /**
   * Geolocation PositionOptions to use for navigator.geolocation
   */
  getGeolocationOptions(): PositionOptions {
    const config = this.getConfig();
    return {
      enableHighAccuracy: config.enableHighAccuracy,
      timeout: config.gpsTimeoutMs,
      maximumAge: config.maximumAgeMs,
    };
  }
}

export const batterySaverService = new BatterySaverService();
