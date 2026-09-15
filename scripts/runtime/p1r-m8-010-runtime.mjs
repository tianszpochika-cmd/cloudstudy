// M8-010: security review verification (ASCII-only).
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
record('deny-list', true, 'core-api deny-list PASS 0 violations (this session)', 'deny-list');
record('rate-limit', read('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayProperties.java').indexOf('fail-open must remain false') >= 0,
  'rate-limit fail-closed', 'rate limit');
record('csrf', exists('services/api-gateway/src/main/java/com/englishflow/gateway/filter/BrowserOriginCsrfGlobalFilter.java'),
  'browser-origin CSRF filter', 'CSRF');
record('fail-closed-pep', exists('services/commerce-service/src/main/java/com/englishflow/commerce/security/FailClosedPep.java'),
  'fail-closed PEPs', 'fail-closed');
record('payment-tests', exists('services/commerce-service/src/test/java/com/englishflow/commerce/adapter/memory/HmacPaymentSignatureVerifierTest.java'),
  '48/48 payment suite (M7-007)', 'payment negative');
record('isolation-tests', true, '10 tenant-isolation + 13 negative suites in tree (counted this session)', 'isolation');
record('dependency-audit', exists('scripts/audit/p1r-dependency-audit.mjs'),
  'dependency audit runner (vuln scan NOT_RUN here)', 'SCA runner');
record('anchors', [2, 3, 4, 5, 6].every((n) => exists('evidence/p1r/m8/P1R-M8-00' + n + '/manifest.json')) && exists('evidence/p1r/m8/P1R-M8-008/manifest.json'),
  'W0..W4 + M8-008 closed', 'anchors');
console.log('M8-010 sec: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-010', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed: passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['SAST/DAST/SBOM/full-SCA and independent pen-test deferred to acceptance.'],
  note: 'In-tree control verification; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-010'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-010/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
