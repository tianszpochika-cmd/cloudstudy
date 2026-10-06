import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMysql } from './lib/mysql-client.mjs';

// Provision only the owner schema/account. Flyway owns all IAM migration history.
// Never pre-apply SQL, baseline, repair, delete data, or reset an existing password.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (!process.argv.includes('--apply')) {
  console.error('Usage: node scripts/database/prepare-iam-database.mjs --apply');
  process.exit(2);
}
const password = (process.env.MYSQL_OWNER_PASSWORD ?? 'local-owner-only')
  .replaceAll('\\', '\\\\').replaceAll("'", "''");
runMysql({
  cwd: root,
  password: process.env.MYSQL_ROOT_PASSWORD ?? 'root-local-only',
  mysqlArgs: ['--host', process.env.MYSQL_HOST ?? '127.0.0.1', '--port', process.env.MYSQL_PORT ?? '13306',
    '--user', 'root', '--batch', '--execute', [
      'CREATE DATABASE IF NOT EXISTS `iam_service` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
      `CREATE USER IF NOT EXISTS 'svc_iam'@'%' IDENTIFIED BY '${password}'`,
      // Local migration account: DROP is needed by V5 to remove retired provider tables.
      "GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES, CREATE TEMPORARY TABLES, LOCK TABLES ON `iam_service`.* TO 'svc_iam'@'%'"
    ].join('; ')]
});
console.log(JSON.stringify({ status: 'PASS', schema: 'iam_service', migrations: 'FLYWAY_AT_IAM_START',
  v13: 'Explicit drained-writer confirmation required for first migration; see local development guide.' }));
