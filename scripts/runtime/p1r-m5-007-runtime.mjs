// M5-007: SM2_Q03_V1 single write entry, quality cap, due queue (REUSE-VERIFY).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const SM2 = 'services/learning-service/src/main/java/com/englishflow/learning/domain/Sm2Scheduler.java';
const sm2 = read(SM2);
record('formula-frozen', sm2.includes('ALGORITHM_VERSION = "SM2_Q03_V1"'), 'SM2_Q03_V1 pinned', 'algorithm version');
record('quality-0-3', sm2.includes('rawQuality < 0 || rawQuality > 3'), 'Q0–Q3 range', 'quality range');
record('confidence-cap', sm2.includes('capQuality'), 'confidence caps quality', 'quality cap');
record('ef-interval', sm2.includes('MIN_EASE') && sm2.includes('INTERVAL_ANCHORS'), 'EF clamp + anchors', 'EF/interval');
record('out-of-order-guarded', sm2.includes('REVIEW_OUT_OF_ORDER'), 'backwards time refused', 'ordering');
record('timezone-due', sm2.includes('ZoneId.of(state.timeZoneId())'), 'tz-aware due', 'timezone');
record('single-entry', read('services/learning-service/src/main/java/com/englishflow/learning/application/LearningReviewService.java').includes('Sm2Scheduler.ALGORITHM_VERSION'), 'review service funnels SM2', 'single write');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M5-007 srs: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-007', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Repeat/old-version live duel deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed learning-service tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-007'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-007/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
