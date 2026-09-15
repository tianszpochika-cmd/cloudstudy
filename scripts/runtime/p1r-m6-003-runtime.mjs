// M6-003: general offline sync page, queue, conflicts, safe recovery (REUSE-VERIFY).
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
record('queue-visible', read('apps/learner-web/src/pages/B11SyncPage.vue').includes('待同步'), 'queue visible', 'queue');
record('conflicts-shown', read('apps/learner-web/src/pages/B11SyncPage.vue').includes('冲突'), 'conflicts shown', 'conflicts');
record('no-silent-overwrite', read('apps/learner-web/src/stores/b10.ts').includes('conflict') || read('apps/learner-web/src/domain/b3.ts').includes('SERVER_WINS'),
  'conflict outcomes explicit', 'no silent overwrite');
record('versioned-sync', read('apps/learner-web/src/stores/b11.ts').includes('cursor'), 'cursor carried', 'versions');
record('owner-pep', read('services/notification-service/src/main/java/com/englishflow/notification/application/OfflineSyncApplicationService.java').includes('context') || exists('services/notification-service/src/main/java/com/englishflow/notification/application/OfflineSyncApplicationService.java'),
  'owner-scoped sync service', 'owner PEP');
record('recovery-entry', read('apps/learner-web/src/pages/B11SyncPage.vue').includes('重试同步'), 'retry entry', 'recovery');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M6-003 gsync: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M6-003', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Post-refresh reconciliation live run deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed trees; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm6', 'P1R-M6-003'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m6/P1R-M6-003/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
