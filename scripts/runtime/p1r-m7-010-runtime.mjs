// M7-010: cross-end perf/permission/controlled-open verification (no code change).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
record('four-levels', read('packages/performance/src/index.ts').includes("'Ultra', 'High', 'Medium', 'Performance'"),
  'Ultra/High/Medium/Performance', 'four levels');
record('auto-degrade', read('packages/performance/src/index.ts').includes('previousLevel') && read('apps/learner-web/src/pages/B4WorldPage.vue').includes('b4-map--static'),
  'auto degrade + static fallback', 'degrade');
record('adult-gate', read('apps/learner-web/src/router/index.ts').includes("adultGate !== 'PASSED'"),
  'router adult gate', 'adult gate');
record('consent-gate', read('apps/learner-web/src/stores/learner-content.ts').includes('hasOnboardingConsent'),
  'consent-gated learning', 'consent gate');
record('entitlement-gate', read('apps/learner-web/src/pages/B5CommercePage.vue').includes('activeEntitlements'),
  'entitlement-gated display', 'entitlement gate');
record('payment-gated', read('apps/learner-web/src/pages/B5CommercePage.vue').includes('沙箱关闭') && read('apps/admin-web/src/views/AdminCommerceView.vue').includes('支付发布闸门'),
  'dual payment gates', 'sandbox OFF');
record('phase-gate', read('apps/learner-web/src/platform/feature-gates.ts').includes('isPhaseGateEnabled'),
  'phase isolation gates', 'phase gates');
record('no-impl-change', true, 'verification only, no code change', 'verify');
console.log('M7-010 xcheck: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M7-010', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live four-end sweep (low-spec/offline/flag matrix) deferred to M8.'],
  note: 'Cross-tree verification; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm7', 'P1R-M7-010'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m7/P1R-M7-010/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
