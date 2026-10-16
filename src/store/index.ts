import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { encryptedAsyncStorage, encryptedEntryStorage } from './keystore';
import type { StringStorage } from './secureStorage';
import {
  getStoredState,
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  type PersistConfig,
  type PersistedState,
} from 'redux-persist';
import { createChatsPersistence, legacyChats } from './chatsStorage';

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
import outbox from './slices/outboxSlice';
import { normalizePersistedState } from './persistMigration';

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
  outbox,
});

/**
 * Slices that survive an app restart. `buddies` and `hangouts` are live Firestore mirrors and
 * `ui` is transient, so they are rebuilt on launch instead of being persisted.
 * `chats` survives too, but is saved one thread per entry (store/chatsStorage.ts), not with these.
 */
const PERSISTED_SLICES: Array<keyof ReturnType<typeof rootReducer>> = [
  'auth',
  'settings',
  'location',
  'friends',
  'notifications',
  'gamification',
  'meetups',
  'safety',
  'favorites',
  'outbox',
];

/**
 * `threadStorage` holds the chats, one encrypted entry per thread (store/chatsStorage.ts). On the first launch after
 * the change the chats still come from the root entry; getStoredState copies them per thread before hydration ends, and
 * the root entry drops them on its next write (they are no longer whitelisted).
 */
export function createAppStore(storage: StringStorage = encryptedAsyncStorage, threadStorage: StringStorage = storage === encryptedAsyncStorage ? encryptedEntryStorage : storage) {
  const chatsPersistence = createChatsPersistence(threadStorage);
  const config: PersistConfig<ReturnType<typeof rootReducer>> = {
    key: 'budmo-root',
    version: 2,
    storage,
    // throttle: batch rapid actions (typing bursts, GPS ticks) into one AsyncStorage write per second
    throttle: 1000,
    whitelist: PERSISTED_SLICES as string[],
    getStoredState: async (conf) => {
      const [root, chats] = await Promise.all([getStoredState(conf), chatsPersistence.load()]);
      if (chats) return { ...root, chats } as unknown as PersistedState;
      // First launch after the change: the chats are still in the root entry. They are copied out before hydration
      // ends, because the root entry drops them on its next write.
      const legacy = legacyChats((root as { chats?: unknown } | undefined)?.chats);
      if (legacy) await chatsPersistence.migrate(legacy);
      return root as PersistedState;
    },
    migrate: async (state) => normalizePersistedState(state),
  };
  const persistedReducer = persistReducer(config, rootReducer);

  const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefault) =>
      getDefault({
        // redux-persist actions carry functions; everything else in the store is plain JSON
        serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      }),
  });

  // Hydrated: from now on every change of the chats is saved per thread
  const persistor = persistStore(store, null, () => chatsPersistence.start(store));
  return { store, persistor, chatsPersistence };
}

export const { store, persistor, chatsPersistence } = createAppStore();

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
