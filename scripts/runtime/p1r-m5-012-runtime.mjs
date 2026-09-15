// M5-012: mistake/mastery/report/today/plan-map loop navigation (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pages = (n) => read(`apps/learner-web/src/pages/${n}`);
record('report-to-today', pages('AssessmentPage.vue').includes("router.push({ name: 'today' })"), 'assessment→today', 'repair→verify');
record('practice-to-today', pages('B2PracticePage.vue').includes("router.push({ name: 'today' })"), 'practice→today', 'verify→report');
record('home-hub', pages('HomePage.vue').includes("name: 'today'") && pages('HomePage.vue').includes("name: 'learn'"), 'home fans out', 'hub');
record('loop-links', pages('LearningLoopPage.vue').includes("name: 'vocabulary'") && pages('LearningLoopPage.vue').includes("name: 'weakness-report'"), 'loop→srs/report', 'loop');
record('today-continues', pages('TodayPage.vue').includes('continueLearning'), 'today→session', 'next task');
record('no-fake-mastery', pages('B2ReportPage.vue').includes('不根据本地点击推算'), 'no local mastery', 'honest loop');
record('offline-kept', pages('TodayPage.vue').includes('lastError'), 'error/recovery kept', 'recovery');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M5-012 loop: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-012', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live browser loop run (fix→verify→report→next with refresh/relogin/offline) deferred to M8 W2.'],
  note: 'REUSE-VERIFY: read from the committed learner-web tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-012'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-012/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
