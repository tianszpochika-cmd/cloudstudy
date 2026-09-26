#!/usr/bin/env node
// Capture a fresh, private-only full dump and the exact Batch19 migration target roster.
// The dump and receipt stay under the isolated project's OS temp directory.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertPrivateTempPermissions, safeEnv } from './uat-isolated-compose.mjs';
import {
  BATCH19_BACKUP_RECEIPT, BATCH19_MIGRATIONS, BATCH19_OWNER_SCHEMAS,
  BATCH19_PROJECT, assertBatch19BackupReceipt, batch19IdentityColumns,
  batch19IdentitySha256, batch19MigrationSourceSha256, batch19TargetRows
} from './batch19-private-promotion.mjs';

const backupName = 'batch19-before-migration.sql';
const mysqlContainer = BATCH19_PROJECT + '-mysql-1';

function runDocker(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8', env: safeEnv(), windowsHide: true,
    timeout: options.timeout ?? 60000, maxBuffer: 4 * 1024 * 1024
  });
  assert(!result.error && result.status === 0, 'private Docker read failed; output suppressed');
  return result.stdout.trim();
}

function digestFile(file) {
  const hash = crypto.createHash('sha256');
  const input = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const bytes = fs.readSync(input, buffer, 0, buffer.length, null);
      if (!bytes) break;
      hash.update(buffer.subarray(0, bytes));
    }
  } finally { fs.closeSync(input); }
  return hash.digest('hex');
}

function privateContext(stateFile) {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  assert.equal(state.project, BATCH19_PROJECT);
  const tempDir = path.resolve(state.tempDir || '');
  const relative = path.relative(os.tmpdir(), tempDir);
  assert(relative && relative !== '..' && !relative.startsWith('..' + path.sep)
    && !path.isAbsolute(relative), 'private state must stay under OS temp');
  assert(path.basename(tempDir).startsWith(BATCH19_PROJECT + '-'));
  const canonicalStateFile = path.join(tempDir, 'state.json');
  assert.equal(fs.realpathSync.native(stateFile).toLowerCase(),
    fs.realpathSync.native(canonicalStateFile).toLowerCase());
  for (const item of [tempDir, stateFile, path.join(tempDir, 'uat.env')]) {
    const info = fs.lstatSync(item);
    assert(!info.isSymbolicLink());
    assert(item === tempDir ? info.isDirectory() : info.isFile());
  }
  assertPrivateTempPermissions(state);
  return { state, tempDir, stateFile: canonicalStateFile,
    receipt: path.join(tempDir, BATCH19_BACKUP_RECEIPT),
    dump: path.join(tempDir, backupName) };
}

function verifyPrivateMysql() {
  const inspected = JSON.parse(runDocker(['inspect', mysqlContainer]));
  assert.equal(inspected.length, 1);
  const item = inspected[0];
  assert.equal(item.Name, '/' + mysqlContainer);
  assert.equal(item.Config.Labels['com.docker.compose.project'], BATCH19_PROJECT);
  assert.equal(item.Config.Labels['com.docker.compose.service'], 'mysql');
  assert.equal(item.State.Status, 'running');
  assert.deepEqual(item.HostConfig.PortBindings || {}, {});
}

function verifySchemas() {
  const names = BATCH19_OWNER_SCHEMAS.map((name) => "'" + name + "'").join(',');
  const sql = 'SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('
    + names + ') ORDER BY schema_name';
  const rows = runDocker(['exec', mysqlContainer, 'sh', '-ec',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --batch --skip-column-names -e "$1"',
    '--', sql]).split(/\r?\n/u).filter(Boolean);
  assert.deepEqual(rows, [...BATCH19_OWNER_SCHEMAS].sort(), 'private owner schema inventory differs');
}

function captureDump(file) {
  const output = fs.openSync(file, 'wx', 0o600);
  let result;
  try {
    result = spawnSync('docker', ['exec', mysqlContainer, 'sh', '-ec',
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --user=root --single-transaction --no-tablespaces --routines --events --all-databases'], {
      env: safeEnv(), windowsHide: true, timeout: 600000,
      stdio: ['ignore', output, 'pipe'], maxBuffer: 1024 * 1024
    });
    fs.fsyncSync(output);
  } finally { fs.closeSync(output); }
  assert(!result.error && result.status === 0, 'private full dump failed; partial file retained for review');
  const stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size > 1024,
    'private full dump is too small');
  return { path: file, bytes: stat.size, sha256: digestFile(file) };
}

function targetMetadata(targets) {
  return Object.fromEntries(Object.entries(targets).map(([service, tables]) => {
    const migration = BATCH19_MIGRATIONS[service];
    assert(migration, 'unknown backup target service');
    return [service, {
      schema: migration.schema,
      migrationVersion: migration.version,
      sourceSha256: batch19MigrationSourceSha256(service),
      tables: Object.fromEntries(Object.entries(tables).map(([table, rows]) =>
        [table, { rowCount: rows.length,
          identitySha256: batch19IdentitySha256(rows, batch19IdentityColumns(service, table)) }]))
    }];
  }));
}

function main(stateFile) {
  assert(stateFile, 'usage: node batch19-private-backup.mjs <private state.json>');
  const paths = privateContext(path.resolve(stateFile));
  assert(!fs.existsSync(paths.dump) && !fs.existsSync(paths.receipt),
    'a Batch19 dump or receipt already exists; inspect it before retrying');
  verifyPrivateMysql();
  verifySchemas();
  const before = batch19TargetRows();
  const dump = captureDump(paths.dump);
  const after = batch19TargetRows();
  assert.deepEqual(targetMetadata(after), targetMetadata(before),
    'migration target identities changed during the full dump');
  const receipt = {
    format: 1, project: BATCH19_PROJECT, stateFile: paths.stateFile,
    createdAt: new Date().toISOString(), schemas: [...BATCH19_OWNER_SCHEMAS], dump,
    preMigrationTargets: targetMetadata(before)
  };
  assertBatch19BackupReceipt(receipt, paths.state,
    { tempDir: paths.tempDir, stateFile: paths.stateFile });
  const fd = fs.openSync(paths.receipt, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(receipt, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  console.log(JSON.stringify({ project: BATCH19_PROJECT, backupBytes: dump.bytes,
    backupSha256: dump.sha256, ownerSchemas: receipt.schemas.length,
    targetRowCounts: Object.fromEntries(Object.entries(receipt.preMigrationTargets)
      .map(([service, target]) => [service, Object.fromEntries(Object.entries(target.tables)
        .map(([table, item]) => [table, item.rowCount]))])) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv[2]); }
  catch (error) {
    console.error('Batch19 private backup failed closed; private output suppressed.'
      + (process.env.CLOUDSTUDY_UAT_DIAGNOSTIC === '1' ? ' ' + String(error.message).slice(0, 180) : ''));
    process.exitCode = 1;
  }
}
