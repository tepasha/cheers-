import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config on top of app.json. Keys come from the environment (a local `.env`, or EAS environment
 * variables for cloud builds), never from files in the repository:
 *   FIREBASE_*            Firebase web config, handed to the app through `extra.firebase`
 *   GOOGLE_MAPS_API_KEY   Google Maps SDK key for the Android build (iOS uses Apple Maps)
 *   PRIVACY_POLICY_URL, TERMS_URL  Public https pages the stores require; the app links to them (LegalLinks)
 *   GOOGLE_WEB_CLIENT_ID  Web OAuth client of the Firebase project (falls back to FIREBASE_OAUTH_CLIENT_ID); needed for Google sign-in
 *   GOOGLE_IOS_CLIENT_ID  iOS OAuth client; also registers its reversed URL scheme in the iOS app
 *   GOOGLE_SERVICES_JSON  Path to google-services.json (FCM, Android push). On EAS: a file environment variable.
 * Locally all of them are optional (demo mode without FIREBASE_*); preview and production builds refuse to start
 * without any of them (releaseConfigProblems below). On EAS every one of them must have the visibility "Plain text"
 * or "Sensitive", never "Secret": `eas update` (and `eas env:exec`) cannot read Secret variables, so an OTA update
 * would ship without them (a Firebase-less, demo-mode app) although the store build had them.
 * OTA updates (expo-updates) switch on by themselves once `extra.eas.projectId` exists (`eas init`); until then the
 * app is built with updates disabled, so nothing tries to reach a project that is not there yet.
 * Expo CLI loads `.env` before it evaluates this file. See `.env.example`.
 */
const env = process.env;
const clean = (value: string | undefined): string | undefined => value?.trim().replace(/^["']+|["']+$/g, '') || undefined;

const isHttpsUrl = (value: string | undefined): boolean => {
  try {
    return new URL(value ?? '').protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * What a release build cannot do without. Every one of these used to fall back silently: no Terms/Privacy links
 * (App Store 5.1.1(i), Play User Data policy), Firestore calls going to the '(default)' database whose rules this repo
 * never deploys, an Android Map tab that crashes without the Maps key, no FCM push without google-services.json, a
 * Google button that only shows a configuration error. CI runs the same list earlier, before a build is queued
 * (`scripts/release-check.mjs --env` through `eas env:exec`); tests/unit/scripts/releaseCheck.test.ts keeps the two
 * in step. `platform` is unset outside a build worker: then both platforms' needs are checked.
 */
export function releaseConfigProblems(projectRoot: string, platform?: string): string[] {
  const problems: string[] = [];
  const need = (name: string, value: string | undefined) => {
    if (!value) problems.push(`${name} is not set`);
  };
  for (const name of ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_APP_ID', 'FIREBASE_STORAGE_BUCKET']) {
    need(name, clean(env[name]));
  }
  const databaseId = clean(env.FIREBASE_FIRESTORE_DATABASE_ID);
  need('FIREBASE_FIRESTORE_DATABASE_ID', databaseId);
  if (databaseId === '(default)') problems.push('FIREBASE_FIRESTORE_DATABASE_ID must name the database firestore.rules and the functions are deployed to, not (default)');
  need('GOOGLE_WEB_CLIENT_ID (or FIREBASE_OAUTH_CLIENT_ID)', clean(env.GOOGLE_WEB_CLIENT_ID) ?? clean(env.FIREBASE_OAUTH_CLIENT_ID));
  for (const name of ['SUPPORT_EMAIL', 'SENTRY_DSN', 'SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN']) need(name, clean(env[name]));
  const supportEmail = clean(env.SUPPORT_EMAIL);
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) problems.push('SUPPORT_EMAIL must be a valid email address');
  if (clean(env.SENTRY_DSN) && !isHttpsUrl(clean(env.SENTRY_DSN))) problems.push('SENTRY_DSN must be an https URL');
  if (clean(env.DONATION_URL) && !isHttpsUrl(clean(env.DONATION_URL))) problems.push('DONATION_URL must be an https URL');
  for (const name of ['PRIVACY_POLICY_URL', 'TERMS_URL']) {
    if (!isHttpsUrl(clean(env[name]))) problems.push(`${name} must be a public https URL`);
  }
  if (platform !== 'ios') {
    need('GOOGLE_MAPS_API_KEY', clean(env.GOOGLE_MAPS_API_KEY));
    const servicesFile = clean(env.GOOGLE_SERVICES_JSON);
    need('GOOGLE_SERVICES_JSON', servicesFile);
    if (servicesFile && !existsSync(resolve(projectRoot, servicesFile))) problems.push(`GOOGLE_SERVICES_JSON points at a file that does not exist (${servicesFile})`);
  }
  if (platform !== 'android') {
    need('GOOGLE_IOS_CLIENT_ID', clean(env.GOOGLE_IOS_CLIENT_ID));
    const classification = clean(env.EXPORT_ENCRYPTION_CLASSIFICATION);
    need('EXPORT_ENCRYPTION_CLASSIFICATION', classification);
    if (classification && !['exempt', 'non-exempt'].includes(classification)) problems.push('EXPORT_ENCRYPTION_CLASSIFICATION must be exempt or non-exempt after operator review');
  }
  return problems;
}

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  // EAS build workers set EAS_BUILD_PROFILE and EAS_BUILD_PLATFORM; nothing else does (not `eas update`, not Expo CLI
  // on a laptop or in CI), so local work and demo mode are untouched. Release profiles fail closed here, where the
  // values that end up in the binary are known (a Secret variable is visible on the worker, so CI's check is stricter).
  const buildProfile = env.EAS_BUILD_PROFILE;
  if (buildProfile === 'preview' || buildProfile === 'production') {
    const problems = releaseConfigProblems(projectRoot, env.EAS_BUILD_PLATFORM);
    if (problems.length > 0) {
      throw new Error(
        `The EAS environment of the "${buildProfile}" build is incomplete:\n  - ${problems.join('\n  - ')}\n` +
          'Set the variables with `eas env:create` (visibility Plain text or Sensitive), see DEPLOY.md.',
      );
    }
  }

  const appId = clean(env.FIREBASE_APP_ID);
  const mapsKey = clean(env.GOOGLE_MAPS_API_KEY);
  const servicesFile = clean(env.GOOGLE_SERVICES_JSON);
  const googleWebClientId = clean(env.GOOGLE_WEB_CLIENT_ID) ?? clean(env.FIREBASE_OAUTH_CLIENT_ID);
  const googleIosClientId = clean(env.GOOGLE_IOS_CLIENT_ID);
  // The sign-in plugin refuses to run without a valid reversed client id, so it is only added when one is given
  const googleIosScheme = googleIosClientId ? `com.googleusercontent.apps.${googleIosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}` : undefined;
  const projectId: string | undefined = config.extra?.eas?.projectId;

  return {
    ...(config as ExpoConfig),
    // The runtime version is a hash of everything native (modules, permissions, config plugins). An OTA update only
    // reaches binaries with the same hash, so it can never ship JS that needs native code an installed app lacks.
    // If native code changed, updates simply stop reaching old binaries until the new build is out.
    // `extra` (below) and the version are left out of the hash (fingerprint.config.js): both are JS-only, every
    // update carries its own copy, and hashing them made each EAS variable change or version bump strand hotfixes.
    // The env values that do reach native code (Maps key, iOS URL scheme, google-services.json) are still hashed.
    runtimeVersion: { policy: 'fingerprint' },
    updates: projectId
      ? { url: `https://u.expo.dev/${projectId}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 }
      : { enabled: false },
    plugins: [...(config.plugins ?? []), ['@sentry/react-native/expo', { organization: clean(env.SENTRY_ORG), project: clean(env.SENTRY_PROJECT) }], ...(googleIosScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosScheme }] as [string, object]] : [])],
    android: {
      ...config.android,
      ...(servicesFile ? { googleServicesFile: servicesFile } : {}),
      ...(mapsKey ? { config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } } } : {}),
    },
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        ...(clean(env.EXPORT_ENCRYPTION_CLASSIFICATION) ? { ITSAppUsesNonExemptEncryption: clean(env.EXPORT_ENCRYPTION_CLASSIFICATION) === 'non-exempt' } : {}),
      },
    },
    extra: {
      ...config.extra,
      google: { webClientId: googleWebClientId, iosClientId: googleIosClientId },
      monitoring: { dsn: clean(env.SENTRY_DSN) },
      // DONATION_URL overrides the developer's monobank jar (the "Support the developer" button in Profile)
      support: { email: clean(env.SUPPORT_EMAIL), url: clean(env.SUPPORT_URL), donationUrl: clean(env.DONATION_URL) ?? 'https://send.monobank.ua/jar/budmo' },
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
