import { spawnSync } from 'node:child_process';
import { parseFlag, repositoryRoot } from './lib/migration-utils.mjs';
import { runMysql as runMysqlClient } from './lib/mysql-client.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
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

const previewSql = `
SELECT 'audit_logs', COUNT(*) FROM audit_logs WHERE reason_code = 'DEV_FIXTURE_CORE_FOUNDATION';
SELECT 'outbox_events', COUNT(*) FROM outbox_events WHERE dedupe_key LIKE 'fixture:core-foundation:%';
SELECT 'idempotency_keys', COUNT(*) FROM idempotency_keys WHERE scope_code = 'fixture' AND scope_subject = 'seed-core-foundation';
SELECT 'media_assets', COUNT(*) FROM media_assets WHERE asset_key LIKE 'fixture/core-foundation/%';
`;
const deleteSql = `
DELETE FROM audit_logs WHERE reason_code = 'DEV_FIXTURE_CORE_FOUNDATION';
DELETE FROM outbox_events WHERE dedupe_key LIKE 'fixture:core-foundation:%';
DELETE FROM idempotency_keys WHERE scope_code = 'fixture' AND scope_subject = 'seed-core-foundation';
DELETE FROM media_assets WHERE asset_key LIKE 'fixture/core-foundation/%';
`;

function run(sql) {
  return runMysqlClient({
    mysqlBin,
    mysqlArgs,
    password: config.password,
    cwd: repositoryRoot,
    input: `${sql.trim()}\n`
  });
}

try {
  console.log(apply ? '将只清理 core-foundation 合成 fixture 标记行：' : '清理预览（未执行 DELETE）：');
  const preview = run(previewSql);
  if (preview) console.log(preview);
  if (apply) {
    run(deleteSql);
    console.log('合成 fixture 清理完成；未执行 DROP DATABASE、DROP TABLE 或 TRUNCATE。');
  } else {
    console.log('如确认需要清理，请再次传入 --apply。');
  }
} catch (error) {
  console.error(`fixture 清理失败: ${error.message}`);
  process.exitCode = 2;
}
