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

function migrationFiles(owner) {
  const directory = path.join(root, path.dirname(owner.migrationPath));
  if (!fs.existsSync(directory)) throw new Error(`${owner.id} migration directory is missing: ${path.dirname(owner.migrationPath)}`);
  const files = fs.readdirSync(directory).filter((name) => /^V\d+__.+\.sql$/i.test(name));
  if (files.length === 0) throw new Error(`${owner.id} has no versioned migrations in ${path.dirname(owner.migrationPath)}`);
  return files
    .map((name) => ({ name, version: String(Number(name.match(/^V(\d+)__/i)[1])), sql: fs.readFileSync(path.join(directory, name), 'utf8') }))
    .sort((left, right) => Number(left.version) - Number(right.version));
}

function expectedTablesFor(files) {
  const tables = new Set();
  for (const file of files) {
    for (const match of file.sql.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+`?([a-z][a-z0-9_]*)`?/gi)) tables.add(match[1]);
    for (const match of file.sql.matchAll(/DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+`?([a-z][a-z0-9_]*)`?/gi)) tables.delete(match[1]);
  }
  return [...tables];
}

function existingTables(schema) {
  const output = query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ${quote(schema)} AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;`
  );
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function migrationHistory(schema, files) {
  if (!existingTables(schema).includes('flyway_schema_history')) {
    return { state: 'absent', appliedVersions: [], missingVersions: [], failedVersions: [] };
  }
  const output = query(`SELECT version, success FROM ${identifier(schema)}.flyway_schema_history ORDER BY installed_rank;`);
  const rows = (output ? output.split(/\r?\n/).filter(Boolean) : [])
    .map((line) => line.split('\t'))
    .filter(([version]) => version && version !== 'NULL');
  const appliedVersions = rows.filter(([, success]) => String(success).trim() === '1').map(([version]) => String(version));
  const failedVersions = rows.filter(([, success]) => String(success).trim() !== '1').map(([version]) => String(version));
  const missingVersions = files.map((file) => file.version).filter((version) => !appliedVersions.includes(version));
  return {
    state: missingVersions.length === 0 && failedVersions.length === 0 ? 'verified' : 'mismatch',
    appliedVersions,
    missingVersions,
    failedVersions
  };
}

function passwordEnvName(owner) {
  return `${owner.id.toUpperCase().replaceAll('-', '_')}_DB_PASSWORD`;
}

function ownerPasswordFor(owner) {
  const envName = passwordEnvName(owner);
  const value = process.env[envName];
  return value && value.trim()
    ? { password: value, source: `service-env:${envName}` }
    : { password: ownerPassword, source: 'shared-env:MYSQL_OWNER_PASSWORD' };
}

function verifyOwnerGrants(owner, password) {
  const schema = identifier(owner.schema);
  query(`CREATE TABLE ${schema}.\`p1r_grant_probe\` (id INT PRIMARY KEY, note VARCHAR(32) NULL);`);
  const ownerArgs = { user: owner.dbCredential, password, database: owner.schema };
  let dml = false;
  let ddlDenied = false;
  let alterDenied = false;
  try {
    query(`INSERT INTO p1r_grant_probe (id, note) VALUES (1, 'probe');`, ownerArgs);
    query(`UPDATE p1r_grant_probe SET note = 'updated' WHERE id = 1;`, ownerArgs);
    query(`SELECT note FROM p1r_grant_probe WHERE id = 1;`, ownerArgs);
    query(`DELETE FROM p1r_grant_probe WHERE id = 1;`, ownerArgs);
    dml = true;
    try {
      query(`CREATE TABLE ${schema}.\`p1r_grant_probe_should_fail\` (id INT);`, ownerArgs);
    } catch {
      ddlDenied = true;
    }
    try {
      query(`ALTER TABLE ${schema}.\`p1r_grant_probe\` ADD COLUMN extra INT;`, ownerArgs);
    } catch {
      alterDenied = true;
    }
  } finally {
    query(`DROP TABLE IF EXISTS ${schema}.\`p1r_grant_probe\`;`);
    query(`DROP TABLE IF EXISTS ${schema}.\`p1r_grant_probe_should_fail\`;`);
  }
  return { dml, ddlDenied, alterDenied };
}

function provisionOwner(owner) {
  const schema = identifier(owner.schema);
  const user = quote(owner.dbCredential);
  const { password, source } = ownerPasswordFor(owner);
  query(`
    CREATE DATABASE IF NOT EXISTS ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    DROP USER IF EXISTS ${user}@'%';
    CREATE USER ${user}@'%' IDENTIFIED BY ${quote(password)};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ${schema}.* TO ${user}@'%';
  `);

  const files = migrationFiles(owner);
  const expectedTables = expectedTablesFor(files);
  const beforeTables = existingTables(owner.schema);
  let migrationState = 'applied-now';
  if (beforeTables.length === 0) {
    for (const file of files) {
      query(file.sql, { database: owner.schema });
    }
  } else if (expectedTables.every((table) => beforeTables.includes(table))) {
    migrationState = 'already-applied-verified';
  } else {
    const missing = expectedTables.filter((table) => !beforeTables.includes(table));
    throw new Error(`${owner.id} schema is partially migrated; missing tables: ${missing.join(', ')}`);
  }

  const grantVerification = verifyOwnerGrants(owner, password);
  const tableCount = existingTables(owner.schema).length;
  const history = migrationHistory(owner.schema, files);
  const accessCheck = query(
    `SELECT COUNT(*) FROM mysql.user WHERE User = ${quote(owner.dbCredential)} AND Host = '%';`
  );
  return {
    id: owner.id,
    schema: owner.schema,
    credential: owner.dbCredential,
    credentialSource: source,
    migrationFiles: files.map((file) => file.name),
    tableCount,
    expectedTableCount: expectedTables.length,
    migrationState,
    history,
    grantVerification,
    access: Number(accessCheck) === 1
  };
}

if (!apply) {
  console.log(JSON.stringify({ mode: 'plan', owners: owners.services.map(({ id, schema, dbCredential, migrationPath }) => ({ id, schema, dbCredential, migrationPath, passwordEnv: passwordEnvName({ id }) })) }, null, 2));
  process.exit(0);
}

try {
  const results = owners.services.map(provisionOwner);
  if (results.some((item) => item.tableCount < 1 || !item.access
    || !item.grantVerification.dml || !item.grantVerification.ddlDenied || !item.grantVerification.alterDenied)) {
    throw new Error('owner schema/credential reconciliation returned an invalid result');
  }
  console.log(JSON.stringify({ mode: 'applied', ownerCount: results.length, results }, null, 2));
} catch (error) {
  console.error(`owner schema reconciliation failed: ${error.message}`);
  process.exitCode = 2;
}
