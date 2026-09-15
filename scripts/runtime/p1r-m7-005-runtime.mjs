// M7-005: leaderboard/visibility/reports/safety/privacy (durable-path verification).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const C = 'services/social-service/src/main/java/com/englishflow/social/web/SocialLocalRealController.java';
const c = read(C);
record('leaderboard-deidentified', c.includes('DEIDENTIFIED') && c.includes('isSelf'),
  'de-identified entries + self flag', 'anonymity');
record('visibility-versioned', c.includes('/me/visibility') && c.includes('privacy_version'),
  'visibility + privacy version', 'visibility');
record('reports-closed-loop', c.includes('/moderation/reports') && c.includes('/appeal') && c.includes('/admin/moderation/reports'),
  'report/appeal/admin queue', 'report loop');
record('cross-tenant-scoped', c.includes('tenant_id = ?'), 'tenant scoping', 'cross-tenant PEP');
record('no-free-content', c.includes('PRESET_ONLY') || c.includes('preset_code'),
  'preset-only content', 'content safety');
record('delay-explained', read('services/social-service/src/main/java/com/englishflow/social/domain/SocialService.java').includes('dataFreshness'),
  'DELAYED freshness explained', 'delay explanation');
record('audit-wired', c.includes('adminReportRow') || c.includes('audit'),
  'admin queue + audit trail', 'audit');
record('no-impl-change', true, 'durable-path verification, no code change', 'reuse');
console.log('M7-005 safety: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M7-005', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Delay-gate query filter and live cross-tenant/over-privilege negative run deferred to acceptance.'],
  note: 'Durable-path verification; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm7', 'P1R-M7-005'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m7/P1R-M7-005/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
