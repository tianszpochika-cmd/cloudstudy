import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ALLOWED_STATUSES = new Set([
  'PLANNED',
  'READY',
  'IN_PROGRESS',
  'REVIEW',
  'ACCEPTED',
  'BLOCKED',
  'REWORK',
]);

const DEPENDENCY_READY_STATUSES = new Set(['READY', 'IN_PROGRESS', 'REVIEW', 'ACCEPTED']);
const EVIDENCE_REQUIRED_STATUSES = new Set(['REVIEW', 'ACCEPTED', 'BLOCKED', 'REWORK']);
const TERMINAL_DECISIONS = new Set(['ACCEPTED', 'BLOCKED', 'REWORK']);
const STATUS_TRANSITIONS = new Map([
  ['PLANNED', new Set(['READY'])],
  ['READY', new Set(['IN_PROGRESS', 'BLOCKED'])],
  ['IN_PROGRESS', new Set(['REVIEW', 'BLOCKED'])],
  ['REVIEW', new Set(['ACCEPTED', 'REWORK', 'BLOCKED'])],
  ['BLOCKED', new Set(['READY', 'IN_PROGRESS', 'REWORK'])],
  ['REWORK', new Set(['IN_PROGRESS', 'BLOCKED'])],
  ['ACCEPTED', new Set(['REWORK'])],
]);
const SHA40 = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function splitRow(line) {
  return line.slice(1, -1).split('|').map((column) => column.trim());
}

export function parseDependencyCell(cell) {
  const dependencies = new Set(
    [...cell.matchAll(/\b(M\d-\d{3})\b/g)].map((match) => `P1R-${match[1]}`),
  );
  const rangePattern = /\b(M\d)-(\d{3})\s*(?:…|\.\.\.|–|—)\s*(?:(M\d)-)?(\d{3})\b/g;
  for (const match of cell.matchAll(rangePattern)) {
    const startMilestone = match[1];
    const endMilestone = match[3] ?? startMilestone;
    const start = Number(match[2]);
    const end = Number(match[4]);
    if (startMilestone !== endMilestone) {
      throw new Error(`dependency range crosses milestones: ${match[0]}`);
    }
    if (end < start) throw new Error(`dependency range is descending: ${match[0]}`);
    for (let index = start; index <= end; index += 1) {
      dependencies.add(`P1R-${startMilestone}-${String(index).padStart(3, '0')}`);
    }
  }
  return [...dependencies].sort((left, right) => left.localeCompare(right, 'en'));
}

export function parseLedger(text) {
  const rows = text
    .split(/\r?\n/)
    .filter((line) => /^\|\s*`P1R-M\d-\d{3}`\s*\|/.test(line));
  const tasks = rows.map((line) => {
    const columns = splitRow(line);
    if (columns.length !== 9) throw new Error(`task row must have 9 columns: ${line}`);
    const id = columns[0].match(/^`(P1R-M\d-\d{3})`$/)?.[1];
    const status = columns[7].match(/^`([A-Z_]+)`$/)?.[1];
    const dependencies = parseDependencyCell(columns[4]);
    if (!id) throw new Error(`invalid task ID cell: ${columns[0]}`);
    return {
      id,
      milestone: id.match(/^P1R-(M\d)-/)?.[1],
      status,
      dependencies,
      line,
    };
  });
  return tasks;
}

export function validateStatusTrajectories({ root, tasks, checkGit = true }) {
  const errors = [];
  const nonPlanned = tasks.filter((task) => task.status !== 'PLANNED');
  const trajectoryPath = path.join(root, 'requirements', 'backlog', 'v2-phase1-rebaseline', 'execution', 'status-trajectories.json');
  if (!fs.existsSync(trajectoryPath)) {
    if (nonPlanned.length > 0) errors.push(`missing status trajectory registry: ${repositoryPath(root, trajectoryPath)}`);
    return errors;
  }
  if (checkGit) validateCommittedPath(root, trajectoryPath, 'status trajectory registry', errors);

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(trajectoryPath, 'utf8'));
  } catch (error) {
    return [...errors, `invalid status trajectory registry JSON: ${error.message}`];
  }
  add(errors, registry.schemaVersion === 'p1r.status-trajectories.v1', 'status trajectory registry has an unsupported schemaVersion');
  add(errors, Array.isArray(registry.records), 'status trajectory registry records must be an array');
  if (!Array.isArray(registry.records)) return errors;

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set();
  for (const [index, record] of registry.records.entries()) {
    const label = `status trajectory records[${index}]`;
    add(errors, isRecord(record), `${label} must be an object`);
    if (!isRecord(record)) continue;
    const task = tasksById.get(record.taskId);
    add(errors, Boolean(task), `${label} references unknown task ${record.taskId ?? '<missing>'}`);
    add(errors, !seen.has(record.taskId), `${label} duplicates task ${record.taskId ?? '<missing>'}`);
    if (nonEmptyString(record.taskId)) seen.add(record.taskId);
    add(errors, validTimestamp(record.recordedAt), `${label}.recordedAt must be an ISO timestamp`);
    add(errors, nonEmptyString(record.actor), `${label}.actor is required`);
    add(errors, nonEmptyString(record.reason), `${label}.reason is required`);
    add(errors, nonEmptyString(record.evidencePath), `${label}.evidencePath is required`);
    add(errors, Array.isArray(record.path) && record.path.length >= 2, `${label}.path must contain at least two states`);
    if (!task || !Array.isArray(record.path) || record.path.length < 2) continue;
    add(errors, record.path[0] === 'PLANNED', `${label}.path must start at PLANNED`);
    for (const [stateIndex, state] of record.path.entries()) {
      add(errors, ALLOWED_STATUSES.has(state), `${label}.path[${stateIndex}] is illegal: ${state}`);
      if (stateIndex === 0) continue;
      const from = record.path[stateIndex - 1];
      add(errors, STATUS_TRANSITIONS.get(from)?.has(state) === true, `${label} has illegal transition ${from} -> ${state}`);
    }
    add(errors, record.path.at(-1) === task.status, `${label} final state ${record.path.at(-1)} does not match ledger ${task.status}`);
    if (EVIDENCE_REQUIRED_STATUSES.has(task.status)) {
      const expected = `evidence/p1r/${task.milestone.toLowerCase()}/${task.id}/manifest.json`;
      add(errors, record.evidencePath === expected, `${label}.evidencePath must be ${expected}`);
    }
  }
  for (const task of nonPlanned) add(errors, seen.has(task.id), `${task.id}: non-PLANNED status requires a status trajectory`);
  for (const task of tasks.filter((item) => item.status === 'PLANNED')) {
    add(errors, !seen.has(task.id), `${task.id}: PLANNED task must not have a completed trajectory record`);
  }
  return errors;
}

function resolveInside(root, relativePath, label, errors) {
  if (!nonEmptyString(relativePath) || path.isAbsolute(relativePath)) {
    errors.push(`${label} must be a non-empty repository-relative path`);
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    errors.push(`${label} escapes the repository: ${relativePath}`);
    return null;
  }
  return resolved;
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function readGitBlob(root, revision, relativePath) {
  const repositoryPath = relativePath.replaceAll('\\', '/');
  const result = spawnSync('git', ['show', `${revision}:${repositoryPath}`], {
    cwd: root,
    encoding: null,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  return result.status === 0 ? result.stdout : null;
}

function validTimestamp(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function commandSucceeded(root, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  return result.status === 0;
}

function repositoryPath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function validateCommittedPath(root, filePath, label, errors) {
  const relativePath = repositoryPath(root, filePath);
  add(errors, commandSucceeded(root, 'git', ['ls-files', '--error-unmatch', '--', relativePath]), `${label} must be tracked by Git: ${relativePath}`);
  add(errors, readGitBlob(root, 'HEAD', relativePath) !== null, `${label} must exist in HEAD: ${relativePath}`);
  add(errors, commandSucceeded(root, 'git', ['diff', '--quiet', '--', relativePath]), `${label} has unstaged changes: ${relativePath}`);
  add(errors, commandSucceeded(root, 'git', ['diff', '--cached', '--quiet', '--', relativePath]), `${label} has staged changes: ${relativePath}`);
}

export function validateManifest({ root, task, manifest, manifestPath, checkGit = true }) {
  const errors = [];
  add(errors, isRecord(manifest), `${task.id}: manifest must be an object`);
  if (!isRecord(manifest)) return errors;

  add(errors, manifest.taskId === task.id, `${task.id}: manifest taskId mismatch`);
  add(errors, manifest.canonicalTaskStatus === task.status, `${task.id}: manifest canonicalTaskStatus must match ledger`);
  add(errors, SHA40.test(manifest.sourceCommit ?? ''), `${task.id}: sourceCommit must be a full 40-character SHA`);
  add(errors, nonEmptyString(manifest.environment) || isRecord(manifest.environment), `${task.id}: environment is required`);
  add(errors, validTimestamp(manifest.startedAt), `${task.id}: startedAt must be an ISO timestamp`);
  add(errors, validTimestamp(manifest.finishedAt), `${task.id}: finishedAt must be an ISO timestamp`);
  if (validTimestamp(manifest.startedAt) && validTimestamp(manifest.finishedAt)) {
    add(errors, Date.parse(manifest.finishedAt) >= Date.parse(manifest.startedAt), `${task.id}: finishedAt precedes startedAt`);
  }

  const actors = Array.isArray(manifest.actors) ? manifest.actors : manifest.executionOwners;
  add(errors, Array.isArray(actors) && actors.some(nonEmptyString), `${task.id}: actors/executionOwners are required`);
  add(errors, Array.isArray(manifest.sourceIds) && manifest.sourceIds.includes(task.id), `${task.id}: sourceIds must include taskId`);
  add(errors, Array.isArray(manifest.commands) && manifest.commands.length > 0, `${task.id}: commands are required`);
  add(errors, Array.isArray(manifest.results) && manifest.results.length > 0, `${task.id}: results are required`);
  add(errors, Array.isArray(manifest.rollbackEvidence), `${task.id}: rollbackEvidence must be an array`);
  add(errors, Array.isArray(manifest.knownGaps), `${task.id}: knownGaps must be an array`);

  add(errors, Array.isArray(manifest.artifactDigests) && manifest.artifactDigests.length > 0, `${task.id}: artifactDigests are required`);
  for (const [index, artifact] of (manifest.artifactDigests ?? []).entries()) {
    const label = `${task.id}: artifactDigests[${index}]`;
    add(errors, isRecord(artifact), `${label} must be an object`);
    if (!isRecord(artifact)) continue;
    add(errors, artifact.algorithm === 'sha256', `${label}.algorithm must be sha256`);
    add(errors, SHA256.test(artifact.digest ?? ''), `${label}.digest must be a SHA-256 digest`);
    const fullPath = resolveInside(root, artifact.path, `${label}.path`, errors);
    if (!fullPath) continue;
    add(errors, fs.existsSync(fullPath) && fs.statSync(fullPath).isFile(), `${label}.path does not name a file: ${artifact.path}`);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() && SHA256.test(artifact.digest ?? '')) {
      if (checkGit && SHA40.test(manifest.sourceCommit ?? '')) {
        const sourceBlob = readGitBlob(root, manifest.sourceCommit, artifact.path);
        const headBlob = readGitBlob(root, 'HEAD', artifact.path);
        add(errors, sourceBlob !== null, `${label}.path is absent from sourceCommit: ${artifact.path}`);
        add(errors, headBlob !== null, `${label}.path is absent from HEAD: ${artifact.path}`);
        if (sourceBlob !== null) {
          add(errors, sha256Bytes(sourceBlob) === artifact.digest.toLowerCase(), `${label}.digest does not match sourceCommit blob ${artifact.path}`);
        }
        if (headBlob !== null) {
          add(errors, sha256Bytes(headBlob) === artifact.digest.toLowerCase(), `${label}.digest is stale at HEAD for ${artifact.path}`);
        }
        add(errors, commandSucceeded(root, 'git', ['diff', '--quiet', '--', artifact.path]), `${label}.path has unstaged changes: ${artifact.path}`);
        add(errors, commandSucceeded(root, 'git', ['diff', '--cached', '--quiet', '--', artifact.path]), `${label}.path has staged changes: ${artifact.path}`);
      } else {
        add(errors, sha256Bytes(fs.readFileSync(fullPath)) === artifact.digest.toLowerCase(), `${label}.digest does not match ${artifact.path}`);
      }
    }
  }

  if (checkGit && SHA40.test(manifest.sourceCommit ?? '')) {
    add(errors, commandSucceeded(root, 'git', ['cat-file', '-e', `${manifest.sourceCommit}^{commit}`]), `${task.id}: sourceCommit is not available in Git`);
    add(errors, commandSucceeded(root, 'git', ['merge-base', '--is-ancestor', manifest.sourceCommit, 'HEAD']), `${task.id}: sourceCommit is not an ancestor of HEAD`);
  }

  const resultStatuses = (manifest.results ?? [])
    .map((result) => isRecord(result) ? result.status : undefined)
    .filter(Boolean);
  add(errors, resultStatuses.length === (manifest.results ?? []).length, `${task.id}: every result needs a status`);

  if (task.status === 'REVIEW' || task.status === 'ACCEPTED') {
    const failing = resultStatuses.filter((status) => !['PASS', 'SKIP', 'NOT_APPLICABLE'].includes(status));
    add(errors, failing.length === 0, `${task.id}: review evidence contains non-passing results: ${failing.join(', ')}`);
  }

  if (task.status === 'REVIEW') {
    add(errors, manifest.decision === null || manifest.decision === 'PENDING', `${task.id}: REVIEW decision must be PENDING/null`);
  }

  if (task.status === 'ACCEPTED') {
    add(errors, manifest.draftOnly !== true, `${task.id}: ACCEPTED evidence cannot be draftOnly`);
    add(errors, manifest.decision === 'ACCEPTED', `${task.id}: decision must be ACCEPTED`);
    add(errors, nonEmptyString(manifest.reviewer), `${task.id}: reviewer is required`);
    add(errors, !Array.isArray(manifest.blockers) || manifest.blockers.length === 0, `${task.id}: ACCEPTED evidence cannot retain blockers`);
  }

  if (task.status === 'BLOCKED' || task.status === 'REWORK') {
    add(errors, manifest.decision === task.status, `${task.id}: decision must be ${task.status}`);
    add(errors, Array.isArray(manifest.blockers) && manifest.blockers.some(nonEmptyString), `${task.id}: blockers are required for ${task.status}`);
    add(errors, Array.isArray(manifest.nextSteps) && manifest.nextSteps.some(nonEmptyString), `${task.id}: nextSteps are required for ${task.status}`);
  }

  if (TERMINAL_DECISIONS.has(manifest.decision)) {
    const reviewer = nonEmptyString(manifest.reviewer) ? manifest.reviewer.trim() : '';
    const normalizedActors = (actors ?? []).filter(nonEmptyString).map((actor) => actor.trim());
    add(errors, reviewer.length > 0, `${task.id}: terminal decision requires reviewer`);
    add(errors, manifest.reviewer === reviewer, `${task.id}: reviewer identity must not contain surrounding whitespace`);
    add(errors, !normalizedActors.includes(reviewer), `${task.id}: terminal reviewer must be independent from execution actors`);
  }

  const canonicalEvidenceRoot = path.join(root, 'evidence', 'p1r');
  const relativeEvidencePath = path.relative(canonicalEvidenceRoot, manifestPath);
  add(errors, relativeEvidencePath !== '..' && !relativeEvidencePath.startsWith(`..${path.sep}`), `${task.id}: historical/non-P1R evidence cannot satisfy the task`);
  add(errors, path.basename(manifestPath) === 'manifest.json', `${task.id}: evidence file must be manifest.json`);
  return errors;
}

export function validateEvidenceGate({ root = process.cwd(), milestone, runPlanCheck = true, checkGit = true } = {}) {
  const errors = [];
  const ledgerPath = path.join(root, 'requirements', 'backlog', 'v2-phase1-rebaseline', '02-编号任务台账.md');
  if (!fs.existsSync(ledgerPath)) return { result: 'FAIL', errors: [`missing ledger: ${ledgerPath}`], tasks: [] };
  if (checkGit) validateCommittedPath(root, ledgerPath, 'canonical ledger', errors);

  let tasks;
  try {
    tasks = parseLedger(fs.readFileSync(ledgerPath, 'utf8'));
  } catch (error) {
    return { result: 'FAIL', errors: [error.message], tasks: [] };
  }

  const ids = tasks.map((task) => task.id);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  add(errors, tasks.length === 108, `expected 108 task rows, got ${tasks.length}`);
  add(errors, duplicates.length === 0, `duplicate task IDs: ${duplicates.join(', ')}`);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  errors.push(...validateStatusTrajectories({ root, tasks, checkGit }));

  for (const task of tasks) {
    add(errors, ALLOWED_STATUSES.has(task.status), `${task.id}: illegal status ${task.status ?? '<missing>'}`);
    for (const dependency of task.dependencies) add(errors, byId.has(dependency), `${task.id}: unknown dependency ${dependency}`);
  }

  const cycleState = new Map();
  const visit = (task, stack = []) => {
    if (cycleState.get(task.id) === 'done') return;
    if (cycleState.get(task.id) === 'visiting') {
      errors.push(`dependency cycle: ${[...stack, task.id].join(' -> ')}`);
      return;
    }
    cycleState.set(task.id, 'visiting');
    for (const dependency of task.dependencies) {
      if (byId.has(dependency)) visit(byId.get(dependency), [...stack, task.id]);
    }
    cycleState.set(task.id, 'done');
  };
  for (const task of tasks) visit(task);

  const selected = milestone ? tasks.filter((task) => task.milestone === milestone) : tasks;
  if (milestone) add(errors, selected.length > 0, `unknown or empty milestone ${milestone}`);

  for (const task of selected) {
    if (DEPENDENCY_READY_STATUSES.has(task.status)) {
      const unmet = task.dependencies.filter((dependency) => byId.get(dependency)?.status !== 'ACCEPTED');
      add(errors, unmet.length === 0, `${task.id}: ${task.status} requires ACCEPTED dependencies: ${unmet.join(', ')}`);
    }

    const manifestPath = path.join(root, 'evidence', 'p1r', task.milestone.toLowerCase(), task.id, 'manifest.json');
    if (EVIDENCE_REQUIRED_STATUSES.has(task.status)) {
      add(errors, fs.existsSync(manifestPath), `${task.id}: ${task.status} requires ${path.relative(root, manifestPath)}`);
      if (fs.existsSync(manifestPath)) {
        if (checkGit) validateCommittedPath(root, manifestPath, `${task.id} canonical manifest`, errors);
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          errors.push(...validateManifest({ root, task, manifest, manifestPath, checkGit }));
        } catch (error) {
          errors.push(`${task.id}: invalid manifest JSON: ${error.message}`);
        }
      }
    }
  }

  let planCheck = { result: 'SKIPPED' };
  if (runPlanCheck) {
    const verifier = path.join(root, 'scripts', 'audit', 'verify-phase1-rebaseline-plan.mjs');
    const checked = spawnSync(process.execPath, [verifier], { cwd: root, encoding: 'utf8', windowsHide: true });
    planCheck = {
      result: checked.status === 0 ? 'PASS' : 'FAIL',
      exitCode: checked.status,
      output: (checked.status === 0 ? checked.stdout : `${checked.stdout}\n${checked.stderr}`).trim(),
    };
    add(errors, checked.status === 0, `plan coverage validator failed: ${planCheck.output}`);
  }

  const statusCounts = {};
  for (const task of selected) statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1;
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    milestone: milestone ?? 'ALL',
    checkedTasks: selected.length,
    statusCounts,
    planCheck,
    errors,
  };
}

function parseArgs(argv) {
  const options = { json: false, milestone: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--milestone') options.milestone = argv[++index];
    else if (arg === '--help') options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (options.milestone && !/^M\d$/.test(options.milestone)) throw new Error(`invalid milestone: ${options.milestone}`);
  return options;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node scripts/audit/p1r-evidence-gate.mjs [--milestone M0] [--json]');
      process.exit(0);
    }
    const report = validateEvidenceGate({ milestone: options.milestone });
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else if (report.result === 'PASS') console.log(`P1R evidence gate PASS: ${report.checkedTasks} tasks (${report.milestone}).`);
    else {
      console.error(`P1R evidence gate FAIL: ${report.errors.length} error(s).`);
      for (const error of report.errors) console.error(`- ${error}`);
    }
    process.exit(report.result === 'PASS' ? 0 : 1);
  } catch (error) {
    console.error(`P1R evidence gate FAIL: ${error.message}`);
    process.exit(1);
  }
}
