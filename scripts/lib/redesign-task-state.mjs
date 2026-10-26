import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const REVIEWER_THREAD = '01a0cb93-8791-7ee2-b453-8e8752b2553f';
export const STATES = ['PLANNED', 'READY', 'IN_PROGRESS', 'REVIEW', 'REWORK', 'BLOCKED', 'ACCEPTED'];
export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export const taskDigest = task => digest(JSON.stringify(task));
const assert = (value, message) => { if (!value) throw new Error(message); };
const clone = value => JSON.parse(JSON.stringify(value));

// Local workflow checks, not an authentication boundary. Only the designated
// reviewing chat may author approval receipts under the repository work rules.
export function resolveFile(root, relative) {
  assert(typeof relative === 'string' && relative && !path.isAbsolute(relative), 'Expected repository-relative file');
  const absolute = path.resolve(root, relative);
  assert(absolute.startsWith(path.resolve(root) + path.sep), 'File escapes repository');
  assert(relative.replaceAll('\\', '/') === path.relative(root, absolute).replaceAll('\\', '/'), 'File path must be canonical, without traversal');
  assert(fs.statSync(absolute).isFile(), 'Evidence must be a regular file: ' + relative);
  assert(fs.realpathSync(absolute).startsWith(fs.realpathSync(root) + path.sep), 'File link escapes repository');
  return absolute;
}
export function artifact(root, relative) {
  const absolute = resolveFile(root, relative);
  return { path: relative.replaceAll('\\', '/'), sha256: digest(fs.readFileSync(absolute)) };
}
export function verifyArtifact(root, item) {
  assert(item && /^[a-f0-9]{64}$/.test(item.sha256), 'Missing SHA-256');
  const current = artifact(root, item.path);
  assert(current.sha256 === item.sha256, 'File changed: ' + item.path);
}
export function inputArtifacts(root, task) {
  const paths = [task.specFile, ...(task.spec.readFirst || []).map(b => b.path), ...(task.spec.requirementBindings || []).map(b => b.path), ...(task.spec.runtimeBindings || []).map(b => b.path), ...(task.spec.architectureBindings || []).map(b => b.path), ...(task.spec.contractRefs || []).map(b => b.path), ...(task.spec.filePlan.edit || []).filter(b => b.exists).map(b => b.path)].filter(Boolean);
  return [...new Set(paths)].map(p => artifact(root, p));
}
export function initialState(index, now) {
  return { schemaVersion: 1, revision: 0, updatedAt: now, reviewerThreadId: REVIEWER_THREAD,
    scope: 'R1 child delivery/review only; canonical P1R states are unchanged',
    tasks: index.tasks.map(task => ({ id: task.id, state: 'PLANNED', executor: null, specSha256: taskDigest(task),
      completedSteps: [], submission: null, review: null, ready: null, history: [] })) };
}
function ledgerSnapshot(root, ledgerPath, task) {
  const text = fs.readFileSync(resolveFile(root, ledgerPath), 'utf8');
  const rows = new Map();
  for (const line of text.split(/\r?\n/)) { const match = /^\|\s*`?(P1R-M\d-\d{3})`?\s*\|/.exec(line); if (match) rows.set(match[1], line); }
  const ids = [...new Set([task.executionParent, ...(task.relatedParents || []), ...(task.contractInputs || [])])].sort();
  return { path: ledgerPath, parents: ids.map(id => { assert(rows.has(id), 'Canonical parent row missing: ' + id); return { id, sha256: digest(rows.get(id)) }; }) };
}
export function deliveryInScope(root, task, relative) {
  if (relative.startsWith(task.evidenceDirectory)) return true;
  return [...task.spec.filePlan.edit, ...task.spec.filePlan.generated].some(item => {
    const allowed = item.path.replaceAll('\\', '/');
    if (relative === allowed) return true;
    if (allowed.includes('*')) {
      const expression = '^' + allowed.split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$';
      return new RegExp(expression).test(relative);
    }
    const absolute = path.resolve(root, allowed);
    return (allowed.endsWith('/') || (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory())) && relative.startsWith(allowed.replace(/\/$/, '') + '/');
  });
}
export function scopeSnapshot(root, task) {
  const files = new Map();
  function collect(relative) {
    const absolute = path.resolve(root, relative);
    assert(absolute.startsWith(path.resolve(root) + path.sep), 'File plan escapes repository');
    if (!fs.existsSync(absolute)) { files.set(relative, { path: relative, sha256: null }); return; }
    assert(fs.realpathSync(absolute).startsWith(fs.realpathSync(root) + path.sep), 'File plan link escapes repository');
    if (fs.statSync(absolute).isDirectory()) {
      for (const entry of fs.readdirSync(absolute)) collect(relative.replace(/\/$/, '') + '/' + entry);
    } else files.set(relative, artifact(root, relative));
  }
  for (const item of [...task.spec.filePlan.edit, ...task.spec.filePlan.generated]) {
    const relative = item.path.replaceAll('\\', '/').replace(/\/$/, '');
    if (relative.startsWith(task.evidenceDirectory.replace(/\/$/, '') + '/')) continue;
    assert(!relative.includes('*'), 'Declare exact generated files or directories before preparation');
    collect(relative);
  }
  return [...files.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
export function gitSnapshot(root, task) {
  const files = scopeSnapshot(root, task);
  const paths = [...new Set([...task.spec.filePlan.edit, ...task.spec.filePlan.generated].map(item => item.path).filter(p => !p.startsWith(task.evidenceDirectory)))];
  const git = args => execFileSync('git', ['-c', 'core.hooksPath=' + path.join(root, '.git', 'unused-workflow-hooks'), ...args], { cwd: root, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  const sourceCommit = git(['rev-parse', 'HEAD']).toString('utf8').trim();
  const diff = git(['diff', 'HEAD', '--binary', '--no-ext-diff', '--no-textconv', '--', ...paths]);
  const status = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...paths]);
  return { sourceCommit, dirtyDiffSha256: digest(Buffer.concat([diff, status, Buffer.from(JSON.stringify(files))])), files };
}
function verifyScope(root, task, snapshot) {
  assert(JSON.stringify(scopeSnapshot(root, task)) === JSON.stringify(snapshot), 'Scoped delivery files changed; include all edits and rerun review');
}
function verifyPreparation(root, task, ready, replacements = [], working = false, deleted = []) {
  assert(ready, 'Input preparation is missing');
  verifyArtifact(root, ready.receipt);
  assert(JSON.stringify(ledgerSnapshot(root, ready.ledgerSnapshot.path, task)) === JSON.stringify(ready.ledgerSnapshot), 'Relevant canonical parent rows changed; prepare inputs again');
  for (const item of ready.evidence) verifyArtifact(root, item);
  for (const original of ready.sourceArtifacts) {
    if (original.path === ready.ledgerSnapshot.path) continue; // Whole-file baseline retained; current validity uses the relevant parent rows.
    if (!fs.existsSync(path.resolve(root, original.path)) && deliveryInScope(root, task, original.path)) {
      if (working) continue;
      assert(deleted.some(item => item.path === original.path && item.previousSha256 === original.sha256), 'Deleted input needs an in-scope baseline tombstone: ' + original.path);
      continue;
    }
    const changed = artifact(root, original.path).sha256 !== original.sha256;
    if (changed && deliveryInScope(root, task, original.path)) {
      // Preserve the preparation baseline. Deliberate edits must be listed in
      // the current delivery; immutable source/policy files remain pinned.
      if (working) continue;
      const replacement = replacements.find(item => item.path === original.path);
      assert(replacement, 'Changed input needs an in-scope delivery snapshot: ' + original.path);
      verifyArtifact(root, replacement);
    } else verifyArtifact(root, original);
  }
}
export function effectiveStates(index, state, root) {
  const records = new Map(state.tasks.map(record => [record.id, record]));
  const specs = new Map(index.tasks.map(task => [task.id, task]));
  const result = new Map();
  const visit = id => {
    if (result.has(id)) return result.get(id);
    const task = specs.get(id), record = records.get(id);
    const issues = [];
    if (!record) issues.push('Missing status record');
    else {
      if (record.specSha256 !== taskDigest(task)) issues.push('Task instructions changed');
      try { for (const entry of record.history) verifyArtifact(root, entry.receipt); }
      catch (error) { issues.push(error.message); }
      if (record.ready) {
        try {
          verifyPreparation(root, task, record.ready, record.submission?.artifacts || [], record.state === 'IN_PROGRESS', record.submission?.deletedArtifacts || []);
          for (const dep of task.dependsOn) assert(visit(dep).state === 'ACCEPTED', 'Dependency needs review: ' + dep);
        }
        catch (error) { issues.push(error.message); }
      }
      if (['REVIEW', 'REWORK', 'ACCEPTED'].includes(record.state) && record.submission) {
        try {
          verifyScope(root, task, record.submission.scopeSnapshot);
          if (record.state !== 'ACCEPTED') {
            const current = gitSnapshot(root, task);
            assert(current.sourceCommit === record.submission.sourceCommit && current.dirtyDiffSha256 === record.submission.dirtyDiffSha256, 'Scoped Git snapshot changed since submission');
          }
          for (const item of [...record.submission.artifacts, ...record.submission.evidence]) verifyArtifact(root, item);
          verifyArtifact(root, record.submission.receipt);
        } catch (error) { issues.push(error.message); }
      }
      if (record.state === 'ACCEPTED') {
        try {
          assert(record.submission && record.review, 'Missing submission/review');
          assert(record.ready, 'Missing input gate review');
          for (const item of record.review.evidence) verifyArtifact(root, item);
          verifyArtifact(root, record.review.receipt);
          for (const dep of task.dependsOn) assert(visit(dep).state === 'ACCEPTED', 'Dependency needs review: ' + dep);
        } catch (error) { issues.push(error.message); }
      }
    }
    const value = { state: issues.length ? 'STALE' : record.state, issues };
    result.set(id, value); return value;
  };
  for (const task of index.tasks) visit(task.id);
  return result;
}
export function applyReceipt(index, previous, receipt, receiptRef, root, now) {
  assert(receipt.expectedRevision === previous.revision, 'Status revision conflict; reload the latest wall');
  const task = index.tasks.find(item => item.id === receipt.taskId);
  assert(task, 'Unknown task');
  const state = clone(previous), record = state.tasks.find(item => item.id === task.id);
  assert(record && STATES.includes(record.state), 'Invalid status record');
  assert(receipt.specSha256 === taskDigest(task), 'Receipt refers to old task instructions');
  assert(typeof receipt.actor === 'string' && receipt.actor.trim(), 'Actor required');
  assert(typeof receipt.note === 'string' && receipt.note.trim(), 'Concrete note required');
  verifyArtifact(root, receiptRef);
  assert(receiptRef.path.startsWith(task.evidenceDirectory), 'Receipt must be in this task evidence directory');
  if (!['block', 'reopen'].includes(receipt.action)) for (const entry of record.history) verifyArtifact(root, entry.receipt);
  const files = (items, required = true) => {
    assert(Array.isArray(items) && (!required || items.length), 'Evidence/artifact list required');
    for (const item of items) {
      verifyArtifact(root, item);
      assert(item.path.startsWith(task.evidenceDirectory), 'Evidence outside task directory: ' + item.path);
    }
  };
  const reviewer = () => {
    assert(receipt.reviewerThreadId === REVIEWER_THREAD && receipt.role === 'reviewer', 'Designated reviewer receipt required');
    assert(receipt.actor !== record.executor, 'Executor cannot approve own delivery');
  };
  const dependencies = () => {
    const effective = effectiveStates(index, previous, root);
    for (const id of task.dependsOn) assert(effective.get(id).state === 'ACCEPTED', 'Dependency not accepted: ' + id);
  };
  switch (receipt.action) {
    case 'ready': {
      reviewer();
      assert(['PLANNED', 'BLOCKED', 'REWORK', 'READY'].includes(record.state), 'Cannot prepare this state');
      dependencies(); files(receipt.evidence);
      assert(Array.isArray(receipt.sourceArtifacts), 'Input source artifact snapshots required');
      const sources = inputArtifacts(root, task);
      assert(sources.every(source => receipt.sourceArtifacts.some(item => item.path === source.path && item.sha256 === source.sha256)), 'Current input source snapshots required');
      for (const item of receipt.sourceArtifacts) verifyArtifact(root, item);
      assert(receipt.parentClaim?.taskId === task.executionParent && receipt.parentClaim.confirmed === true && receipt.parentClaim.owner, 'P1R owner/claim confirmation required');
      assert(receipt.parentClaim.canonicalLedgerSha256 === artifact(root, index.canonicalStateSource).sha256, 'P1R ledger snapshot drift');
      assert(task.gateInputs.every(id => receipt.gates?.some(gate => gate.id === id && gate.result === 'PASS' && typeof gate.scope === 'string' && gate.scope.trim() && gate.evidencePaths?.length && gate.evidencePaths.every(p => receipt.evidence.some(e => e.path === p)))), 'Every applicable input gate needs an explicit preparation scope and current evidence');
      assert((task.spec.blockers || []).every(blocker => receipt.blockerDecisions?.some(d => d.id === blocker.id && ['APPROVED', 'EXCLUDED'].includes(d.disposition) && d.reason && d.evidencePaths?.length && d.evidencePaths.every(p => receipt.evidence.some(e => e.path === p)))), 'Resolve or explicitly exclude each conditional blocker');
      for (const decision of receipt.blockerDecisions || []) if (decision.disposition === 'EXCLUDED') assert(task.spec.blockers.some(b => b.id === decision.id && b.allowExclude === true), 'This required input cannot be excluded: ' + decision.id);
      record.state = 'READY'; record.specSha256 = receipt.specSha256; record.ready = { receipt: receiptRef, sourceArtifacts: receipt.sourceArtifacts, evidence: receipt.evidence, gates: receipt.gates, blockerDecisions: receipt.blockerDecisions || [], parentClaim: receipt.parentClaim, ledgerSnapshot: ledgerSnapshot(root, index.canonicalStateSource, task), fileBaseline: scopeSnapshot(root, task) };
      record.completedSteps = []; record.submission = null; record.review = null;
      break;
    }
    case 'start':
      assert(['READY', 'REWORK'].includes(record.state), 'Start requires READY or REWORK');
      dependencies(); assert(record.specSha256 === receipt.specSha256 && record.ready, 'Inputs need fresh preparation');
      verifyPreparation(root, task, record.ready, record.submission?.artifacts || [], false, record.submission?.deletedArtifacts || []);
      verifyScope(root, task, record.state === 'REWORK' && record.submission ? record.submission.scopeSnapshot : record.ready.fileBaseline);
      record.state = 'IN_PROGRESS'; record.executor = receipt.actor; record.review = null; break;
    case 'checkpoint':
      assert(record.state === 'IN_PROGRESS' && receipt.actor === record.executor, 'Only current executor records development checkpoints');
      assert(Array.isArray(receipt.completedSteps) && receipt.completedSteps.every(n => task.spec.steps.some(step => step.order === n)), 'Unknown step');
      files(receipt.evidence);
      record.completedSteps = [...new Set(receipt.completedSteps)].sort((a, b) => a - b); break;
    case 'submit': {
      assert(record.state === 'IN_PROGRESS' && receipt.actor === record.executor, 'Submit requires current executor');
      dependencies(); files(receipt.evidence);
      assert(Array.isArray(receipt.artifacts) && receipt.artifacts.length, 'Current delivery artifacts required');
      for (const item of receipt.artifacts) { verifyArtifact(root, item); assert(deliveryInScope(root, task, item.path.replaceAll('\\', '/')), 'Delivery artifact outside card file plan: ' + item.path); }
      verifyPreparation(root, task, record.ready, receipt.artifacts, false, receipt.deletedArtifacts || []);
      const current = gitSnapshot(root, task);
      const baseline = new Map(record.ready.fileBaseline.map(item => [item.path, item.sha256]));
      for (const item of current.files) if (item.sha256 && item.sha256 !== baseline.get(item.path)) assert(receipt.artifacts.some(a => a.path === item.path && a.sha256 === item.sha256), 'Changed scope file omitted from delivery: ' + item.path);
      const present = new Map(current.files.map(item => [item.path, item.sha256]));
      for (const item of receipt.deletedArtifacts || []) assert(baseline.get(item.path) === item.previousSha256 && item.previousSha256 && !fs.existsSync(path.resolve(root, item.path)), 'Invalid scoped deletion tombstone: ' + item.path);
      for (const item of record.ready.fileBaseline) if (item.sha256 && !present.get(item.path)) assert(receipt.deletedArtifacts?.some(a => a.path === item.path && a.previousSha256 === item.sha256), 'Deleted scope file needs a baseline tombstone: ' + item.path);
      assert(task.spec.steps.every(step => receipt.completedSteps?.includes(step.order)), 'All development steps must be delivered');
      assert(/^[a-f0-9]{40}$/.test(receipt.sourceCommit) && /^[a-f0-9]{64}$/.test(receipt.dirtyDiffSha256), 'Source commit and dirty diff SHA-256 required');
      assert(receipt.sourceCommit === current.sourceCommit && receipt.dirtyDiffSha256 === current.dirtyDiffSha256, 'Source commit/diff must match the actual current scoped Git snapshot');
      assert(receipt.environment && Array.isArray(receipt.knownGaps) && receipt.rollback, 'Environment, known gaps array and rollback required');
      record.completedSteps = task.spec.steps.map(step => step.order);
      record.submission = { receipt: receiptRef, artifacts: receipt.artifacts, deletedArtifacts: receipt.deletedArtifacts || [], scopeSnapshot: current.files, evidence: receipt.evidence, sourceCommit: receipt.sourceCommit, dirtyDiffSha256: receipt.dirtyDiffSha256, environment: receipt.environment, knownGaps: receipt.knownGaps, rollback: receipt.rollback, submittedAt: now };
      record.state = 'REVIEW'; record.review = null; break;
    }
    case 'approve': {
      reviewer(); assert(record.state === 'REVIEW' && record.submission && record.ready, 'Approve requires submitted REVIEW');
      dependencies(); assert(record.specSha256 === receipt.specSha256, 'Submission instructions are stale');
      verifyPreparation(root, task, record.ready, record.submission.artifacts, false, record.submission.deletedArtifacts);
      const current = gitSnapshot(root, task);
      verifyScope(root, task, record.submission.scopeSnapshot);
      assert(current.sourceCommit === record.submission.sourceCommit && current.dirtyDiffSha256 === record.submission.dirtyDiffSha256, 'Scoped Git snapshot changed since submission');
      for (const item of [...record.submission.artifacts, ...record.submission.evidence]) verifyArtifact(root, item);
      verifyArtifact(root, record.submission.receipt); files(receipt.evidence);
      assert(Array.isArray(receipt.results) && new Set(receipt.results.map(r => r.id)).size === task.spec.testCases.length && receipt.results.length === task.spec.testCases.length, 'Every case needs one review result');
      for (const test of task.spec.testCases) {
        const result = receipt.results.find(item => item.id === test.id);
        assert(result && ['PASS', 'NOT_APPLICABLE'].includes(result.result) && result.actual && result.evidencePaths?.length && result.evidencePaths.every(p => receipt.evidence.some(e => e.path === p)), 'Case lacks reviewed evidence: ' + test.id);
        if (result.result === 'NOT_APPLICABLE') assert(result.reason && test.conditionalOn?.includes(result.excludedBy) && record.ready.blockerDecisions.some(d => d.disposition === 'EXCLUDED' && d.id === result.excludedBy), 'Excluded case needs a matching conditional test and prepared scope decision');
      }
      assert(Array.isArray(receipt.stepChecks) && receipt.stepChecks.length === task.spec.steps.length && new Set(receipt.stepChecks.map(s => s.order)).size === task.spec.steps.length, 'Every execution step needs one reviewer check');
      for (const step of task.spec.steps) {
        const check = receipt.stepChecks.find(item => item.order === step.order);
        assert(check?.result === 'PASS' && check.actual && check.evidencePaths?.length && check.evidencePaths.every(p => receipt.evidence.some(e => e.path === p)), 'Step lacks reviewer verification: ' + step.order);
      }
      assert(receipt.runs?.length && receipt.runs.every(run => run.command && run.startedAt && run.finishedAt && run.exitCode === 0 && receipt.evidence.some(e => e.path === run.logPath)), 'Reviewer rerun log required');
      assert(receipt.runs.every(run => Number.isFinite(Date.parse(run.startedAt)) && Number.isFinite(Date.parse(run.finishedAt)) && Date.parse(run.startedAt) >= Date.parse(record.submission.submittedAt) && Date.parse(run.finishedAt) >= Date.parse(run.startedAt) && Date.parse(run.finishedAt) <= Date.parse(now)), 'Reviewer rerun timestamps must be valid and follow the current submission');
      assert(!record.submission.knownGaps.some(gap => gap.blocking || ['P0', 'P1', 'P2'].includes(gap.priority)), 'Blocking delivery gaps remain open');
      assert(receipt.decision === 'ACCEPTED' && receipt.findings?.filter(f => ['P0', 'P1', 'P2'].includes(f.priority)).length === 0, 'Blocking findings must be fixed before acceptance');
      record.review = { receipt: receiptRef, reviewerThreadId: REVIEWER_THREAD, actor: receipt.actor, evidence: receipt.evidence, results: receipt.results, stepChecks: receipt.stepChecks, runs: receipt.runs, findings: receipt.findings || [], reviewedAt: now };
      record.state = 'ACCEPTED'; break;
    }
    case 'reject':
      reviewer(); assert(record.state === 'REVIEW', 'Reject requires REVIEW'); files(receipt.evidence);
      assert(receipt.findings?.length, 'Rework needs actionable findings');
      record.state = 'REWORK'; record.review = { receipt: receiptRef, actor: receipt.actor, evidence: receipt.evidence, findings: receipt.findings, reviewedAt: now }; break;
    case 'block':
      assert(record.state !== 'ACCEPTED', 'Accepted work needs reopen before blocking');
      assert(receipt.condition && receipt.unblockEvidence, 'Block requires condition and concrete unblock evidence');
      record.state = 'BLOCKED'; record.block = { condition: receipt.condition, unblockEvidence: receipt.unblockEvidence }; break;
    case 'reopen':
      reviewer(); assert(record.state === 'ACCEPTED', 'Reopen requires ACCEPTED');
      record.state = 'REWORK'; record.specSha256 = receipt.specSha256; record.ready = null; record.review = null; break;
    default: throw new Error('Unknown action');
  }
  record.history.push({ at: now, action: receipt.action, actor: receipt.actor, note: receipt.note, receipt: receiptRef, state: record.state });
  state.revision += 1; state.updatedAt = now;
  return state;
}

export function saveState(filename, value, expectedRevision) {
  const lock = filename + '.lock';
  let handle, temporary;
  try {
    handle = fs.openSync(lock, 'wx');
    const existing = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : null;
    assert((existing?.revision ?? -1) === expectedRevision, 'Concurrent update; reload status');
    temporary = filename + '.tmp-' + crypto.randomUUID();
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(temporary, filename);
  } finally {
    if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary);
    if (handle !== undefined) { fs.closeSync(handle); fs.unlinkSync(lock); }
  }
}
