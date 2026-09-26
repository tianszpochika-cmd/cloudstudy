import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  REPAIRABLE, REVIEW_ONLY, countSql, planHash, targetName,
} from '../../scripts/database/repair-local-learning-world-seed.mjs';

test('repair targets are owner scoped and require exact seed evidence', () => {
  const names = REPAIRABLE.map(targetName);
  assert.equal(new Set(names).size, names.length);
  assert.ok(REPAIRABLE.length >= 10);
  assert.ok(REPAIRABLE.every(target => target.exact.includes('seed-')));
  assert.ok(REPAIRABLE.every(target => !/profile|consent|iam_/.test(target.table)));
  assert.ok(REVIEW_ONLY.some(target => target.table === 'xp_ledger'));
  assert.ok(REVIEW_ONLY.some(target => target.table === 'b25_learning_srs_state'));
  assert.ok(names.indexOf('assessment_service.b25_assessment_report') <
    names.indexOf('assessment_service.b25_assessment_session'));
  for (const target of [...REPAIRABLE, ...REVIEW_ONLY]) {
    const query = countSql(target);
    const approvedQuery = countSql(target, 'approved');
    assert.match(query, /JOIN iam_service\.iam_principal p ON p\.principal_id = t\./);
    assert.match(query, /p\.tenant_id = 'platform'/);
    assert.match(query, /p\.adult_gate_status <> 'APPROVED' OR p\.adult_verified_at IS NULL/);
    assert.match(approvedQuery, /p\.adult_gate_status = 'APPROVED' AND p\.adult_verified_at IS NOT NULL/);
    assert.doesNotMatch(query, /\b(UPDATE|DELETE|INSERT|DROP|TRUNCATE)\b/i);
  }
});

test('reviewed plan hash changes when a count changes', () => {
  const repairable = [{ table: targetName(REPAIRABLE[0]), rows: 104, principals: 104 }];
  const reviewOnly = [{ table: targetName(REVIEW_ONLY[0]), rows: 104, principals: 104 }];
  const original = planHash(repairable, reviewOnly);
  assert.match(original, /^[a-f0-9]{64}$/);
  assert.notEqual(planHash([{ ...repairable[0], rows: 105 }], reviewOnly), original);
  assert.notEqual(planHash(repairable, [{ ...reviewOnly[0], rows: 105 }]), original);
  assert.notEqual(planHash(repairable, reviewOnly, [{ ...repairable[0], rows: 63 }]), original);
});

test('remote database is refused before any database operation', () => {
  const result = spawnSync(process.execPath,
    ['scripts/database/repair-local-learning-world-seed.mjs', '--dry-run'], {
      cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
      env: { ...process.env, MYSQL_HOST: 'db.example.invalid' },
    });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /restricted to local MySQL 127\.0\.0\.1:13306/);
});

test('apply is impossible without a reviewed 64-character plan hash', () => {
  const result = spawnSync(process.execPath,
    ['scripts/database/repair-local-learning-world-seed.mjs', '--apply'], {
      cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
      env: { ...process.env, MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '13306' },
    });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage: node scripts\/database\/repair-local-learning-world-seed\.mjs/);
});

test('rollback rejects an arbitrary schema before reading data', () => {
  const result = spawnSync(process.execPath,
    ['scripts/database/repair-local-learning-world-seed.mjs', '--rollback', 'iam_service'], {
      cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
      env: { ...process.env, MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '13306' },
    });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exact repair backup schema name/);
});
