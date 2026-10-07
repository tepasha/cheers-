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
import { pruneExpiredContent } from '../store/thunks/lifecycle';
import { selectCanUseApp } from '../store/selectors';
import { useFirestoreStreams, usePresence, useProfileSync } from './useCloudSync';
import { languageAutoDetected } from '../store/slices/settingsSlice';
import { locationUpdated } from '../store/slices/locationSlice';
import { networkStatusChanged } from '../store/slices/uiSlice';
import { getBatterySaverConfig } from '../logic/batterySaver';
import { detectLanguageFromGeo } from '../services/i18nService';
import { toUserGeoLocation } from '../services/locationService';
import { openChatFromPush, registerPush } from '../store/thunks/push';
import { chatOpenRequested } from '../store/slices/uiSlice';
import { navigationRef } from '../navigation/ref';
import { configureNotifications, onPushTokenChanged, subscribeToNotificationTaps } from '../services/systemNotifications';
import { flushOutbox } from '../store/thunks/outbox';

export function useOutbox() {
  const dispatch = useAppDispatch();
  const allowed = useAppSelector(selectCanUseApp);
  const online = useAppSelector((s) => s.ui.isOnline);
  const uid = useAppSelector((s) => s.auth.user.id);
  useEffect(() => {
    if (!allowed || !online) return;
    void dispatch(flushOutbox());
    const timer = setInterval(() => void dispatch(flushOutbox()), 5000);
    return () => clearInterval(timer);
  }, [dispatch, allowed, online, uid]);
}

const SESSION_CHECK_MS = 60_000;
const EXPIRY_PRUNE_MS = 60_000;
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

/** Follows the device position while the user has opted in to real GPS (not a simulated preset) */
export function useLocationTracking() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const isSimulated = useAppSelector((s) => s.location.current.isSimulated);
  const batterySaver = useAppSelector((s) => s.settings.batterySaver);
  const allowed = useAppSelector(selectCanUseApp);
  const userId = useAppSelector((s) => s.auth.user.id);

  useEffect(() => {
    if (isSimulated || !allowed) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    const config = getBatterySaverConfig(batterySaver);

    const checkPermission = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (cancelled || store.getState().auth.user.id !== userId) return false;
      if (!permission.granted) {
        subscription?.remove(); subscription = null;
        dispatch(locationUpdated({ ...store.getState().location.current, status: 'error' }));
      }
      return permission.granted;
    };
    let starting = false;
    const startTracking = async () => {
      if (starting) return;
      starting = true;
      try {
      if (!await checkPermission() || cancelled || subscription) return;

      const sub = await Location.watchPositionAsync(
        {
          accuracy: config.enableHighAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
          timeInterval: config.locationIntervalMs,
          distanceInterval: 30,
        },
        (position) => {
          if (cancelled || !selectCanUseApp(store.getState()) || store.getState().auth.user.id !== userId) return;
          const next = toUserGeoLocation(position.coords);
          const prev = store.getState().location.current;
          // Ignore jitter so idle GPS noise does not re-render every screen
          if (prev.status !== 'active' || Math.abs(next.lat - prev.lat) > MIN_MOVE_DEGREES || Math.abs(next.lng - prev.lng) > MIN_MOVE_DEGREES) {
            dispatch(locationUpdated(next));
          }
        }
      );

      if (cancelled) sub.remove();
      else subscription = sub;
      } catch (err) {
        if (!cancelled && store.getState().auth.user.id === userId) dispatch(locationUpdated({ ...store.getState().location.current, status: 'error' }));
        console.warn('Location tracking failed:', err);
      } finally { starting = false; }
    };
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void startTracking();
    });
    void startTracking();

    return () => {
      cancelled = true;
      foreground.remove();
      subscription?.remove();
    };
  }, [dispatch, store, isSimulated, batterySaver, allowed, userId]);
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
  // Registering a phone for pushes publishes a device document: not before the age is confirmed
  const allowed = useAppSelector(selectCanUseApp);
  const enabled = useAppSelector((s) => s.settings.push.webPushEnabled);
  const language = useAppSelector((s) => s.settings.language);

  useEffect(() => {
    configureNotifications();
  }, []);

  useEffect(() => {
    if (!allowed || !enabled) return;
    void dispatch(registerPush({ ask: false }));
    const stop = onPushTokenChanged(() => void dispatch(registerPush({ ask: false })));
    const timer = setInterval(() => AppState.currentState === 'active' && void dispatch(registerPush({ ask: false })), 10 * 60 * 1000);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && void dispatch(registerPush({ ask: false })));
    return () => { stop(); clearInterval(timer); sub.remove(); };
  }, [dispatch, allowed, enabled, language, userId]);
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
  const inApp = useAppSelector((s) => s.ui.authReady && selectCanUseApp(s));
  const known = useAppSelector((s) => (s.ui.pendingChatId ? s.chats.threads.some((t) => t.id === s.ui.pendingChatId) : false));
  const inboxReady = useAppSelector((s) => s.ui.inboxReady);
  const blocked = useAppSelector((s) => {
    const thread = s.chats.threads.find((t) => t.id === s.ui.pendingChatId);
    return thread && !thread.isGroup && s.safety.blockedUsers.some((b) => b.userId === thread.buddy.id);
  });

  useEffect(() => {
    if (!pending || !inApp || !navReady || !inboxReady || !navigationRef.isReady()) return;
    dispatch(chatOpenRequested(null));
    if (known && !blocked) navigationRef.navigate('ChatRoom', { chatId: pending });
    else navigationRef.navigate('Tabs', { screen: 'Chats' });
  }, [dispatch, pending, inApp, navReady, known, inboxReady, blocked]);
}

export function useAppLifecycle() {
  useOutbox();
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
