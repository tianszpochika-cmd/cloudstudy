import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { effectiveStates, STATES } from './lib/redesign-task-state.mjs';

// Read-only planning checks. No services, database writes, or runtime acceptance.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'docs/06-design/v2-980plus/redesign/';
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const index = JSON.parse(read(base + 'dev-plan-R1.tasks.json'));
const plan = read(base + 'dev-plan-R1.md');
const ledger = read(index.canonicalStateSource);
const business = read(base + 'business-chains.md');
const interactions = read(base + 'interaction-chains.md');
const registry = read('docs/06-design/v2-980plus/08-980plus-功能点设计登记册.md');
const architecture = read('docs/02-architecture/v2-platform-capability-matrix.md');
const errors = [];
const statePath = path.join(root, base, 'dev-plan-R1.status.json');
const loadedState = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : null;
const require = (ok, message) => { if (!ok) errors.push(message); };
function expand(text, prefix) {
  const out = new Set(), add = n => out.add(prefix + '-' + String(n).padStart(3, '0'));
  for (const m of text.matchAll(/\b(BC|IC|R1)-(\d{3})((?:(?:[…–—](?:(?:BC|IC|R1)-)?|\/)\d{3})*)/g)) {
    if (m[1] !== prefix) continue;
    let previous = +m[2]; add(previous);
    for (const tail of m[3].matchAll(/([…–—\/])(?:(?:BC|IC|R1)-)?(\d{3})/g)) {
      const n = +tail[2];
      if (tail[1] === '/') add(n); else for (let i = previous; i <= n; i++) add(i);
      previous = n;
    }
  }
  return [...out];
}
const planRows = new Map(plan.split(/\r?\n/).filter(l => /^\| R1-\d{3} /.test(l)).map(l => { const c = l.split('|').slice(1, -1).map(x => x.trim()); return [c[0], c]; }));
for (const [id, c] of planRows) require(c.length === 6, id + ': expected six table columns');
const planLines = plan.split(/\r?\n/);
for (let i = 0; i < planLines.length; i++) if (/^\| 卡 \|/.test(planLines[i])) {
  require(planLines[i].split('|').slice(1, -1).length === 6 && planLines[i + 1]?.split('|').slice(1, -1).length === 6, 'task table header/separator columns at line ' + (i + 1));
}
const ids = index.tasks.map(t => t.id);
const taskById = new Map(index.tasks.map(t => [t.id, t]));
const detailedSpecs = new Map();
for (const file of index.specFiles || []) {
  const data = JSON.parse(read(file));
  for (const task of Array.isArray(data) ? data : data.tasks) {
    require(!detailedSpecs.has(task.id), 'duplicate source specification: ' + task.id);
    detailedSpecs.set(task.id, task);
  }
}
require(index.schemaVersion === 2 && detailedSpecs.size === 114, '114 detailed source specs required');
let stepCount = 0, caseCount = 0;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const exists = relative => nonempty(relative) && !path.isAbsolute(relative) && path.resolve(root, relative).startsWith(root + path.sep) && fs.existsSync(path.resolve(root, relative));
const canonicalIds = new Set([...ledger.matchAll(/^\| `(P1R-M\d-\d{3})`/gm)].map(m => m[1]));
const bcIds = new Set([...business.matchAll(/^\| (BC-\d{3})\b/gm)].map(m => m[1]));
const icIds = new Set([...interactions.matchAll(/^\| (IC-\d{3})\b/gm)].map(m => m[1]));
const planIds = [...plan.matchAll(/^\| (R1-\d{3}) /gm)].map(m => m[1]);
require(ids.length === 114 && new Set(ids).size === 114, '114 unique decomposition labels required');
require(JSON.stringify(ids) === JSON.stringify(planIds), 'task index order/labels must match plan');
require(index.planSha256 === crypto.createHash('sha256').update(plan).digest('hex'), 'plan hash drift: regenerate reviewed task index');
require(!index.tasks.some(t => Object.hasOwn(t, 'status')), 'task status must remain in canonical P1R ledger');
for (let n = 1; n <= 114; n++) require(taskById.has('R1-' + String(n).padStart(3, '0')), 'missing card ' + n);
for (const t of index.tasks) {
  const row = planRows.get(t.id);
  if (row?.length === 6) {
    require(t.scope === row[1] && t.title === row[2] && t.acceptance === row[3] && t.owner === row[4], t.id + ': Markdown/index fields disagree');
    require(JSON.stringify(t.dependsOn) === JSON.stringify(expand(row[5], 'R1')), t.id + ': Markdown/index dependencies disagree');
    require(JSON.stringify(t.bc) === JSON.stringify(expand(row[1], 'BC')), t.id + ': Markdown/index BC scope disagrees');
  }
  require(canonicalIds.has(t.executionParent), t.id + ': missing P1R parent');
  require((t.kind === 'qa') === /^QA\b/.test(t.owner), t.id + ': QA kind must follow QA responsibility, not the word replay');
  for (const p of [...t.relatedParents, ...t.contractInputs]) require(canonicalIds.has(p), t.id + ': unknown parent/contract ' + p);
  for (const d of t.dependsOn) require(taskById.has(d) && d !== t.id, t.id + ': bad dependency ' + d);
  for (const g of t.gateInputs) require(['G-ENV', 'G-CONTRACT', 'G-PLATFORM', 'G-CONTENT', 'G-FRONTEND'].includes(g), t.id + ': unknown gate ' + g);
  if (t.kind === 'frontend' && row) require(expand(row[1], 'IC').every(i => t.ic.includes(i)), t.id + ': missing explicit frontend interaction');
  for (const b of t.bc) require(bcIds.has(b), t.id + ': unknown business step ' + b);
  for (const i of t.ic) require(icIds.has(i), t.id + ': unknown interaction ' + i);
  for (const r of t.sourceTrace.requirements) require(t.spec?.requirementBindings?.some(b => b.id === r), t.id + ': missing precise requirement source ' + r);
  for (const a of t.sourceTrace.architecture) require(architecture.includes(a), t.id + ': missing architecture source ' + a);
  for (const f of ['title', 'scope', 'owner', 'acceptance', 'evidenceDirectory', 'manifest']) require(typeof t[f] === 'string' && t[f].trim(), t.id + ': empty ' + f);
  require(t.sourceTrace.canonicalTrace && t.sourceTrace.resolution && t.gateInputs.length && t.contractInputs.length && t.delivery.length, t.id + ': missing source/gate/delivery inputs');
  const milestone = t.executionParent.match(/M(\d)-/)?.[1];
  require(t.manifest === `evidence/p1r/m${milestone}/${t.executionParent}/manifest.json`, t.id + ': noncanonical manifest');
  require(t.evidenceDirectory === `evidence/p1r/m${milestone}/${t.executionParent}/redesign/${t.id}/`, t.id + ': noncanonical evidence directory');
  const spec = t.spec;
  require(spec?.id === t.id && JSON.stringify(spec) === JSON.stringify(detailedSpecs.get(t.id)), t.id + ': detailed source/index drift');
  if (!spec) continue;
  require(nonempty(spec.objective), t.id + ': concrete objective required');
  for (const field of ['requirementBindings', 'runtimeBindings', 'architectureBindings', 'readFirst', 'contractRefs', 'steps', 'testCases', 'commands', 'deliverables', 'blockers', 'nonGoals']) require(Array.isArray(spec[field]), t.id + ': specification array missing ' + field);
  for (const field of ['runtimeBindings', 'architectureBindings', 'readFirst', 'steps', 'testCases', 'commands', 'deliverables', 'nonGoals']) require(spec[field]?.length > 0, t.id + ': specification empty ' + field);
  for (const bindings of [spec.requirementBindings, spec.runtimeBindings, spec.architectureBindings]) for (const b of bindings || []) {
    require(nonempty(b.id) && nonempty(b.reason) && exists(b.path), t.id + ': invalid precise source ' + b.id);
    if (b.id !== 'N/A' && exists(b.path)) require(read(b.path).includes(b.id), t.id + ': source ID absent from specified file: ' + b.id + ' @ ' + b.path);
  }
  for (const b of spec.requirementBindings || []) require(nonempty(b.applicability), t.id + ': requirement applicability required ' + b.id);
  for (const item of spec.readFirst || []) require(exists(item.path) && nonempty(item.section), t.id + ': read-first location invalid ' + item.path);
  require(Array.isArray(spec.filePlan?.edit) && Array.isArray(spec.filePlan?.generated) && Array.isArray(spec.filePlan?.forbidden) && spec.filePlan.forbidden.length, t.id + ': file boundaries required');
  for (const item of spec.filePlan?.edit || []) {
    require(nonempty(item.path) && nonempty(item.purpose) && typeof item.exists === 'boolean', t.id + ': invalid edit path');
    require(!path.isAbsolute(item.path) && path.resolve(root, item.path).startsWith(root + path.sep), t.id + ': edit escapes workspace');
    if (item.exists) require(exists(item.path), t.id + ': claimed existing edit path absent ' + item.path);
    else {
      const prepared = loadedState?.tasks.find(record => record.id === t.id)?.ready?.fileBaseline.some(file => file.path === item.path);
      require(!exists(item.path) || prepared, t.id + ': new edit path already exists without reviewed preparation ' + item.path);
    }
  }
  for (const c of spec.contractRefs || []) {
    require(exists(c.path) && nonempty(c.action) && nonempty(c.notes) && Array.isArray(c.operations), t.id + ': contract reference incomplete ' + c.path);
    if (exists(c.path)) {
      const text = read(c.path);
      let api;
      try { api = JSON.parse(text); } catch { /* Markdown/YAML references remain text checked. */ }
      for (const operation of c.operations) {
        const route = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) (\S+)$/i.exec(operation);
        const known = api?.paths ? (route ? Boolean(api.paths[route[2]]?.[route[1].toLowerCase()]) : Object.values(api.paths).some(item => Object.values(item).some(method => method?.operationId === operation))) : text.includes(operation);
        require(known, t.id + ': unknown contract operation ' + operation + ' @ ' + c.path);
      }
    }
  }
  require(spec.steps?.length >= 3, t.id + ': at least three concrete execution steps required');
  for (const [n, step] of (spec.steps || []).entries()) {
    require(step.order === n + 1 && ['action', 'output', 'check'].every(k => nonempty(step[k])), t.id + ': numbered step incomplete ' + (n + 1));
    if (step.testCaseRefs) require(step.testCaseRefs.every(id => spec.testCases.some(test => test.id === id)), t.id + ': step refers to unknown test case ' + (n + 1));
  }
  require(spec.testCases?.length >= 3 && new Set(spec.testCases.map(c => c.id)).size === spec.testCases.length, t.id + ': at least three unique concrete test cases required');
  for (const c of spec.testCases || []) {
    require(['id', 'layer', 'setup', 'action', 'expected', 'evidence'].every(k => nonempty(c[k])), t.id + ': test case incomplete ' + c.id);
    if (c.conditionalOn) require(Array.isArray(c.conditionalOn) && c.conditionalOn.length > 0 && c.conditionalOn.every(id => spec.blockers.some(b => b.id === id && b.allowExclude === true)), t.id + ': optional case must bind a specifically excludable blocker ' + c.id);
  }
  for (const c of spec.commands || []) {
    require(['command', 'workdir', 'purpose', 'when'].every(k => nonempty(c[k])), t.id + ': command incomplete');
    const directory = path.resolve(root, c.workdir);
    require((directory === root || directory.startsWith(root + path.sep)) && fs.existsSync(directory) && fs.statSync(directory).isDirectory(), t.id + ': command working directory absent/outside workspace ' + c.workdir);
    for (const match of c.command.matchAll(/(?:^|\s)(scripts\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js))/g)) {
      const planned = spec.filePlan.edit.some(item => item.path === match[1] && item.exists === false);
      require(exists(match[1]) || (planned && c.requiresFiles?.includes(match[1])), t.id + ': command script absent without declared future-file precondition ' + match[1]);
    }
  }
  for (const b of spec.blockers || []) require(['id', 'condition', 'unblockEvidence'].every(k => nonempty(b[k])), t.id + ': blocker incomplete ' + b.id);
  require(exists(t.instructionsFile), t.id + ': rendered task card absent');
  stepCount += spec.steps?.length || 0; caseCount += spec.testCases?.length || 0;
}
const coveredBC = new Set(index.tasks.flatMap(t => t.bc));
require(coveredBC.size === 114, 'expected 114 unique BC references, not completion count');
for (const banned of ['BC-094', 'BC-187', 'BC-191', 'BC-207']) require(!coveredBC.has(banned), 'excluded write scope entered: ' + banned);
for (let n = 1; n <= 12; n++) require(index.tasks.some(t => t.reviewFindings.includes('R2-' + String(n).padStart(2, '0'))), 'review finding not assigned: ' + n);
const marks = new Map(), order = [];
function visit(id) {
  if (marks.get(id) === 1) { errors.push('dependency cycle at ' + id); return; }
  if (marks.get(id) === 2 || !taskById.has(id)) return;
  marks.set(id, 1);
  for (const d of taskById.get(id).dependsOn) visit(d);
  marks.set(id, 2); order.push(id);
}
for (const id of ids) visit(id);
require(taskById.get('R1-014')?.dependsOn.includes('R1-017'), 'L1 QA must wait for frontend');
require(taskById.get('R1-018')?.dependsOn.includes('R1-025'), 'placement must wait for qualified content seed');
require(taskById.get('R1-030')?.dependsOn.includes('R1-029'), 'plan contract must wait for placement QA');
require(taskById.get('R1-032')?.kind === 'implementation', 'ensure idempotency replay is an implementation card');
let stateCounts = null;
if (loadedState) {
  const state = loadedState;
  require(state.tasks.length === 114 && new Set(state.tasks.map(t => t.id)).size === 114 && state.tasks.every(t => taskById.has(t.id)), 'status wall must contain exactly the current 114 cards');
  require(state.tasks.every(t => STATES.includes(t.state)), 'unknown child state');
  if (errors.length === 0) {
    const effective = effectiveStates(index, state, root);
    stateCounts = Object.fromEntries([...STATES, 'STALE'].map(key => [key, [...effective.values()].filter(t => t.state === key).length]));
    require(stateCounts.STALE === 0, 'status wall has stale instructions/evidence; review before locking delivery');
  }
}
console.log(JSON.stringify({ result: errors.length ? 'FAIL' : 'PASS', cards: ids.length, detailedSpecs: detailedSpecs.size, executionSteps: stepCount, testCases: caseCount, uniqueBCReferences: coveredBC.size, reviewFindingsCovered: 12, parents: new Set(index.tasks.map(t => t.executionParent)).size, dagNodes: order.length, stateCounts, errors, scope: 'planning structure and detailed source/file/operation existence only; test case definitions are not executed product acceptance' }, null, 2));
process.exitCode = errors.length ? 1 : 0;
