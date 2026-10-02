import { describe, expect, it } from 'vitest';
import { REQUIRED_ENV, checkEnv, checkStore, checkIdentifiers, checkProject, checkVersions } from '../../../scripts/release-check.mjs';

describe('release-check', () => {
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

  it('lists the missing environment variables, treating blanks as missing', () => {
    expect(checkEnv({})).toHaveLength(REQUIRED_ENV.length);
    const all = Object.fromEntries(REQUIRED_ENV.map((n) => [n, 'x']));
    expect(checkEnv(all)).toEqual([]);
    expect(checkEnv({ ...all, GOOGLE_MAPS_API_KEY: '   ' })).toEqual(['environment variable GOOGLE_MAPS_API_KEY is not set']);
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
