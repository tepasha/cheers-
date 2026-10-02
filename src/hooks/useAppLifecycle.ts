import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { RootState } from '../store';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { enforceSessionExpiry, handleFirebaseUser, touchSession } from '../store/thunks/auth';
import { syncChatInbox } from '../store/thunks/inbox';
import { buddiesSynced } from '../store/slices/buddiesSlice';
import { pruneExpiredContent, syncHangouts } from '../store/thunks/lifecycle';
import { meetupsMerged } from '../store/slices/meetupsSlice';
import { languageAutoDetected } from '../store/slices/settingsSlice';
import { locationUpdated } from '../store/slices/locationSlice';
import { networkStatusChanged } from '../store/slices/uiSlice';
import { getBatterySaverConfig } from '../logic/batterySaver';
import { coarseCoordinate } from '../logic/privacy';
import { PRESENCE_INTERVAL_MS, snapToQueryGrid } from '../logic/nearby';
import { detectLanguageFromGeo } from '../services/i18nService';
import { firestoreSyncService } from '../services/firestoreSyncService';
import { toUserGeoLocation } from '../services/locationService';
import { restoreFavoritesFromCloud } from '../store/thunks/favorites';
import { syncBlocksFromCloud } from '../store/thunks/safety';
import { openChatFromPush, registerPush } from '../store/thunks/push';
import { chatOpenRequested } from '../store/slices/uiSlice';
import { navigationRef } from '../navigation/ref';
import { configureNotifications, onPushTokenChanged, subscribeToNotificationTaps } from '../services/systemNotifications';

const SESSION_CHECK_MS = 60_000;
const EXPIRY_PRUNE_MS = 60_000;
const PROFILE_SYNC_DEBOUNCE_MS = 1_500;
const MIN_MOVE_DEGREES = 0.0003; // ~30 m

/** Mirrors Firebase Auth (the source of truth) into Redux, including the session restored on launch */
export function useAuthSync() {
  const dispatch = useAppDispatch();

  useEffect(() => onAuthStateChanged(auth, (fb) => dispatch(handleFirebaseUser(fb))), [dispatch]);
}

/** 36-hour rolling session: extended on launch and every foreground, enforced once a minute */
export function useSessionLifecycle() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(touchSession());

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') dispatch(touchSession());
    });
    const timer = setInterval(() => dispatch(enforceSessionExpiry()), SESSION_CHECK_MS);

    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [dispatch]);
}

export function useNetworkStatus() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let mounted = true;
    Network.getNetworkStateAsync()
      .then((s) => mounted && dispatch(networkStatusChanged(s.isInternetReachable !== false)))
      .catch(() => {});

    const sub = Network.addNetworkStateListener((s) => dispatch(networkStatusChanged(s.isInternetReachable !== false)));
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [dispatch]);
}

/**
 * Firestore live streams. Subscriptions are keyed on identity / battery mode only: distances are
 * derived in selectors, so a GPS tick never tears down and recreates a listener.
 */
export function useFirestoreStreams() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const userId = useAppSelector((s) => s.auth.user.id);
  // Firestore rules only serve verified accounts, so nothing is subscribed before that
  const isLoggedIn = useAppSelector((s) => s.auth.user.isLoggedIn && s.auth.user.emailVerified === true);
  const batterySaver = useAppSelector((s) => s.settings.batterySaver);

  useEffect(() => {
    if (!isLoggedIn) return;
    const { realtimeSyncIntervalMs } = getBatterySaverConfig(batterySaver);
    return firestoreSyncService.subscribeToLiveHangouts(
      store.getState().location.current,
      (items) => dispatch(syncHangouts(items)),
      { throttleMs: batterySaver ? realtimeSyncIntervalMs : 0 }
    );
  }, [dispatch, store, isLoggedIn, batterySaver]);

  // "People nearby" is a query around the position, on a ~550 m grid so that walking does not re-subscribe each step
  const gridLat = useAppSelector((s) => snapToQueryGrid(s.location.current.lat));
  const gridLng = useAppSelector((s) => snapToQueryGrid(s.location.current.lng));
  useEffect(() => {
    if (!isLoggedIn) return;
    return firestoreSyncService.subscribeToPublicBuddies(userId, { lat: gridLat, lng: gridLng }, (items) => dispatch(buddiesSynced(items)));
  }, [dispatch, isLoggedIn, userId, gridLat, gridLng]);

  useEffect(() => {
    if (!isLoggedIn) return;
    return firestoreSyncService.subscribeToMeetups((items) => dispatch(meetupsMerged(items)));
  }, [dispatch, isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) void dispatch(restoreFavoritesFromCloud());
  }, [dispatch, isLoggedIn, userId]);

  useEffect(() => {
    if (isLoggedIn) void dispatch(syncBlocksFromCloud());
  }, [dispatch, isLoggedIn, userId]);

  useEffect(() => {
    if (!isLoggedIn) return;
    return firestoreSyncService.subscribeToMyChats(userId, (chats) => void dispatch(syncChatInbox(chats)));
  }, [dispatch, isLoggedIn, userId]);
}

/** Lets other people see that this person is around: once on launch, on every return to the app, and every 10 minutes */
export function usePresence() {
  const userId = useAppSelector((s) => s.auth.user.id);
  const verified = useAppSelector((s) => s.auth.user.isLoggedIn && s.auth.user.emailVerified === true);

  useEffect(() => {
    if (!verified || !userId) return;
    const touch = () => void firestoreSyncService.touchPresence(userId);
    touch();
    const timer = setInterval(() => AppState.currentState === 'active' && touch(), PRESENCE_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && touch());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [verified, userId]);
}

/**
 * Tables live 4 hours and meetups leave the lists a day after they start. The Firestore queries already exclude the
 * expired ones, but a feed that stays quiet sends no snapshot, so what is on screen is pruned on a timer as well.
 */
export function useExpiryPruning() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const prune = () => {
      dispatch(pruneExpiredContent());
    };
    prune();
    const timer = setInterval(prune, EXPIRY_PRUNE_MS);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && prune());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [dispatch]);
}

/** Publishes identity + position to the public profile (debounced; never touches other fields) */
export function useProfileSync() {
  const user = useAppSelector((s) => s.auth.user);
  const location = useAppSelector((s) => s.location.current);
  // Only ~1 km steps are ever published, so a 30 m GPS move must not cause a Firestore write
  const lat = coarseCoordinate(location.lat);
  const lng = coarseCoordinate(location.lng);

  useEffect(() => {
    if (!user.isLoggedIn || !user.emailVerified || !user.id) return;
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
  }, [user.isLoggedIn, user.emailVerified, user.id, user.name, user.avatar, user.age, location.locationName, lat, lng]);
}

/** Follows the device position while the user has opted in to real GPS (not a simulated preset) */
export function useLocationTracking() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const isSimulated = useAppSelector((s) => s.location.current.isSimulated);
  const batterySaver = useAppSelector((s) => s.settings.batterySaver);

  useEffect(() => {
    if (isSimulated) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    const config = getBatterySaverConfig(batterySaver);

    (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted || cancelled) return;

      const sub = await Location.watchPositionAsync(
        {
          accuracy: config.enableHighAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
          timeInterval: config.locationIntervalMs,
          distanceInterval: 30,
        },
        (position) => {
          const next = toUserGeoLocation(position.coords);
          const prev = store.getState().location.current;
          // Ignore jitter so idle GPS noise does not re-render every screen
          if (Math.abs(next.lat - prev.lat) > MIN_MOVE_DEGREES || Math.abs(next.lng - prev.lng) > MIN_MOVE_DEGREES) {
            dispatch(locationUpdated(next));
          }
        }
      );

      if (cancelled) sub.remove();
      else subscription = sub;
    })().catch((err) => console.warn('Location tracking failed:', err));

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [dispatch, store, isSimulated, batterySaver]);
}

/** Re-detects the UI language from the position until the user picks one manually */
export function useLanguageAutoDetect() {
  const dispatch = useAppDispatch();
  const lat = useAppSelector((s) => s.location.current.lat);
  const lng = useAppSelector((s) => s.location.current.lng);

  useEffect(() => {
    const detected = detectLanguageFromGeo({ lat, lng });
    dispatch(languageAutoDetected({ lang: detected.lang, hint: detected.locationHint }));
  }, [dispatch, lat, lng]);
}

/**
 * Keeps this phone registered for chat pushes while the user is signed in with notifications on. Runs again when
 * the language changes (the server localizes the text per device) and when the OS rotates the push token.
 */
export function usePushRegistration() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user.id);
  const verified = useAppSelector((s) => s.auth.user.isLoggedIn && s.auth.user.emailVerified === true);
  const enabled = useAppSelector((s) => s.settings.push.webPushEnabled);
  const language = useAppSelector((s) => s.settings.language);

  useEffect(() => {
    configureNotifications();
  }, []);

  useEffect(() => {
    if (!verified || !enabled) return;
    void dispatch(registerPush({ ask: false }));
    return onPushTokenChanged(() => void dispatch(registerPush({ ask: false })));
  }, [dispatch, verified, enabled, language, userId]);
}

/** Taps on a chat notification (also the one that launched the app) ask the navigator for that chat */
export function usePushTaps() {
  const dispatch = useAppDispatch();
  useEffect(() => subscribeToNotificationTaps((chatId) => dispatch(openChatFromPush(chatId))), [dispatch]);
}

/**
 * Opens the chat a notification asked for once the navigator is mounted and the user is in the main app.
 * A chat this device does not have yet (it arrives with the inbox sync) falls back to the chat list.
 */
export function usePendingChatOpen(navReady: boolean) {
  const dispatch = useAppDispatch();
  const pending = useAppSelector((s) => s.ui.pendingChatId);
  const inApp = useAppSelector((s) => s.ui.authReady && s.auth.user.isLoggedIn && s.auth.user.emailVerified === true);
  const known = useAppSelector((s) => (s.ui.pendingChatId ? s.chats.threads.some((t) => t.id === s.ui.pendingChatId) : false));

  useEffect(() => {
    if (!pending || !inApp || !navReady || !navigationRef.isReady()) return;
    dispatch(chatOpenRequested(null));
    if (known) navigationRef.navigate('ChatRoom', { chatId: pending });
    else navigationRef.navigate('Tabs', { screen: 'Chats' });
  }, [dispatch, pending, inApp, navReady, known]);
}

export function useAppLifecycle() {
  useAuthSync();
  usePushRegistration();
  usePushTaps();
  useSessionLifecycle();
  useNetworkStatus();
  useFirestoreStreams();
  useExpiryPruning();
  usePresence();
  useProfileSync();
  useLocationTracking();
  useLanguageAutoDetect();
}
