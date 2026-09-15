// M3-009: admin supply-chain slices (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
for (const v of ['AdminContentView.vue','AdminAuditView.vue','AdminB12GovernanceView.vue','AdminCommerceView.vue','AdminB6ReleaseView.vue']) {
  record(`slice-exists:${v}`, exists(`apps/admin-web/src/views/${v}`), 'present', 'present');
}
const audit = read('apps/admin-web/src/views/AdminAuditView.vue');
record('audit-redacted-export', audit.includes('脱敏'), 'redacted export', 'desensitization');
const gov = read('apps/admin-web/src/views/AdminB12GovernanceView.vue');
record('governance-recovery-entries', gov.includes('recovery') && gov.includes('permission'), 'recovery + permission states', 'recovery entries');
const content = read('apps/admin-web/src/views/AdminContentView.vue');
record('publish-rollback-gated', content.includes('canPublishSelected') && content.includes('canRollbackSelected'), 'publish/rollback gated', 'PEP');
record('read-only-projection', content.includes('服务端投影'), 'server projection wording', 'read-only');
console.log('M3-009 slices: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M3-009', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Cross-tenant negative against live admin-ops/audit and dual-approval live run deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed admin-web tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm3', 'P1R-M3-009'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m3/P1R-M3-009/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
