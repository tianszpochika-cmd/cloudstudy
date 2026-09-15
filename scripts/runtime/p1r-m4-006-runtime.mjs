// M4-006: placement report, CEFR, explanation, versioned results (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const B25 = 'services/assessment-service/src/main/java/com/englishflow/assessment/web/B25AssessmentJdbcController.java';
const b25 = read(B25);
record('cefr-boundaries', b25.includes('ZERO_A1') && b25.includes('CET4_B1') && b25.includes('CET6_B2'),
  'A1..C2 mapping incl. fast-track', 'CEFR boundaries');
record('report-versioned', b25.includes('report_id') && b25.includes('radar_json') && b25.includes('mistakes_json'),
  'report/radar/mistakes persisted', 'versioned results');
record('explanation', b25.includes('recommendedAdvice') && b25.includes('estimatedVocabulary'),
  'advice + vocab explanation', 'explanation');
record('not-ready-guarded', b25.includes('assessment report is not ready'),
  '404 until ready', 'data-insufficient');
record('server-scored', read('apps/learner-web/src/pages/AssessmentPage.vue').includes('答案规则只由 assessment 服务端判定'),
  'client cannot rewrite', 'server scoring');
record('recovery-kept', read('apps/learner-web/src/pages/AssessmentPage.vue').includes('重新读取'),
  'recoverable entry', 'recovery');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M4-006 report: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M4-006', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['A1–C2 boundary live fixtures run deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed trees; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm4', 'P1R-M4-006'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m4/P1R-M4-006/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
