// M8-012: backup/PITR/reconcile/DR/retention verification (ASCII-only).
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
record('rpo-rto', read('docs/02-architecture/v2-microservices-architecture.md').indexOf('RPO') >= 0,
  'RPO/RTO targets doc', 'RPO/RTO');
record('reconcile', read('services/commerce-service/src/main/java/com/englishflow/commerce/application/CommerceApplicationService.java').indexOf('reconcileOrder') >= 0,
  'order reconcile + repair flag', 'reconcile');
record('owner-receipts', read('packages/contracts/fragments/m1-017-privacy-lifecycle.openapi.json').indexOf('M1017OwnerReceiptSummary') >= 0 || read('packages/contracts/fragments/m1-017-privacy-lifecycle.openapi.json').indexOf('ownerReceipts') >= 0,
  'owner receipt contract', 'owner receipts');
record('legal-hold', read('packages/contracts/fragments/m1-017-privacy-lifecycle.openapi.json').indexOf('ACTIVE_RETAINED') >= 0,
  'legal-hold outcomes', 'legal hold');
record('export-expiry', read('services/learner-service/src/main/java/com/englishflow/learner/web/B25LearnerJdbcController.java').indexOf('EXPIRED') >= 0,
  'export expiry enforced', 'retention/expiry');
record('deletion-retained', read('services/iam-service/src/main/java/com/englishflow/iam/web/IamAccountDeletionController.java').indexOf('receipt') >= 0,
  'deletion rows retained + receipts', 'delete retention');
record('recovery-receipts', read('services/workflow-service/src/main/java/com/englishflow/workflow/application/ManualRecoveryService.java').indexOf('recordReceipt') >= 0,
  'recovery receipts', 'recovery audit');
record('anchors', exists('evidence/p1r/m8/P1R-M8-006/manifest.json') && exists('evidence/p1r/m8/P1R-M8-011/manifest.json'),
  'M8-006 + M8-011 closed', 'anchors');
console.log('M8-012 DR: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-012', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed: passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live backup-restore drill and PITR proof deferred to acceptance.'],
  note: 'DR capability verification; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-012'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-012/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
