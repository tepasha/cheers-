import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config on top of app.json. Keys come from the environment (a local `.env`, or EAS environment
 * variables for cloud builds), never from files in the repository:
 *   FIREBASE_*            Firebase web config, handed to the app through `extra.firebase`
 *   GOOGLE_MAPS_API_KEY   Google Maps SDK key for the Android build (iOS uses Apple Maps)
 * Expo CLI loads `.env` before it evaluates this file. See `.env.example`.
 */
const env = process.env;
const clean = (value: string | undefined): string | undefined => value?.trim().replace(/^["']+|["']+$/g, '') || undefined;

export default ({ config }: ConfigContext): ExpoConfig => {
  const appId = clean(env.FIREBASE_APP_ID);
  const mapsKey = clean(env.GOOGLE_MAPS_API_KEY);

  return {
    ...(config as ExpoConfig),
    android: {
      ...config.android,
      ...(mapsKey ? { config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } } } : {}),
    },
    extra: {
      ...config.extra,
      firebase: {
        apiKey: clean(env.FIREBASE_API_KEY),
        authDomain: clean(env.FIREBASE_AUTH_DOMAIN),
        projectId: clean(env.FIREBASE_PROJECT_ID),
        appId,
        storageBucket: clean(env.FIREBASE_STORAGE_BUCKET),
        // The web app id is `1:<messagingSenderId>:web:<hash>`
        messagingSenderId: appId?.split(':')[1],
        firestoreDatabaseId: clean(env.FIREBASE_FIRESTORE_DATABASE_ID),
      },
    },
  };
};
