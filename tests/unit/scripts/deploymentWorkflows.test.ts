import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const workflow = (name: string) => parse(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));

describe('Expo deployment entry points', () => {
  it('keeps full production releases and store promotion manual', () => {
    for (const name of ['release', 'promote']) {
      expect(Object.keys(workflow(name).on)).toEqual(['workflow_dispatch']);
    }
  });

  it('runs the whole test line automatically on the stage branch, against staging only', () => {
    const preview = workflow('preview');
    expect(preview.on.push.branches).toEqual(['stage']);
    expect(Object.keys(preview.jobs)).toEqual(['ci', 'backend', 'android', 'ota', 'github-release']);
    expect(preview.jobs.backend.with.environment).toBe('staging');
    for (const job of Object.values(preview.jobs) as { if?: string }[]) expect(job.if).toBeUndefined();
    expect(preview.jobs.android.with).toMatchObject({ profile: 'preview', submit: false, skip_backend_check: true });
    expect(preview.jobs.ota.with).toMatchObject({ channel: 'preview', skip_backend_check: true });
    expect(preview.jobs.android.if).toBeUndefined();
    expect(preview.jobs.ota.if).toBeUndefined();
  });

  it('waits for a usable Android binary before publishing its OTA update', () => {
    const preview = workflow('preview');
    expect(preview.jobs.android.needs).toContain('backend');
    expect(preview.jobs.ota.needs).toContain('android');
    expect(preview.concurrency).toMatchObject({ 'cancel-in-progress': false });
  });

  it('attaches the stage APK to a GitHub pre-release, never to the latest release', () => {
    const preview = workflow('preview');
    const release = preview.jobs['github-release'];
    expect(release.needs).toBe('android');
    expect(release.permissions).toEqual({ contents: 'write' });
    expect(release.env.BUILD_ID).toBe('${{ needs.android.outputs.build_id }}');
    expect(preview.permissions).toEqual({ contents: 'read' });
    const publish = release.steps.find((step: { name: string }) => step.name.includes('Publish the pre-release'));
    expect(publish.run).toContain('--prerelease --latest=false');
    expect(workflow('build-android').on.workflow_call.outputs.build_id.value).toBe('${{ jobs.build-android.outputs.build_id }}');
  });

  it('publishes an Expo Go copy of preview updates only', () => {
    const steps = workflow('ota').jobs.update.steps as { name: string; if?: string; run?: string }[];
    const copy = steps.find((step) => step.name.includes('Expo Go'))!;
    expect(copy.if).toBe("inputs.channel == 'preview'");
    expect(copy.run).toContain('EXPO_GO_UPDATE=1 eas update --platform android');
    // dist/ of the builds' update must be uploaded to Sentry before the copy rewrites it
    expect(steps.indexOf(copy)).toBeGreaterThan(steps.findIndex((step) => step.name.includes('source maps')));
  });

  it('skips the staging backend comparison only when a caller asks, and never for production', () => {
    for (const child of ['ota', 'build-android']) {
      const config = workflow(child);
      expect(config.on.workflow_call.inputs.skip_backend_check.default).toBe(false);
      expect(config.on.workflow_dispatch.inputs.skip_backend_check).toBeUndefined();
    }
    const android = workflow('build-android').jobs;
    expect(android.staging.if).toBe("inputs.profile != 'production' && !inputs.skip_backend_check");
    const ota = workflow('ota').jobs.update;
    const check = ota.steps.find((step: { name: string }) => step.name.includes("talks to this channel's backend"));
    expect(check.if).toBe("${{ inputs.channel == 'production' || !inputs.skip_backend_check }}");
    expect(ota.environment).toContain("inputs.channel == 'production' && 'production'");
  });

  it('deploys Android only: no iOS build, submit or update', () => {
    expect(existsSync('.github/workflows/build-ios.yml')).toBe(false);
    expect(Object.keys(workflow('release').jobs)).not.toContain('ios');
    expect(workflow('promote').on.workflow_dispatch.inputs.platform).toBeUndefined();
    const publish = workflow('ota').jobs.update.steps.find((step: { name: string }) => step.name.includes('Publish the update'));
    expect(publish.run).toContain('eas update --platform android');
  });

  it('lets child workflows skip CI only when the parent completed its CI gate', () => {
    for (const parent of ['preview', 'release']) {
      const { jobs } = workflow(parent);
      expect(jobs.ci.uses).toBe('./.github/workflows/ci-check.yml');
      for (const name of parent === 'preview' ? ['backend', 'android', 'ota'] : ['backend', 'android']) {
        expect(jobs[name].with.ci_checked).toBe(true);
      }
    }
    for (const child of ['ota', 'build-android', 'deploy-backend']) {
      const config = workflow(child);
      expect(config.on.workflow_call.inputs.ci_checked.default).toBe(false);
      expect(config.on.workflow_dispatch.inputs.ci_checked).toBeUndefined();
      expect(config.jobs.ci.if).toBe('${{ !inputs.ci_checked }}');
    }
  });
});
