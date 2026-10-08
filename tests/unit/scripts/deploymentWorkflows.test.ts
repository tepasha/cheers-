import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const workflow = (name: string) => parse(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));

describe('Expo deployment entry points', () => {
  it('keeps full production releases and store promotion manual', () => {
    for (const name of ['release', 'promote']) {
      expect(Object.keys(workflow(name).on)).toEqual(['workflow_dispatch']);
    }
  });

  it('allows automatic pushes to deploy only the preview app and staging backend', () => {
    const preview = workflow('preview');
    expect(preview.on.push.branches).toEqual(['main']);
    expect(preview.jobs.backend.with.environment).toBe('staging');
    expect(preview.jobs.android.with).toMatchObject({ profile: 'preview', submit: false });
    expect(preview.jobs.ota.with.channel).toBe('preview');
    expect(preview.jobs.android.if).toBeUndefined();
    expect(preview.jobs.ota.if).toBeUndefined();
  });

  it('waits for a usable Android binary before publishing its OTA update', () => {
    const preview = workflow('preview');
    expect(preview.jobs.android.needs).toContain('backend');
    expect(preview.jobs.ota.needs).toContain('android');
    expect(preview.concurrency).toMatchObject({ 'cancel-in-progress': false });
  });

  it('lets child workflows skip CI only when the parent completed its CI gate', () => {
    for (const parent of ['preview', 'release']) {
      const { jobs } = workflow(parent);
      expect(jobs.ci.uses).toBe('./.github/workflows/ci-check.yml');
      for (const name of parent === 'preview' ? ['backend', 'android', 'ota'] : ['backend', 'android', 'ios']) {
        expect(jobs[name].with.ci_checked).toBe(true);
      }
    }
    for (const child of ['ota', 'build-android', 'build-ios', 'deploy-backend']) {
      const config = workflow(child);
      expect(config.on.workflow_call.inputs.ci_checked.default).toBe(false);
      expect(config.on.workflow_dispatch.inputs.ci_checked).toBeUndefined();
      expect(config.jobs.ci.if).toBe('${{ !inputs.ci_checked }}');
    }
  });
});
