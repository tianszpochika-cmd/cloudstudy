// Soft-withdraw the one known local offline package with no downloadable parts.
// Dry-run by default and restricted to local MySQL.
import { runMysql } from './lib/mysql-client.mjs';

if (process.env.MYSQL_HOST && process.env.MYSQL_HOST !== '127.0.0.1') throw new Error('local MySQL only');
if (process.env.MYSQL_PORT && process.env.MYSQL_PORT !== '13306') throw new Error('local MySQL only');

const table = 'notification_service.notification_offline_package';
const predicate = `package_id = 'OFFLINE-B4-FOUNDATION'
 AND signature = 'b4-offline-signature-v1'
 AND JSON_LENGTH(signed_part_urls_json) = 0
 AND state = 'PUBLISHED'`;
const mysqlArgs = [
  '--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '--user', 'root',
  '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw',
];
function mysql(input) {
  return runMysql({
    mysqlBin: process.env.MYSQL_BIN || 'mysql', mysqlArgs,
    password: process.env.MYSQL_ROOT_PASSWORD || 'root-local-only',
    cwd: process.cwd(), input,
  });
}

const count = Number(mysql(`SELECT COUNT(*) FROM ${table} WHERE ${predicate};\n`));
if (!Number.isInteger(count) || count < 0 || count > 1) throw new Error('Unexpected offline fixture scope');
const apply = process.argv.includes('--apply');
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', candidates: count }));
if (!apply || count === 0) process.exit(0);

const changed = Number(mysql(`UPDATE ${table} SET state = 'DELETED' WHERE ${predicate};
SELECT ROW_COUNT();\n`));
console.log(JSON.stringify({ changed }));
if (changed !== count) process.exitCode = 1;
