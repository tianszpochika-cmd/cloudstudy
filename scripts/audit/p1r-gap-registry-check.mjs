import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseLedger } from './p1r-evidence-gate.mjs';

const CANONICAL_COUNTS = Object.freeze({ CONTRACT: 24, EVENT: 16, IMPLEMENTATION: 2, EVIDENCE: 3 });
const ALLOWED_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'CLOSED', 'BLOCKED', 'REWORK']);
const ACTIVE_TASK_STATUSES = new Set(['READY', 'IN_PROGRESS', 'REVIEW', 'ACCEPTED', 'BLOCKED', 'REWORK']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseGapIds(markdown) {
  const section = markdown.match(/^## 8\. GAP[\s\S]*?(?=^## 9\.|\Z)/m)?.[0] ?? '';
  return new Set(
    section
      .split(/\r?\n/)
      .map((line) => line.match(/^\|\s*`([^`]+)`/u)?.[1])
      .filter((id) => /^(?:CONTRACT|EVENT|IMPLEMENTATION|EVIDENCE)-GAP-[A-Z0-9-]+$/.test(id ?? '')),
  );
}

function expectedKind(id) {
  return id.split('-GAP-')[0];
}

function inside(root, relativePath) {
  if (!nonEmpty(relativePath) || path.isAbsolute(relativePath)) return null;
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) ? null : resolved;
}

export function validateGapRegistryData({ registry, matrixGapIds, tasksById, root = process.cwd(), checkEvidenceFiles = true }) {
  const errors = [];
  add(errors, isRecord(registry), 'gap registry must be an object');
  if (!isRecord(registry)) return errors;
  add(errors, registry.schemaVersion === 'p1r.gap-registry.v1', 'unsupported gap registry schemaVersion');
  add(errors, Array.isArray(registry.gaps), 'gap registry gaps must be an array');
  if (!Array.isArray(registry.gaps)) return errors;

  const seen = new Set();
  const counts = {};
  for (const [index, gap] of registry.gaps.entries()) {
    const label = `gaps[${index}]`;
    add(errors, isRecord(gap), `${label} must be an object`);
    if (!isRecord(gap)) continue;
    add(errors, nonEmpty(gap.id), `${label}.id is required`);
    add(errors, !seen.has(gap.id), `${label} duplicates ${gap.id ?? '<missing>'}`);
    if (nonEmpty(gap.id)) seen.add(gap.id);
    add(errors, matrixGapIds.has(gap.id), `${label} is absent from the canonical matrix: ${gap.id ?? '<missing>'}`);
    add(errors, gap.kind === expectedKind(gap.id ?? ''), `${label}.kind does not match ${gap.id ?? '<missing>'}`);
    counts[gap.kind] = (counts[gap.kind] ?? 0) + 1;
    add(errors, ALLOWED_STATUSES.has(gap.status), `${label}.status is illegal: ${gap.status ?? '<missing>'}`);
    add(errors, Array.isArray(gap.closureTasks) && gap.closureTasks.length > 0, `${label}.closureTasks are required`);

    const closureTasks = Array.isArray(gap.closureTasks) ? gap.closureTasks : [];
    for (const taskId of closureTasks) add(errors, tasksById.has(taskId), `${label} references unknown closure task ${taskId}`);
    const closureTaskStatuses = closureTasks.map((taskId) => tasksById.get(taskId)?.status).filter(Boolean);

    if (gap.status === 'IN_PROGRESS') {
      add(errors, closureTaskStatuses.some((status) => ACTIVE_TASK_STATUSES.has(status)), `${label}: IN_PROGRESS requires an active closure task`);
    }
    if (gap.status === 'CLOSED') {
      add(errors, closureTaskStatuses.length === closureTasks.length && closureTaskStatuses.every((status) => status === 'ACCEPTED'), `${label}: CLOSED requires every closure task to be ACCEPTED`);
      add(errors, nonEmpty(gap.closedAt) && Number.isFinite(Date.parse(gap.closedAt)), `${label}.closedAt must be an ISO timestamp`);
      add(errors, nonEmpty(gap.reviewer), `${label}.reviewer is required for CLOSED`);
      const evidenceFile = inside(root, gap.closureEvidence);
      add(errors, evidenceFile !== null && gap.closureEvidence.startsWith('evidence/p1r/'), `${label}.closureEvidence must be a canonical P1R path`);
      if (checkEvidenceFiles && evidenceFile) add(errors, fs.existsSync(evidenceFile), `${label}.closureEvidence does not exist: ${gap.closureEvidence}`);
    } else {
      add(errors, gap.closureEvidence === null, `${label}.closureEvidence must remain null until CLOSED`);
    }
    if (gap.status === 'BLOCKED') {
      add(errors, nonEmpty(gap.blocker), `${label}.blocker is required for BLOCKED`);
      add(errors, nonEmpty(gap.nextStep), `${label}.nextStep is required for BLOCKED`);
    }
  }

  for (const id of matrixGapIds) add(errors, seen.has(id), `canonical matrix GAP is missing from registry: ${id}`);
  for (const [kind, expected] of Object.entries(CANONICAL_COUNTS)) {
    add(errors, counts[kind] === expected, `${kind} GAP count must be ${expected}, got ${counts[kind] ?? 0}`);
    add(errors, registry.expectedCounts?.[kind] === expected, `expectedCounts.${kind} must be ${expected}`);
  }
  const total = Object.values(CANONICAL_COUNTS).reduce((sum, value) => sum + value, 0);
  add(errors, registry.gaps.length === total, `total GAP count must be ${total}, got ${registry.gaps.length}`);
  add(errors, registry.expectedCounts?.TOTAL === total, `expectedCounts.TOTAL must be ${total}`);
  return errors;
}

export function validateGapRegistry({ root = process.cwd(), checkEvidenceFiles = true } = {}) {
  const registryPath = path.join(root, 'config', 'p1r-gap-registry.v1.json');
  const matrixPath = path.join(root, 'requirements', 'backlog', 'v2-phase1-rebaseline', '04-追溯覆盖矩阵.md');
  const ledgerPath = path.join(root, 'requirements', 'backlog', 'v2-phase1-rebaseline', '02-编号任务台账.md');
  const missing = [registryPath, matrixPath, ledgerPath].filter((filePath) => !fs.existsSync(filePath));
  if (missing.length > 0) return { result: 'FAIL', errors: missing.map((filePath) => `missing canonical input: ${path.relative(root, filePath)}`) };

  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const matrixGapIds = parseGapIds(fs.readFileSync(matrixPath, 'utf8'));
    const tasks = parseLedger(fs.readFileSync(ledgerPath, 'utf8'));
    const errors = validateGapRegistryData({
      registry,
      matrixGapIds,
      tasksById: new Map(tasks.map((task) => [task.id, task])),
      root,
      checkEvidenceFiles,
    });
    const statusCounts = {};
    for (const gap of registry.gaps ?? []) statusCounts[gap.status] = (statusCounts[gap.status] ?? 0) + 1;
    return { result: errors.length === 0 ? 'PASS' : 'FAIL', gapCount: registry.gaps?.length ?? 0, statusCounts, errors };
  } catch (error) {
    return { result: 'FAIL', errors: [error instanceof Error ? error.message : String(error)] };
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const report = validateGapRegistry();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === 'PASS' ? 0 : 1);
}
