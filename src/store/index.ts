import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { encryptedAsyncStorage } from './keystore';
import type { StringStorage } from './secureStorage';
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';

import auth from './slices/authSlice';
import settings from './slices/settingsSlice';
import location from './slices/locationSlice';
import buddies from './slices/buddiesSlice';
import hangouts from './slices/hangoutsSlice';
import chats from './slices/chatsSlice';
import friends from './slices/friendsSlice';
import notifications from './slices/notificationsSlice';
import gamification from './slices/gamificationSlice';
import meetups from './slices/meetupsSlice';
import safety from './slices/safetySlice';
import favorites from './slices/favoritesSlice';
import ui from './slices/uiSlice';

export const rootReducer = combineReducers({
  auth,
  settings,
  location,
  buddies,
  hangouts,
  chats,
  friends,
  notifications,
  gamification,
  meetups,
  safety,
  favorites,
  ui,
});

/**
 * Slices that survive an app restart. `buddies` and `hangouts` are live Firestore mirrors and
 * `ui` is transient, so they are rebuilt on launch instead of being persisted.
 */
const PERSISTED_SLICES: Array<keyof ReturnType<typeof rootReducer>> = [
  'auth',
  'settings',
  'location',
  'chats',
  'friends',
  'notifications',
  'gamification',
  'meetups',
  'safety',
  'favorites',
];

export function createAppStore(storage: StringStorage = encryptedAsyncStorage) {
  const persistedReducer = persistReducer(
    // throttle: batch rapid actions (typing bursts, GPS ticks) into one AsyncStorage write per second
    { key: 'budmo-root', version: 1, storage, throttle: 1000, whitelist: PERSISTED_SLICES as string[] },
    rootReducer
  );

  const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefault) =>
      getDefault({
        // redux-persist actions carry functions; everything else in the store is plain JSON
        serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      }),
  });

  return { store, persistor: persistStore(store) };
}

export const { store, persistor } = createAppStore();

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
