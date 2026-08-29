import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runMysql as runMysqlClient } from '../database/lib/mysql-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const composeFile = process.env.MYSQL_COMPOSE_FILE || 'infra/docker/docker-compose.dev.yml';
const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const mysqlHost = process.env.MYSQL_HOST || '127.0.0.1';
const mysqlPort = process.env.MYSQL_PORT || '13306';
const mysqlUser = process.env.MYSQL_USER || 'yuxuexing';
const mysqlDatabase = process.env.MYSQL_DATABASE || 'yuxuexing';
const mysqlPassword = process.env.MYSQL_PASSWORD || 'yuxuexing';
const runId = `b28-runtime-${new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14)}`;

function command(commandName, args, input = '') {
  const result = spawnSync(commandName, args, {
    cwd: root,
    input,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.error) throw new Error(`${commandName} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${commandName} failed with exit ${result.status}: ${(result.stderr || result.stdout || '').trim()}`);
  return (result.stdout || '').trim();
}

function nodeScript(script, args = []) {
  return command(process.execPath, [path.join(root, script), ...args]);
}

function mysqlArgs(database = mysqlDatabase, user = mysqlUser) {
  return [
    '--protocol=TCP', '--host', mysqlHost, '--port', String(mysqlPort), '--user', user,
    '--database', database, '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw'
  ];
}

function mysql(sql, { database = mysqlDatabase, user = mysqlUser, password = mysqlPassword } = {}) {
  return runMysqlClient({
    mysqlBin,
    mysqlArgs: mysqlArgs(database, user),
    password,
    cwd: root,
    input: `${sql.trim()}\n`
  });
}

function redis(args) {
  return command('docker', ['compose', '-f', composeFile, 'exec', '-T', 'redis', 'redis-cli', ...args]);
}

function readSourceRow(table, entityKey) {
  const tableName = String(table);
  if (!/^[a-z][a-z0-9_]+$/.test(tableName)) throw new Error(`unsafe source table: ${tableName}`);
  const key = String(entityKey).replaceAll("'", "''");
  const output = mysql(`
    SELECT JSON_OBJECT(
      'fixtureRunId', fixture_run_id,
      'ownerService', owner_service,
      'entityType', entity_type,
      'entityKey', entity_key,
      'payloadHash', SHA2(CAST(canonical_payload_json AS CHAR), 256),
      'payload', canonical_payload_json
    )
    FROM b25_fixture_row
    WHERE source_table = '${tableName}' AND entity_key = '${key}'
    LIMIT 1;
  `);
  if (!output) throw new Error(`no persisted owner row for ${tableName}/${entityKey}`);
  return output;
}

function rebuildRedisProjection() {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config/b25-data.json'), 'utf8'));
  const rebuilt = [];
  for (const recipe of config.redisRebuild.recipes) {
    const principalId = recipe.sourceEntityKey.match(/fixture-principal-[^:]+/)?.[0] || 'fixture-principal-0001';
    const key = recipe.keyTemplate
      .replace('{contentEpoch}', recipe.rebuildVersion)
      .replace('{principalId}', principalId);
    const value = readSourceRow(recipe.sourceTable, recipe.sourceEntityKey);
    redis(['DEL', key]);
    const setResult = redis(['SET', key, value, 'EX', String(recipe.ttlSeconds)]);
    if (setResult !== 'OK') throw new Error(`Redis projection write failed for ${key}`);
    const readBack = redis(['GET', key]);
    const ttl = Number(redis(['TTL', key]));
    if (readBack !== value || !Number.isInteger(ttl) || ttl <= 0) throw new Error(`Redis projection read-back failed for ${key}`);
    rebuilt.push({ key, sourceTable: recipe.sourceTable, sourceEntityKey: recipe.sourceEntityKey, ttlSeconds: ttl });
  }
  return rebuilt;
}

function revision() {
  const commit = command('git', ['rev-parse', '--short', 'HEAD']);
  const dirty = spawnSync('git', ['diff', '--quiet'], { cwd: root, windowsHide: true }).status !== 0;
  return `${commit}${dirty ? '-dirty' : ''}`;
}

function pass(id, evidenceRef, details = {}) {
  return { id, status: 'PASS', evidenceRef, details };
}

try {
  console.log('B28 runtime probe: toolchain');
  nodeScript('scripts/toolchain/check-toolchain.mjs');
  const checks = [pass('toolchain-probe', 'command:pnpm toolchain:check')];

  console.log('B28 runtime probe: compose configuration');
  command('docker', ['compose', '-f', composeFile, 'config', '--quiet']);
  checks.push(pass('docker-compose-config', `command:docker compose -f ${composeFile} config --quiet`));

  console.log('B28 runtime probe: dependency health');
  nodeScript('scripts/check-local-infra.mjs', ['--require-healthy']);
  checks.push(pass('dependency-health', 'command:node scripts/check-local-infra.mjs --require-healthy', { dependencies: ['mysql', 'redis', 'minio', 'kafka', 'rabbitmq', 'iam-service'] }));

  console.log('B28 runtime probe: Flyway-compatible root migration and persisted data');
  nodeScript('scripts/database/run-migrations.mjs', ['--apply']);
  nodeScript('scripts/database/check-database.mjs', ['--mode', 'existing']);
  nodeScript('scripts/database/replay-b25-fixture.mjs', ['--apply']);
  nodeScript('scripts/database/validate-b25-data.mjs', ['--mode', 'mysql', '--action', 'summary']);
  checks.push(pass('flyway-migration-run', 'commands:run-migrations/check-database/replay-b25-fixture', { migrationCount: 23, persistedEntityCount: 20 }));

  console.log('B28 runtime probe: owner schema and credential reconciliation');
  const ownerOutput = nodeScript('scripts/database/reconcile-owner-schemas.mjs', ['--apply']);
  const ownerResult = JSON.parse(ownerOutput);
  checks.push(pass('owner-schema-reconciliation', 'command:node scripts/database/reconcile-owner-schemas.mjs --apply', {
    ownerCount: ownerResult.ownerCount,
    totalMigratedTables: ownerResult.results.reduce((sum, item) => sum + item.tableCount, 0)
  }));

  console.log('B28 runtime probe: Redis rebuild from MySQL owner rows');
  const rebuilt = rebuildRedisProjection();

  console.log('B28 runtime probe: MySQL restart and read-back');
  command('docker', ['compose', '-f', composeFile, 'restart', 'mysql']);
  command('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait', 'mysql']);
  nodeScript('scripts/check-local-infra.mjs', ['--require-healthy']);
  nodeScript('scripts/database/check-database.mjs', ['--mode', 'existing']);
  nodeScript('scripts/database/validate-b25-data.mjs', ['--mode', 'mysql', '--action', 'summary']);
  const persistedRows = Number(mysql("SELECT COUNT(*) FROM b25_fixture_run WHERE fixture_run_id = 'seed-b25-phase1-v1';"));
  if (persistedRows !== 1) throw new Error(`restart read-back expected one persisted seed row, got ${persistedRows}`);
  checks.push(pass('restart-persistence', 'commands:docker-compose-restart-mysql/check-database/validate-b25-data', { persistedSeedRows: persistedRows, redisProjectionCount: rebuilt.length }));

  const evidence = {
    batch: 'B28',
    runId,
    sourceRevision: revision(),
    environment: {
      profile: 'local-real',
      host: '127.0.0.1',
      composeFile,
      dataClass: 'persisted-local-test-data',
      backend: 'docker-compose'
    },
    capturedAt: new Date().toISOString(),
    mode: 'local-real',
    status: 'PASS',
    evidenceClass: 'runtime-external',
    provenance: { producer: 'b28-runtime-probe', source: 'executed-local-runtime' },
    checks
  };
  const evidenceDir = path.join(root, 'evidence', 'b28');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, `${runId}.json`);
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status: 'PASS', evidenceFile: path.relative(root, evidencePath), checks: checks.map((item) => item.id) }, null, 2));
} catch (error) {
  console.error(`B28 runtime probe failed: ${error.message}`);
  process.exitCode = 1;
}
