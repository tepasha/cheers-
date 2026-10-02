import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config on top of app.json. Keys come from the environment (a local `.env`, or EAS environment
 * variables for cloud builds), never from files in the repository:
 *   FIREBASE_*            Firebase web config, handed to the app through `extra.firebase`
 *   GOOGLE_MAPS_API_KEY   Google Maps SDK key for the Android build (iOS uses Apple Maps)
 *   PRIVACY_POLICY_URL, TERMS_URL  Public https pages the stores require; the app links to them when set
 *   GOOGLE_SERVICES_JSON  Path to google-services.json (FCM, Android push). On EAS: a file environment variable.
 * OTA updates (expo-updates) switch on by themselves once `extra.eas.projectId` exists (`eas init`); until then the
 * app is built with updates disabled, so nothing tries to reach a project that is not there yet.
 * Expo CLI loads `.env` before it evaluates this file. See `.env.example`.
 */
const env = process.env;
const clean = (value: string | undefined): string | undefined => value?.trim().replace(/^["']+|["']+$/g, '') || undefined;

export default ({ config }: ConfigContext): ExpoConfig => {
  const appId = clean(env.FIREBASE_APP_ID);
  const mapsKey = clean(env.GOOGLE_MAPS_API_KEY);
  const servicesFile = clean(env.GOOGLE_SERVICES_JSON);
  const projectId: string | undefined = config.extra?.eas?.projectId;

  return {
    ...(config as ExpoConfig),
    // The runtime version is a hash of everything native (modules, permissions, config plugins). An OTA update only
    // reaches binaries with the same hash, so it can never ship JS that needs native code an installed app lacks.
    // If native code changed, updates simply stop reaching old binaries until the new build is out.
    runtimeVersion: { policy: 'fingerprint' },
    updates: projectId
      ? { url: `https://u.expo.dev/${projectId}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 }
      : { enabled: false },
    android: {
      ...config.android,
      ...(servicesFile ? { googleServicesFile: servicesFile } : {}),
      ...(mapsKey ? { config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } } } : {}),
    },
    extra: {
      ...config.extra,
      legal: { privacyPolicyUrl: clean(env.PRIVACY_POLICY_URL), termsUrl: clean(env.TERMS_URL) },
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
