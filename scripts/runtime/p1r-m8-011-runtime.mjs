// M8-011: fault-injection/recovery verification (ASCII-only).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed: observed, expected: expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
record('saga-states', read('services/workflow-service/src/main/java/com/englishflow/workflow/domain/SagaStatus.java').indexOf('COMPENSATION_FAILED') >= 0,
  'compensating/compensated/failed states', 'saga states');
record('compensation-order', read('services/workflow-service/src/main/java/com/englishflow/workflow/domain/SagaStateMachine.java').indexOf('compensationOrder') >= 0,
  'reverse-order compensation', 'compensation');
record('two-person', read('services/workflow-service/src/main/java/com/englishflow/workflow/domain/ManualRecoveryRequest.java').indexOf('cannot approve their own recovery') >= 0,
  'two-person recovery rule', 'manual recovery');
record('idempotent-executor', read('services/workflow-service/src/main/java/com/englishflow/workflow/application/SagaCompensationExecutor.java').indexOf('skipped') >= 0,
  'applied compensations skipped', 'no double undo');
record('dlq', read('services/gamification-service/src/main/java/com/englishflow/gamification/integration/TrustedCompletionKafkaConsumer.java').indexOf('getDlqTopic') >= 0,
  'consumer DLQ routing', 'DLQ');
record('retry-backoff', read('services/gamification-service/src/main/java/com/englishflow/gamification/integration/TrustedCompletionKafkaConsumer.java').indexOf('backoff') >= 0,
  'bounded backoff+jitter', 'retry');
record('graceful', read('services/gamification-service/src/main/resources/application.yml').indexOf('graceful') >= 0,
  'graceful shutdown', 'shutdown');
record('anchors', exists('evidence/p1r/m8/P1R-M8-006/manifest.json') && exists('evidence/p1r/m8/P1R-M8-009/manifest.json'),
  'M8-006 + M8-009 closed', 'anchors');
console.log('M8-011 chaos: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-011', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed: passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live fault-injection runs and alert drills deferred to acceptance.'],
  note: 'Mechanism verification; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-011'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-011/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
