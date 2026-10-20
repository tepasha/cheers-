import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const workflow = (name: string) => parse(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));
type Step = { name?: string; if?: string; run?: string; uses?: string };
const step = (steps: Step[], name: string) => steps.find((s) => s.name?.includes(name))!;

describe('Expo deployment entry points', () => {
  it('keeps every production path manual', () => {
    for (const name of ['release', 'promote', 'ota']) {
      expect(Object.keys(workflow(name).on)).toEqual(['workflow_dispatch']);
    }
    for (const name of ['build-android', 'deploy-backend']) {
      expect(Object.keys(workflow(name).on)).toEqual(['workflow_call', 'workflow_dispatch']);
    }
  });

  it('runs the whole test line automatically on the stage branch, against staging only', () => {
    const preview = workflow('preview');
    expect(preview.on.push.branches).toEqual(['stage']);
    expect(Object.keys(preview.jobs)).toEqual(['ci', 'backend', 'android', 'ios', 'ota']);
    expect(preview.jobs.ci.uses).toBe('./.github/workflows/ci-check.yml');
    expect(preview.jobs.backend.environment).toBe('staging');
    expect(preview.jobs.android.env.PROFILE).toBe('preview');
    expect(preview.jobs.ota.env.CHANNEL).toBe('preview');
    expect(preview.concurrency).toMatchObject({ 'cancel-in-progress': false });
  });

  it('runs every stage step on every push: nothing is skipped, nothing reuses the production workflows', () => {
    const preview = workflow('preview');
    for (const [name, job] of Object.entries(preview.jobs) as [string, { if?: string; uses?: string; steps?: Step[] }][]) {
      // iOS is the one switch: off until the Apple side is set up
      if (name === 'ios') continue;
      expect(job.if).toBeUndefined();
      if (name !== 'ci') expect(job.uses).toBeUndefined();
      // `always()` only keeps the cleanup running after a failure
      for (const s of job.steps ?? []) expect(s.if === undefined || s.if === 'always()').toBe(true);
    }
  });

  it('orders the stage line: backend before the apps, the APK before its OTA update', () => {
    const { jobs } = workflow('preview');
    expect(jobs.backend.needs).toBe('ci');
    expect(jobs.android.needs).toBe('backend');
    expect(jobs.ota.needs).toBe('android');
    expect(jobs.ios.needs).toBe('backend');
  });

  it('runs the iOS preview in its own workflow, behind IOS_PREVIEW, from stage only', () => {
    const { ios } = workflow('preview').jobs;
    expect(ios.if).toBe("vars.IOS_PREVIEW == 'true'");
    expect(ios.uses).toBe('./.github/workflows/preview-ios.yml');
    expect(ios.with.ci_checked).toBe(true);
    const config = workflow('preview-ios');
    expect(Object.keys(config.on)).toEqual(['workflow_call', 'workflow_dispatch']);
    expect(config.permissions).toEqual({ contents: 'read' });
    expect(config.jobs.gate.steps[0].run).toContain('refs/heads/stage');
    const job = config.jobs.ios;
    expect(job.needs).toEqual(['gate', 'ci']);
    expect(job.env).toEqual({ PROFILE: 'preview', CHANNEL: 'preview' });
    // A called workflow must not wait on its caller's concurrency group
    expect(job.concurrency.group).not.toBe(workflow('preview').concurrency.group);
    const steps = job.steps as Step[];
    expect(step(steps, 'EAS Build for iOS').if).toBe("steps.plan.outputs.build == 'true'");
    const update = step(steps, 'Publish the update');
    expect(update.if).toBeUndefined();
    expect(update.run).toContain('eas update --platform ios --channel "$CHANNEL"');
    expect(steps.indexOf(update)).toBeGreaterThan(steps.indexOf(step(steps, 'EAS Build for iOS')));
  });

  it('attaches the stage APK to a GitHub pre-release, never to the latest release', () => {
    const preview = workflow('preview');
    expect(preview.permissions).toEqual({ contents: 'read' });
    expect(preview.jobs.android.permissions).toEqual({ contents: 'write' });
    expect(step(preview.jobs.android.steps, 'Publish the pre-release').run).toContain('--prerelease --latest=false');
  });

  it('publishes an Expo Go copy of each preview update, after the source maps of the APK update', () => {
    const steps = workflow('preview').jobs.ota.steps as Step[];
    const copy = step(steps, 'Expo Go');
    expect(copy.run).toContain('EXPO_GO_UPDATE=1 eas update --platform android');
    expect(steps.indexOf(copy)).toBeGreaterThan(steps.indexOf(step(steps, 'source maps')));
    expect(JSON.stringify(workflow('ota'))).not.toContain('EXPO_GO_UPDATE');
  });

  it('keeps the shared workflows production-only', () => {
    expect(workflow('ota').jobs.update.environment).toBe('production');
    expect(workflow('ota').jobs.update.env.CHANNEL).toBe('production');
    expect(step(workflow('ota').jobs.update.steps, 'production backend').if).toBeUndefined();
    expect(workflow('build-android').jobs['build-android'].env.PROFILE).toBe('production');
    expect(workflow('build-android').jobs.staging).toBeUndefined();
    expect(workflow('deploy-backend').jobs.deploy.environment).toBe('production');
    for (const name of ['build-android', 'deploy-backend']) {
      const inputs = Object.keys(workflow(name).on.workflow_call.inputs);
      expect(inputs).not.toContain('profile');
      expect(inputs).not.toContain('environment');
      expect(inputs).not.toContain('skip_backend_check');
    }
  });

  it('deploys Android only to production: no iOS build, submit or update', () => {
    expect(existsSync('.github/workflows/build-ios.yml')).toBe(false);
    expect(Object.keys(workflow('release').jobs)).not.toContain('ios');
    expect(workflow('promote').on.workflow_dispatch.inputs.platform).toBeUndefined();
    expect(step(workflow('ota').jobs.update.steps, 'Publish the update').run).toContain('eas update --platform android');
    expect(step(workflow('preview').jobs.ota.steps, 'Publish the update').run).toContain('eas update --platform android');
  });

  it('lets child workflows skip CI only when the parent completed its CI gate', () => {
    const { jobs } = workflow('release');
    expect(jobs.ci.uses).toBe('./.github/workflows/ci-check.yml');
    for (const name of ['backend', 'android']) expect(jobs[name].with.ci_checked).toBe(true);
    for (const child of ['build-android', 'deploy-backend', 'preview-ios']) {
      const config = workflow(child);
      expect(config.on.workflow_call.inputs.ci_checked.default).toBe(false);
      expect(config.on.workflow_dispatch?.inputs?.ci_checked).toBeUndefined();
      expect(config.jobs.ci.if).toBe('${{ !inputs.ci_checked }}');
    }
    expect(workflow('ota').jobs.ci.if).toBeUndefined();
  });
});
