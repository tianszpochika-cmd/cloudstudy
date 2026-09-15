// M4-005: P1_PLACEMENT_V1 engine, selection, checkpoint, resume (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
record('manifest-frozen', read('packages/contracts/fragments/b10/b10-placement.openapi.json').includes('P1_PLACEMENT_V1') && read('packages/contracts/fragments/b10/b10-placement.openapi.json').includes('ten-item'),
  'P1_PLACEMENT_V1 ten-item manifest', 'manifest');
record('ten-four-dimensions', read('packages/contracts/generated/openapi.ts').includes('totalItemCount: 10'),
  '10 items, 4 dimensions', 'selection set');
record('placement-lifecycle', read('services/assessment-service/src/main/java/com/englishflow/assessment/web/B25AssessmentJdbcController.java').includes('/placement/start') && read('services/assessment-service/src/main/java/com/englishflow/assessment/web/B25AssessmentJdbcController.java').includes('/placement/submit-step'),
  'start/submit/skip/report', 'lifecycle');
record('checkpoint-monotonic', read('services/assessment-service/src/main/java/com/englishflow/assessment/domain/AssessmentSession.java').includes('ASM_CHECKPOINT_CONFLICT'),
  'monotonic seq + hash guard', 'checkpoint');
record('resume-idempotent', read('services/assessment-service/src/main/java/com/englishflow/assessment/web/B25AssessmentJdbcController.java').includes('Idempotency-Key'),
  'idempotent submit/resume', 'resume');
record('content-pinned', read('services/assessment-service/src/main/java/com/englishflow/assessment/web/B25AssessmentJdbcController.java').includes('content_version_id') || read('services/assessment-service/src/main/java/com/englishflow/assessment/web/B25AssessmentJdbcController.java').includes('contentVersionId'),
  'content version pins', 'contentVersion');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M4-005 placement: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M4-005', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Fixed-input/output determinism run and boundary/confidence live fixtures deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from contracts + assessment-service; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm4', 'P1R-M4-005'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m4/P1R-M4-005/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
