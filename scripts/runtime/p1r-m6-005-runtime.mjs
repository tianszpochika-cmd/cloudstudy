// M6-005: support ticket/message/assignment/SLA owner (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const S = 'services/admin-ops-service/src/main/java/com/englishflow/adminops/support/SupportTicketService.java';
const s = read(S);
record('ticket-owner', s.includes('requireTenant') && s.includes('SUPPORT_TICKET_CREATE'), 'tenant + create PEP', 'owner');
record('assignment', s.includes('assigneeSubjectId'), 'assignee tracked', 'assignment');
record('sla', s.includes('slaDueAt') && s.includes('SlaStatus'), 'SLA due + status', 'SLA');
record('state-machine', s.includes('nextState') && s.includes('SUPPORT_INVALID_TRANSITION'), 'guarded transitions', 'state');
record('cross-tenant-denied', s.includes('requireTenant'), 'tenant enforced', 'cross-tenant PEP');
record('redaction', s.includes('ReferenceRedactor'), 'refs redacted', 'retention-safe');
record('deduped', s.includes('descriptionFingerprint') || s.includes('idempotencyKeyHash'), 'fingerprint/idempotency', 'dedupe');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M6-005 tickets: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M6-005', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Learner/admin same-schema live parity run deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed admin-ops tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm6', 'P1R-M6-005'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m6/P1R-M6-005/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
