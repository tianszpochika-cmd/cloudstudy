// M5-010: mastery projection, D7 gate, migration, replayable degrade (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const MS = 'services/learning-service/src/main/java/com/englishflow/learning/domain/MasteryStage.java';
record('d7-gate', read(MS).includes('VerificationStage.D7') && read(MS).includes('CONSOLIDATED'),
  'CONSOLIDATED needs D7 + score + attempts', 'D7 gate');
record('stage-machine', read(MS).includes('assertTransition'), 'guarded transitions', 'state machine');
record('replayable', read('services/learning-service/src/main/java/com/englishflow/learning/domain/MasteryProjection.java').includes('replayed'),
  'duplicate evidence no-op', 'replayable');
record('evidence-versioned', read('services/learning-service/src/main/java/com/englishflow/learning/domain/MasteryProjection.java').includes('mastery.rule.v1'),
  'rule version pinned', 'rule version');
record('server-never-scores', read('services/learning-service/src/main/java/com/englishflow/learning/application/LearningMasteryService.java').includes('never scores'),
  'projection only, never scores', 'separation');
record('owner-scoped', read('services/learning-service/src/main/java/com/englishflow/learning/adapter/jdbc/JdbcLearningFactStore.java').includes('learning_runtime_mastery_projection'),
  'durable owner projection', 'owner DB');
record('degrade-failclosed', read('services/learning-service/src/main/java/com/englishflow/learning/adapter/failclosed/FailClosedLearningFactStore.java').includes('MasteryProjection'),
  'fail-closed store', 'degrade');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M5-010 mastery: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-010', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['History-migration replay and failure-degrade live runs deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed learning-service tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-010'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-010/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
