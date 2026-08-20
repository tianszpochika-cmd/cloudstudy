import { spawnSync } from 'node:child_process';
import {
  parseFlag,
  printMigrationPlan,
  repositoryRoot,
  sqlString,
  validateMigrationSet
} from './lib/migration-utils.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const validation = validateMigrationSet();
if (validation.errors.length > 0) {
  for (const error of validation.errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const mysqlConfig = {
  host: parseFlag(args, '--host', process.env.MYSQL_HOST || '127.0.0.1'),
  port: parseFlag(args, '--port', process.env.MYSQL_PORT || '13306'),
  user: parseFlag(args, '--user', process.env.MYSQL_USER || 'yuxuexing'),
  database: parseFlag(args, '--database', process.env.MYSQL_DATABASE || 'yuxuexing'),
  password: process.env.MYSQL_PASSWORD ?? 'yuxuexing'
};

const mysqlArgs = [
  '--protocol=TCP',
  '--host',
  mysqlConfig.host,
  '--port',
  String(mysqlConfig.port),
  '--user',
  mysqlConfig.user,
  '--database',
  mysqlConfig.database,
  '--default-character-set=utf8mb4',
  '--batch',
  '--skip-column-names',
  '--raw'
];

function runMysql(sql) {
  const result = spawnSync(mysqlBin, mysqlArgs, {
    cwd: repositoryRoot,
    input: `${sql.trim()}\n`,
    encoding: 'utf8',
    env: { ...process.env, MYSQL_PWD: mysqlConfig.password }
  });
  if (result.error) throw new Error(`无法启动 mysql 客户端 (${mysqlBin}): ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `mysql exit ${result.status}`).trim());
  }
  return (result.stdout || '').trim();
}

function readLedger() {
  try {
    const output = runMysql(
      'SELECT migration_version, checksum_sha256, status FROM schema_version ORDER BY migration_version;'
    );
    return new Map(
      output
        ? output.split(/\r?\n/).map((line) => line.split('\t')).map(([version, checksum, status]) => [version, { checksum, status }])
        : []
    );
  } catch (error) {
    if (/doesn.?t exist|unknown table/i.test(error.message)) return new Map();
    throw error;
  }
}

if (!apply) {
  console.log('迁移 dry-run（未连接数据库）；使用 --apply 才会写入数据库。');
  printMigrationPlan(validation.migrations);
  process.exit(0);
}

try {
  const ledger = readLedger();
  for (const migration of validation.migrations) {
    const applied = ledger.get(migration.version);
    if (applied) {
      if (applied.status !== 'APPLIED') throw new Error(`迁移 ${migration.version} 状态为 ${applied.status}，需人工处理`);
      if (applied.checksum.toLowerCase() !== migration.checksumSha256.toLowerCase()) {
        throw new Error(`迁移 ${migration.version} checksum 不一致，禁止改写已应用迁移`);
      }
      console.log(`SKIP ${migration.version} ${migration.file}（已应用且 checksum 一致）`);
      continue;
    }

    const startedAt = Date.now();
    console.log(`APPLY ${migration.version} ${migration.file}`);
    runMysql(migration.sql);
    runMysql(`
      INSERT INTO schema_version
        (migration_version, description, checksum_sha256, execution_ms, status, installed_by)
      VALUES
        (${sqlString(migration.version)}, ${sqlString(migration.descriptionFromFile)}, ${sqlString(migration.checksumSha256)},
         ${Math.max(0, Date.now() - startedAt)}, 'APPLIED', ${sqlString(process.env.USERNAME || process.env.USER || 'migration-runner')});
    `);
  }
  console.log(`迁移完成: ${validation.migrations.length} 个版本已核对`);
} catch (error) {
  console.error(`迁移失败: ${error.message}`);
  process.exitCode = 1;
}
