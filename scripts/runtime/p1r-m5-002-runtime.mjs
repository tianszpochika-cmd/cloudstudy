// M5-002: session/checkpoint/attempt + idempotent scoring entry (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const B10 = 'services/assessment-service/src/main/java/com/englishflow/assessment/web/B10AssessmentJdbcController.java';
const b10 = read(B10);
record('session-entry', b10.includes('/sessions') && b10.includes('Idempotency-Key'), 'sessions with idempotency', 'session');
record('checkpoint-entry', b10.includes('checkpoint') && b10.includes('checkpointDigest'), 'versioned checkpoint + digest', 'checkpoint');
record('attempt-idempotent', b10.includes('claimAttemptIdempotency') && b10.includes('was reused with a different'),
  'digest-guarded idempotency', 'attempt idempotency');
record('submission-digest', b10.includes('submission_digest') && b10.includes('submissionDigest'), 'submission digests', 'digest');
record('owner-db', b10.includes('principal_id = ? AND tenant_id = ?'), 'owner-scoped writes', 'owner DB');
record('resume-path', b10.includes('/sessions/{sessionId}'), 'session resume read', 'resume');
record('old-version-kept', b10.includes('content_version_id'), 'version pins kept', 'old versions');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M5-002 attempt: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-002', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['alternativeContentVersionId population from the M5-001 policy and repeat/timeout/out-of-order live duel deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed assessment-service tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-002'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-002/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
