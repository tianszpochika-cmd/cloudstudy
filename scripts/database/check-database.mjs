import { spawnSync } from 'node:child_process';
import {
  parseFlag,
  repositoryRoot,
  requiredColumns,
  requiredIndexes,
  requiredTables,
  validateMigrationSet
} from './lib/migration-utils.mjs';

const args = process.argv.slice(2);
const mode = parseFlag(args, '--mode', 'existing');
if (!['empty', 'existing'].includes(mode)) {
  console.error('用法: node scripts/database/check-database.mjs --mode empty|existing');
  process.exit(1);
}

const validation = validateMigrationSet();
if (validation.errors.length > 0) {
  for (const error of validation.errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const config = {
  host: parseFlag(args, '--host', process.env.MYSQL_HOST || '127.0.0.1'),
  port: parseFlag(args, '--port', process.env.MYSQL_PORT || '13306'),
  user: parseFlag(args, '--user', process.env.MYSQL_USER || 'yuxuexing'),
  database: parseFlag(args, '--database', process.env.MYSQL_DATABASE || 'yuxuexing'),
  password: process.env.MYSQL_PASSWORD ?? 'yuxuexing'
};
const mysqlArgs = [
  '--protocol=TCP',
  '--host',
  config.host,
  '--port',
  String(config.port),
  '--user',
  config.user,
  '--database',
  config.database,
  '--default-character-set=utf8mb4',
  '--batch',
  '--skip-column-names',
  '--raw'
];

function query(sql) {
  const result = spawnSync(mysqlBin, mysqlArgs, {
    cwd: repositoryRoot,
    input: `${sql.trim()}\n`,
    encoding: 'utf8',
    env: { ...process.env, MYSQL_PWD: config.password }
  });
  if (result.error) throw new Error(`无法启动 mysql 客户端 (${mysqlBin}): ${result.error.message}`);
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `mysql exit ${result.status}`).trim());
  return (result.stdout || '').trim();
}

function rows(sql, width) {
  const output = query(sql);
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const values = line.split('\t');
    if (values.length !== width) throw new Error(`查询结果列数异常: ${line}`);
    return values;
  });
}

function checkEmpty() {
  const tables = rows(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;",
    1
  ).map(([name]) => name);
  if (tables.length > 0) {
    throw new Error(`空库检查失败，发现 ${tables.length} 张表: ${tables.join(', ')}`);
  }
  console.log(`空库检查通过: ${config.database} 没有业务表；未执行任何删除操作`);
}

function checkExisting() {
  const tableRows = rows(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;",
    1
  );
  const actualTables = new Set(tableRows.map(([name]) => name));
  const missingTables = requiredTables.filter((table) => !actualTables.has(table));
  if (missingTables.length > 0) throw new Error(`存量库检查失败，缺少基础表: ${missingTables.join(', ')}`);

  const tableList = requiredTables.map((table) => `'${table}'`).join(', ');
  const actualColumns = new Map();
  for (const [table, column] of rows(
    `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tableList});`,
    2
  )) {
    if (!actualColumns.has(table)) actualColumns.set(table, new Set());
    actualColumns.get(table).add(column);
  }
  const missingColumns = [];
  for (const [table, columns] of Object.entries(requiredColumns)) {
    for (const column of columns) if (!actualColumns.get(table)?.has(column)) missingColumns.push(`${table}.${column}`);
  }
  if (missingColumns.length > 0) throw new Error(`存量库检查失败，缺少列: ${missingColumns.join(', ')}`);

  const actualIndexes = new Map();
  for (const [table, indexName] of rows(
    `SELECT TABLE_NAME, INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tableList}) GROUP BY TABLE_NAME, INDEX_NAME;`,
    2
  )) {
    if (!actualIndexes.has(table)) actualIndexes.set(table, new Set());
    actualIndexes.get(table).add(indexName);
  }
  const missingIndexes = [];
  for (const [table, indexes] of Object.entries(requiredIndexes)) {
    for (const indexName of indexes) if (!actualIndexes.get(table)?.has(indexName)) missingIndexes.push(`${table}.${indexName}`);
  }
  if (missingIndexes.length > 0) throw new Error(`存量库检查失败，缺少索引: ${missingIndexes.join(', ')}`);

  const ledgerRows = rows(
    'SELECT migration_version, checksum_sha256, status FROM schema_version ORDER BY migration_version;',
    3
  );
  const expected = new Map(validation.migrations.map((migration) => [migration.version, migration.checksumSha256]));
  for (const [version, checksum, status] of ledgerRows) {
    if (!expected.has(version)) throw new Error(`schema_version 存在未登记迁移: ${version}`);
    if (status !== 'APPLIED') throw new Error(`schema_version ${version} 状态不是 APPLIED: ${status}`);
    if (checksum.toLowerCase() !== expected.get(version).toLowerCase()) throw new Error(`schema_version ${version} checksum 不一致`);
  }
  const missingLedger = [...expected.keys()].filter((version) => !ledgerRows.some(([item]) => item === version));
  if (missingLedger.length > 0) throw new Error(`schema_version 缺少已落地迁移: ${missingLedger.join(', ')}`);

  console.log(`存量库检查通过: ${config.database}，基础表 ${requiredTables.length} 张、迁移 ${ledgerRows.length} 个、核心列/索引均存在`);
}

try {
  if (mode === 'empty') checkEmpty();
  else checkExisting();
} catch (error) {
  console.error(`数据库检查失败: ${error.message}`);
  process.exitCode = 2;
}
