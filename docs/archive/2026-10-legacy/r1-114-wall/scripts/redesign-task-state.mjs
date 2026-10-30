import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialState, artifact, inputArtifacts, gitSnapshot, applyReceipt, saveState, taskDigest, REVIEWER_THREAD } from './lib/redesign-task-state.mjs';
import { renderWall } from './lib/redesign-task-wall.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'docs/06-design/v2-980plus/redesign/';
const readJSON = filename => JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
const index = readJSON(path.join(root, base, 'dev-plan-R1.tasks.json'));
const filename = path.join(root, base, 'dev-plan-R1.status.json');
const [action, id, receiptPath] = process.argv.slice(2);
try {
  if (index.schemaVersion !== 2 || index.tasks.length !== 114 || index.tasks.some(task => task.spec?.id !== task.id)) throw new Error('Generate and validate the current 114 detailed task specifications first');
  if (action === 'init') {
    if (!fs.existsSync(filename)) saveState(filename, initialState(index, new Date().toISOString()), -1);
    console.log('Status records preserved/initialized; no task accepted.');
  } else if (action === 'hash') {
    const task = index.tasks.find(task => task.id === id);
    if (!task) throw new Error('Unknown task');
    console.log(taskDigest(task));
  } else if (action === 'artifact') {
    console.log(JSON.stringify(artifact(root, id), null, 2));
  } else if (action === 'snapshot') {
    const task = index.tasks.find(task => task.id === id);
    if (!task) throw new Error('Unknown task');
    console.log(JSON.stringify(gitSnapshot(root, task), null, 2));
  } else if (action === 'template') {
    const task = index.tasks.find(task => task.id === id);
    if (!task) throw new Error('Unknown task');
    const previous = readJSON(filename);
    const proof = { path: task.evidenceDirectory + 'REPLACE-with-proof-file', sha256: 'REPLACE-with-actual-sha256' };
    const common = { taskId: id, action: receiptPath, expectedRevision: previous.revision, specSha256: taskDigest(task), actor: 'REPLACE-with-executor', note: 'REPLACE-with-concrete-result' };
    let extra;
    if (receiptPath === 'ready') extra = { role: 'reviewer', reviewerThreadId: REVIEWER_THREAD, actor: 'root-reviewer', sourceArtifacts: inputArtifacts(root, task), parentClaim: { taskId: task.executionParent, confirmed: false, owner: 'REPLACE-with-confirmed-P1R-owner', canonicalLedgerSha256: artifact(root, index.canonicalStateSource).sha256 }, gates: task.gateInputs.map(id => ({ id, result: 'PENDING', scope: 'REPLACE-with-actual-input-scope-and-pending-card-output-boundary', evidencePaths: [proof.path] })), blockerDecisions: task.spec.blockers.map(b => ({ id: b.id, disposition: 'PENDING', reason: b.condition, evidencePaths: [proof.path] })), evidence: [proof] };
    else if (receiptPath === 'submit') { const snapshot = gitSnapshot(root, task); extra = { completedSteps: task.spec.steps.map(s => s.order), sourceCommit: snapshot.sourceCommit, dirtyDiffSha256: snapshot.dirtyDiffSha256, artifacts: [{ path: 'REPLACE-with-current-delivery-path', sha256: proof.sha256 }], deletedArtifacts: [], evidence: [proof], environment: { kind: 'REPLACE-with-isolated-environment', ports: [], schemas: [], fixtureDigest: 'REPLACE' }, knownGaps: [], rollback: 'REPLACE-with-scoped-rollback-and-evidence' }; }
    else if (receiptPath === 'approve') extra = { role: 'reviewer', reviewerThreadId: REVIEWER_THREAD, actor: 'root-reviewer', decision: 'PENDING', evidence: [proof], results: task.spec.testCases.map(test => ({ id: test.id, result: 'PENDING', actual: '', evidencePaths: [proof.path] })), stepChecks: task.spec.steps.map(step => ({ order: step.order, result: 'PENDING', actual: '', evidencePaths: [proof.path] })), runs: [{ command: 'REPLACE-with-actual-rerun-command', startedAt: '', finishedAt: '', exitCode: null, logPath: proof.path }], findings: [] };
    else if (receiptPath === 'checkpoint') extra = { completedSteps: [], evidence: [proof] };
    else if (receiptPath === 'block') extra = { condition: '', unblockEvidence: '' };
    else if (receiptPath === 'reject') extra = { role: 'reviewer', reviewerThreadId: REVIEWER_THREAD, actor: 'root-reviewer', evidence: [proof], findings: [{ priority: 'P1', path: '', line: 1, problem: '', fix: '', retestCaseIds: [] }] };
    else if (receiptPath === 'reopen') extra = { role: 'reviewer', reviewerThreadId: REVIEWER_THREAD, actor: 'root-reviewer' };
    else if (receiptPath === 'start') extra = {};
    else throw new Error('Unknown receipt template action');
    console.log(JSON.stringify({ ...common, ...extra }, null, 2));
  } else if (action === 'record') {
    const previous = readJSON(filename);
    const reference = artifact(root, receiptPath);
    const receipt = readJSON(path.join(root, reference.path));
    if (receipt.taskId !== id) throw new Error('Receipt task ID mismatch');
    const next = applyReceipt(index, previous, receipt, reference, root, new Date().toISOString());
    saveState(filename, next, previous.revision);
    renderWall(root, base, index, next);
    console.log(`${id}: ${next.tasks.find(task => task.id === id).state}; revision ${next.revision}`);
  } else if (action === 'wall') {
    renderWall(root, base, index, readJSON(filename));
    console.log('Read-only status wall regenerated.');
  } else {
    throw new Error('Usage: node scripts/redesign-task-state.mjs init | wall | hash R1-ID | snapshot R1-ID | artifact relative/path | template R1-ID action | record R1-ID receipt.json');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
