#!/usr/bin/env node
/**
 * Google Play staged rollout without a second upload, used by promote.yml:
 *   node scripts/play-promote.mjs --package com.budmo.app --version-code 42 --rollout 0.1 --key service-account.json
 *
 * The tag release already uploaded this versionCode to the internal track, and Play refuses a second upload of a
 * version code it has seen, so `eas submit` (which always uploads) cannot take a build to production. This script
 * works on the existing release through the Play Developer API edits (edits.insert → tracks.get → tracks.update →
 * edits.commit):
 *   versionCode not on production yet   copy its internal-track release (name, release notes) to production
 *   versionCode already rolling out     change the user fraction (0.1 → 0.5), or complete it (1)
 * rollout < 1 is a staged release (`inProgress` + userFraction); rollout = 1 is `completed` (Play rejects a
 * userFraction of 1). Following the API's staged-rollout guide, only the release being changed is sent: Play keeps
 * the release that is currently live and retires it when the new one completes.
 * The key is read from a file and never printed. Node 22, no dependencies.
 */
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const FROM_TRACK = 'internal';
const TO_TRACK = 'production';

/** "0.1" → 0.1. Above 0 and at most 1; anything else (empty, "10%", "1.5", "0") is refused */
export function parseRollout(text) {
  const value = String(text ?? '').trim();
  if (!/^(0(\.\d+)?|1(\.0+)?)$/.test(value) || Number(value) <= 0) {
    throw new Error(`rollout must be a fraction above 0 and at most 1 (0.1, 0.5, 1), got "${value}"`);
  }
  return Number(value);
}

const hasVersion = (versionCode) => (release) => (release.versionCodes ?? []).map(String).includes(versionCode);

/**
 * Decides the production track update. Pure: takes the two tracks as the API returns them ({ releases: [...] },
 * or null when the track has none) and returns the body for tracks.update plus a one-line description.
 */
export function planRollout({ internalTrack, productionTrack, versionCode, rollout }) {
  const code = String(versionCode);
  if (!/^\d+$/.test(code)) throw new Error(`versionCode must be a positive integer, got "${code}"`);
  const complete = rollout === 1;
  const withStatus = (release) => {
    const { userFraction: _old, status: _status, ...rest } = release;
    return complete ? { ...rest, status: 'completed' } : { ...rest, status: 'inProgress', userFraction: rollout };
  };

  const live = (productionTrack?.releases ?? []).find(hasVersion(code));
  if (live) {
    if (live.status === 'completed') throw new Error(`versionCode ${code} is already rolled out to 100% on ${TO_TRACK}`);
    // Play does not let a rollout shrink; to stop it, halt the release in Play Console
    if (!complete && typeof live.userFraction === 'number' && rollout < live.userFraction) {
      throw new Error(`versionCode ${code} is already at ${live.userFraction} on ${TO_TRACK}; a rollout cannot be lowered (halt it in Play Console instead)`);
    }
    return {
      track: { track: TO_TRACK, releases: [withStatus(live)] },
      summary: `${TO_TRACK}: versionCode ${code} ${live.status}${live.userFraction ? ` ${live.userFraction}` : ''} → ${complete ? 'completed (100%)' : `inProgress ${rollout}`}`,
    };
  }

  const tested = (internalTrack?.releases ?? []).find(hasVersion(code));
  if (!tested) {
    throw new Error(`versionCode ${code} is not on the ${FROM_TRACK} track: promote only the build the tag release sent to internal testing`);
  }
  // Only this versionCode is promoted, even if the internal release bundled others
  const release = withStatus({ ...tested, versionCodes: [code] });
  return {
    track: { track: TO_TRACK, releases: [release] },
    summary: `${FROM_TRACK} → ${TO_TRACK}: versionCode ${code} ${complete ? 'completed (100%)' : `inProgress ${rollout}`}`,
  };
}

const base64url = (value) => Buffer.from(value).toString('base64url');

/** OAuth 2.0 access token for a service account (JWT bearer grant), as google-auth-library does it */
async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = key.token_uri || 'https://oauth2.googleapis.com/token';
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key.private_key, 'base64url');
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(`Google refused the service account (${response.status} ${body.error ?? ''} ${body.error_description ?? ''})`.trim());
  }
  return body.access_token;
}

function playClient(token, packageName) {
  return async (method, path, body, { allow404 = false } = {}) => {
    const response = await fetch(`${API}/${encodeURIComponent(packageName)}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (allow404 && response.status === 404) return null;
    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        message = JSON.parse(text).error?.message ?? text;
      } catch {
        // not JSON: keep the raw text
      }
      throw new Error(`Play API ${method} ${path}: ${response.status} ${message}`);
    }
    return text ? JSON.parse(text) : {};
  };
}

function args(argv) {
  const value = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return { packageName: value('--package'), versionCode: value('--version-code'), rollout: value('--rollout'), keyFile: value('--key') };
}

async function main(argv) {
  const { packageName, versionCode, rollout: rolloutText, keyFile } = args(argv);
  if (!packageName || !versionCode || !rolloutText || !keyFile) {
    throw new Error('usage: play-promote.mjs --package <id> --version-code <n> --rollout <0..1> --key <service-account.json>');
  }
  const rollout = parseRollout(rolloutText);
  const key = JSON.parse(readFileSync(keyFile, 'utf8'));
  if (key.type !== 'service_account' || !key.client_email || !key.private_key) throw new Error('--key is not a Google service account JSON key');

  const play = playClient(await accessToken(key), packageName);
  const edit = await play('POST', '/edits', {});
  try {
    const internalTrack = await play('GET', `/edits/${edit.id}/tracks/${FROM_TRACK}`, undefined, { allow404: true });
    const productionTrack = await play('GET', `/edits/${edit.id}/tracks/${TO_TRACK}`, undefined, { allow404: true });
    const plan = planRollout({ internalTrack, productionTrack, versionCode, rollout });
    console.log(`play-promote: ${plan.summary}`);
    await play('PUT', `/edits/${edit.id}/tracks/${TO_TRACK}`, plan.track);
    await play('POST', `/edits/${edit.id}:commit`);
    console.log('play-promote: committed');
    return plan.summary;
  } catch (error) {
    // Nothing was committed: drop the edit instead of leaving it open
    await play('DELETE', `/edits/${edit.id}`).catch(() => {});
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    () => process.exit(0),
    (error) => {
      console.error(`${process.env.GITHUB_ACTIONS === 'true' ? '::error::' : ''}play-promote: ${error.message}`);
      process.exit(1);
    }
  );
}
