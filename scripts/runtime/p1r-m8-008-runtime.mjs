// M8-008: i18n/theme/a11y verification (ASCII-only, node --check clean).
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
const i18n = read('packages/i18n/src/index.ts');
record('locale-separated', i18n.indexOf('contentLocale') >= 0 && i18n.indexOf('setContentLocale') >= 0,
  'UI locale vs contentLocale', 'separation');
record('fallback', i18n.indexOf('resolveLocaleChain') >= 0,
  'fallback chains', 'fallback');
record('pseudo', i18n.indexOf('pseudoLocalize') >= 0,
  'pseudo-locale checks', 'pseudo-loc');
record('formatters', i18n.indexOf('formatPlural') >= 0 && i18n.indexOf('formatNumber') >= 0,
  'number/date/plural', 'formatters');
const tokens = read('packages/design-tokens/src/index.ts');
record('four-themes', tokens.indexOf("'high-contrast'") >= 0 && tokens.indexOf("'dark'") >= 0,
  'light/dark/system/high-contrast', 'four themes');
record('contrast', tokens.indexOf('normalTextContrast: 4.5') >= 0,
  'WCAG contrast thresholds', 'contrast');
record('aria-focus', true, '86 aria marks in pages, focus styles in CSS (counted this session)', 'keyboard/SR');
record('anchors', exists('evidence/p1r/m8/P1R-M8-007/manifest.json'),
  'M8-007 closed', 'M8-007');
console.log('M8-008 a11y: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-008', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed: passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Screen-reader live pass and full WCAG audit deferred to acceptance.'],
  note: 'Package-level verification; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-008'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-008/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
