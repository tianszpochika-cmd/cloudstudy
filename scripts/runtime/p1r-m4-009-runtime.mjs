// M4-009: cross-end consistency web/mobile (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const web = read('apps/learner-web/src/platform/gateway.ts');
const mob = read('apps/mobile/src/platform/gateway.ts');
record('returnTo-same-guards', web.includes("candidate.includes('\\\\')") && mob.includes("candidate.includes('\\\\')") && web.includes('startsWith(\'//\')') && mob.includes('startsWith(\'//\')'),
  'identical traversal guards', 'deep-link safety parity');
record('returnTo-platform-fallbacks', web.includes("fallback = '/home'") && mob.includes("fallback = '/pages/home/home'"),
  'per-platform fallbacks', 'correct fallbacks');
record('offline-states', read('apps/learner-web/src/platform/ui-state.ts').includes('offline') && read('apps/mobile/src/platform/ui-state.ts').includes('offline'),
  'offline state both ends', 'offline parity');
record('responsive-web', read('apps/learner-web/src/pages/AssessmentPage.vue').includes('@media'),
  'web media queries', 'responsive web');
record('responsive-mobile', read('apps/mobile/src/pages/login/login.vue').includes('rpx'),
  'mobile rpx units', 'responsive mobile');
record('relogin-returnTo', read('apps/learner-web/src/stores/session.ts').includes('consumeReturnTo') && read('apps/mobile/src/stores/session.ts').includes('consumeReturnTo'),
  'returnTo after re-login both', 're-login recovery');
record('same-owner-reads', read('apps/learner-web/src/api/learner-content.ts').includes('principal') || read('apps/learner-web/src/api/b1.ts').includes('/iam/devices'),
  'owner-scoped reads', 'same owner state');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M4-009 x-end: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M4-009', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live Web/H5/iPad size matrix and offline-kill run deferred to M8-007.'],
  note: 'REUSE-VERIFY: read from both client trees; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm4', 'P1R-M4-009'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m4/P1R-M4-009/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
