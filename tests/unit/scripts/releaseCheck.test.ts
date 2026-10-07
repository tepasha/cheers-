import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PLATFORM_ENV,
  REQUIRED_ENV,
  checkBackend,
  checkEnv,
  checkOnMain,
  checkReleaseRef,
  checkStore,
  checkIdentifiers,
  checkProject,
  checkVersions,
} from '../../../scripts/release-check.mjs';
import appConfig, { releaseConfigProblems } from '../../../app.config';

const PLATFORMS = ['android', 'ios'] as const;
const ALL_ENV = [...REQUIRED_ENV, ...PLATFORMS.flatMap((p) => PLATFORM_ENV[p])];

/** A complete, valid environment (every value well-formed) */
function fullEnv(): Record<string, string> {
  const env: Record<string, string> = Object.fromEntries(ALL_ENV.map((n) => [n, 'x']));
  env.PRIVACY_POLICY_URL = 'https://example.com/privacy';
  env.TERMS_URL = 'https://example.com/terms';
  env.FIREBASE_FIRESTORE_DATABASE_ID = 'budmo-db';
  env.SUPPORT_EMAIL = 'support@example.com';
  env.SENTRY_DSN = 'https://public-key@sentry.example.com/1';
  env.EXPORT_ENCRYPTION_CLASSIFICATION = 'exempt';
  env.ADMOB_ANDROID_APP_ID = 'ca-app-pub-1234567890123456~1234567890';
  env.ADMOB_IOS_APP_ID = 'ca-app-pub-1234567890123456~0987654321';
  return env;
}

describe('release-check', () => {
  it('rejects invalid operator contacts and monitoring endpoints', () => {
    expect(checkEnv({ ...fullEnv(), SUPPORT_EMAIL: 'not-an-email' })).toContain('SUPPORT_EMAIL must be a valid email address');
    expect(checkEnv({ ...fullEnv(), SENTRY_DSN: 'http://insecure.example.com/1' })).toContain('SENTRY_DSN must be an https URL');
    expect(checkEnv({ ...fullEnv(), EXPORT_ENCRYPTION_CLASSIFICATION: 'unknown' })).toContain('EXPORT_ENCRYPTION_CLASSIFICATION must be exempt or non-exempt after operator review');
  });
  it('refuses the sample AdMob app id and malformed ad units, and accepts unset units (test ads)', () => {
    const sample = { ...fullEnv(), ADMOB_ANDROID_APP_ID: 'ca-app-pub-3940256099942544~3347511713' };
    expect(checkEnv(sample, { platform: 'android' })[0]).toMatch(/ADMOB_ANDROID_APP_ID must be your AdMob app id/);
    expect(checkEnv(sample, { platform: 'ios' })).toEqual([]);
    expect(checkEnv({ ...fullEnv(), ADMOB_IOS_BANNER_ID: 'ca-app-pub-1234567890123456~1234567890' })[0]).toMatch(/ADMOB_IOS_BANNER_ID must be an AdMob ad unit id/);
    expect(checkEnv({ ...fullEnv(), ADMOB_IOS_INLINE_ID: 'ca-app-pub-1234567890123456/1234567890' })).toEqual([]);
  });
  it('accepts a tag that names the app version', () => {
    expect(checkVersions({ tag: 'v1.2.0', appVersion: '1.2.0', packageVersion: '1.2.0' })).toEqual([]);
    expect(checkVersions({ appVersion: '1.2.0', packageVersion: '1.2.0' })).toEqual([]); // no tag: just the versions
  });

  it('rejects a tag that does not match the app version (the old "v1.2.0 builds 1.0.0" trap)', () => {
    const problems = checkVersions({ tag: 'v1.2.0', appVersion: '1.0.0', packageVersion: '1.0.0' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/does not match/);
  });

  it('rejects malformed tags and versions', () => {
    expect(checkVersions({ tag: '1.0.0', appVersion: '1.0.0', packageVersion: '1.0.0' })[0]).toMatch(/not of the form/);
    expect(checkVersions({ tag: 'v1.0', appVersion: '1.0.0', packageVersion: '1.0.0' })[0]).toMatch(/not of the form/);
    expect(checkVersions({ appVersion: '1.0', packageVersion: '1.0' })[0]).toMatch(/not X\.Y\.Z/);
  });

  it('requires app.json and package.json to agree', () => {
    expect(checkVersions({ appVersion: '1.1.0', packageVersion: '1.0.0' })[0]).toMatch(/differs/);
  });

  it('reports every problem at once', () => {
    expect(checkVersions({ tag: 'oops', appVersion: '1.0', packageVersion: '2.0.0' }).length).toBeGreaterThanOrEqual(3);
  });

  it('knows whether `eas init` has been run', () => {
    expect(checkProject({ expo: {} })).toHaveLength(1);
    expect(checkProject({ expo: { extra: { eas: { projectId: 'abc' } } } })).toEqual([]);
  });

  it('lists the missing environment variables, treating blanks and bare quotes as missing', () => {
    expect(checkEnv({})).toHaveLength(ALL_ENV.length);
    const all = fullEnv();
    expect(checkEnv(all)).toEqual([]);
    expect(checkEnv({ ...all, GOOGLE_MAPS_API_KEY: '   ' })).toEqual(['environment variable GOOGLE_MAPS_API_KEY is not set']);
    expect(checkEnv({ ...all, FIREBASE_API_KEY: '""' })).toEqual(['environment variable FIREBASE_API_KEY is not set']);
  });

  it('requires everything a broken build used to ship without: the database id, Google client ids, legal URLs', () => {
    for (const name of ['FIREBASE_FIRESTORE_DATABASE_ID', 'GOOGLE_WEB_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID', 'GOOGLE_MAPS_API_KEY', 'PRIVACY_POLICY_URL', 'TERMS_URL']) {
      expect(ALL_ENV).toContain(name);
    }
  });

  it('checks one platform for a store build and both for an OTA update', () => {
    const { GOOGLE_IOS_CLIENT_ID: _ios, ...androidOnly } = fullEnv();
    expect(checkEnv(androidOnly, { platform: 'android' })).toEqual([]);
    expect(checkEnv(androidOnly, { platform: 'ios' })).toEqual(['environment variable GOOGLE_IOS_CLIENT_ID is not set']);
    expect(checkEnv(androidOnly)).toEqual(['environment variable GOOGLE_IOS_CLIENT_ID is not set']);
    const { GOOGLE_MAPS_API_KEY: _maps, ...iosOnly } = fullEnv();
    expect(checkEnv(iosOnly, { platform: 'ios' })).toEqual([]);
    expect(checkEnv(iosOnly, { platform: 'android' })).toHaveLength(1);
    expect(checkEnv(fullEnv(), { platform: 'web' })[0]).toMatch(/unknown platform/);
  });

  it('accepts FIREBASE_OAUTH_CLIENT_ID in place of GOOGLE_WEB_CLIENT_ID, as app.config.ts does', () => {
    const { GOOGLE_WEB_CLIENT_ID: _web, ...env } = fullEnv();
    expect(checkEnv(env)).toEqual(['environment variable GOOGLE_WEB_CLIENT_ID is not set']);
    expect(checkEnv({ ...env, FIREBASE_OAUTH_CLIENT_ID: 'web.apps.googleusercontent.com' })).toEqual([]);
  });

  it('refuses non-https legal URLs and the (default) database', () => {
    expect(checkEnv({ ...fullEnv(), TERMS_URL: 'http://example.com/terms' })).toEqual(['TERMS_URL must be a public https URL']);
    expect(checkEnv({ ...fullEnv(), PRIVACY_POLICY_URL: 'example.com/privacy' })).toEqual(['PRIVACY_POLICY_URL must be a public https URL']);
    expect(checkEnv({ ...fullEnv(), FIREBASE_FIRESTORE_DATABASE_ID: '(default)' })[0]).toMatch(/not \(default\)/);
  });

  it('refuses a store listing with placeholders or without public https legal pages', () => {
    const ok = { PRIVACY_POLICY_URL: 'https://example.com/privacy', TERMS_URL: 'https://example.com/terms' };
    expect(checkStore({ storeConfigText: '{"a":"fine"}', env: ok })).toEqual([]);
    expect(checkStore({ storeConfigText: 'REPLACE_ME and REPLACE_ME', env: ok })[0]).toMatch(/2 REPLACE_ME/);
    expect(checkStore({ storeConfigText: '{}', env: {} })).toHaveLength(2);
    expect(checkStore({ storeConfigText: '{}', env: { ...ok, TERMS_URL: 'http://example.com/terms' } })).toEqual(['TERMS_URL must be a public https URL']);
    expect(checkStore({ storeConfigText: '{}', env: { ...ok, PRIVACY_POLICY_URL: 'javascript:alert(1)' } })).toHaveLength(1);
  });

  it('requires the same bundle id on both platforms', () => {
    expect(checkIdentifiers({ expo: { ios: { bundleIdentifier: 'a.b' }, android: { package: 'a.b' } } })).toEqual([]);
    expect(checkIdentifiers({ expo: { ios: { bundleIdentifier: 'a.b' }, android: { package: 'a.c' } } })).toHaveLength(1);
  });
});

describe('release-check: backend of a channel', () => {
  const app = { FIREBASE_PROJECT_ID: 'budmo-staging', FIREBASE_FIRESTORE_DATABASE_ID: 'budmo-db' };
  const expected = { EXPECTED_FIREBASE_PROJECT_ID: 'budmo-staging', EXPECTED_FIRESTORE_DATABASE_ID: 'budmo-db' };

  it('accepts a client that talks to the backend its channel deploys to', () => {
    expect(checkBackend({ ...app, ...expected })).toEqual([]);
    expect(checkBackend({ ...app, EXPECTED_FIREBASE_PROJECT_ID: ' "budmo-staging" ', EXPECTED_FIRESTORE_DATABASE_ID: 'budmo-db' })).toEqual([]);
  });

  it('refuses a preview client pointed at another project or database (the shared production project trap)', () => {
    const problems = checkBackend({ ...expected, FIREBASE_PROJECT_ID: 'budmo-prod', FIREBASE_FIRESTORE_DATABASE_ID: 'budmo-db' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/FIREBASE_PROJECT_ID is "budmo-prod".*"budmo-staging"/);
    expect(checkBackend({ ...expected, ...app, FIREBASE_FIRESTORE_DATABASE_ID: 'cheers_db' })[0]).toMatch(/FIRESTORE_DATABASE_ID/);
    expect(checkBackend({ ...expected })).toHaveLength(2);
  });

  it('refuses to build for a channel whose backend is not configured', () => {
    const problems = checkBackend({ ...app });
    expect(problems).toHaveLength(2);
    expect(problems.every((p) => /not configured/.test(p))).toBe(true);
  });
});

describe('release-check: production only from main or a release tag', () => {
  const sha = 'a'.repeat(40);

  it('accepts main and release tags whose commit is on main', () => {
    expect(checkReleaseRef({ ref: 'refs/heads/main', sha, onMain: true })).toEqual([]);
    expect(checkReleaseRef({ ref: 'refs/tags/v1.2.0', sha, onMain: true })).toEqual([]);
  });

  it('refuses any other branch or tag before asking git', () => {
    for (const ref of ['refs/heads/feature/x', 'refs/heads/develop', 'refs/tags/v1.2', 'refs/tags/test', 'refs/pull/1/merge', undefined]) {
      const problems = checkReleaseRef({ ref, sha, onMain: true });
      expect(problems, String(ref)).toHaveLength(1);
      expect(problems[0]).toMatch(/only from main or a release tag/);
    }
  });

  it('refuses a release tag pushed onto a commit that is not on main', () => {
    expect(checkReleaseRef({ ref: 'refs/tags/v1.2.0', sha, onMain: false })[0]).toMatch(/is not on main/);
  });

  it('fails closed when git cannot tell, and on anything that is not a commit hash', () => {
    expect(checkOnMain({ sha, onMain: 'git merge-base failed (exit 128)' })[0]).toMatch(/could not check/);
    expect(checkOnMain({ sha: '--help', onMain: true })[0]).toMatch(/not a git commit hash/);
    expect(checkOnMain({ sha: undefined, onMain: true })[0]).toMatch(/not a git commit hash/);
    expect(checkOnMain({ sha: 'abc1234', onMain: true })).toEqual([]);
  });
});

/**
 * app.config.ts repeats the check on the EAS build worker, where the values that end up in the binary are known.
 * The two lists must not drift apart: whatever CI demands, the worker demands too, and nothing more (except
 * google-services.json, a file variable only the worker materialises).
 */
describe('app.config.ts release gate', () => {
  const stubEnv = (env: Record<string, string | undefined>) => {
    for (const name of [...ALL_ENV, 'FIREBASE_OAUTH_CLIENT_ID', 'GOOGLE_SERVICES_JSON', 'EAS_BUILD_PROFILE', 'EAS_BUILD_PLATFORM']) vi.stubEnv(name, env[name]);
  };
  const root = process.cwd();
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(PLATFORMS)('demands exactly what release-check demands for an %s build', (platform) => {
    const env = { ...fullEnv(), GOOGLE_SERVICES_JSON: 'package.json' }; // any existing file
    stubEnv(env);
    expect(releaseConfigProblems(root, platform)).toEqual([]);
    for (const name of [...REQUIRED_ENV, ...PLATFORM_ENV[platform]]) {
      stubEnv({ ...env, [name]: undefined });
      expect(checkEnv({ ...env, [name]: undefined }, { platform }).length, name).toBeGreaterThan(0);
      expect(releaseConfigProblems(root, platform).join('\n'), name).toContain(name);
    }
    const other = platform === 'android' ? 'ios' : 'android';
    for (const name of PLATFORM_ENV[other]) {
      stubEnv({ ...env, [name]: undefined });
      expect(releaseConfigProblems(root, platform), name).toEqual([]);
    }
  });

  it('needs an existing google-services.json for Android only', () => {
    stubEnv(fullEnv());
    expect(releaseConfigProblems(root, 'android')).toEqual(['GOOGLE_SERVICES_JSON is not set']);
    expect(releaseConfigProblems(root, 'ios')).toEqual([]);
    stubEnv({ ...fullEnv(), GOOGLE_SERVICES_JSON: 'no/such/google-services.json' });
    expect(releaseConfigProblems(root, 'android')[0]).toMatch(/does not exist/);
  });

  it('refuses the (default) database and non-https legal URLs, like release-check', () => {
    stubEnv({ ...fullEnv(), FIREBASE_FIRESTORE_DATABASE_ID: '(default)', TERMS_URL: 'http://example.com/terms' });
    expect(releaseConfigProblems(root, 'ios')).toHaveLength(2);
  });

  it('throws only for preview and production builds on the EAS worker, so local work and demo mode still start', () => {
    const context = { config: { name: 'Budmo', slug: 'budmo-app' }, projectRoot: root } as never;
    stubEnv({});
    expect(() => appConfig(context)).not.toThrow();
    stubEnv({ EAS_BUILD_PROFILE: 'development' });
    expect(() => appConfig(context)).not.toThrow();
    stubEnv({ EAS_BUILD_PROFILE: 'production', EAS_BUILD_PLATFORM: 'ios' });
    expect(() => appConfig(context)).toThrow(/production.*incomplete/s);
    stubEnv({ ...fullEnv(), EAS_BUILD_PROFILE: 'preview', EAS_BUILD_PLATFORM: 'ios' });
    expect(appConfig(context).extra?.firebase).toMatchObject({ firestoreDatabaseId: 'budmo-db' });
  });
});
