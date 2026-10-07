import { describe, expect, it } from 'vitest';
import { parseRollout, planRollout } from '../../../scripts/play-promote.mjs';

const notes = [{ language: 'uk-UA', text: 'Виправлення' }];
const internal = { track: 'internal', releases: [{ name: '1.0.0 (5)', versionCodes: ['5'], status: 'completed', releaseNotes: notes }] };
const liveOld = { name: '0.9.0 (4)', versionCodes: ['4'], status: 'completed' };

describe('play-promote', () => {
  it('accepts fractions above 0 and at most 1', () => {
    expect(parseRollout('0.1')).toBe(0.1);
    expect(parseRollout(' 0.5 ')).toBe(0.5);
    expect(parseRollout('1')).toBe(1);
    expect(parseRollout('1.0')).toBe(1);
    for (const bad of ['0', '0.0', '1.5', '10%', '', '-0.1', '.5', 'abc', undefined]) {
      expect(() => parseRollout(bad as string)).toThrow(/rollout/);
    }
  });

  it('promotes the internal release to production as a staged rollout, without any upload', () => {
    const { track } = planRollout({ internalTrack: internal, productionTrack: { releases: [liveOld] }, versionCode: 5, rollout: 0.1 });
    expect(track).toEqual({
      track: 'production',
      releases: [{ name: '1.0.0 (5)', versionCodes: ['5'], status: 'inProgress', userFraction: 0.1, releaseNotes: notes }],
    });
  });

  it('promotes straight to 100% as a completed release (Play rejects userFraction 1)', () => {
    const { track } = planRollout({ internalTrack: internal, productionTrack: null, versionCode: '5', rollout: 1 });
    expect(track.releases).toEqual([{ name: '1.0.0 (5)', versionCodes: ['5'], status: 'completed', releaseNotes: notes }]);
  });

  it('raises a running rollout and then completes it', () => {
    const rolling = { releases: [liveOld, { name: '1.0.0 (5)', versionCodes: ['5'], status: 'inProgress', userFraction: 0.1 }] };
    expect(planRollout({ internalTrack: internal, productionTrack: rolling, versionCode: 5, rollout: 0.5 }).track.releases).toEqual([
      { name: '1.0.0 (5)', versionCodes: ['5'], status: 'inProgress', userFraction: 0.5 },
    ]);
    const done = planRollout({ internalTrack: internal, productionTrack: rolling, versionCode: 5, rollout: 1 });
    expect(done.track.releases).toEqual([{ name: '1.0.0 (5)', versionCodes: ['5'], status: 'completed' }]);
    expect(done.summary).toMatch(/inProgress 0\.1 → completed/);
  });

  it('resumes a halted rollout', () => {
    const halted = { releases: [{ versionCodes: ['5'], status: 'halted', userFraction: 0.1 }] };
    expect(planRollout({ internalTrack: internal, productionTrack: halted, versionCode: 5, rollout: 0.2 }).track.releases[0]).toMatchObject({
      status: 'inProgress',
      userFraction: 0.2,
    });
  });

  it('refuses what Play would refuse or what was never tested', () => {
    expect(() => planRollout({ internalTrack: internal, productionTrack: null, versionCode: 6, rollout: 0.1 })).toThrow(/not on the internal track/);
    expect(() => planRollout({ internalTrack: null, productionTrack: null, versionCode: 5, rollout: 0.1 })).toThrow(/not on the internal track/);
    const rolling = { releases: [{ versionCodes: ['5'], status: 'inProgress', userFraction: 0.5 }] };
    expect(() => planRollout({ internalTrack: internal, productionTrack: rolling, versionCode: 5, rollout: 0.1 })).toThrow(/cannot be lowered/);
    const done = { releases: [{ versionCodes: ['5'], status: 'completed' }] };
    expect(() => planRollout({ internalTrack: internal, productionTrack: done, versionCode: 5, rollout: 1 })).toThrow(/already rolled out/);
    expect(() => planRollout({ internalTrack: internal, productionTrack: null, versionCode: 'null', rollout: 0.1 })).toThrow(/positive integer/);
  });
});
