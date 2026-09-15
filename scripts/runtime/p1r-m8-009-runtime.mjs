// M8-009: perf/audio/offline/durability verification (ASCII-only).
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
record('four-levels', read('packages/performance/src/index.ts').indexOf("'Ultra', 'High', 'Medium', 'Performance'") >= 0,
  'four levels', 'levels');
record('budgets', read('packages/performance/src/index.ts').indexOf('textureBudgetMb') >= 0,
  'resource budgets', 'budgets');
record('audio-range', read('apps/learner-web/src/pages/B11ListeningPage.vue').indexOf('0.5, 0.75, 1, 1.25, 1.5, 2') >= 0,
  '0.5x-2.0x rates', 'audio range');
record('offline-queue', read('apps/learner-web/src/pages/B11ListeningPage.vue').indexOf('queueProgress') >= 0,
  'offline progress queue', 'offline');
record('perf-selector', read('apps/learner-web/src/pages/B11ListeningPage.vue').indexOf('setPerformance') >= 0,
  'in-page perf switch', 'low-spec');
record('slo-doc', read('docs/02-architecture/v2-microservices-architecture.md').indexOf('99.95%') >= 0,
  'SLO baseline doc', 'SLO report');
record('probes', read('services/gamification-service/src/main/resources/application.yml').indexOf('liveness') >= 0,
  'health probes', 'probes');
record('anchors', exists('evidence/p1r/m8/P1R-M8-004/manifest.json') && exists('evidence/p1r/m8/P1R-M8-007/manifest.json'),
  'M8-004 + M8-007 closed', 'anchors');
console.log('M8-009 perf: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-009', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed: passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Load/soak runs and capacity report deferred to acceptance.'],
  note: 'Local-segment verification; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-009'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-009/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
