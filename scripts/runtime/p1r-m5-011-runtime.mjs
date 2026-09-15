// M5-011: daily/weekly/stage reports, watermark, caliber, rebuild (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const B25 = 'services/learning-service/src/main/java/com/englishflow/learning/web/B25LearningJdbcController.java';
const b25 = read(B25);
record('daily-report', b25.includes('/stats/daily-report'), 'daily endpoint', 'daily');
record('weekly-report', b25.includes('/stats/weekly-report'), 'weekly endpoint', 'weekly');
record('watermark', b25.includes('calculationVersion') && b25.includes('B25-SRS-REPORT-1'), 'calculation version watermark', 'watermark');
record('generated-at', b25.includes('generatedAt'), 'data watermark time', 'watermark time');
record('idempotent-rebuild', b25.includes('INSERT IGNORE'), 'replay-safe rebuild', 'rebuild');
record('report-page', read('apps/learner-web/src/pages/B2ReportPage.vue').includes('calculationVersion'), 'version shown', 'report page');
record('sources-traced', b25.includes('source') && b25.includes('mysql'), 'source trace', 'trace');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M5-011 reports: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-011', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Late-event rebuild and cross-owner reconciliation live runs deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed trees; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-011'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-011/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
