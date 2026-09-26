import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = 'scripts/database/seed-local-real-learning-world.mjs';

test('local learning-world seed refuses to fan out without a named fixture account', () => {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
    env: { ...process.env, LOCAL_TEST_SUBJECT: '' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LOCAL_TEST_SUBJECT must identify one synthetic local account/);
});

test('local learning-world seed rejects a remote database before connecting', () => {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
    env: { ...process.env, LOCAL_TEST_SUBJECT: 'synthetic-uat-01', MYSQL_HOST: 'db.example.invalid' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires MySQL on 127\.0\.0\.1:13306/);
});
