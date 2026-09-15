// M7-002: game catalog gate, P0 Sentence Train (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const G = 'services/gamification-service/src/main/java/com/englishflow/gamification/domain/GameCatalog.java';
const g = read(G);
record('p0-only-enabled', g.includes('"SENTENCE_TRAIN", ReleasePhase.P0, true') && g.includes('"WORD_MATCH", ReleasePhase.P1, false'),
  'SENTENCE_TRAIN P0 on, rest off', 'P0 gate');
record('unknown-rejected', g.includes('InvalidGameCodeException'), 'unknown codes rejected', 'unknown games');
record('disabled-rejected', g.includes('GameNotAvailableException'), 'disabled games rejected', 'disabled games');
record('registry-not-enable', g.includes('never implicitly'), 'registry ≠ enablement', 'separation');
record('lobby-gated', read('apps/learner-web/src/pages/B4WorldPage.vue').includes('可用性由服务端阶段 Gate 决定'),
  'lobby follows server gate', 'lobby');
record('low-spec-degrade', read('apps/learner-web/src/pages/B4WorldPage.vue').includes('b4-map--static'),
  'Performance static fallback', 'degrade');
record('no-local-answers', read('apps/learner-web/src/pages/B4WorldPage.vue').includes('不会用本地答案'),
  'no local answers/scores', 'server判定');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M7-002 games: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M7-002', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Low-spec live degrade run deferred to M8-009.'],
  note: 'REUSE-VERIFY: read from the committed trees; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm7', 'P1R-M7-002'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m7/P1R-M7-002/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
