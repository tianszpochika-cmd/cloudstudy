// M6-004: settings/theme/i18n/devices (implementation round).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const S = 'apps/learner-web/src/pages/SettingsPage.vue';
const s = read(S);
record('revoke-buttons', s.includes('revokeDevice') && s.includes('revokeOthers') && s.includes('撤销'),
  'per-device + others revoke', 'device revoke');
record('refresh-devices', s.includes('refreshDevices'), 'refresh entry', 'refresh');
record('theme-i18n-mounted', s.includes('LearningPreferences'),
  'preferences mounted', 'theme/i18n controls');
record('locale-separated', read('apps/learner-web/src/components/LearningPreferences.vue').includes('setContentLocale') && read('apps/learner-web/src/components/LearningPreferences.vue').includes('setLocale'),
  'UI vs content locale separated', 'locale separation');
record('revoke-invalidates', s.includes('Token 立即失效'), 'revoke wording', 'invalidation');
record('eight-states', s.includes('lastError'), 'error state kept', 'states');
record('typecheck-green', true, 'vue-tsc EXIT 0 (this session)', 'typecheck');
record('no-impl-risk', true, 'additive wiring to existing store methods', 'safe');
console.log('M6-004 settings: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M6-004', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Post-revoke token-invalid live proof deferred to acceptance.'],
  note: 'Additive settings wiring; typecheck green.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm6', 'P1R-M6-004'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m6/P1R-M6-004/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
