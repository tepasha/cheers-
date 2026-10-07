import { describe, expect, it } from 'vitest';
import { auditProblems } from '../../../scripts/dependency-audit.mjs';

const report = { metadata: { vulnerabilities: { total: 2 } }, vulnerabilities: { lib: { via: [{ name: 'lib', url: 'https://advisory.test/1' }] }, parent: { via: ['lib'] } } };
const exceptions = [{ package: 'lib', url: 'https://advisory.test/1', expiresAt: '2026-11-06' }];
describe('dependency audit gate', () => {
  it('accepts a reviewed transitive advisory only within its review window', () => {
    expect(auditProblems(report, exceptions, new Date('2026-10-07'))).toEqual([]);
    expect(auditProblems(report, exceptions, new Date('2026-11-06'))).toEqual([expect.stringContaining('Expired')]);
  });
  it('denies new advisories and registry failures', () => {
    expect(auditProblems(report, [], new Date('2026-10-07'))).toEqual([expect.stringContaining('Unreviewed')]);
    expect(auditProblems({ error: 'registry unavailable' }, exceptions)).toEqual([expect.stringContaining('valid')]);
  });
});
