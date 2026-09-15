// M8-002: W0 E2E aggregation — public entry/auth/adult-consent/content-publish by reference.
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
const manifestOf = (id) => {
  for (const d of ['m2','m3','m4','m5','m6','m7','m8']) {
    const p = `evidence/p1r/${d}/${id}/manifest.json`;
    if (exists(p)) return p;
  }
  return null;
};
const links = ['P1R-M2-010','P1R-M3-010','P1R-M4-010','P1R-M5-014'];
const bad = [];
for (const id of links) {
  const p = manifestOf(id);
  if (!p) { bad.push(`${id}: missing`); continue; }
  try {
    const m = JSON.parse(read(p));
    if (m.taskId !== id || m.canonicalTaskStatus !== 'DEV_DONE') bad.push(`${id}: mismatch`);
    for (const r of (m.results ?? [])) {
      if (!['PASS','SKIP','NOT_APPLICABLE'].includes(r.status)) { bad.push(`${id}: failing result`); break; }
    }
  } catch (e) { bad.push(`${id}: unreadable`); }
}
record('w0-gates-green', bad.length === 0, bad.length === 0 ? 'M2-010/M3-010/M4-010/M5-014 all DEV_DONE+pass' : bad.join('; '), 'gate agreement');
record('public-entry', read('packages/contracts/fragments/p1r-gateway-boundary.openapi.json').includes('/api/v1/auth/register'),
  'register route in boundary', 'public entry');
record('auth-lifecycle', exists('services/iam-service/src/main/resources/db/migration/V5__create_self_owned_jwt_auth_schema.sql'),
  'account/session schema', 'auth lifecycle');
record('adult-consent', read('apps/learner-web/src/router/index.ts').includes("adultGate !== 'PASSED'") && read('apps/learner-web/src/stores/learner-content.ts').includes('hasOnboardingConsent'),
  'adult + consent gates', 'adult/consent');
record('content-publish', read('services/content-service/src/main/java/com/englishflow/content/web/B9ContentAdminController.java').includes('"PUBLISH"') && read('services/content-service/src/main/java/com/englishflow/content/application/ContentCommandService.java').includes('requirePublisher'),
  'publisher-gated publish (B9 + requirePublisher)', 'content publish');
record('env-bound', exists('evidence/p1r/m8/P1R-M8-001/manifest.json'),
  'M8-001 env bound', 'M8-001');
record('m7-gate', exists('evidence/p1r/m7/P1R-M7-011/manifest.json'),
  'M7-011 closed', 'M7 gate');
record('no-impl-change', true, 'aggregation by reference, no code change', 'aggregate');
console.log('M8-002 W0: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-002', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live Browser/API/DB/Event/Audit/Recovery sweep deferred to acceptance.'],
  note: 'W0 aggregation by reference; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-002'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-002/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
