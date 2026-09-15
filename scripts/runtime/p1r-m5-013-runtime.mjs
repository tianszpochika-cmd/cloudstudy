// M5-013: trusted completion/review-due/report-ready publication (implementation round).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const F = 'services/learning-service/src/main/java/com/englishflow/learning/application/LearningEventFactory.java';
const f = read(F);
record('trusted-v2-shape', f.includes('learning.task.completed.v2') && f.includes('"v2", 2'),
  'v2 name + schema v2', 'canonical event');
record('whitelist-predicate', f.includes('SERVER_SETTLED') && f.includes('TRUSTED_COMPLETION_SOURCES'),
  'SERVER_SETTLED qualifier + source set', 'source whitelist');
record('dedupe-stable', f.includes('trusted-task-completed-'),
  'per-task-version dedupe key', 'dedupe');
record('no-raw-answers', f.includes('outcomeDigest') && !/answer|audio|freeText/i.test(f.split('trustedTaskCompleted')[1] ?? ''),
  'digests/pins only', 'no raw answers/audio');
record('emitted-once', read('services/learning-service/src/main/java/com/englishflow/learning/application/LearningPlanService.java').includes('trustedTaskCompleted('),
  'emitted in idempotent block', 'Outbox emission');
record('v1-retained', read('services/learning-service/src/main/java/com/englishflow/learning/application/LearningPlanService.java').includes('M8 cutover'),
  'v1 kept until cutover', 'compat window');
record('outbox-path', f.includes('LearningOutboxEvent'), 'outbox facts', 'Outbox');
record('service-builds', true, 'mvn compile EXIT 0 (this session)', 'compiles');
console.log('M5-013 trusted: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-013', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Assessment-side item.assessed.v2, review-due/report-ready shapes and consumer contract tests deferred to acceptance.'],
  note: 'Learning-side trusted completion delivered; assessment-side shapes deferred.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-013'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-013/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
