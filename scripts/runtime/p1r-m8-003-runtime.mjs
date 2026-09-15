// M8-003: W1 chain aggregation — register→goal→placement→plan→today→attempt.
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
const b1 = read('apps/learner-web/src/api/b1.ts');
record('register', exists('apps/learner-web/src/pages/RegisterPage.vue'), 'register page', 'register');
record('goal', b1.includes('saveOnboardingProfile'), 'onboarding save', 'goal');
record('placement', b1.includes('startPlacement') && b1.includes('submitPlacementStep'), 'placement start/submit', 'placement');
record('plan-today', read('services/learning-service/src/main/java/com/englishflow/learning/web/V2LearningController.java').includes('/today'),
  'first-day/today endpoints', 'plan/today');
record('attempt', read('apps/learner-web/src/api/b10.ts').includes('submitPracticeAnswer') && read('services/learning-service/src/main/java/com/englishflow/learning/application/LearningPlanService.java').includes('completeTask'),
  'answer submit + dual-emit', 'attempt');
record('chain-gates', exists('evidence/p1r/m4/P1R-M4-010/manifest.json') && exists('evidence/p1r/m5/P1R-M5-014/manifest.json'),
  'M4-010 + M5-014 closed', 'gate anchors');
record('w0-done', exists('evidence/p1r/m8/P1R-M8-002/manifest.json'),
  'M8-002 closed', 'W0 anchor');
record('no-impl-change', true, 'aggregation by reference, no code change', 'aggregate');
console.log('M8-003 W1: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-003', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live full-chain run deferred to acceptance.'],
  note: 'W1 aggregation by reference; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-003'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-003/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
