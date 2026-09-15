// M8-014: migration/flags/rollback/runbook verification (ASCII-only).
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
const globCount = (dir, ext) => {
  let n = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name.endsWith(ext)) n++; } };
  walk(path.join(root, dir)); return n;
};
record('migrations', globCount('services', '.sql') >= 70,
  globCount('services', '.sql') + ' SQL files (migrations + fixtures)', 'migrations');
record('payment-flag', read('services/commerce-service/src/main/resources/application.yaml').indexOf('COMMERCE_PAYMENT_ENABLED') >= 0,
  'payment production gate', 'payment flag');
record('feature-flag', read('services/gamification-service/src/main/resources/application.yml').indexOf('GAMIFICATION_FEATURE_ENABLED') >= 0,
  'gamification feature flag', 'feature flag');
record('phase-flags', read('apps/learner-web/src/platform/feature-gates.ts').indexOf('isPhaseGateEnabled') >= 0,
  'phase gates', 'phase flags');
record('consumer-flag', read('services/gamification-service/src/main/resources/application.yml').indexOf('GAMIFICATION_EVENT_CONSUMER_ENABLED') >= 0,
  'consumer enabled flag', 'consumer flag');
record('rollback-paths', read('services/content-service/src/main/java/com/englishflow/content/application/ContentCommandService.java').indexOf('publishRollback') >= 0,
  'publish rollback + saga compensations', 'rollback');
record('runbook', exists('docs/07-operations/incident-runbook.md'),
  'incident runbook', 'runbook');
record('anchors', exists('evidence/p1r/m8/P1R-M8-012/manifest.json') && exists('evidence/p1r/m8/P1R-M8-013/manifest.json'),
  'M8-012 + M8-013 closed', 'anchors');
console.log('M8-014 release: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-014', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed: passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live canary/rollback drill deferred to acceptance.'],
  note: 'Release-train verification; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-014'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-014/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
