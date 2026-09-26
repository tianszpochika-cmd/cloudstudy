import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const shell = process.platform === 'win32' && fs.existsSync('C:/Program Files/Git/usr/bin/sh.exe')
  ? 'C:/Program Files/Git/usr/bin/sh.exe' : 'sh';
const asShellPath = (value) => process.platform === 'win32'
  ? `/${value[0].toLowerCase()}${value.slice(2).replaceAll('\\', '/')}` : value;

function syntheticEnv(overrides = {}) {
  const env = { ...process.env, MYSQL_ROOT_PASSWORD: 'synthetic-root-only' };
  for (const name of [
    'IAM', 'LEARNER', 'CONTENT', 'LEARNING', 'ASSESSMENT', 'MEDIA',
    'NOTIFICATION', 'GAMIFICATION', 'SOCIAL', 'COMMERCE', 'ADMIN_OPS',
    'ANALYTICS', 'AUDIT', 'WORKFLOW'
  ]) env[`${name}_DB_PASSWORD`] = `synthetic-${name.toLowerCase()}`;
  return { ...env, ...overrides };
}

test('bootstrap blocks before SQL without explicit operational gates', (context) => {
  const result = spawnSync(shell, ['-c',
    'mysql() { exit 91; }; . infra/docker/clyunedev/bootstrap-owner-schemas.sh'],
  { cwd: root, env: syntheticEnv(), encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') return context.skip('POSIX shell is unavailable');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /writers must be drained/);
});

test('one invalid late owner password blocks before any account rotation', (context) => {
  const result = spawnSync(shell, ['-c',
    'mysql() { exit 91; }; . infra/docker/clyunedev/bootstrap-owner-schemas.sh'],
  {
    cwd: root,
    env: syntheticEnv({
      P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED: 'true',
      P1R_EXTERNAL_MIGRATION_BACKUP_READY: 'true',
      WORKFLOW_DB_PASSWORD: "invalid'password"
    }),
    encoding: 'utf8'
  });
  if (result.error?.code === 'ENOENT') return context.skip('POSIX shell is unavailable');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unsafe for SQL provisioning/);
});

test('bootstrap revokes legacy grants and issues only own-schema runtime grants', (context) => {
  const capture = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-bootstrap-'));
  context.after(() => fs.rmSync(capture, { recursive: true, force: true }));
  const sqlFile = path.join(capture, 'sql.txt');
  const argsFile = path.join(capture, 'args.txt');
  const result = spawnSync(shell, ['-c',
    'mysql() { printf "%s\\n" "$*" >> "$CAPTURE_ARGS"; while IFS= read -r line; do printf "%s\\n" "$line"; done >> "$CAPTURE_SQL"; }; . infra/docker/clyunedev/bootstrap-owner-schemas.sh'],
  {
    cwd: root,
    env: syntheticEnv({
      P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED: 'true',
      P1R_EXTERNAL_MIGRATION_BACKUP_READY: 'true',
      CAPTURE_SQL: asShellPath(sqlFile),
      CAPTURE_ARGS: asShellPath(argsFile)
    }),
    encoding: 'utf8'
  });
  if (result.error?.code === 'ENOENT') return context.skip('POSIX shell is unavailable');
  assert.equal(result.status, 0, result.stderr);
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const args = fs.readFileSync(argsFile, 'utf8');
  assert.equal((sql.match(/REVOKE IF EXISTS ALL PRIVILEGES, GRANT OPTION FROM/g) || []).length, 14);
  assert.equal((sql.match(/GRANT SELECT, INSERT, UPDATE, DELETE ON/g) || []).length, 13);
  assert.match(sql, /GRANT ALL PRIVILEGES ON `iam_service`\.\* TO 'svc_iam'@'%'/);
  assert.doesNotMatch(args, /synthetic-/);
});
