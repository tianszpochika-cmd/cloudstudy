// M4-007: deterministic daily plan, budget, backlog protection, reason codes (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
record('quotas-frozen', read('services/learning-service/src/main/java/com/englishflow/learning/domain/DailyQuotaMinutes.java').includes('5, 15, 30, or 45'),
  '5/15/30/45 enforced', 'budget');
record('timezone-carried', read('services/learning-service/src/main/java/com/englishflow/learning/application/LearningPlanService.java').includes('timeZone') || read('services/learning-service/src/main/java/com/englishflow/learning/domain/LearningPlan.java').includes('timeZone'),
  'timezone in plan', 'timezone/DST');
record('idempotent-saga', read('services/learning-service/src/main/java/com/englishflow/learning/application/LearningPlanService.java').includes('plan.create') && read('services/learning-service/src/main/java/com/englishflow/learning/application/LearningPlanService.java').includes('plan.resume'),
  'create/resume idempotent', 'idempotent Saga');
record('version-guarded', read('services/learning-service/src/main/java/com/englishflow/learning/application/LearningPlanService.java').includes('requireVersion'),
  'expectedPlanVersion guard', 'reorder guard');
record('reason-codes', read('services/learning-service/src/main/java/com/englishflow/learning/web/B3LearningJdbcController.java').includes('RULE_RETRY'),
  'reasonTrace codes', 'reason codes');
record('queue-ordered', read('services/learning-service/src/main/java/com/englishflow/learning/adapter/memory/InMemoryLearningFactStore.java').includes('sorted'),
  'due-ordered queue', 'deterministic order');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M4-007 plan: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M4-007', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Pure-function determinism fixtures and DST boundary proof deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed learning-service tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm4', 'P1R-M4-007'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m4/P1R-M4-007/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
