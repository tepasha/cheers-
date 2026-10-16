import { useEffect, useRef, useState } from 'react';
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
import { snapToQueryGrid } from '../logic/nearby';
import { feedCells, nextFeedCell } from '../logic/feedArea';
import { firestoreSyncService } from '../services/firestoreSyncService';
import { queueSync } from '../store/thunks/outbox';
import { syncedKey } from '../store/slices/outboxSlice';
import { captureSession } from '../store/sessionGuard';
import { useAppInForeground } from './useAppInForeground';
import { useDemanded } from '../services/demand';

/**
 * Everything that talks to other people's data lives here, and every hook is behind selectCanUseApp: signed in,
 * e-mail verified and the age confirmed (21+). A first Google sign-in has none of its birth date yet, so while it sits
 * on the birth-date screen nothing is subscribed and nothing is published.
 */

const PROFILE_SYNC_DEBOUNCE_MS = 1_500;

/**
 * Firestore live streams. Subscriptions are keyed on identity / battery mode only: distances are
 * derived in selectors, so a GPS tick never tears down and recreates a listener.
 * The table and meetup feeds stop while the app is in the background (on Android the process and its connection stay
 * up, so every change in them would keep downloading for nobody); back in the foreground the same query resumes from
 * the cached result and fetches only what changed. Battery saver keeps them to the screens that show them. The chat
 * inbox keeps running: unread badges and opening a chat from a push rely on it.
 * The people nearby are asked for only while a screen or sheet shows them (services/demand.ts).
 * Tables and meetups come from the area around the person (logic/feedArea.ts): the listeners move only when the
 * person moves well into another ~20 km cell, never on a GPS tick.
 */
export function useFirestoreStreams() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const userId = useAppSelector((s) => s.auth.user.id);
  const allowed = useAppSelector(selectCanUseApp);
  const batterySaver = useAppSelector((s) => s.settings.batterySaver);
  const generation = useAppSelector((s) => s.ui.sessionGeneration);
  const foreground = useAppInForeground();
  const peopleInView = useDemanded('people');
  const feedsInView = useDemanded('feeds');
  const { peopleRefreshMs, feedsOnlyInView } = getBatterySaverConfig(batterySaver);
  const feedsLive = allowed && foreground && (!feedsOnlyInView || feedsInView);
  // The selector remembers the cell it chose last, which is what keeps a boundary from flapping (nextFeedCell)
  const [pickFeedCell] = useState(() => {
    let last: string | null = null;
    return (s: RootState) => (last = nextFeedCell(last, s.location.current));
  });
  const feedCell = useAppSelector(pickFeedCell);

  useEffect(() => {
    if (!feedsLive) return;
    const current = captureSession(store.getState);
    return firestoreSyncService.subscribeToLiveHangouts(userId, store.getState().location.current, feedCells(feedCell), (items) => { if (current()) dispatch(syncHangouts(items)); });
  }, [dispatch, store, feedsLive, userId, generation, feedCell]);

  // "People nearby" is a query around the position, on a ~550 m grid so that walking does not re-subscribe each step.
  // A screen that shows people again within the refresh time keeps what the store holds and asks once that runs out.
  const gridLat = useAppSelector((s) => snapToQueryGrid(s.location.current.lat));
  const gridLng = useAppSelector((s) => snapToQueryGrid(s.location.current.lng));
  const peopleFetched = useRef<{ key: string; at: number } | null>(null);
  useEffect(() => {
    if (!allowed || !foreground || !peopleInView) return;
    const current = captureSession(store.getState);
    const key = `${userId}@${gridLat},${gridLng}`;
    const last = peopleFetched.current;
    const wait = last?.key === key ? Math.max(0, last.at + peopleRefreshMs - Date.now()) : 0;
    let stop: (() => void) | undefined;
    const start = setTimeout(() => {
      stop = firestoreSyncService.subscribeToPublicBuddies(userId, { lat: gridLat, lng: gridLng }, (items) => {
        if (!current()) return;
        peopleFetched.current = { key, at: Date.now() };
        dispatch(buddiesSynced(items));
      }, peopleRefreshMs);
    }, wait);
    return () => {
      clearTimeout(start);
      stop?.();
    };
  }, [dispatch, store, allowed, foreground, peopleInView, peopleRefreshMs, userId, gridLat, gridLng, generation]);

  useEffect(() => {
    if (!feedsLive) return;
    const current = captureSession(store.getState);
    return firestoreSyncService.subscribeToMeetups(userId, feedCells(feedCell), (items) => {
      if (!current()) return;
      const pendingIds = store.getState().outbox.jobs
        .filter((job) => job.owner === userId && job.method === 'saveMeetup')
        .map((job) => (job.args[0] as { id?: string } | undefined)?.id)
        .filter((id): id is string => typeof id === 'string');
      dispatch(meetupsReconciled({ items, pendingIds }));
    });
  }, [dispatch, store, feedsLive, userId, generation, feedCell]);

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

/**
 * Publishes identity + position to the public profile (debounced; never touches other fields). A profile identical to
 * the one last saved (typically: the previous launch) is not written again, unless an older change is still queued.
 */
export function useProfileSync() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
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
      const args = [{
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
      }];
      const { jobs, synced } = store.getState().outbox;
      const pending = jobs.some((j) => j.owner === user.id && j.key === 'profile');
      if (!pending && synced?.[syncedKey(user.id, 'profile')] === JSON.stringify(args)) return;
      dispatch(queueSync('saveUserProfile', 'profile', args));
    }, PROFILE_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dispatch, store, allowed, user.id, user.name, user.avatar, user.age, user.tagline, user.bio, user.preferredDrinks, user.currentMood, user.paymentRule, shareLocation, lat, lng]);
}
