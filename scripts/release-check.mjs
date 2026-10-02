#!/usr/bin/env node
/**
 * Pre-release checks, run by CI before any store build and by hand before tagging:
 *   node scripts/release-check.mjs --tag v1.2.0   the tag must equal the app version (app.json == package.json)
 *   node scripts/release-check.mjs --project      `extra.eas.projectId` exists (after `eas init`)
 *   node scripts/release-check.mjs --env          the variables app.config.ts needs are set (local .env or CI)
 *   node scripts/release-check.mjs --store        store.config.json has no REPLACE_ME left; the legal URLs are https links
 * Exits 1 and prints every problem, not just the first.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REQUIRED_ENV = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_FIRESTORE_DATABASE_ID',
  'GOOGLE_MAPS_API_KEY',
];

export const LEGAL_ENV = ['PRIVACY_POLICY_URL', 'TERMS_URL'];

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

export function checkEnv(env) {
  return REQUIRED_ENV.filter((name) => !String(env[name] ?? '').trim()).map((name) => `environment variable ${name} is not set`);
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
    try {
      if (new URL(String(env[name] ?? '').trim()).protocol !== 'https:') throw new Error('not https');
    } catch {
      problems.push(`${name} must be a public https URL`);
    }
  }
  return problems;
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

  const problems = [
    ...checkVersions({
      tag: tagIndex >= 0 ? argv[tagIndex + 1] : undefined,
      appVersion: appJson.expo.version,
      packageVersion: read('package.json').version,
    }),
    ...checkIdentifiers(appJson),
    ...(flag('--project') ? checkProject(appJson) : []),
    ...(flag('--env') ? checkEnv(process.env) : []),
    ...(flag('--store') ? checkStore({ storeConfigText: readFileSync(new URL('../store.config.json', import.meta.url), 'utf8'), env: process.env }) : []),
  ];

  if (problems.length === 0) {
    console.log('release-check: ok');
    return 0;
  }
  problems.forEach((p) => console.error(`release-check: ${p}`));
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
