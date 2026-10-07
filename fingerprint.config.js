/**
 * What goes into the native fingerprint, which is the OTA runtime version (`runtimeVersion: { policy: 'fingerprint' }`
 * in app.config.ts). An update reaches only binaries with the same hash, so the hash must change when, and only when,
 * the native side changes.
 *
 * By default @expo/fingerprint also hashes the whole resolved Expo config, including two parts that never reach
 * native code:
 *   extra    filled from EAS variables (Firebase web config, Google client ids, legal URLs). Read by JS through
 *            expo-constants, and every update carries its own copy in the manifest.
 *   version  the marketing version (plus android.versionCode / ios.buildNumber). The update manifest carries it too,
 *            and EAS sets the build numbers remotely (eas.json `appVersionSource: remote`).
 * With them hashed, adding or changing an EAS variable, or a hotfix commit that bumps app.json's version, gave the
 * update a runtime version that no installed binary has: `eas update` still reported success, and nobody got it.
 *
 * Everything native stays hashed: config plugins and their options (e.g. the Google sign-in iOS URL scheme), the
 * Android Maps key (`android.config.googleMaps`), google-services.json's contents, permissions, icons and splash,
 * package.json dependencies, eas.json. Changing any of those still needs a store build, as it must.
 *
 * Setting `sourceSkips` replaces the library default, so the default skip is listed again.
 * Check with `npx expo-updates runtimeversion:resolve --platform android --workflow managed` (or `eas fingerprint:compare`).
 */
const { SourceSkips } = require('expo/fingerprint');

/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips:
    SourceSkips.ExpoConfigExtraSection |
    SourceSkips.ExpoConfigVersions |
    // @expo/fingerprint's default: package.json "android"/"ios" scripts, which `expo prebuild` rewrites
    SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun,
};
