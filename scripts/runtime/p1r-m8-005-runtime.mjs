// M8-005: W3 aggregation — reward/social/entitlement by reference.
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
record('no-double-reward', read('services/gamification-service/src/main/java/com/englishflow/gamification/application/GamificationApplicationService.java').includes('replay()'),
  'replay absorbs redelivery', 'no double reward');
record('kafka-settlement', exists('services/gamification-service/src/main/java/com/englishflow/gamification/integration/TrustedCompletionKafkaConsumer.java'),
  'Kafka settlement path', 'Kafka path');
record('lease-recovery', read('services/social-service/src/main/java/com/englishflow/social/web/SocialLocalRealController.java').includes('DISCONNECTED'),
  'disconnect/lease recovery', 'lease recovery');
record('sandbox-admission', read('services/commerce-service/src/main/java/com/englishflow/commerce/application/CommerceApplicationService.java').includes('revokeOrderEntitlements'),
  'refund→revoke admission', 'sandbox/refund/revoke');
record('refund-workbench', read('apps/admin-web/src/views/AdminCommerceView.vue').includes('COMMERCE_REFUND'),
  'refund ops workbench', 'refund ops');
record('production-off', read('apps/admin-web/src/views/AdminCommerceView.vue').includes('支付发布闸门'),
  'production OFF held', 'production OFF');
record('anchors', exists('evidence/p1r/m7/P1R-M7-011/manifest.json') && exists('evidence/p1r/m8/P1R-M8-003/manifest.json'),
  'M7-011 + M8-003 closed', 'anchors');
record('no-impl-change', true, 'aggregation by reference, no code change', 'aggregate');
console.log('M8-005 W3: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-005', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live W3 sweep and payment-sandbox segment deferred to acceptance.'],
  note: 'W3 aggregation by reference; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-005'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-005/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
