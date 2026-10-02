import * as Location from 'expo-location';
import { UserGeoLocation } from './geoService';
import { ph } from './i18nService';
import { formatClock } from '../utils/time';

export type LocationPermissionResult = 'granted' | 'denied';

const round4 = (n: number) => Math.round(n * 10000) / 10000;

const clockLabel = () => formatClock();

export function toUserGeoLocation(coords: Location.LocationObjectCoords): UserGeoLocation {
  return {
    lat: round4(coords.latitude),
    lng: round4(coords.longitude),
    locationName: ph('Реальна геолокація GPS'),
    accuracyMeters: Math.round(coords.accuracy ?? 8) || 8,
    lastUpdated: clockLabel(),
    isSimulated: false,
    status: 'active',
  };
}

export async function ensureLocationPermission(): Promise<LocationPermissionResult> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const asked = await Location.requestForegroundPermissionsAsync();
  return asked.granted ? 'granted' : 'denied';
}

/** One-shot fix of the real device position; null when permission is denied or the fix fails */
export async function requestDeviceLocation(highAccuracy = true): Promise<UserGeoLocation | null> {
  try {
    if ((await ensureLocationPermission()) !== 'granted') return null;
    const position = await Location.getCurrentPositionAsync({
      accuracy: highAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
    });
    return toUserGeoLocation(position.coords);
  } catch (err) {
    console.warn('Could not read device location:', err);
    return null;
  }
}
