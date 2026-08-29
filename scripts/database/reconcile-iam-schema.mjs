import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMysql } from './lib/mysql-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rootPassword = process.env.MYSQL_ROOT_PASSWORD ?? 'root-local-only';
const ownerPassword = process.env.MYSQL_OWNER_PASSWORD ?? 'local-owner-only';
const schema = 'iam_service';
const user = 'svc_iam';

function mysqlArgs(userName, database, sql) {
  return ['--host', process.env.MYSQL_HOST ?? '127.0.0.1', '--port', process.env.MYSQL_PORT ?? '13306', '--user', userName, ...(database ? ['--database', database] : []), '--batch', '--skip-column-names', '--execute', sql];
}

if (!process.argv.includes('--apply')) {
  console.error('Usage: node scripts/database/reconcile-iam-schema.mjs --apply');
  process.exit(2);
}

const escapedPassword = ownerPassword.replaceAll('\\', '\\\\').replaceAll("'", "''");
const sql = [
  `CREATE DATABASE IF NOT EXISTS \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE USER IF NOT EXISTS '${user}'@'%' IDENTIFIED BY '${escapedPassword}'`,
  `ALTER USER '${user}'@'%' IDENTIFIED BY '${escapedPassword}'`,
  `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, CREATE TEMPORARY TABLES, LOCK TABLES ON \`${schema}\`.* TO '${user}'@'%'`,
  'FLUSH PRIVILEGES',
].join('; ');
runMysql({ mysqlArgs: mysqlArgs('root', null, sql), password: rootPassword, cwd: root });

const migrationPath = path.join(root, 'services', 'iam-service', 'src', 'main', 'resources', 'db', 'migration', 'V1__create_iam_service_schema.sql');
const migration = `SET collation_connection = 'utf8mb4_unicode_ci';\n${fs.readFileSync(migrationPath, 'utf8')}`;
runMysql({
  mysqlArgs: ['--host', process.env.MYSQL_HOST ?? '127.0.0.1', '--port', process.env.MYSQL_PORT ?? '13306', '--user', user, '--database', schema, '--batch'],
  password: ownerPassword,
  cwd: root,
  input: migration,
});

const jwtRuntimeMigrationPath = path.join(root, 'services', 'iam-service', 'src', 'main', 'resources', 'db', 'migration', 'V5__create_self_owned_jwt_auth_schema.sql');
runMysql({
  mysqlArgs: ['--host', process.env.MYSQL_HOST ?? '127.0.0.1', '--port', process.env.MYSQL_PORT ?? '13306', '--user', user, '--database', schema, '--batch'],
  password: ownerPassword,
  cwd: root,
  input: `SET collation_connection = 'utf8mb4_unicode_ci';\n${fs.readFileSync(jwtRuntimeMigrationPath, 'utf8')}`,
});

const policyVersionMigrationPath = path.join(root, 'services', 'iam-service', 'src', 'main', 'resources', 'db', 'migration', 'V3__seed_b30_policy_version.sql');
runMysql({
  mysqlArgs: ['--host', process.env.MYSQL_HOST ?? '127.0.0.1', '--port', process.env.MYSQL_PORT ?? '13306', '--user', user, '--database', schema, '--batch'],
  password: ownerPassword,
  cwd: root,
  input: `SET collation_connection = 'utf8mb4_unicode_ci';\n${fs.readFileSync(policyVersionMigrationPath, 'utf8')}`,
});

const consentHistoryMigrationPath = path.join(root, 'services', 'iam-service', 'src', 'main', 'resources', 'db', 'migration', 'V4__preserve_iam_consent_history.sql');
runMysql({
  mysqlArgs: ['--host', process.env.MYSQL_HOST ?? '127.0.0.1', '--port', process.env.MYSQL_PORT ?? '13306', '--user', user, '--database', schema, '--batch'],
  password: ownerPassword,
  cwd: root,
  input: `SET collation_connection = 'utf8mb4_unicode_ci';\n${fs.readFileSync(consentHistoryMigrationPath, 'utf8')}`,
});

const count = runMysql({ mysqlArgs: mysqlArgs(user, schema, 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()'), password: ownerPassword, cwd: root });
console.log(JSON.stringify({ status: 'PASS', schema, user, tableCount: Number(count) || 0, runtimeMode: process.env.MYSQL_RUNTIME_MODE ?? 'auto' }, null, 2));
