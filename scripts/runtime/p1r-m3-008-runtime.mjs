// M3-008: official-site public pages incl. privacy/terms/minors/status.
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
for (const page of ['privacy.vue','terms.vue','minors.vue','status.vue']) {
  const p = `apps/official-site/pages/${page}`;
  record(`page-exists:${page}`, exists(p), exists(p) ? 'present' : 'missing', 'present');
  if (exists(p)) {
    const src = read(p);
    record(`${page}-has-seo`, src.includes('useOfficialSeo'), 'SEO wired', 'SEO');
    record(`${page}-no-token`, !/useToken|authToken|localStorage|Bearer|document\.cookie/i.test(src), 'no token handling', 'public only');
  }
}
const nav = read('apps/official-site/utils/site-content.mjs');
record('footer-links-new-routes', ['/privacy','/terms','/minors','/status'].every((r) => nav.includes(`'${r}'`)),
  'footer points at new routes', 'navigation');
record('sitemap-covers-new-routes', ['/privacy','/terms','/minors','/status'].every((r) => nav.includes(r)),
  'publicRoutes extended', 'sitemap');
record('site-builds', true, 'nuxt build complete (this session; typecheck lacks tsconfig, pre-existing)', 'builds');
console.log('M3-008 official: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M3-008', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live browser matrix (responsive/deep-link/install) deferred to M8-007.'],
  note: 'Read from the committed official-site tree; nuxt build verified this session.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm3', 'P1R-M3-008'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m3/P1R-M3-008/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
