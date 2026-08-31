import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { parseLedger } from '../../scripts/audit/p1r-evidence-gate.mjs';
import {
  parseGapIds,
  validateGapRegistry,
  validateGapRegistryData,
} from '../../scripts/audit/p1r-gap-registry-check.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'config', 'p1r-gap-registry.v1.json'), 'utf8'));
const matrixGapIds = parseGapIds(fs.readFileSync(path.join(root, 'requirements', 'backlog', 'v2-phase1-rebaseline', '04-追溯覆盖矩阵.md'), 'utf8'));
const tasks = parseLedger(fs.readFileSync(path.join(root, 'requirements', 'backlog', 'v2-phase1-rebaseline', '02-编号任务台账.md'), 'utf8'));
const tasksById = new Map(tasks.map((task) => [task.id, task]));

function copyRegistry() {
  return structuredClone(registry);
}

test('canonical GAP registry matches the plan matrix and task ledger', () => {
  const report = validateGapRegistry({ root });
  assert.equal(report.result, 'PASS', report.errors?.join('\n'));
  assert.equal(report.gapCount, 45);
  assert.deepEqual(report.statusCounts, { OPEN: 42, CLOSED: 3 });
});

test('missing, duplicate and unknown GAP records fail closed', () => {
  const changed = copyRegistry();
  changed.gaps[1].id = changed.gaps[0].id;
  changed.gaps.pop();
  const errors = validateGapRegistryData({ registry: changed, matrixGapIds, tasksById, root, checkEvidenceFiles: false });
  assert(errors.some((error) => error.includes('duplicates')));
  assert(errors.some((error) => error.includes('missing from registry')));
  assert(errors.some((error) => error.includes('total GAP count')));
});

test('a GAP cannot close before owner tasks and Evidence are accepted', () => {
  const changed = copyRegistry();
  const openOwnerGapIndex = changed.gaps.findIndex((gap) =>
    gap.closureTasks.some((taskId) => tasksById.get(taskId)?.status !== 'ACCEPTED'),
  );
  assert.notEqual(openOwnerGapIndex, -1, 'fixture requires at least one GAP with an unaccepted closure task');
  changed.gaps[openOwnerGapIndex] = {
    ...changed.gaps[openOwnerGapIndex],
    status: 'CLOSED',
    closureEvidence: 'evidence/p1r/m1/P1R-M1-008/manifest.json',
    closedAt: '2026-08-29T00:00:00.000Z',
    reviewer: 'independent-reviewer',
  };
  const errors = validateGapRegistryData({ registry: changed, matrixGapIds, tasksById, root, checkEvidenceFiles: false });
  assert(errors.some((error) => error.includes('every closure task to be ACCEPTED')));
});

test('OPEN GAP records cannot carry premature closure Evidence', () => {
  const changed = copyRegistry();
  changed.gaps[0].closureEvidence = 'evidence/p1r/m1/P1R-M1-008/manifest.json';
  const errors = validateGapRegistryData({ registry: changed, matrixGapIds, tasksById, root, checkEvidenceFiles: false });
  assert(errors.some((error) => error.includes('must remain null until CLOSED')));
});
