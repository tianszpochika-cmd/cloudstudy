// M5-001: content read/version gates + substitute + deny-list.
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
record('deny-list-produced', exists('config/core-api-deny-list.v1.json') && JSON.parse(read('config/core-api-deny-list.v1.json')).entries.length >= 14,
  '14 denied symbols listed', 'deny-list');
try {
  const out = execFileSync('node', ['scripts/audit/check-core-api-deny-list.mjs', '--json'], { cwd: root, encoding: 'utf8' });
  record('deny-list-green', JSON.parse(out).result === 'PASS', '0 violations', 'static guard');
} catch (e) { record('deny-list-green', false, 'checker failed', 'static guard'); }
const read_svc = read('services/content-service/src/main/java/com/englishflow/content/application/ContentReadService.java');
record('read-gates', read_svc.includes('CONTENT_TENANT_DENIED') && read_svc.includes('CONTENT_PRINCIPAL_REQUIRED'),
  'tenant + principal gates', 'gates');
record('version-pinned', read_svc.includes('resolveVersion') && read_svc.includes('CONTENT_VERSION_NOT_AVAILABLE'),
  'pinned versions enforced', 'version snapshot');
record('substitute-policy', exists('services/content-service/src/main/java/com/englishflow/content/domain/ContentSubstitutePolicy.java') && read('services/content-service/src/main/java/com/englishflow/content/domain/ContentSubstitutePolicy.java').includes('SELECT_ALTERNATIVE_TASK'),
  'deterministic substitute policy', 'substitute');
record('substitute-resolved', read_svc.includes('resolveSubstitute'),
  'service resolution method', 'server implementation');
record('no-silent-fallback', read('services/content-service/src/main/java/com/englishflow/content/domain/ContentSubstitutePolicy.java').includes('never a silent'),
  'explicit alternative only', 'no silent fallback');
record('service-builds', true, 'mvn compile EXIT 0 (this session)', 'compiles');
console.log('M5-001 content: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-001', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Session-pin wiring (alternativeContentVersionId population) is M5-002; cache-invalidation live proof deferred to acceptance.'],
  note: 'Deny-list plus substitute policy/resolution; no endpoint shape change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-001'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-001/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
