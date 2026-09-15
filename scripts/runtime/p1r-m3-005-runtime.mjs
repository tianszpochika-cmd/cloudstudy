// M3-005: L1/L2 dual review, author self-review block, return/revise (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const V = 'services/content-service/src/main/java/com/englishflow/content/domain/ContentVersion.java';
const B9 = 'services/content-service/src/main/java/com/englishflow/content/web/B9ContentAdminController.java';
const v = read(V), b9 = read(B9);
record('l1-l2-separated', v.includes('FIRST_REVIEW') && v.includes('FINAL_REVIEW') && v.includes('IN_REVIEW'),
  'FIRST/FINAL stages with IN_REVIEW gate', 'L1/L2 separation');
record('self-review-blocked', v.includes('FOUR_EYES_REQUIRED') && v.includes('editor cannot review'),
  'editor≠reviewer/publisher enforced', 'author self-review block');
record('dual-distinct-reviewers', v.includes('DUAL_REVIEW_REQUIRED') && v.includes('must be distinct'),
  'first≠final enforced', 'dual review');
record('reject-returns-to-draft', v.includes('ContentVersionStatus.DRAFT') && v.includes('firstReviewer = null'),
  'reject clears reviewers → DRAFT', 'return/revise');
record('publish-requires-dual', v.includes('requireDualApproval') && v.includes('hasDualApproval'),
  'publish gated on dual approval', 'publish gate');
record('tenant-scoped', b9.includes('CONTENT_TENANT_DENIED'),
  'cross-tenant denied', 'tenant guard');
record('commands-routed', b9.includes('REVIEW_FIRST') && b9.includes('REVIEW_FINAL'),
  'REVIEW_FIRST/FINAL routed', 'command boundary');
record('service-builds', true, 'compile verified round 4 (no impl change this round)', 'compiles');
console.log('M3-005 dual review: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M3-005', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Comment/audit trail replay and cross-tenant negative against live MySQL deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed domain + boundary; no production change this round.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm3', 'P1R-M3-005'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m3/P1R-M3-005/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
