import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlag, repositoryRoot, validateMigrationSet } from './lib/migration-utils.mjs';
import { runMysql as runMysqlClient } from './lib/mysql-client.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..', '..');
const configPath = path.join(root, 'config', 'b25-data.json');
const fixturePath = path.join(root, 'database', 'mysql', 'fixtures', 'b25-phase1.json');
const seedPath = path.join(root, 'database', 'mysql', 'seeds', 'dev', 'V0023__b25-phase1.sql');
const migrationPath = path.join(root, 'database', 'mysql', 'migrations', 'V0023__create_phase1_real_data_b25.sql');
const migrationRunnerPath = path.join(root, 'scripts', 'database', 'run-migrations.mjs');
const mode = parseFlag(process.argv.slice(2), '--mode', 'static');
const mysqlAction = parseFlag(process.argv.slice(2), '--action', 'summary');

const errors = [];
const fail = (message) => errors.push(message);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const readJson = (filePath, label) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${label} cannot be read: ${error.message}`);
    return null;
  }
};
const readText = (filePath, label) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`${label} cannot be read: ${error.message}`);
    return '';
  }
};
const requireString = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
};
const requireBoolean = (value, label) => {
  if (typeof value !== 'boolean') fail(`${label} must be boolean`);
};
const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const safeRelative = (relativePath, label) => {
  const absolutePath = path.resolve(root, relativePath);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) fail(`${label} escapes repository: ${relativePath}`);
  return absolutePath;
};

const config = readJson(configPath, 'config/b25-data.json');
const fixture = readJson(fixturePath, 'database/mysql/fixtures/b25-phase1.json');
const seedSql = readText(seedPath, 'database/mysql/seeds/dev/V0023__b25-phase1.sql');
const migrationSql = readText(migrationPath, 'database/mysql/migrations/V0023__create_phase1_real_data_b25.sql');

function validateHeader() {
  if (!isRecord(config)) return;
  if (config.schemaVersion !== 1) fail('config.schemaVersion must be 1');
  if (config.batch !== 'B25' || config.phase !== 'phase-1') fail('config must remain B25 Phase 1');
  if (config.mode !== 'static-and-synthetic' || config.status !== 'static-foundation') fail('config must remain static-and-synthetic');
  if (config.runtimeStatus !== 'pending') fail('config.runtimeStatus must remain pending until runtime evidence exists');
  if (JSON.stringify(config.scope) !== JSON.stringify(['V2-B25-DATA-001', 'V2-B25-DATA-002', 'V2-B25-DATA-006'])) fail('config.scope must cover DATA-001/002/006 only');
  if (config.task?.status !== 'defined' || config.task?.runtimeRequired !== true || config.task?.defaultDecision !== 'deny') fail('task must remain runtime-required and deny-by-default');
}

function validateFilesAndMigration() {
  if (!config || !fixture) return;
  for (const relativePath of [config.migration.rootFile, config.migration.manifestFile, config.fixture.jsonFile, config.fixture.seedSql]) {
    if (!fs.existsSync(safeRelative(relativePath, 'configured path'))) fail(`configured path does not exist: ${relativePath}`);
  }
  if (!migrationSql.includes('CREATE TABLE IF NOT EXISTS')) fail('B25 migration must be replay-safe');
  if (/\bDROP\s+(DATABASE|SCHEMA|TABLE|VIEW)\b|\bTRUNCATE\s+TABLE\b|\bCREATE\s+DATABASE\b/i.test(migrationSql)) fail('B25 migration contains destructive DDL');
  if (/--\s*down\b|\/\*\s*down\b/i.test(migrationSql)) fail('B25 migration must not contain an implicit down script');
  if (!seedSql.includes('ON DUPLICATE KEY UPDATE')) fail('B25 seed must expose duplicate replay semantics');
  if (/\bDROP\s+(DATABASE|SCHEMA|TABLE|VIEW)\b|\bTRUNCATE\s+TABLE\b|\bDELETE\s+FROM\b/i.test(seedSql)) fail('B25 seed contains destructive or broad cleanup SQL');
  if (!seedSql.includes("@seed_run_id = 'seed-b25-phase1-v1'")) fail('B25 seed is missing the fixed seed run id');

  const migrationResult = validateMigrationSet();
  if (migrationResult.errors.length > 0) for (const error of migrationResult.errors) fail(`migration set: ${error}`);
  const manifestEntry = migrationResult.manifest?.migrations?.find((item) => item.file === path.basename(migrationPath));
  if (!manifestEntry || manifestEntry.version !== '0023') fail('migration manifest must register V0023 as version 0023');
  const requiredTables = new Set(manifestEntry?.requiredTables ?? []);
  for (const table of Object.keys(config.expectedRows ?? {})) if (!requiredTables.has(table)) fail(`manifest missing B25 required table: ${table}`);
  for (const table of Object.keys(config.expectedRows ?? {})) {
    const pattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+\`?${table}\`?`, 'i');
    if (!pattern.test(migrationSql)) fail(`B25 migration does not create ${table}`);
  }
  const insertTables = [...seedSql.matchAll(/\bINSERT\s+INTO\s+`?([a-z][a-z0-9_]*)`?/gi)].map((match) => match[1]);
  const allowedTables = new Set(Object.keys(config.expectedRows ?? {}));
  for (const table of insertTables) if (!allowedTables.has(table)) fail(`B25 seed writes outside declared owner tables: ${table}`);
  for (const table of allowedTables) if (!insertTables.includes(table)) fail(`B25 seed is missing deterministic replay for owner table: ${table}`);
  if (/\bJOIN\b/i.test(seedSql)) fail('B25 seed must not use cross-service SQL joins');
}

function validateOwnerMap() {
  if (!isRecord(config) || !isRecord(fixture)) return;
  const owners = config.dataOwnerPolicy?.ownerMap;
  if (!Array.isArray(owners) || owners.length === 0) {
    fail('dataOwnerPolicy.ownerMap must be non-empty');
    return;
  }
  const ownerByService = new Map();
  const tableOwner = new Map();
  const allTables = new Set();
  for (const owner of owners) {
    requireString(owner?.service, 'owner.service');
    requireString(owner?.schema, `${owner?.service}.schema`);
    requireString(owner?.writeAuthority, `${owner?.service}.writeAuthority`);
    requireString(owner?.redisNamespace, `${owner?.service}.redisNamespace`);
    if (ownerByService.has(owner.service)) fail(`duplicate owner service: ${owner.service}`);
    ownerByService.set(owner.service, owner);
    if (owner.writeAuthority !== `${owner.service}-only`) fail(`${owner.service} must use owner-only write authority`);
    if (!Array.isArray(owner.tables) || owner.tables.length === 0) fail(`${owner.service}.tables must be non-empty`);
    for (const table of owner.tables) {
      if (!/^[a-z][a-z0-9_]+$/.test(table)) fail(`invalid owner table: ${table}`);
      if (tableOwner.has(table)) fail(`table has more than one owner: ${table}`);
      tableOwner.set(table, owner.service);
      allTables.add(table);
    }
  }
  if (config.dataOwnerPolicy.crossServiceWritesAllowed !== false || config.dataOwnerPolicy.crossServiceSqlJoinsAllowed !== false) fail('cross-service write/join policy must be false');
  if (config.dataOwnerPolicy.redisIsSourceOfTruth !== false) fail('Redis must not be the source of truth');
  const expectedTables = new Set(Object.keys(config.expectedRows ?? {}));
  if (JSON.stringify([...allTables].sort()) !== JSON.stringify([...expectedTables].sort())) fail('owner table union must equal expectedRows table set');

  const fixtureOwners = new Map((fixture.owners ?? []).map((owner) => [owner.service, owner]));
  for (const [service, owner] of ownerByService) {
    const fixtureOwner = fixtureOwners.get(service);
    if (!fixtureOwner || fixtureOwner.schema !== owner.schema || JSON.stringify(fixtureOwner.tables) !== JSON.stringify(owner.tables)) fail(`fixture/config owner mismatch: ${service}`);
    if (!fs.existsSync(safeRelative(owner.service === 'workflow-service' ? 'database/mysql/migrations/V0023__create_phase1_real_data_b25.sql' : fixtureOwner.migrationSource, `${service}.migrationSource`))) fail(`${service}.migrationSource does not exist`);
  }
  if (fixtureOwners.size !== ownerByService.size) fail('fixture owner set must equal config owner set');

  for (const entity of fixture.entities ?? []) {
    const owner = ownerByService.get(entity.ownerService);
    if (!owner) fail(`entity has unknown owner: ${entity.ownerService}`);
    if (owner && (entity.schema !== owner.schema || !owner.tables.includes(entity.table))) fail(`entity table is outside owner boundary: ${entity.entityKey}`);
    requireString(entity.entityType, 'entity.entityType');
    requireString(entity.entityKey, 'entity.entityKey');
    if (!isRecord(entity.payload)) fail(`entity payload must be an object: ${entity.entityKey}`);
    const digestExpression = `SHA2(CONCAT(@seed_run_id, '|${entity.ownerService}|${entity.entityType}|${entity.entityKey}'), 256)`;
    if (!seedSql.includes(digestExpression)) fail(`seed is missing deterministic digest binding: ${entity.entityKey}`);
    if (!new RegExp(entity.entityKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(seedSql)) fail(`seed is missing entity key: ${entity.entityKey}`);
  }
}

function walkSensitive(value, location = '$') {
  const forbiddenKey = /(password|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|private[_-]?key|phone|email)/i;
  const forbiddenValue = /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  if (Array.isArray(value)) value.forEach((item, index) => walkSensitive(item, `${location}[${index}]`));
  else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKey.test(key)) fail(`fixture contains sensitive field name: ${location}.${key}`);
      walkSensitive(child, `${location}.${key}`);
    }
  } else if (typeof value === 'string' && forbiddenValue.test(value)) fail(`fixture contains phone/email-shaped value: ${location}`);
}

function validateFixture() {
  if (!isRecord(fixture) || !isRecord(config)) return;
  if (fixture.schemaVersion !== 'b25.fixture.v1' || fixture.batch !== 'B25' || fixture.phase !== 'phase-1') fail('fixture header must be B25 Phase 1');
  if (fixture.synthetic !== true || fixture.seedRunId !== config.fixture.seedRunId || fixture.seedVersion !== config.fixture.seedVersion) fail('fixture synthetic identity does not match config');
  if (fixture.policy?.noRealCredentials !== true || fixture.policy?.noPii !== true || fixture.policy?.noProductionData !== true || fixture.policy?.paymentProviderCalls !== 'disabled') fail('fixture safety policy is incomplete');
  if (!Array.isArray(fixture.entities) || fixture.entities.length === 0) fail('fixture.entities must be non-empty');
  if (!Array.isArray(fixture.redisProjections) || fixture.redisProjections.length === 0) fail('fixture.redisProjections must be non-empty');
  walkSensitive(fixture);

  const entityKeys = new Set();
  const countByTable = new Map();
  const typeSet = new Set();
  for (const entity of fixture.entities) {
    const identity = `${entity.ownerService}|${entity.entityType}|${entity.entityKey}`;
    if (entityKeys.has(identity)) fail(`duplicate fixture entity: ${identity}`);
    entityKeys.add(identity);
    typeSet.add(entity.entityType);
    countByTable.set(entity.table, (countByTable.get(entity.table) ?? 0) + 1);
  }
  for (const requiredType of fixture.requiredEntityTypes ?? []) if (!typeSet.has(requiredType)) fail(`fixture is missing required entity type: ${requiredType}`);
  for (const [table, count] of countByTable) if (config.expectedRows[table] !== count) fail(`${table} expected ${config.expectedRows[table]} entity rows but fixture has ${count}`);
  if (config.expectedRows.b25_fixture_row !== fixture.entities.length) fail('b25_fixture_row expected row count must equal fixture entity count');
  if (config.expectedRows.b25_fixture_redis_projection !== fixture.redisProjections.length) fail('redis projection expected row count mismatch');
  for (const recipe of fixture.redisProjections) {
    if (!Number.isInteger(recipe.ttlSeconds) || recipe.ttlSeconds <= 0) fail(`invalid Redis TTL: ${recipe.keyTemplate}`);
    if (recipe.rebuildStrategy !== 'MYSQL_OWNER_ROWS') fail(`Redis recipe must rebuild from MySQL owner rows: ${recipe.keyTemplate}`);
    if (/(token|secret|password|email|phone|audio_bytes|raw_media)/i.test(recipe.keyTemplate)) fail(`Redis key template contains sensitive material: ${recipe.keyTemplate}`);
    if (!fixture.entities.some((entity) => entity.table === recipe.sourceTable && entity.entityKey === recipe.sourceEntityKey)) fail(`Redis recipe source row is not in fixture: ${recipe.sourceEntityKey}`);
    if (!seedSql.includes(recipe.keyTemplate) || !seedSql.includes('MYSQL_OWNER_ROWS')) fail(`seed is missing Redis recipe: ${recipe.keyTemplate}`);
  }
}

function mysqlQuery(sql) {
  const args = process.argv.slice(2);
  const mysqlBin = process.env.MYSQL_BIN || 'mysql';
  const host = parseFlag(args, '--host', process.env.MYSQL_HOST || '127.0.0.1');
  const port = parseFlag(args, '--port', process.env.MYSQL_PORT || '13306');
  const user = parseFlag(args, '--user', process.env.MYSQL_USER || 'yuxuexing');
  const database = parseFlag(args, '--database', process.env.MYSQL_DATABASE || 'yuxuexing');
  const password = process.env.MYSQL_PASSWORD ?? 'yuxuexing';
  return runMysqlClient({
    mysqlBin,
    mysqlArgs: ['--protocol=TCP', '--host', host, '--port', String(port), '--user', user, '--database', database, '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw'],
    password,
    cwd: repositoryRoot,
    input: `${sql.trim()}\n`
  });
}

function runMigrationPass(passNumber) {
  const args = process.argv.slice(2);
  const childArgs = [
    migrationRunnerPath,
    '--apply',
    '--host', parseFlag(args, '--host', process.env.MYSQL_HOST || '127.0.0.1'),
    '--port', parseFlag(args, '--port', process.env.MYSQL_PORT || '13306'),
    '--user', parseFlag(args, '--user', process.env.MYSQL_USER || 'yuxuexing'),
    '--database', parseFlag(args, '--database', process.env.MYSQL_DATABASE || 'yuxuexing')
  ];
  const result = spawnSync(process.execPath, childArgs, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env },
    windowsHide: true
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  if (result.error) throw new Error(`repeat migration pass ${passNumber} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`repeat migration pass ${passNumber} failed: ${output || `exit ${result.status}`}`);
  return output;
}

function validateRepeatMigration() {
  if (!fs.existsSync(migrationRunnerPath)) throw new Error('scripts/database/run-migrations.mjs does not exist');
  runMigrationPass(1);
  runMigrationPass(2);
  console.log('B25 repeat-migration check passed: run-migrations --apply completed twice with checksum ledger semantics.');
  console.log('This is a runtime observation only; it does not prove a fresh empty database, owner grants, service API replay or Redis rebuild.');
}

function validateMysql(action) {
  const tables = Object.keys(config.expectedRows ?? {});
  const seedRunId = config.fixture.seedRunId.replaceAll("'", "''");
  const lines = [];
  for (const table of tables) {
    const value = mysqlQuery(`SELECT COUNT(*) FROM \`${table}\` WHERE fixture_run_id = '${seedRunId}';`);
    const count = Number(value);
    if (!Number.isInteger(count)) throw new Error(`invalid count for ${table}: ${value}`);
    lines.push(`${table}\t${count}\t${config.expectedRows[table]}`);
    if (action === 'empty' && count !== 0) throw new Error(`B25 fixture database is not empty: ${table}=${count}`);
    if (action === 'summary' && count !== config.expectedRows[table]) throw new Error(`B25 fixture row count mismatch: ${table} expected ${config.expectedRows[table]}, got ${count}`);
  }
  const run = mysqlQuery(`SELECT seed_version, synthetic, status, source_hash FROM b25_fixture_run WHERE fixture_run_id = '${seedRunId}';`);
  if (action === 'summary' && !run) throw new Error('B25 fixture run ledger is missing');
  if (action === 'summary') {
    const parts = run.split(/\t/);
    if (parts[0] !== config.fixture.seedVersion || parts[1] !== '1' || parts[2] !== 'READY' || parts[3].toLowerCase() !== sha256(config.fixture.seedRunId)) throw new Error('B25 fixture run ledger does not match deterministic seed identity');
  }
  console.log(`B25 MySQL ${action} check passed (runtime observation only; it does not promote the test Gate).`);
  console.log(lines.join('\n'));
}

validateHeader();
validateFilesAndMigration();
validateOwnerMap();
validateFixture();

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else if (mode === 'static') {
  console.log(`B25 static data checks passed: ${fixture.entities.length} synthetic entities, ${fixture.redisProjections.length} rebuildable Redis recipes, ${Object.keys(config.expectedRows).length} owner tables.`);
  console.log('Runtime MySQL migration, owner grants, API replay, Redis rebuild and restart evidence remain pending.');
} else if (mode === 'mysql') {
  try {
    if (mysqlAction === 'repeat') validateRepeatMigration();
    else validateMysql(mysqlAction === 'empty' ? 'empty' : 'summary');
  } catch (error) {
    console.error(`B25 MySQL check failed: ${error.message}`);
    process.exitCode = 2;
  }
} else {
  console.error(`Unknown mode: ${mode}. Use --mode static or --mode mysql --action empty|summary|repeat.`);
  process.exitCode = 1;
}
