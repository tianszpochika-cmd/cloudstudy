import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = path.dirname(fileURLToPath(import.meta.url));
const base = 'docs/06-design/v2-980plus/redesign/';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const runs = [];
function run(label, args) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  const filename = label + '.log';
  fs.writeFileSync(path.join(out, filename), (result.stdout || '') + (result.stderr || ''));
  runs.push({ command: [process.execPath, ...args].join(' '), startedAt, finishedAt: new Date().toISOString(),
    exitCode: result.status, log: filename, logSha256: hash(fs.readFileSync(path.join(out, filename))) });
  assert.equal(result.status, 0, label + ': ' + result.stderr);
  return result.stdout;
}
const generated = [base + 'dev-plan-R1.tasks.json', base + 'tasks/README.md',
  ...fs.readdirSync(path.join(root, base, 'tasks')).filter(n => /^R1-\d{3}\.md$/.test(n)).map(n => base + 'tasks/' + n)];
const before = generated.map(p => ({ path: p, sha256: hash(fs.readFileSync(path.join(root, p))) }));
run('regenerate', ['scripts/generate-redesign-dev-plan-index.cjs']);
const after = generated.map(p => ({ path: p, sha256: hash(fs.readFileSync(path.join(root, p))) }));
assert.deepEqual(after, before, 'Generated index/cards drift');
const plan = JSON.parse(run('plan-check', ['scripts/check-redesign-dev-plan.mjs']));
assert.equal(plan.stateCounts.READY, 1);
assert.equal(plan.stateCounts.PLANNED, 113);
assert.equal(plan.stateCounts.ACCEPTED, 0);
assert.equal(plan.stateCounts.STALE, 0);
const workflowLog = run('workflow-tests', ['--test', 'scripts/test-redesign-task-state.mjs']);
assert.match(workflowLog, /# fail 0/);
const syntax = ['scripts/generate-redesign-dev-plan-index.cjs',
  'artifacts/review-2026-10-03/r1-001-preflight/apply-preparation-scope.mjs',
  'artifacts/review-2026-10-03/r1-001-preflight/prepare-ready.mjs',
  'artifacts/review-2026-10-03/r1-001-preflight/verify-handoff.mjs'];
for (const [n, file] of syntax.entries()) run('syntax-' + n, ['--check', file]);
const checked = [base + 'README.md', base + 'validation-report.md', base + 'dev-plan-R1.md',
  base + 'tasks/R1-001.md', base + 'tasks/README.md', base + 'status-wall.md',
  'evidence/p1r/m3/P1R-M3-008/redesign/R1-001/inputs/approval-20261003.md',
  ...['G-ENV', 'G-CONTRACT', 'G-PLATFORM', 'G-FRONTEND'].map(id => 'evidence/p1r/m3/P1R-M3-008/redesign/R1-001/inputs/' + id + '-20261003.md')];
let links = 0;
const missing = [];
for (const p of checked) {
  const text = fs.readFileSync(path.join(root, p), 'utf8');
  for (const match of text.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const url = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!url || /^[a-z][a-z\d+.-]*:/i.test(url)) continue;
    links++;
    const target = path.resolve(root, path.dirname(p), decodeURIComponent(url));
    if (!fs.existsSync(target)) missing.push({ source: p, url });
  }
}
assert.deepEqual(missing, [], 'Broken local links');
const result = { result: 'PASS', verifiedAt: new Date().toISOString(), runs,
  plan, generatedFilesStable: generated.length, relativeLinks: { files: checked.length, links, missing },
  workflowTests: { tests: Number(/# tests (\d+)/.exec(workflowLog)?.[1]),
    pass: Number(/# pass (\d+)/.exec(workflowLog)?.[1]), fail: 0,
    scope: 'temporary repository workflow fixtures, not product business acceptance' },
  scope: 'preparation handoff only; no product TC executed or ACCEPTED card' };
fs.writeFileSync(path.join(out, 'handoff-verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ result: result.result, states: plan.stateCounts, workflowTests: result.workflowTests,
  generatedFilesStable: generated.length, relativeLinks: result.relativeLinks }));
