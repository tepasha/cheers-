import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { RootState } from '../store';
import { selectCanUseApp } from '../store/selectors';
import { syncChatInbox } from '../store/thunks/inbox';
import { buddiesSynced } from '../store/slices/buddiesSlice';
import { syncHangouts } from '../store/thunks/lifecycle';
import { meetupsMerged } from '../store/slices/meetupsSlice';
import { restoreFavoritesFromCloud } from '../store/thunks/favorites';
import { syncBlocksFromCloud } from '../store/thunks/safety';
import { getBatterySaverConfig } from '../logic/batterySaver';
import { coarseCoordinate } from '../logic/privacy';
import { PRESENCE_INTERVAL_MS, snapToQueryGrid } from '../logic/nearby';
import { firestoreSyncService } from '../services/firestoreSyncService';

/**
 * Everything that talks to other people's data lives here, and every hook is behind selectCanUseApp: signed in,
 * e-mail verified and the age confirmed (21+). A first Google sign-in has none of its birth date yet, so while it sits
 * on the birth-date screen nothing is subscribed and nothing is published.
 */

const PROFILE_SYNC_DEBOUNCE_MS = 1_500;

/**
 * Firestore live streams. Subscriptions are keyed on identity / battery mode only: distances are
 * derived in selectors, so a GPS tick never tears down and recreates a listener.
 */
export function useFirestoreStreams() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const userId = useAppSelector((s) => s.auth.user.id);
  const allowed = useAppSelector(selectCanUseApp);
  const batterySaver = useAppSelector((s) => s.settings.batterySaver);

  useEffect(() => {
    if (!allowed) return;
    const { realtimeSyncIntervalMs } = getBatterySaverConfig(batterySaver);
    return firestoreSyncService.subscribeToLiveHangouts(
      store.getState().location.current,
      (items) => dispatch(syncHangouts(items)),
      { throttleMs: batterySaver ? realtimeSyncIntervalMs : 0 }
    );
  }, [dispatch, store, allowed, batterySaver]);

  // "People nearby" is a query around the position, on a ~550 m grid so that walking does not re-subscribe each step
  const gridLat = useAppSelector((s) => snapToQueryGrid(s.location.current.lat));
  const gridLng = useAppSelector((s) => snapToQueryGrid(s.location.current.lng));
  useEffect(() => {
    if (!allowed) return;
    return firestoreSyncService.subscribeToPublicBuddies(userId, { lat: gridLat, lng: gridLng }, (items) => dispatch(buddiesSynced(items)));
  }, [dispatch, allowed, userId, gridLat, gridLng]);

  useEffect(() => {
    if (!allowed) return;
    return firestoreSyncService.subscribeToMeetups((items) => dispatch(meetupsMerged(items)));
  }, [dispatch, allowed]);

  useEffect(() => {
    if (allowed) void dispatch(restoreFavoritesFromCloud());
  }, [dispatch, allowed, userId]);

  useEffect(() => {
    if (allowed) void dispatch(syncBlocksFromCloud());
  }, [dispatch, allowed, userId]);

  useEffect(() => {
    if (!allowed) return;
    return firestoreSyncService.subscribeToMyChats(userId, (chats) => void dispatch(syncChatInbox(chats)));
  }, [dispatch, allowed, userId]);
}

/** Lets other people see that this person is around: once on launch, on every return to the app, and every 10 minutes */
export function usePresence() {
  const userId = useAppSelector((s) => s.auth.user.id);
  const allowed = useAppSelector(selectCanUseApp);

  useEffect(() => {
    if (!allowed || !userId) return;
    const touch = () => void firestoreSyncService.touchPresence(userId);
    touch();
    const timer = setInterval(() => AppState.currentState === 'active' && touch(), PRESENCE_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && touch());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [allowed, userId]);
}

/** Publishes identity + position to the public profile (debounced; never touches other fields) */
export function useProfileSync() {
  const user = useAppSelector((s) => s.auth.user);
  const allowed = useAppSelector(selectCanUseApp);
  const location = useAppSelector((s) => s.location.current);
  // Only a ~20 m grid is ever published, so a smaller GPS move must not cause a Firestore write
  const lat = coarseCoordinate(location.lat);
  const lng = coarseCoordinate(location.lng);

  useEffect(() => {
    if (!allowed || !user.id) return;
    const timer = setTimeout(() => {
      void firestoreSyncService.saveUserProfile({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        locationName: location.locationName,
        lat,
        lng,
        age: user.age,
      });
    }, PROFILE_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [allowed, user.id, user.name, user.avatar, user.age, location.locationName, lat, lng]);
}
