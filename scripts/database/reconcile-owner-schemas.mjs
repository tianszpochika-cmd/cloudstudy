import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMysql as runMysqlClient } from './lib/mysql-client.mjs';
import { repositoryRoot } from './lib/migration-utils.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const owners = JSON.parse(fs.readFileSync(path.join(root, 'config/b17-runtime-services.json'), 'utf8'));
const apply = process.argv.includes('--apply');
const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MYSQL_PORT || '13306';
const adminUser = process.env.MYSQL_ADMIN_USER || 'root';
const adminPassword = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only';
const ownerPassword = process.env.MYSQL_OWNER_PASSWORD || 'local-owner-only';

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function identifier(value) {
  if (!/^[a-z][a-z0-9_]+$/.test(value)) throw new Error(`unsafe MySQL identifier: ${value}`);
  return `\`${value}\``;
}

function argsFor({ user, database } = {}) {
  return [
    '--protocol=TCP', '--host', host, '--port', String(port), '--user', user,
    ...(database ? ['--database', database] : []),
    '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw'
  ];
}

function query(sql, { user = adminUser, password = adminPassword, database } = {}) {
  return runMysqlClient({
    mysqlBin,
    mysqlArgs: argsFor({ user, database }),
    password,
    cwd: repositoryRoot,
    input: `${sql.trim()}\n`
  });
}

function migrationTables(migration) {
  return [...migration.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+`?([a-z][a-z0-9_]*)`?/gi)].map((match) => match[1]);
}

function existingTables(schema) {
  const output = query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ${quote(schema)} AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;`
  );
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function provisionOwner(owner) {
  const schema = identifier(owner.schema);
  const user = quote(owner.dbCredential);
  query(`
    CREATE DATABASE IF NOT EXISTS ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS ${user}@'%' IDENTIFIED BY ${quote(ownerPassword)};
    ALTER USER ${user}@'%' IDENTIFIED BY ${quote(ownerPassword)};
    GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, EXECUTE ON ${schema}.* TO ${user}@'%';
  `);

  const migration = fs.readFileSync(path.join(root, owner.migrationPath), 'utf8');
  const expectedTables = migrationTables(migration);
  const beforeTables = existingTables(owner.schema);
  let migrationState = 'applied-now';
  if (beforeTables.length === 0) {
    query(migration, { user: owner.dbCredential, password: ownerPassword, database: owner.schema });
  } else if (expectedTables.every((table) => beforeTables.includes(table))) {
    migrationState = 'already-applied-verified';
  } else {
    const missing = expectedTables.filter((table) => !beforeTables.includes(table));
    throw new Error(`${owner.id} schema is partially migrated; missing tables: ${missing.join(', ')}`);
  }

  const tableCount = existingTables(owner.schema).length;
  const accessCheck = query(
    `SELECT COUNT(*) FROM mysql.user WHERE User = ${quote(owner.dbCredential)} AND Host = '%';`
  );
  return { id: owner.id, schema: owner.schema, credential: owner.dbCredential, tableCount, expectedTableCount: expectedTables.length, migrationState, access: Number(accessCheck) === 1 };
}

if (!apply) {
  console.log(JSON.stringify({ mode: 'plan', owners: owners.services.map(({ id, schema, dbCredential, migrationPath }) => ({ id, schema, dbCredential, migrationPath })) }, null, 2));
  process.exit(0);
}

try {
  const results = owners.services.map(provisionOwner);
  if (results.some((item) => item.tableCount < 1 || !item.access)) throw new Error('owner schema/credential reconciliation returned an invalid result');
  console.log(JSON.stringify({ mode: 'applied', ownerCount: results.length, results }, null, 2));
} catch (error) {
  console.error(`owner schema reconciliation failed: ${error.message}`);
  process.exitCode = 2;
}
