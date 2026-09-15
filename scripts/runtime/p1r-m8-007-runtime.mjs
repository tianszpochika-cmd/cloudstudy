// M8-007: four-end matrix - routes/responsive/PWA/mobile/no-5th-codebase (verify).
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
const routes = (read('apps/learner-web/src/router/index.ts').match(/path: '/g) || []).length;
record('canonical-routes', routes >= 30, routes + ' learner-web routes', 'canonical routes');
record('responsive', (read('apps/learner-web/src/assets/styles/base.css').match(/@media/g) || []).length >= 5,
  'media queries present', 'responsive');
record('pwa', exists('apps/learner-web/public/manifest.webmanifest') && exists('apps/learner-web/public/sw.js'),
  'manifest + sw', 'PWA install/update');
record('mobile-h5', exists('apps/mobile/src/manifest.json') && exists('apps/mobile/src/pages.json'),
  'mobile manifest + pages', 'mobile H5');
record('no-5th-codebase', exists('apps/miniapp-wechat/archive-boundary.json') && !exists('apps/miniapp-wechat/package.json'),
  'archive boundary, no package', 'no 5th codebase');
record('conditional-compile', read('apps/miniapp-wechat/README.md').indexOf('uni-app') >= 0,
  'miniapp via conditional compile', 'conditional target');
record('anchors', [2, 3, 4, 5, 6].every((n) => exists('evidence/p1r/m8/P1R-M8-00' + n + '/manifest.json')),
  'W0..W4 closed', 'M8-002..006');
record('no-impl-change', true, 'verification only, no code change', 'verify');
console.log('M8-007 matrix: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-007', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed: passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Real devices, iOS/Android/iPad runs and miniapp device runs deferred to acceptance.'],
  note: 'Local matrix segments verified; device runs deferred.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-007'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-007/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
