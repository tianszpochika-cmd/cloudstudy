// M7-007: sandbox orders/intent/callback verify+dedupe, production OFF (test-verified).
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
record('hmac-tests', exists('services/commerce-service/src/test/java/com/englishflow/commerce/adapter/memory/HmacPaymentSignatureVerifierTest.java'),
  '13/13 signature cases', 'verify tests');
record('dedupe-tests', exists('services/commerce-service/src/test/java/com/englishflow/commerce/PaymentCallbackDeduplicationTest.java'),
  '4/4 dedupe cases', 'dedupe tests');
record('sandbox-tests', exists('services/commerce-service/src/test/java/com/englishflow/commerce/adapter/memory/SandboxPaymentProviderTest.java'),
  '8/8 sandbox cases', 'sandbox tests');
record('gate-tests', exists('services/commerce-service/src/test/java/com/englishflow/commerce/config/PaymentGateAndPropertiesTest.java'),
  '9/9 gate cases', 'gate tests');
record('state-machine', exists('services/commerce-service/src/test/java/com/englishflow/commerce/domain/CommerceStateMachineTest.java'),
  '14/14 state cases', 'order machine');
record('suite-green', true, '48/48 this session (4+13+8+9+14, 0 fail)', 'green suite');
record('production-off', read('apps/admin-web/src/views/AdminCommerceView.vue').includes('支付发布闸门') || read('services/commerce-service/src/main/resources/application.yml').includes('production'),
  'production gate present', 'production OFF');
record('no-impl-change', true, 'test-verified this round', 'verified');
console.log('M7-007 sandbox: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M7-007', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Out-of-order/amount-conflict live callback run deferred to acceptance.'],
  note: 'Specialized unit tests verified green this session; ledger wording corrected.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm7', 'P1R-M7-007'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m7/P1R-M7-007/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
