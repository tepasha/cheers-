import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { RootState } from '../store';
import { selectCanUseApp } from '../store/selectors';
import { syncChatInbox } from '../store/thunks/inbox';
import { buddiesSynced } from '../store/slices/buddiesSlice';
import { syncHangouts } from '../store/thunks/lifecycle';
import { meetupsReconciled } from '../store/slices/meetupsSlice';
import { restoreFavoritesFromCloud } from '../store/thunks/favorites';
import { syncBlocksFromCloud } from '../store/thunks/safety';
import { getBatterySaverConfig } from '../logic/batterySaver';
import { coarseCoordinate } from '../logic/privacy';
import { PRESENCE_INTERVAL_MS, snapToQueryGrid } from '../logic/nearby';
import { firestoreSyncService } from '../services/firestoreSyncService';
import { queueSync } from '../store/thunks/outbox';
import { captureSession } from '../store/sessionGuard';

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
  const generation = useAppSelector((s) => s.ui.sessionGeneration);

  useEffect(() => {
    if (!allowed) return;
    const current = captureSession(store.getState);
    const { realtimeSyncIntervalMs } = getBatterySaverConfig(batterySaver);
    return firestoreSyncService.subscribeToLiveHangouts(
      store.getState().location.current,
      (items) => { if (current()) dispatch(syncHangouts(items)); },
      { throttleMs: batterySaver ? realtimeSyncIntervalMs : 0 }
    );
  }, [dispatch, store, allowed, batterySaver, userId, generation]);

  // "People nearby" is a query around the position, on a ~550 m grid so that walking does not re-subscribe each step
  const gridLat = useAppSelector((s) => snapToQueryGrid(s.location.current.lat));
  const gridLng = useAppSelector((s) => snapToQueryGrid(s.location.current.lng));
  useEffect(() => {
    if (!allowed) return;
    const current = captureSession(store.getState);
    return firestoreSyncService.subscribeToPublicBuddies(userId, { lat: gridLat, lng: gridLng }, (items) => { if (current()) dispatch(buddiesSynced(items)); });
  }, [dispatch, store, allowed, userId, gridLat, gridLng, generation]);

  useEffect(() => {
    if (!allowed) return;
    const current = captureSession(store.getState);
    return firestoreSyncService.subscribeToMeetups((items) => {
      if (!current()) return;
      const pendingIds = store.getState().outbox.jobs
        .filter((job) => job.owner === userId && job.method === 'saveMeetup')
        .map((job) => (job.args[0] as { id?: string } | undefined)?.id)
        .filter((id): id is string => typeof id === 'string');
      dispatch(meetupsReconciled({ items, pendingIds }));
    });
  }, [dispatch, store, allowed, userId, generation]);

  useEffect(() => {
    if (allowed) void dispatch(restoreFavoritesFromCloud());
  }, [dispatch, allowed, userId, generation]);

  useEffect(() => {
    if (allowed) void dispatch(syncBlocksFromCloud());
  }, [dispatch, allowed, userId, generation]);

  useEffect(() => {
    if (!allowed) return;
    const current = captureSession(store.getState);
    return firestoreSyncService.subscribeToMyChats(userId, (chats) => { if (current()) void dispatch(syncChatInbox(chats)); });
  }, [dispatch, store, allowed, userId, generation]);
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
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const allowed = useAppSelector(selectCanUseApp);
  const location = useAppSelector((s) => s.location.current);
  const shareLocation = useAppSelector((s) => s.settings.shareLocation === true) && !location.isSimulated && location.status === 'active';
  // An approximate area is published, so smaller GPS movements do not cause a write.
  const lat = coarseCoordinate(location.lat);
  const lng = coarseCoordinate(location.lng);

  useEffect(() => {
    if (!allowed || !user.id) return;
    const timer = setTimeout(() => {
      dispatch(queueSync('saveUserProfile', 'profile', [{
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        shareLocation,
        lat: shareLocation ? lat : undefined,
        lng: shareLocation ? lng : undefined,
        age: user.age,
        tagline: user.tagline,
        bio: user.bio,
        preferredDrinks: user.preferredDrinks,
        currentMood: user.currentMood,
        paymentRule: user.paymentRule === 'not_specified' ? undefined : user.paymentRule,
      }]));
    }, PROFILE_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dispatch, allowed, user.id, user.name, user.avatar, user.age, user.tagline, user.bio, user.preferredDrinks, user.currentMood, user.paymentRule, shareLocation, lat, lng]);
}
