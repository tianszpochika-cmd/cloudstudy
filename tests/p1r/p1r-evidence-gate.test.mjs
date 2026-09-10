import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  parseDependencyCell,
  parseLedger,
  validateEvidenceGate,
  validateManifest,
  validateStatusTrajectories,
} from '../../scripts/audit/p1r-evidence-gate.mjs';

function row(id, depends, status) {
  return `| \`${id}\` | task | trace | owner | ${depends} | NEW | evidence | \`${status}\` | \`不适用\` |`;
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

function git(root, args, encoding = 'utf8') {
  const result = spawnSync('git', args, { cwd: root, encoding, windowsHide: true });
  assert.equal(result.status, 0, String(result.stderr || result.stdout));
  return result.stdout;
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

test('dependency ranges expand completely and reject malformed ranges', () => {
  assert.deepEqual(
    parseDependencyCell('M8-002…006,M8-008'),
    ['P1R-M8-002', 'P1R-M8-003', 'P1R-M8-004', 'P1R-M8-005', 'P1R-M8-006', 'P1R-M8-008'],
  );
  assert.throws(() => parseDependencyCell('M8-006…002'), /descending/);
  assert.throws(() => parseDependencyCell('M7-010…M8-002'), /crosses milestones/);
});

test('status trajectories reject skipped transitions and ledger mismatch', () => {
  withTempRepo((root) => {
    const executionRoot = path.join(root, 'requirements', 'backlog', 'v2-phase1-rebaseline', 'execution');
    fs.mkdirSync(executionRoot, { recursive: true });
    fs.writeFileSync(path.join(executionRoot, 'status-trajectories.json'), JSON.stringify({
      schemaVersion: 'p1r.status-trajectories.v1',
      records: [{
        taskId: 'P1R-M0-001',
        path: ['PLANNED', 'ACCEPTED'],
        recordedAt: '2026-08-29T00:00:00.000Z',
        actor: 'coordinator',
        reason: 'test invalid skip',
        evidencePath: 'evidence/p1r/m0/P1R-M0-001/manifest.json',
      }],
    }));
    const errors = validateStatusTrajectories({
      root,
      tasks: [{ id: 'P1R-M0-001', milestone: 'M0', status: 'REVIEW' }],
      checkGit: false,
    });
    assert(errors.some((error) => error.includes('illegal transition PLANNED -> ACCEPTED')));
    assert(errors.some((error) => error.includes('does not match ledger REVIEW')));
  });
});

test('accepted manifest validates artifact digest and independent reviewer', () => {
  withTempRepo((root) => {
    const task = { id: 'P1R-M0-001', status: 'ACCEPTED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const errors = validateManifest({ root, task, manifest: acceptedManifest(root), manifestPath, checkGit: false });
    assert.deepEqual(errors, []);
  });
});

test('git-backed digest is portable across checkout line endings and detects committed drift', () => {
  withTempRepo((root) => {
    git(root, ['init']);
    git(root, ['config', 'user.email', 'p1r-test@example.invalid']);
    git(root, ['config', 'user.name', 'P1R Test']);
    git(root, ['config', 'core.autocrlf', 'false']);
    git(root, ['add', 'artifact.txt']);
    git(root, ['commit', '-m', 'fixture']);
    const sourceCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const sourceBytes = git(root, ['show', `${sourceCommit}:artifact.txt`], null);
    const digest = crypto.createHash('sha256').update(sourceBytes).digest('hex');
    git(root, ['config', 'core.autocrlf', 'true']);
    fs.writeFileSync(path.join(root, 'artifact.txt'), 'stable artifact\r\n');

    const task = { id: 'P1R-M0-001', status: 'ACCEPTED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const manifest = acceptedManifest(root, {
      sourceCommit,
      artifactDigests: [{ path: 'artifact.txt', algorithm: 'sha256', digest }],
    });
    assert.deepEqual(validateManifest({ root, task, manifest, manifestPath, checkGit: true }), []);

    fs.writeFileSync(path.join(root, 'artifact.txt'), 'changed content\n');
    const errors = validateManifest({ root, task, manifest, manifestPath, checkGit: true });
    assert(errors.some((error) => error.includes('unstaged changes')));
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

test('accepted reviewer identity rejects surrounding-whitespace bypass', () => {
  withTempRepo((root) => {
    const task = { id: 'P1R-M0-001', status: 'ACCEPTED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const errors = validateManifest({
      root,
      task,
      manifest: acceptedManifest(root, { reviewer: ' executor ' }),
      manifestPath,
      checkGit: false,
    });
    assert(errors.some((error) => error.includes('surrounding whitespace')));
    assert(errors.some((error) => error.includes('terminal reviewer must be independent')));
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

test('blocked and rework decisions reject self review', () => {
  withTempRepo((root) => {
    for (const status of ['BLOCKED', 'REWORK']) {
      const task = { id: 'P1R-M0-001', status };
      const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
      const manifest = acceptedManifest(root, {
        canonicalTaskStatus: status,
        decision: status,
        reviewer: 'executor',
        blockers: ['blocked for test'],
        nextSteps: ['assign independent reviewer'],
      });
      const errors = validateManifest({ root, task, manifest, manifestPath, checkGit: false });
      assert(errors.some((error) => error.includes('terminal reviewer must be independent')));
    }
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

test('full gate rejects uncommitted ledger and canonical manifest', () => {
  withTempRepo((root) => {
    git(root, ['init']);
    git(root, ['config', 'user.email', 'p1r-test@example.invalid']);
    git(root, ['config', 'user.name', 'P1R Test']);
    git(root, ['config', 'core.autocrlf', 'false']);
    git(root, ['add', 'artifact.txt']);
    git(root, ['commit', '-m', 'artifact only']);
    const sourceCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const sourceBytes = git(root, ['show', `${sourceCommit}:artifact.txt`], null);
    const digest = crypto.createHash('sha256').update(sourceBytes).digest('hex');

    writeSyntheticLedger(root, { 'P1R-M0-001': { status: 'REVIEW' } });
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', 'P1R-M0-001', 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(acceptedManifest(root, {
      canonicalTaskStatus: 'REVIEW',
      sourceCommit,
      artifactDigests: [{ path: 'artifact.txt', algorithm: 'sha256', digest }],
      decision: 'PENDING',
    })));

    const report = validateEvidenceGate({ root, milestone: 'M0', runPlanCheck: false, checkGit: true });
    assert.equal(report.result, 'FAIL');
    assert(report.errors.some((error) => error.includes('canonical ledger must be tracked')));
    assert(report.errors.some((error) => error.includes('canonical manifest must be tracked')));
  });
});
