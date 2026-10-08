#!/usr/bin/env node
/**
 * Pre-release checks, run by CI before any store build and by hand before tagging:
 *   node scripts/release-check.mjs --tag v1.2.0   the tag must equal the app version (app.json == package.json)
 *   node scripts/release-check.mjs --project      `extra.eas.projectId` exists (after `eas init`)
 *   node scripts/release-check.mjs --env [--platform android|ios]
 *                                                 the variables app.config.ts compiles into a build or OTA update are
 *                                                 set and sane. CI runs it through `eas env:exec <environment>` before
 *                                                 every build and update, so it sees exactly what EAS will use.
 *   node scripts/release-check.mjs --store        store.config.json has no REPLACE_ME left; the legal URLs are https links
 *   node scripts/release-check.mjs --backend      the app's Firebase project / database (EAS variables, run through
 *                                                 `eas env:exec`) are the ones the channel's backend is deployed to
 *                                                 (EXPECTED_FIREBASE_PROJECT_ID / EXPECTED_FIRESTORE_DATABASE_ID)
 *   node scripts/release-check.mjs --release-ref  manual workflow run, from main or a release tag on main
 *   node scripts/release-check.mjs --on-main SHA  the commit is on main (needs a checkout with fetch-depth: 0)
 * Exits 1 and prints every problem, not just the first.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Variables app.config.ts compiles into every build AND every OTA update (both platforms). Missing ones used to fall
 * back silently: no Terms/Privacy links, the '(default)' Firestore database, a Google button that only shows a
 * configuration error. app.config.ts throws for the same list on the EAS build worker (releaseConfigProblems), and
 * tests/unit/scripts/releaseCheck.test.ts keeps the two in step.
 */
export const REQUIRED_ENV = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_FIRESTORE_DATABASE_ID',
  'GOOGLE_WEB_CLIENT_ID',
  'PRIVACY_POLICY_URL',
  'TERMS_URL',
  'SUPPORT_EMAIL',
  'SENTRY_DSN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN',
];

/**
 * Needed by one platform's binary only: the Android Maps SDK key (iOS uses Apple Maps), the iOS Google client id,
 * each platform's AdMob app id
 */
export const PLATFORM_ENV = {
  android: ['GOOGLE_MAPS_API_KEY', 'ADMOB_ANDROID_APP_ID'],
  ios: ['GOOGLE_IOS_CLIENT_ID', 'EXPORT_ENCRYPTION_CLASSIFICATION', 'ADMOB_IOS_APP_ID'],
};

/** Optional AdMob ad units (unset: Google's test ads); when given they must be well-formed */
const ADMOB_UNIT_ENV = {
  android: ['ADMOB_ANDROID_BANNER_ID', 'ADMOB_ANDROID_INLINE_ID'],
  ios: ['ADMOB_IOS_BANNER_ID', 'ADMOB_IOS_INLINE_ID'],
};
const isAdMobAppId = (value) => /^ca-app-pub-\d{16}~\d{10}$/.test(value) && !value.startsWith('ca-app-pub-3940256099942544');
const isAdMobUnitId = (value) => /^ca-app-pub-\d{16}\/\d{10}$/.test(value);

/** app.config.ts accepts these names instead */
const ALTERNATIVE_ENV = { GOOGLE_WEB_CLIENT_ID: 'FIREBASE_OAUTH_CLIENT_ID' };

export const LEGAL_ENV = ['PRIVACY_POLICY_URL', 'TERMS_URL'];

// The same normalisation app.config.ts applies (surrounding blanks and quotes do not count as a value)
const clean = (value) => String(value ?? '').trim().replace(/^["']+|["']+$/g, '');

const isHttpsUrl = (value) => {
  try {
    return new URL(clean(value)).protocol === 'https:';
  } catch {
    return false;
  }
};

const SEMVER = /^\d+\.\d+\.\d+$/;

/** Versions: app.json and package.json agree, and a release tag `vX.Y.Z` names exactly that version */
export function checkVersions({ tag, appVersion, packageVersion }) {
  const problems = [];
  if (!SEMVER.test(appVersion ?? '')) problems.push(`app.json version "${appVersion}" is not X.Y.Z`);
  if (packageVersion !== appVersion) problems.push(`package.json version (${packageVersion}) differs from app.json (${appVersion})`);
  if (tag !== undefined) {
    const m = /^v(\d+\.\d+\.\d+)$/.exec(tag);
    if (!m) problems.push(`tag "${tag}" is not of the form vX.Y.Z`);
    else if (m[1] !== appVersion) problems.push(`tag ${tag} does not match the app version ${appVersion}: bump app.json and package.json first`);
  }
  return problems;
}

export function checkProject(appJson) {
  const id = appJson?.expo?.extra?.eas?.projectId;
  return id ? [] : ['app.json has no expo.extra.eas.projectId: run `npx eas-cli init`'];
}

/**
 * `platform` narrows the check to one store build; without it (OTA updates, which ship to both platforms) every
 * platform's variables are required. GOOGLE_SERVICES_JSON is not checked here: it is a file variable, and only the
 * build worker materialises its file, so app.config.ts checks it there.
 */
export function checkEnv(env, { platform } = {}) {
  if (platform !== undefined && !PLATFORM_ENV[platform]) return [`unknown platform "${platform}" (android or ios)`];
  const names = [...REQUIRED_ENV, ...(platform ? PLATFORM_ENV[platform] : Object.values(PLATFORM_ENV).flat())];
  const value = (name) => clean(env[name]) || clean(env[ALTERNATIVE_ENV[name]]);
  const problems = names.filter((name) => !value(name)).map((name) => `environment variable ${name} is not set`);
  for (const name of LEGAL_ENV) {
    if (value(name) && !isHttpsUrl(value(name))) problems.push(`${name} must be a public https URL`);
  }
  if (value('SUPPORT_EMAIL') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('SUPPORT_EMAIL'))) problems.push('SUPPORT_EMAIL must be a valid email address');
  if (value('SENTRY_DSN') && !isHttpsUrl(value('SENTRY_DSN'))) problems.push('SENTRY_DSN must be an https URL');
  if (platform !== 'android' && value('EXPORT_ENCRYPTION_CLASSIFICATION') && !['exempt', 'non-exempt'].includes(value('EXPORT_ENCRYPTION_CLASSIFICATION'))) problems.push('EXPORT_ENCRYPTION_CLASSIFICATION must be exempt or non-exempt after operator review');
  for (const os of platform ? [platform] : Object.keys(PLATFORM_ENV)) {
    const appIdName = `ADMOB_${os.toUpperCase()}_APP_ID`;
    if (value(appIdName) && !isAdMobAppId(value(appIdName))) problems.push(`${appIdName} must be your AdMob app id (ca-app-pub-…~…), not Google's sample id`);
    for (const name of ADMOB_UNIT_ENV[os]) {
      if (value(name) && !isAdMobUnitId(value(name))) problems.push(`${name} must be an AdMob ad unit id (ca-app-pub-…/…)`);
    }
  }
  if (value('FIREBASE_FIRESTORE_DATABASE_ID') === '(default)') {
    problems.push('FIREBASE_FIRESTORE_DATABASE_ID must name the database firestore.rules and the functions are deployed to, not (default)');
  }
  return problems;
}

/**
 * Store listing: no placeholder may reach App Store Connect, and the legal pages must be public https URLs
 * (both stores reject a listing without a working privacy policy).
 */
export function checkStore({ storeConfigText, env }) {
  const problems = [];
  const left = (storeConfigText.match(/REPLACE_ME/g) ?? []).length;
  if (left > 0) problems.push(`store.config.json still has ${left} REPLACE_ME placeholder(s)`);
  for (const name of LEGAL_ENV) {
    if (!isHttpsUrl(env[name])) problems.push(`${name} must be a public https URL`);
  }
  return problems;
}

/**
 * Pairs of (EAS variable compiled into the app, the CI variable carrying the GitHub Environment's value, the name of
 * that GitHub variable). deploy-backend.yml deploys the rules and functions with the GitHub Environment's values.
 */
const BACKEND_ENV = [
  ['FIREBASE_PROJECT_ID', 'EXPECTED_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID'],
  ['FIREBASE_FIRESTORE_DATABASE_ID', 'EXPECTED_FIRESTORE_DATABASE_ID', 'FIRESTORE_DATABASE_ID'],
];

/**
 * A client (build or OTA update) must talk to the backend its channel's rules and functions are deployed to: preview
 * clients to the GitHub Environment `staging`, production ones to `production`. Nothing else ties the EAS variables
 * to that environment, and a mismatch is silent: preview testers write into the production database (where real
 * users see their tables and meetups), or test against rules that were deployed somewhere else.
 * Project ids and database ids are not secrets (every app binary contains them), so they are named in the message.
 */
export function checkBackend(env) {
  const problems = [];
  for (const [appName, expectedName, githubName] of BACKEND_ENV) {
    const actual = clean(env[appName]);
    const expected = clean(env[expectedName]);
    if (!expected) {
      problems.push(`the GitHub Environment of this channel has no variable ${githubName}: its backend is not configured, so no client may be built for it (see DEPLOY.md)`);
    } else if (actual !== expected) {
      problems.push(`EAS variable ${appName} is "${actual}", but this channel's backend is deployed to "${expected}" (GitHub Environment variable ${githubName}): point them at the same Firebase project and database`);
    }
  }
  return problems;
}

/** Refs a production run may start from: main, or a release tag in the form release.yml / --tag accept */
const RELEASE_REF = /^refs\/(heads\/main|tags\/v\d+\.\d+\.\d+)$/;
const COMMIT = /^[0-9a-f]{7,40}$/;

/** Every production entry point uses this gate, including reusable workflows called by another workflow. */
export function checkProductionTrigger(eventName) {
  return eventName === 'workflow_dispatch' ? []
    : ['production requires a manual Run workflow action (workflow_dispatch); pushes, tags and scheduled runs cannot deploy production'];
}

/**
 * `onMain` is the answer of `git merge-base --is-ancestor <sha> origin/main`: true, false, or a string explaining why
 * git could not answer (an unknown commit, a shallow checkout).
 */
export function checkOnMain({ sha, onMain, what = 'commit' }) {
  if (!COMMIT.test(sha ?? '')) return [`${what}: "${sha ?? ''}" is not a git commit hash`];
  if (onMain === true) return [];
  if (onMain === false) {
    return [`${what} ${sha.slice(0, 12)} is not on main: only commits merged into main (where CI ran on them) may reach production`];
  }
  return [`could not check whether ${what} ${sha.slice(0, 12)} is on main: ${onMain}`];
}

/**
 * The production gate of every manual entry point (ota.yml, build-*.yml, deploy-backend.yml, promote.yml) and of
 * release.yml: the run must come from main or a release tag, and the commit must be on main, because a tag can be
 * pushed onto any commit, including one from an untested branch.
 */
export function checkReleaseRef({ ref, sha, onMain }) {
  if (!RELEASE_REF.test(ref ?? '')) {
    return [`production is reached only from main or a release tag vX.Y.Z, not from ${ref || '(no ref)'}: use Run workflow on main or an existing release tag`];
  }
  return checkOnMain({ sha, onMain, what: ref });
}

function isOnMain(sha) {
  if (!COMMIT.test(sha ?? '')) return false; // checkOnMain reports the format; never hand git an option-like string
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    // 1 = not an ancestor; anything else (128) = git could not tell, e.g. the commit is not in this repository
    return error.status === 1
      ? false
      : `git merge-base failed (exit ${error.status ?? error.message}): is the commit in this repository, and was it checked out with fetch-depth: 0?`;
  }
}

/** Bundle identifiers must match between platforms, or store listings and push credentials drift apart */
export function checkIdentifiers(appJson) {
  const { ios, android } = appJson?.expo ?? {};
  return ios?.bundleIdentifier && ios.bundleIdentifier === android?.package
    ? []
    : [`ios.bundleIdentifier (${ios?.bundleIdentifier}) and android.package (${android?.package}) must be the same`];
}

function main(argv) {
  const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  const appJson = read('app.json');
  const flag = (name) => argv.includes(name);
  const tagIndex = argv.indexOf('--tag');
  const platformIndex = argv.indexOf('--platform');
  const onMainIndex = argv.indexOf('--on-main');
  const onMainSha = onMainIndex >= 0 ? argv[onMainIndex + 1] : undefined;
  const ref = process.env.GITHUB_REF;
  const sha = process.env.GITHUB_SHA;

  const problems = [
    ...checkVersions({
      tag: tagIndex >= 0 ? argv[tagIndex + 1] : undefined,
      appVersion: appJson.expo.version,
      packageVersion: read('package.json').version,
    }),
    ...checkIdentifiers(appJson),
    ...(flag('--project') ? checkProject(appJson) : []),
    ...(flag('--env') ? checkEnv(process.env, { platform: platformIndex >= 0 ? argv[platformIndex + 1] : undefined }) : []),
    ...(flag('--store') ? checkStore({ storeConfigText: readFileSync(new URL('../store.config.json', import.meta.url), 'utf8'), env: process.env }) : []),
    ...(flag('--backend') ? checkBackend(process.env) : []),
    ...(flag('--release-ref') ? [
      ...checkProductionTrigger(process.env.GITHUB_EVENT_NAME),
      ...checkReleaseRef({ ref, sha, onMain: isOnMain(sha) }),
    ] : []),
    ...(onMainIndex >= 0 ? checkOnMain({ sha: onMainSha, onMain: isOnMain(onMainSha) }) : []),
  ];

  if (problems.length === 0) {
    console.log('release-check: ok');
    return 0;
  }
  // GitHub Actions turns ::error:: lines into annotations on the run
  const prefix = process.env.GITHUB_ACTIONS === 'true' ? '::error::release-check: ' : 'release-check: ';
  problems.forEach((p) => console.error(`${prefix}${p}`));
  if (flag('--env') && problems.some((p) => p.startsWith('environment variable'))) {
    console.error(
      'release-check: on EAS, create the variable for this environment with `eas env:create` and the visibility "Plain text" or ' +
        '"Sensitive": "Secret" variables are invisible to `eas env:exec` and `eas update`, so an OTA update would ship without them.',
    );
  }
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
