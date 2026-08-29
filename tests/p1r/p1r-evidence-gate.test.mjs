import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseLedger,
  validateEvidenceGate,
  validateManifest,
} from '../../scripts/audit/p1r-evidence-gate.mjs';

function row(id, depends, status) {
  return `| \`${id}\` | task | trace | owner | ${depends} | NEW | evidence | \`${status}\` |`;
}

function withTempRepo(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p1r-evidence-gate-'));
  try {
    fs.mkdirSync(path.join(root, 'evidence', 'p1r', 'm0', 'P1R-M0-001'), { recursive: true });
    fs.writeFileSync(path.join(root, 'artifact.txt'), 'stable artifact\n');
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function acceptedManifest(root, overrides = {}) {
  const digest = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'artifact.txt'))).digest('hex');
  return {
    taskId: 'P1R-M0-001',
    canonicalTaskStatus: 'ACCEPTED',
    sourceCommit: 'a'.repeat(40),
    artifactDigests: [{ path: 'artifact.txt', algorithm: 'sha256', digest }],
    environment: 'test',
    startedAt: '2026-08-29T00:00:00.000Z',
    finishedAt: '2026-08-29T00:01:00.000Z',
    actors: ['executor'],
    sourceIds: ['P1R-M0-001'],
    commands: ['node test'],
    results: [{ check: 'unit', status: 'PASS' }],
    rollbackEvidence: [{ status: 'NOT_APPLICABLE', reason: 'read-only artifact' }],
    knownGaps: [],
    reviewer: 'independent-reviewer',
    decision: 'ACCEPTED',
    ...overrides,
  };
}

const milestoneCounts = { M0: 8, M1: 18, M2: 10, M3: 10, M4: 10, M5: 14, M6: 11, M7: 11, M8: 16 };

function writeSyntheticLedger(root, overrides = {}) {
  const planRoot = path.join(root, 'requirements', 'backlog', 'v2-phase1-rebaseline');
  fs.mkdirSync(planRoot, { recursive: true });
  const rows = [];
  for (const [milestone, count] of Object.entries(milestoneCounts)) {
    for (let index = 1; index <= count; index += 1) {
      const id = `P1R-${milestone}-${String(index).padStart(3, '0')}`;
      const override = overrides[id] ?? {};
      rows.push(row(id, override.depends ?? '无', override.status ?? 'PLANNED'));
    }
  }
  fs.writeFileSync(path.join(planRoot, '02-编号任务台账.md'), rows.join('\n'));
}

test('ledger parser extracts statuses and normalized dependencies', () => {
  const tasks = parseLedger([
    row('P1R-M0-001', '无', 'ACCEPTED'),
    row('P1R-M0-002', 'M0-001', 'READY'),
  ].join('\n'));
  assert.equal(tasks.length, 2);
  assert.deepEqual(tasks[1].dependencies, ['P1R-M0-001']);
  assert.equal(tasks[1].status, 'READY');
});

test('accepted manifest validates artifact digest and independent reviewer', () => {
  withTempRepo((root) => {
    const task = { id: 'P1R-M0-001', status: 'ACCEPTED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const errors = validateManifest({ root, task, manifest: acceptedManifest(root), manifestPath, checkGit: false });
    assert.deepEqual(errors, []);
  });
});

test('accepted manifest fails closed on digest mismatch and self review', () => {
  withTempRepo((root) => {
    const task = { id: 'P1R-M0-001', status: 'ACCEPTED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const manifest = acceptedManifest(root, {
      artifactDigests: [{ path: 'artifact.txt', algorithm: 'sha256', digest: '0'.repeat(64) }],
      reviewer: 'executor',
    });
    const errors = validateManifest({ root, task, manifest, manifestPath, checkGit: false });
    assert(errors.some((error) => error.includes('digest does not match')));
    assert(errors.some((error) => error.includes('reviewer must be independent')));
  });
});

test('blocked manifest requires blockers and next steps', () => {
  withTempRepo((root) => {
    const task = { id: 'P1R-M0-001', status: 'BLOCKED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const manifest = acceptedManifest(root, {
      canonicalTaskStatus: 'BLOCKED',
      decision: 'BLOCKED',
      reviewer: 'coordinator',
      blockers: [],
      nextSteps: [],
    });
    const errors = validateManifest({ root, task, manifest, manifestPath, checkGit: false });
    assert(errors.some((error) => error.includes('blockers are required')));
    assert(errors.some((error) => error.includes('nextSteps are required')));
  });
});

test('artifact path traversal is rejected', () => {
  withTempRepo((root) => {
    const task = { id: 'P1R-M0-001', status: 'ACCEPTED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const manifest = acceptedManifest(root, {
      artifactDigests: [{ path: '../outside.txt', algorithm: 'sha256', digest: '0'.repeat(64) }],
    });
    const errors = validateManifest({ root, task, manifest, manifestPath, checkGit: false });
    assert(errors.some((error) => error.includes('escapes the repository')));
  });
});

test('full gate rejects READY task whose dependency is not accepted', () => {
  withTempRepo((root) => {
    writeSyntheticLedger(root, {
      'P1R-M0-002': { depends: 'M0-001', status: 'READY' },
    });
    const report = validateEvidenceGate({ root, milestone: 'M0', runPlanCheck: false, checkGit: false });
    assert.equal(report.result, 'FAIL');
    assert(report.errors.some((error) => error.includes('requires ACCEPTED dependencies')));
  });
});

test('full gate rejects REVIEW without canonical evidence manifest', () => {
  withTempRepo((root) => {
    writeSyntheticLedger(root, {
      'P1R-M0-001': { status: 'REVIEW' },
    });
    const report = validateEvidenceGate({ root, milestone: 'M0', runPlanCheck: false, checkGit: false });
    assert.equal(report.result, 'FAIL');
    assert(report.errors.some((error) => error.includes('REVIEW requires')));
  });
});
