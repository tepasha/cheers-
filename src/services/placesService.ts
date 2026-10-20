import { httpsCallable } from 'firebase/functions';
import { firebaseConfigured, functions } from './firebase';
import { readPlaceVenues, type PlaceVenue, type PlacesQuery } from '../logic/places';
import type { AppLanguage } from '../types';

/** Bars, pubs and restaurants in a circle, from Google Places through the callable nearbyVenues */
export async function fetchNearbyPlaces(query: PlacesQuery, language: AppLanguage): Promise<PlaceVenue[]> {
  if (!firebaseConfigured) return [];
  const result = await httpsCallable<PlacesQuery & { language: AppLanguage }, unknown>(functions, 'nearbyVenues')({ ...query, language });
  return readPlaceVenues(result.data);
}
