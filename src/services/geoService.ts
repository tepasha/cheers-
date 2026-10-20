// Geo location simulation & calculations for RadarView
export interface UserGeoLocation {
  lat: number;
  lng: number;
  locationName: string;
  accuracyMeters: number;
  lastUpdated: string;
  isSimulated: boolean;
  status: 'active' | 'locating' | 'calibrating' | 'error';
}

export const INITIAL_USER_LOCATION: UserGeoLocation = {
  lat: 50.4635,
  lng: 30.5180,
  locationName: 'Київ, Поділ (Контрактова площа)',
  accuracyMeters: 6,
  lastUpdated: 'Щойно',
  isSimulated: true,
  status: 'active',
};

/**
 * Calculates distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100;
}

/**
 * Calculates compass bearing from point 1 to point 2 in degrees (0 = North, 90 = East, 180 = South, 270 = West)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360;
  return bearing;
}

/**
 * Formats distance into a human-readable Ukrainian string
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} м`;
  }
  return `${distanceKm.toFixed(1)} км`;
}

/**
 * Simulates random pedestrian walk movement within ~60-120 meters
 */
export function simulateWalkingStep(lat: number, lng: number): { lat: number; lng: number } {
  // 0.0001 deg lat is roughly 11 meters
  const deltaLat = (Math.random() - 0.5) * 0.0009; // ~100m
  const deltaLng = (Math.random() - 0.5) * 0.0012; // ~90m
  return {
    lat: Math.round((lat + deltaLat) * 10000) / 10000,
    lng: Math.round((lng + deltaLng) * 10000) / 10000,
  };
}
