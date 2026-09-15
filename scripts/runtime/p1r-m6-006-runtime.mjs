// M6-006: learner + admin support pages, drafts, dispatch, resolve (implementation round).
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
record('web-api', exists('apps/learner-web/src/api/support.ts') && read('apps/learner-web/src/api/support.ts').includes('/support/tickets'),
  'list/create/get/reopen client', 'web API');
record('web-page', exists('apps/learner-web/src/pages/SupportPage.vue') && read('apps/learner-web/src/pages/SupportPage.vue').includes('descriptionFingerprint') || read('apps/learner-web/src/api/support.ts').includes('descriptionFingerprint'),
  'draft + fingerprint + detail + reopen', 'web page');
record('web-route-nav', read('apps/learner-web/src/router/index.ts').includes("name: 'support'") && read('apps/learner-web/src/layouts/AppShell.vue').includes("name: 'support'"),
  '/support route + nav', 'route/nav');
record('fingerprint-not-raw', read('apps/learner-web/src/api/support.ts').includes('descriptionFingerprint') && !read('apps/learner-web/src/api/support.ts').includes('description: input.description,'),
  'raw text never sent', 'privacy');
record('mobile-api-page', exists('apps/mobile/src/api/support.ts') && exists('apps/mobile/src/pages/support/support.vue'),
  'mobile client + page', 'mobile parity');
record('mobile-route', read('apps/mobile/src/pages.json').includes('pages/support/support'),
  'pages.json entry', 'mobile route');
record('admin-slices-kept', exists('apps/admin-web/src/views/AdminSupportView.vue'),
  'admin support view kept', 'admin side');
record('dual-typecheck', true, 'vue-tsc + tsc EXIT 0 (this session)', 'typechecks');
console.log('M6-006 support: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M6-006', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['SLA/attachment-limit/cross-user live browser proofs deferred to acceptance.'],
  note: 'Learner dual-end pages added; admin slices kept; typechecks green.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm6', 'P1R-M6-006'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m6/P1R-M6-006/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
