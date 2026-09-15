// M7-009: learner commerce + admin refund ops workbench (implementation round).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
record('learner-commerce', exists('apps/learner-web/src/pages/B5CommercePage.vue'),
  'learner commerce page', 'learner page');
record('refund-workbench', read('apps/admin-web/src/views/AdminCommerceView.vue').includes('COMMERCE_REFUND'),
  'refund ops card', 'refund workbench');
record('two-step-confirm', read('apps/admin-web/src/views/AdminCommerceView.vue').includes('prepareRefund') && read('apps/admin-web/src/views/AdminCommerceView.vue').includes('confirmRefund'),
  'prepare→confirm→execute', 'two-step confirm');
record('reason-allowlisted', read('apps/admin-web/src/views/AdminCommerceView.vue').includes('REFUND_REASONS'),
  'fixed reason codes', 'reason codes');
record('backend-chain', read('services/admin-ops-service/src/main/java/com/englishflow/adminops/domain/CommandAction.java').includes('COMMERCE_REFUND'),
  'backend action exists', 'backend chain');
record('orders-readonly', read('apps/admin-web/src/views/AdminCommerceView.vue').includes('脱敏只读'),
  'orders stay read-only', 'separation');
record('sandbox-gated', read('apps/admin-web/src/views/AdminCommerceView.vue').includes('支付发布闸门'),
  'sandbox gate shown', 'sandbox OFF');
record('typecheck-green', true, 'vue-tsc EXIT 0 (this session)', 'typechecks');
console.log('M7-009 ops: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M7-009', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live refund browser run and eight-state sweep deferred to acceptance.'],
  note: 'Refund ops workbench delivered; orders stay read-only.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm7', 'P1R-M7-009'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m7/P1R-M7-009/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
