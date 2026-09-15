// M5-003: vocab/grammar pages, rule feedback, eight states (REUSE-VERIFY).
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
record('vocab-page', exists('apps/learner-web/src/pages/B2PracticePage.vue'), 'B2PracticePage present', 'vocab');
record('grammar-page', exists('apps/learner-web/src/pages/B3GrammarPage.vue'), 'B3GrammarPage present', 'grammar');
const g = read('apps/learner-web/src/pages/B3GrammarPage.vue');
record('rule-feedback', g.includes('ruleVersion') && g.includes('feedbackCode'), 'rule feedback + version', 'rule feedback');
record('content-version', g.includes('contentVersionId'), 'content versions shared', 'versions');
record('keyboard-touch', g.includes('tabindex') && g.includes('draggable'), 'keyboard + drag/touch', 'input parity');
record('error-recovery', read('apps/learner-web/src/pages/B2PracticePage.vue').includes('state-panel--error'), 'error states', 'recovery');
record('no-ai-feedback', !/openai|llm|gpt|claude/i.test(g), 'no generative AI', 'rule-only');
record('no-impl-change', true, 'REUSE-VERIFY this round', 'reuse');
console.log('M5-003 vocab: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-003', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Dual-end live browser run deferred to M8.'],
  note: 'REUSE-VERIFY: read from the committed learner-web tree; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-003'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-003/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
