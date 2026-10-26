import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Read checks and deterministic regeneration of this planning delivery only.
// No runtime, database, parent-ledger, service, or business acceptance action.
const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../..');
const base = 'docs/06-design/v2-980plus/redesign/';
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = relative => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
const save = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
const commands = [];
const run = args => {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
  commands.push({ command: ['node', ...args].join(' '), workdir: root, exitCode: result.status, output: result.stdout + result.stderr });
  if (result.status !== 0) throw new Error(commands.at(-1).output || 'Command failed');
  return result.stdout;
};
const index = JSON.parse(read(base + 'dev-plan-R1.tasks.json'));
const generated = [base + 'dev-plan-R1.tasks.json', base + 'tasks/README.md', ...index.tasks.map(t => t.instructionsFile)];
const before = generated.map(relative => ({ path: relative, sha256: hash(relative) }));
run(['scripts/generate-redesign-dev-plan-index.cjs']);
const after = generated.map(relative => ({ path: relative, sha256: hash(relative) }));
const generation = { result: JSON.stringify(before) === JSON.stringify(after) ? 'PASS' : 'FAIL', files: generated.length, differences: after.filter((item, n) => item.sha256 !== before[n].sha256) };
save('generation-check.json', generation);
if (generation.result !== 'PASS') throw new Error('Regeneration changed the reviewed output');
run(['scripts/redesign-task-state.mjs', 'wall']);
const planning = JSON.parse(run(['scripts/check-redesign-dev-plan.mjs']));
save('plan-check.json', planning);
const tools = ['scripts/generate-redesign-dev-plan-index.cjs', 'scripts/check-redesign-dev-plan.mjs', 'scripts/redesign-task-state.mjs', 'scripts/test-redesign-task-state.mjs', 'scripts/lib/redesign-task-state.mjs', 'scripts/lib/redesign-task-wall.mjs', 'scripts/lib/render-redesign-task-cards.cjs'];
for (const file of tools) run(['--check', file]);
save('syntax-check.json', { result: 'PASS', results: commands.filter(c => c.command.startsWith('node --check')).map(c => ({ file: c.command.slice('node --check '.length), exitCode: c.exitCode, output: c.output })) });
const docs = ['README.md', 'dev-plan-R1.md', 'execution-handbook.md', 'input-gates.md', 'revision-notes.md', 'validation-report.md', 'business-chains.md', 'interaction-chains.md', 'design-source-traceability.md', 'traceability-matrix.md', 'status-wall.md', 'tasks/README.md', 'mockups/admin/DEMO-GUIDE.md', 'mockups/mobile/DEMO-GUIDE.md', 'mockups/mobile/evidence/README.md'].map(p => base + p).concat(index.tasks.map(t => t.instructionsFile));
const snapshots = [...new Set([...docs.filter(p => p !== base + 'validation-report.md'), ...generated, ...index.specFiles, ...tools, base + 'dev-plan-R1.status.json', base + 'status-wall.html', 'CHANGELOG.md', path.relative(root, path.join(output, 'review-summary.md')).replaceAll('\\', '/'), path.relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/')])];
save('file-snapshot.json', { at: new Date().toISOString(), scope: 'Current uncommitted planning delivery; hashes identify files and do not prove product acceptance', excluded: ['validation-report.md (self-reference)', 'file-snapshot.json (self-reference)'], files: snapshots.map(relative => ({ path: relative, bytes: fs.statSync(path.join(root, relative)).size, sha256: hash(relative) })) });
const missing = [];
let links = 0;
for (const file of docs) {
  const text = read(file).replace(/```[\s\S]*?```/g, '');
  for (const match of text.matchAll(/\[[^\]\n]+\]\(([^\n)]+)\)/g)) {
    let target = match[1].replace(/^<|>$/g, '');
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
    target = decodeURIComponent(target.split('#')[0]);
    if (!target) continue;
    links += 1;
    if (!fs.existsSync(path.resolve(path.dirname(path.join(root, file)), target))) missing.push({ file, target });
  }
}
const linking = { result: missing.length ? 'FAIL' : 'PASS', documents: docs.length, relativeFileLinks: links, missing, limitations: 'Target existence only; external URLs and heading anchors not checked' };
save('link-check.json', linking);
if (missing.length) throw new Error(JSON.stringify(missing));
save('commands.json', { at: new Date().toISOString(), scope: 'planning artifacts only', commands });
const evidenceFiles = ['workflow-tests.tap', 'plan-check.json', 'syntax-check.json', 'generation-check.json', 'link-check.json', 'commands.json', 'snapshot-smoke-R1-001.json', 'ready-template-R1-001.json', 'submit-template-R1-001.json'].map(name => path.relative(root, path.join(output, name)).replaceAll('\\', '/'));
const finalSnapshots = [...new Set([...snapshots, ...evidenceFiles])];
save('file-snapshot.json', { at: new Date().toISOString(), scope: 'Current uncommitted planning delivery and actual verification artifacts; hashes do not prove product acceptance', excluded: ['validation-report.md (self-reference)', 'file-snapshot.json (self-reference)'], files: finalSnapshots.map(relative => ({ path: relative, bytes: fs.statSync(path.join(root, relative)).size, sha256: hash(relative) })) });
console.log(JSON.stringify({ result: 'PASS', generation, planning, linking, syntaxFiles: tools.length, snapshotFiles: finalSnapshots.length }, null, 2));
