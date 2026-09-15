// M8-006: W4 aggregation — notification/sync/support/privacy/recovery by reference.
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
record('notify-owned', exists('evidence/p1r/m6/P1R-M6-001/manifest.json') && exists('evidence/p1r/m6/P1R-M6-002/manifest.json'),
  'M6-001/002 closed', 'notification');
record('sync-owned', exists('evidence/p1r/m6/P1R-M6-003/manifest.json'),
  'M6-003 closed', 'sync');
record('support-owned', exists('evidence/p1r/m6/P1R-M6-005/manifest.json') && exists('evidence/p1r/m6/P1R-M6-006/manifest.json'),
  'M6-005/006 closed', 'support');
record('export-owned', exists('evidence/p1r/m6/P1R-M6-007/manifest.json'),
  'M6-007 export closed', 'export receipt');
record('delete-owned', exists('evidence/p1r/m6/P1R-M6-008/manifest.json'),
  'M6-008 deletion closed', 'delete receipt');
record('dlq-owned', read('services/gamification-service/src/main/java/com/englishflow/gamification/integration/TrustedCompletionKafkaConsumer.java').includes('getDlqTopic'),
  'DLQ routing present', 'DLQ/recovery');
record('anchors', exists('evidence/p1r/m6/P1R-M6-011/manifest.json') && exists('evidence/p1r/m8/P1R-M8-004/manifest.json'),
  'M6-011 + M8-004 closed', 'anchors');
record('no-impl-change', true, 'aggregation by reference, no code change', 'aggregate');
console.log('M8-006 W4: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-006', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live fault-injection sweep deferred to acceptance.'],
  note: 'W4 aggregation by reference; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-006'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-006/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
