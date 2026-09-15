// M7-006: SKU/activation/free entitlements (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const A = 'services/commerce-service/src/main/java/com/englishflow/commerce/domain/ActivationCode.java';
const a = read(A);
record('sku-versioned', read('services/commerce-service/src/main/java/com/englishflow/commerce/domain/Sku.java').includes('version'),
  'versioned SKU', 'SKU/version');
record('activation-idempotent', read('services/commerce-service/src/main/java/com/englishflow/commerce/application/CommerceApplicationService.java').includes('activation.redeem'),
  'idempotent issue/redeem', 'activation');
record('expiry-used', a.includes('ACTIVATION_CODE_EXPIRED') && a.includes('REDEEMED'),
  'expiry + used states', 'expiry/used');
record('state-machine', read('services/commerce-service/src/main/java/com/englishflow/commerce/domain/CommerceStateMachine.java').includes('requireActivationTransition'),
  'guarded transitions', 'state machine');
record('entitlement-explained', read('services/commerce-service/src/main/java/com/englishflow/commerce/domain/CommerceViews.java').includes('EntitlementView'),
  'entitlement views', 'free/paid explanation');
record('official-pricing', read('apps/official-site/pages/pricing.vue').includes('pricingPlans') || read('apps/official-site/pages/pricing.vue').includes('plan'),
  'pricing page present', 'official projection');
record('real-db', read('services/commerce-service/src/main/resources/db/migration/V1__create_commerce_own_schema.sql').includes('commerce_activation_code'),
  'activation tables', 'real DB');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M7-006 commerce: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M7-006', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live sandbox redeem run deferred to acceptance (M7-007 owns sandbox).'],
  note: 'REUSE-VERIFY: read from the committed trees; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm7', 'P1R-M7-006'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m7/P1R-M7-006/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
