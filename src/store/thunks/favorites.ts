import { FavoriteVenueItem } from '../../types';
import type { AppThunk } from '../hooks';
import { favoriteRemoved, favoriteSaved, favoritesReplaced } from '../slices/favoritesSlice';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { analyticsService } from '../../services/analyticsService';
import { sounds } from '../../services/soundService';

export const saveFavoriteVenue =
  (venue: FavoriteVenueItem): AppThunk =>
  (dispatch, getState) => {
    const toSave = { ...venue, createdAt: venue.createdAt ?? new Date().toISOString() };
    dispatch(favoriteSaved(toSave));
    sounds.playPop();
    analyticsService.trackVenueFavorite(venue.id, venue.name, true);
    void firestoreSyncService.saveFavoriteVenue(getState().auth.user.id, toSave);
  };

export const removeFavoriteVenue =
  (venueId: string): AppThunk =>
  (dispatch, getState) => {
    const venue = getState().favorites.items.find((v) => v.id === venueId);
    dispatch(favoriteRemoved(venueId));
    sounds.playTap();
    if (venue) analyticsService.trackVenueFavorite(venue.id, venue.name, false);
    void firestoreSyncService.removeFavoriteVenue(getState().auth.user.id, venueId);
  };

/** Pulls the signed-in user's favorites from Firestore and merges them with the local list */
export const restoreFavoritesFromCloud =
  (): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const state = getState();
    if (!state.auth.user.isLoggedIn) return;
    const cloud = await firestoreSyncService.getUserFavorites(state.auth.user.id);
    if (cloud.length === 0) return;

    const merged = new Map(state.favorites.items.map((v) => [v.id, v]));
    cloud.forEach((v) => merged.set(v.id, v));
    dispatch(favoritesReplaced(Array.from(merged.values())));
  };
