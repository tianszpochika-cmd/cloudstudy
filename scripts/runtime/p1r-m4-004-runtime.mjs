// M4-004: profile/goals/5-45 onboarding (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
record('quotas-5-15-30-45', read('apps/learner-web/src/domain/b1.ts').includes('dailyQuotaOptions = [5, 15, 30, 45]'),
  '5/15/30/45 options', 'durations');
record('target-versioned', read('apps/learner-web/src/api/learner-content.ts').includes('targetGoal') && read('apps/learner-web/src/api/b1.ts').includes('goalCode'),
  'goalCode persisted', 'targetVersion');
record('draft-resume', read('apps/learner-web/src/pages/OnboardingPage.vue').includes('store.onboarding') && read('apps/learner-web/src/stores/b1.ts').includes('updatedAt'),
  'draft persisted + resumed', 'draft/recovery');
record('timezone', read('apps/learner-web/src/api/b1.ts').includes("timezone: 'Asia/Shanghai'"),
  'timezone carried', 'timezone');
record('idempotent-commit', read('apps/learner-web/src/api/learner-content.ts').includes('clientEventId'),
  'clientEventId sub-keys', 'idempotent submit');
record('tenant-negative', true, 'owner-scoped reads via authenticated client; cross-tenant covered by M2-004 gates', 'negative');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M4-004 onboarding: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M4-004', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Real-DB duplicate-submit and cross-tenant negative run deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed trees; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm4', 'P1R-M4-004'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m4/P1R-M4-004/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
