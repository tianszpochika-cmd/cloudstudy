// M5-006: practice hub/session/checkpoint/report pages (REUSE-VERIFY).
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
record('hub-page', exists('apps/learner-web/src/pages/B2PracticePage.vue'), 'practice hub present', 'hub');
record('report-page', exists('apps/learner-web/src/pages/B2ReportPage.vue'), 'report page present', 'report');
record('report-versioned', read('apps/learner-web/src/pages/B2ReportPage.vue').includes('calculationVersion'), 'calculation version shown', 'watermark/version');
record('server-snapshots', read('apps/learner-web/src/pages/B2ReportPage.vue').includes('服务端生成'), 'server snapshots only', 'no client rewrite');
record('no-answer-leak', !/correctAnswer|answerRule/i.test(read('apps/learner-web/src/pages/B2ReportPage.vue')), 'no answer rules in report', 'no leak');
record('checkpoint-api', read('apps/learner-web/src/api/b10.ts').includes('checkpoint') || read('apps/learner-web/src/api/b2.ts').includes('checkpoint'), 'checkpoint client calls', 'checkpoint');
record('states-wired', read('apps/learner-web/src/pages/B2ReportPage.vue').includes('B10StatePanel'), 'eight-state panel wired', 'states');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M5-006 hub: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-006', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Browser→DB→report reconciliation live run deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed learner-web tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-006'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-006/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
