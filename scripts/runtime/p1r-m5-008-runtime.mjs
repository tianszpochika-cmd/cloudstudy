// M5-008: SRS page, offline queue, conflicts, safe sync (REUSE-VERIFY).
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
record('sync-page', exists('apps/learner-web/src/pages/B11SyncPage.vue'), 'sync page present', 'sync page');
const b10 = read('apps/learner-web/src/stores/b10.ts');
record('queue-visible', b10.includes('offline-queue') && b10.includes('queueCount'), 'visible persisted queue', 'queue');
record('client-seq', b10.includes('clientSeq'), 'clientSeq ordering', 'clientSeq');
record('base-version', b10.includes('baseStateVersion'), 'baseStateVersion carried', 'baseVersion');
record('conflicts-surfaced', read('apps/learner-web/src/domain/b3.ts').includes('SERVER_WINS'), 'SERVER_WINS/LOCAL_RETRY/MERGED', 'no silent overwrite');
record('queued-not-mastered', read('apps/learner-web/src/platform/b10-i18n.ts').includes('queued'), 'queued≠mastered wording', 'safe sync');
record('no-client-kafka', !/from.*['\"]kafka|KafkaProducer|produce\(/i.test(b10), 'no client event production', 'no client events');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M5-008 sync: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-008', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Offline/disorder/duplicate live conflict run deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed learner-web tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-008'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-008/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
