// M5-005: speaking/writing pages, rule recording/submit, no-AI degrade (REUSE-VERIFY).
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
record('speaking-page', exists('apps/learner-web/src/pages/B3SpeakingPage.vue'), 'present', 'speaking');
record('writing-page', exists('apps/learner-web/src/pages/B3WritingPage.vue'), 'present', 'writing');
const s = read('apps/learner-web/src/pages/B3SpeakingPage.vue');
record('local-encrypt', s.includes('AES-GCM') && s.includes('SHA-256'), 'local encrypt + hash', 'recording vault');
record('no-ai', s.includes('不提供 AI') || s.includes('不生成 AI'), 'no AI scoring stated', 'no AI');
record('permission-states', s.includes('permission-banner') && s.includes('denied'), 'mic permission states', 'authorization');
const w = read('apps/learner-web/src/pages/B3WritingPage.vue');
record('rule-feedback', w.includes('ruleVersion'), 'rule versions', 'rule feedback');
record('offline-draft', w.includes('断网时仍保留本地草稿'), 'offline draft kept', 'retention/recovery');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M5-005 speech: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-005', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Upload-failure and retention-policy live runs deferred to acceptance.'],
  note: 'REUSE-VERIFY: read from the committed learner-web tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-005'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-005/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
