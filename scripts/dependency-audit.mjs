import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Fail on new advisories, expired exceptions, malformed reports, or registry failures. */
export function auditProblems(report, exceptions, now = new Date()) {
  if (!report?.vulnerabilities || !report?.metadata?.vulnerabilities || report.error) return ['Could not obtain a valid npm audit report'];
  const actual = new Map();
  for (const entry of Object.values(report.vulnerabilities)) {
    if (!Array.isArray(entry.via)) return ['Malformed vulnerability record'];
    for (const advisory of entry.via) {
      if (advisory && typeof advisory === 'object') actual.set(advisory.url, advisory);
      else if (typeof advisory !== 'string' || !report.vulnerabilities[advisory]) return ['Unresolved vulnerability record'];
    }
  }
  if (report.metadata.vulnerabilities.total > 0 && actual.size === 0) return ['Audit did not describe its advisories'];
  const problems = [];
  for (const [url, advisory] of actual) {
    const exception = exceptions.find((item) => item.url === url && item.package === advisory.name);
    if (!exception) problems.push(`Unreviewed advisory: ${advisory.name} ${url}`);
    else if (!(new Date(`${exception.expiresAt}T00:00:00Z`) > now)) problems.push(`Expired advisory exception: ${url}`);
  }
  return problems;
}

function run() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { exceptions } = JSON.parse(readFileSync(new URL('../docs/dependency-audit-exceptions.json', import.meta.url), 'utf8'));
  for (const [label, cwd, allowed] of [['application', root, exceptions], ['functions', fileURLToPath(new URL('../functions/', import.meta.url)), []]]) {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd audit --json'] : ['audit', '--json'];
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    let report;
    try { report = JSON.parse(result.stdout); } catch { throw new Error(`${label}: npm audit failed or returned invalid JSON`); }
    const problems = auditProblems(report, allowed);
    if (result.error || ![0, 1].includes(result.status)) problems.push('npm audit command failed');
    if (problems.length) throw new Error(`${label}: ${problems.join('; ')}`);
    console.log(`${label}: ${report.metadata.vulnerabilities.total} audit records; no unreviewed or expired advisories`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();
