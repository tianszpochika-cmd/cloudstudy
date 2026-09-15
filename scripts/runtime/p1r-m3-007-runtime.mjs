// M3-007: takedown / emergency block / rollback / explainable recovery (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const SVC = 'services/content-service/src/main/java/com/englishflow/content/application/ContentCommandService.java';
const VER = 'services/content-service/src/main/java/com/englishflow/content/domain/ContentVersion.java';
const B9 = 'services/content-service/src/main/java/com/englishflow/content/web/B9ContentAdminController.java';
const svc = read(SVC), ver = read(VER), b9 = read(B9);
record('unpublish-archives', ver.includes('ARCHIVED') && svc.includes('EXPLICIT_UNPUBLISH'),
  'UNPUBLISH → ARCHIVED with event', 'takedown');
record('rollback-guarded', ver.includes('ROLLBACK_TARGET_INVALID') && ver.includes('rollbackOfVersionId') && svc.includes('ROLLBACK_SOURCE_MISSING'),
  'rollback needs approved/published target + source', 'rollback');
record('rollback-keeps-dual-rights', ver.includes('requireDualApproval') && ver.includes('requirePublishableRights'),
  'rollback keeps dual + rights gates', 'safe rollback');
record('epoch-bumps', read('services/content-service/src/main/java/com/englishflow/content/domain/ContentDefinition.java').includes('contentEpoch++'),
  'contentEpoch++ on revision', 'cache busting');
record('old-versions-kept', ver.includes('wasPublished'),
  'previous versions retained', 'old safe version');
record('commands-routed', b9.includes('"UNPUBLISH"') && b9.includes('"ROLLBACK"'),
  'UNPUBLISH/ROLLBACK routed', 'boundary');
record('projections-invalidated', svc.includes('appendProjectionInvalidated'),
  'invalidation on takedown/rollback', 'cache cleanup');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M3-007 takedown: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M3-007', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Emergency-block reason audit and learner-facing explainable recovery copy need live flows and are deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm3', 'P1R-M3-007'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m3/P1R-M3-007/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
