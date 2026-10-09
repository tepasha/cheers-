import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import appConfig from '../../../app.config';

describe('Google services file used for native fingerprinting', () => {
  let projectRoot: string;
  let downloaded: string;
  const config = () => appConfig({ config: { name: 'Budmo', slug: 'budmo-app' }, projectRoot } as never);

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'budmo-google-services-'));
    downloaded = join(projectRoot, '.eas', '.env', 'GOOGLE_SERVICES_JSON');
    mkdirSync(join(projectRoot, '.eas', '.env'), { recursive: true });
    writeFileSync(downloaded, '{"project_info":{"project_id":"preview"}}');
    for (const name of ['GOOGLE_SERVICES_JSON', 'EAS_BUILD', 'EAS_BUILD_PROFILE', 'EAS_BUILD_PLATFORM']) vi.stubEnv(name, undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('uses the downloaded contents when EAS CLI provides only a filename', () => {
    vi.stubEnv('GOOGLE_SERVICES_JSON', 'google-services.json');
    expect(config().android?.googleServicesFile).toBe(downloaded);
  });

  it('uses the downloaded file with dotenv disabled for OTA runtime resolution', () => {
    vi.stubEnv('EXPO_NO_DOTENV', '1');
    expect(config().android?.googleServicesFile).toBe(downloaded);
  });

  it('prefers an existing explicit path, including the file injected on EAS', () => {
    const injected = join(projectRoot, 'worker-google-services.json');
    writeFileSync(injected, '{}');
    vi.stubEnv('GOOGLE_SERVICES_JSON', injected);
    expect(config().android?.googleServicesFile).toBe(injected);
    vi.stubEnv('EAS_BUILD', 'true');
    expect(config().android?.googleServicesFile).toBe(injected);
  });

  it('never masks a missing worker file with a downloaded local copy', () => {
    vi.stubEnv('EAS_BUILD', 'true');
    vi.stubEnv('EAS_BUILD_PROFILE', 'preview');
    vi.stubEnv('EAS_BUILD_PLATFORM', 'android');
    vi.stubEnv('GOOGLE_SERVICES_JSON', 'missing.json');
    expect(() => config()).toThrow(/GOOGLE_SERVICES_JSON points at a file that does not exist/);
  });

  it('allows local demo mode when no file has been configured or downloaded', () => {
    rmSync(downloaded);
    expect(config().android?.googleServicesFile).toBeUndefined();
  });
});
