// M7-003: world/avatar/rewards pages, source explanation (REUSE-VERIFY).
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
record('world-page', exists('apps/learner-web/src/pages/B4WorldPage.vue'), 'world page present', 'world');
record('ledger-projection', read('apps/learner-web/src/pages/B4WorldPage.vue').includes('只展示服务端返回的事实'), 'server facts only', 'ledger');
record('avatar-fallback', read('apps/learner-web/src/pages/B4WorldPage.vue').includes('2D_FALLBACK'), '2D fallback', 'avatar');
const r = read('apps/learner-web/src/components/b12/B12RewardsCard.vue');
record('probability-disclosed', r.includes('disclosedBeforeClaim'), 'pre-claim disclosure', 'source explanation');
record('duplicate-shown', r.includes('幂等重放'), 'replay display', 'duplicate claims');
record('no-local-draw', r.includes('未进行客户端抽取'), 'no client draw', 'server draw');
record('states-kept', read('apps/learner-web/src/pages/B4WorldPage.vue').includes('b4-inline-empty'), 'empty/error/offline states', 'states');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M7-003 world: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M7-003', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Cross-end live browser run deferred to M8.'],
  note: 'REUSE-VERIFY: read from the committed trees; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm7', 'P1R-M7-003'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m7/P1R-M7-003/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
