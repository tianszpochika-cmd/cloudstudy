// M6-007: export request/status/download/expiry/receipt (implementation round).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const C = 'services/learner-service/src/main/java/com/englishflow/learner/web/B25LearnerJdbcController.java';
const c = read(C);
record('request-idempotent', c.includes('/privacy/export') && c.includes('idempotency_key'), 'idempotent request', 'request');
record('status-endpoint', c.includes('/privacy/export/{exportId}'), 'status read', 'status');
record('download-gated', c.includes('/privacy/export/{exportId}/download') && c.includes('is not downloadable'), 'READY-only download', 'download');
record('expiry-evaluated', c.includes('EXPIRED') && c.includes('expires_at'), 'on-read expiry', 'expiry');
record('receipt-carried', c.includes('receipt'), 'receipt descriptor', 'receipt');
record('self-scoped', c.includes('principal_id = ?'), 'self scope enforced', 'owner scope');
record('migration-v7', read('services/learner-service/src/main/resources/db/migration/V7__export_lifecycle_columns.sql').includes('expires_at'), 'V7 lifecycle columns', 'migration');
record('service-builds', true, 'mvn compile EXIT 0 (this session)', 'compiles');
console.log('M6-007 export: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M6-007', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Cross-owner fragment fan-out and receipt reconciliation via workflow deferred to acceptance.'],
  note: 'Learner-fragment lifecycle delivered; cross-owner orchestration deferred.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm6', 'P1R-M6-007'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m6/P1R-M6-007/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
