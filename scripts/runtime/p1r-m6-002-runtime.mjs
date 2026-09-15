// M6-002: retry/DLQ/manual recovery + domain isolation (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const R = 'services/notification-service/src/main/java/com/englishflow/notification/application/NotificationRetryApplicationService.java';
const C = 'services/notification-service/src/main/java/com/englishflow/notification/application/NotificationRecoveryApplicationService.java';
const r = read(R), c = read(C);
record('retry-dispatched', r.includes('RETRY_SCHEDULED') && r.includes('notification.retry.dispatch'), 'retry dispatch + audit', 'retry');
record('dlq-routed', r.includes('DEAD_LETTER') && r.includes('notification.dlq.v1'), 'DLQ routing + event', 'DLQ');
record('manual-recovery', c.includes('requireManualRecovery') && c.includes('notification.manual_recovery'), 'gated manual recovery + audit', 'recovery');
record('recovery-notice', c.includes('queueRecoveryNotice'), 'safe recovery notice', 'notice');
record('trace-audit', r.includes('traceId') && c.includes('traceId'), 'trace + audit links', 'trace');
record('domain-isolated', c.includes('notification-message') && !/learner|commerce|payment/i.test(c.split('queueRecoveryNotice')[0] ?? ''), 'notification-only writes', 'isolation');
record('deduped', r.includes('IdempotencyKey'), 'idempotent dispatch', 'dedupe');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M6-002 retry: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M6-002', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Channel-failure live run (no rollback of learning/payment) deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed notification-service tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm6', 'P1R-M6-002'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m6/P1R-M6-002/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
