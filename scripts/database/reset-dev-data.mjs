import { spawnSync } from 'node:child_process';
import { parseFlag, repositoryRoot } from './lib/migration-utils.mjs';

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
