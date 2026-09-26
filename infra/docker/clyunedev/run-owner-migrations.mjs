#!/usr/bin/env node
// clyunedev-only, short-lived admin job. No automatic baseline of old schemas.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readOwnerManifest } from '../../../scripts/database/lib/owner-manifest.mjs';
import { loadMigrations, passwordEnvName, validateOwnerState } from './owner-migration-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const historyTable = 'p1r_schema_history';
const guardTable = 'p1r_migration_guard';
const adminUser = process.env.MYSQL_ADMIN_USER;
const adminPassword = process.env.MYSQL_ROOT_PASSWORD;
const host = process.env.MYSQL_HOST;
const port = process.env.MYSQL_PORT;
const mysqlBin = process.env.MYSQL_BIN || 'mysql';

function required(value, label) {
  if (!value || !value.trim() || value.startsWith('replace-with-')) {
    throw new Error(`${label} is required`);
  }
  return value;
}

function identifier(value) {
  if (!/^[a-z][a-z0-9_]*$/u.test(value)) throw new Error(`invalid SQL identifier: ${value}`);
  return `\`${value}\``;
}

function literal(value) {
  if (!/^[A-Za-z0-9_.-]+$/u.test(value)) throw new Error('invalid SQL literal');
  return `'${value}'`;
}

function mysql(sql, { user = adminUser, password = adminPassword, database } = {}) {
  const args = [
    '--protocol=TCP', '--host', host, '--port', port, '--user', user,
    '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw', '--binary-mode=1',
    ...(database ? ['--database', database] : [])
  ];
  return spawnSync(mysqlBin, args, {
    input: `${sql.trim()}\n`,
    encoding: 'utf8',
    env: { PATH: process.env.PATH || '', HOME: '/tmp', MYSQL_PWD: password },
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024
  });
}

function query(sql, options, label) {
  const result = mysql(sql, options);
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed (mysql exit ${result.status ?? 'unknown'}); no SQL or credentials logged`);
  }
  return result.stdout.trim();
}

function rows(output, width, label) {
  if (!output) return [];
  return output.split(/\r?\n/u).map((line) => {
    const fields = line.split('\t');
    if (fields.length !== width) throw new Error(`${label}: invalid MySQL result`);
    return fields;
  });
}

function readState(owner) {
  const schema = identifier(owner.schema);
  const tableOutput = query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ${literal(owner.schema)} ORDER BY TABLE_NAME;`,
    undefined, `${owner.id} table inventory`
  );
  const tables = tableOutput ? tableOutput.split(/\r?\n/u) : [];
  const historyRows = tables.includes(historyTable)
    ? rows(query(`SELECT version, checksum FROM ${schema}.${identifier(historyTable)} ORDER BY version;`,
      undefined, `${owner.id} history`), 2, `${owner.id} history`)
      .map(([version, checksum]) => ({ version: Number(version), checksum }))
    : [];
  const guardPresent = tables.includes(guardTable);
  const guardRows = guardPresent
    ? rows(query(`SELECT id, version, checksum FROM ${schema}.${identifier(guardTable)};`,
      undefined, `${owner.id} guard`), 3, `${owner.id} guard`)
    : [];
  const flywayRows = tables.includes('flyway_schema_history')
    ? rows(query(`SELECT version, success FROM ${schema}.flyway_schema_history ORDER BY installed_rank;`,
      undefined, `${owner.id} Flyway history`), 2, `${owner.id} Flyway history`)
      .map(([version, success]) => ({ version: version === 'NULL' ? null : version, success }))
    : [];
  return { tables, historyRows, guardPresent, guardRows, flywayRows };
}

function verifyDenied(sql, options, label) {
  const result = mysql(sql, options);
  if (result.error || result.status === 0 || !/ERROR (1044|1142|1143|1227)\b/u.test(result.stderr)) {
    throw new Error(`${label}: expected MySQL privilege denial`);
  }
}

function verifyGrantList(user, schema, permissions) {
  const raw = query(`SHOW GRANTS FOR ${literal(user)}@'%';`, undefined, `${user} grants`);
  const grants = raw.split(/\r?\n/u).map((line) => line.replaceAll('`', '').replaceAll("'", ''));
  const expected = new Set([
    `GRANT USAGE ON *.* TO ${user}@%`,
    `GRANT ${permissions} ON ${schema}.* TO ${user}@%`
  ]);
  if (grants.length !== expected.size || grants.some((grant) => !expected.has(grant))) {
    throw new Error(`${user}: grants exceed or differ from own-schema policy`);
  }
}

function verifyNoStaleMigrationUser(owner) {
  const name = `p1r_mig_${owner.schema}`;
  const count = query(`SELECT COUNT(*) FROM mysql.user WHERE User = ${literal(name)} AND Host = '%';`,
    undefined, `${owner.id} temporary account lookup`);
  if (count !== '0') throw new Error(`${owner.id}: stale scoped migration account requires manual review`);
}

function verifyExternalGrant(owner, otherOwner, password) {
  const schema = identifier(owner.schema);
  const probe = identifier(`p1r_grant_probe_${crypto.randomBytes(5).toString('hex')}`);
  const ownerConnection = { user: owner.dbCredential, password, database: owner.schema };
  query(`CREATE TABLE ${schema}.${probe} (id INT PRIMARY KEY, note VARCHAR(32));`, undefined, `${owner.id} grant probe setup`);
  try {
    query(`INSERT INTO ${probe} (id, note) VALUES (1, 'probe');`, ownerConnection, `${owner.id} INSERT grant`);
    query(`UPDATE ${probe} SET note = 'updated' WHERE id = 1;`, ownerConnection, `${owner.id} UPDATE grant`);
    const value = query(`SELECT note FROM ${probe} WHERE id = 1;`, ownerConnection, `${owner.id} SELECT grant`);
    if (value !== 'updated') throw new Error(`${owner.id}: DML readback failed`);
    query(`DELETE FROM ${probe} WHERE id = 1;`, ownerConnection, `${owner.id} DELETE grant`);
    verifyDenied(`CREATE TABLE ${schema}.${identifier(`${probe.slice(1, -1)}_denied`)} (id INT);`,
      ownerConnection, `${owner.id} CREATE`);
    verifyDenied(`ALTER TABLE ${probe} ADD COLUMN denied INT;`, ownerConnection, `${owner.id} ALTER`);
    verifyDenied(`SELECT version FROM ${identifier(otherOwner.schema)}.${identifier(historyTable)} LIMIT 1;`,
      ownerConnection, `${owner.id} cross-schema SELECT`);
  } finally {
    query(`DROP TABLE IF EXISTS ${schema}.${probe};`, undefined, `${owner.id} grant probe cleanup`);
    query(`DROP TABLE IF EXISTS ${schema}.${identifier(`${probe.slice(1, -1)}_denied`)};`,
      undefined, `${owner.id} denied probe cleanup`);
  }
}

function verifyIamGrant(outerOwner) {
  const schema = identifier('iam_service');
  const probe = identifier(`p1r_iam_probe_${crypto.randomBytes(5).toString('hex')}`);
  const connection = { user: 'svc_iam', password: process.env.IAM_DB_PASSWORD, database: 'iam_service' };
  query(`CREATE TABLE ${schema}.${probe} (id INT);`, connection, 'IAM own-schema DDL');
  try {
    verifyDenied(`SELECT version FROM ${identifier(outerOwner.schema)}.${identifier(historyTable)} LIMIT 1;`,
      connection, 'IAM cross-schema SELECT');
    verifyDenied(`CREATE TABLE ${identifier(outerOwner.schema)}.${probe} (id INT);`,
      connection, 'IAM cross-schema DDL');
  } finally {
    query(`DROP TABLE IF EXISTS ${schema}.${probe};`, connection, 'IAM grant probe cleanup');
    query(`DROP TABLE IF EXISTS ${identifier(outerOwner.schema)}.${probe};`, undefined,
      'IAM denied probe cleanup');
  }
}

function migrate({ owner, migrations, pending }) {
  if (pending.length === 0) return;
  const schema = identifier(owner.schema);
  query(`CREATE TABLE IF NOT EXISTS ${schema}.${identifier(historyTable)} (
    version INT NOT NULL PRIMARY KEY,
    description VARCHAR(128) NOT NULL,
    checksum CHAR(64) NOT NULL,
    applied_at DATETIME(6) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`, undefined,
  `${owner.id} history setup`);
  query(`CREATE TABLE IF NOT EXISTS ${schema}.${identifier(guardTable)} (
    id TINYINT NOT NULL PRIMARY KEY,
    version INT NOT NULL,
    checksum CHAR(64) NOT NULL,
    started_at DATETIME(6) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`, undefined,
  `${owner.id} guard setup`);

  // The SQL file runs as a temporary account scoped to this one owner schema.
  // Root only manages accounts, the history ledger and grant probes.
  const migrationUser = `p1r_mig_${owner.schema}`;
  const migrationPassword = crypto.randomBytes(32).toString('hex');
  query(`CREATE USER ${literal(migrationUser)}@'%' IDENTIFIED BY ${literal(migrationPassword)};`,
    undefined, `${owner.id} scoped migration account`);
  try {
    query(`GRANT ALL PRIVILEGES ON ${schema}.* TO ${literal(migrationUser)}@'%';`,
      undefined, `${owner.id} scoped migration grant`);
    for (const migration of pending) {
      query(`INSERT INTO ${schema}.${identifier(guardTable)} (id, version, checksum, started_at)
        VALUES (1, ${migration.version}, ${literal(migration.checksum)}, UTC_TIMESTAMP(6));`,
      undefined, `${owner.id} V${migration.version} guard acquire`);
      // A second job may have passed the initial preflight before the first job
      // finished. Recheck under the unique guard before running nontransactional DDL.
      const fresh = readState(owner);
      try {
        validateOwnerState(owner, migrations, { ...fresh, guardRows: [] });
        if (fresh.guardRows.length !== 1
          || fresh.guardRows[0][1] !== String(migration.version)
          || fresh.guardRows[0][2] !== migration.checksum
          || fresh.historyRows.length !== migrations.indexOf(migration)) {
          throw new Error(`${owner.id}: concurrent migration changed history or guard`);
        }
      } catch (error) {
        query(`DELETE FROM ${schema}.${identifier(guardTable)} WHERE id = 1;`, undefined,
          `${owner.id} stale guard cleanup`);
        throw error;
      }
      query(migration.sql, { user: migrationUser, password: migrationPassword, database: owner.schema },
        `${owner.id} V${migration.version} SQL`);
      query(`INSERT INTO ${schema}.${identifier(historyTable)}
        (version, description, checksum, applied_at)
        VALUES (${migration.version}, ${literal(migration.name)}, ${literal(migration.checksum)}, UTC_TIMESTAMP(6));`,
      undefined, `${owner.id} V${migration.version} history record`);
      query(`DELETE FROM ${schema}.${identifier(guardTable)} WHERE id = 1;`, undefined,
        `${owner.id} V${migration.version} guard release`);
      console.log(`${owner.id}: applied V${migration.version}`);
    }
  } finally {
    query(`DROP USER ${literal(migrationUser)}@'%';`, undefined,
      `${owner.id} scoped migration account cleanup`);
  }
}

function main() {
  const mode = process.argv[2] || '--apply';
  if (!['--apply', '--preflight', '--verify'].includes(mode) || process.argv.length > 3) {
    throw new Error('expected --apply, --preflight or --verify');
  }
  if (process.env.MYSQL_RUNTIME_MODE !== 'host' || host !== 'mysql' || port !== '3306') {
    throw new Error('clyunedev migrator requires the private Compose MySQL endpoint');
  }
  if (mode !== '--verify' && (process.env.P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED !== 'true'
    || process.env.P1R_EXTERNAL_MIGRATION_BACKUP_READY !== 'true')) {
    throw new Error('writers-drained and backup-ready gates must both be true');
  }
  required(adminUser, 'MYSQL_ADMIN_USER');
  required(adminPassword, 'MYSQL_ROOT_PASSWORD');
  if (mode !== '--verify') {
    const iamPassword = required(process.env.IAM_DB_PASSWORD, 'IAM_DB_PASSWORD');
    if (/['\\\r\n]/u.test(iamPassword)) throw new Error('IAM password cannot be provisioned safely');
  }
  const owners = readOwnerManifest(root).services;
  if (owners.length !== 13 || new Set(owners.map((owner) => owner.schema)).size !== 13) {
    throw new Error('external owner manifest is not the expected 13 distinct schemas');
  }
  const plans = owners.map((owner) => {
    identifier(owner.schema);
    identifier(owner.dbCredential);
    const password = mode === '--verify' ? null
      : required(process.env[passwordEnvName(owner)], passwordEnvName(owner));
    if (password && /['\\\r\n]/u.test(password)) {
      throw new Error(`${owner.id}: runtime password cannot be provisioned safely`);
    }
    const migrations = loadMigrations(root, owner);
    return { owner, password, migrations };
  });
  // Nothing is written until every owner has passed file and database preflight.
  for (const plan of plans) {
    verifyNoStaleMigrationUser(plan.owner);
    const schemaExists = query(`SELECT COUNT(*) FROM information_schema.SCHEMATA
      WHERE SCHEMA_NAME = ${literal(plan.owner.schema)};`, undefined, `${plan.owner.id} schema lookup`);
    if (schemaExists === '0' && mode === '--preflight') {
      plan.pending = plan.migrations;
      continue;
    }
    if (schemaExists !== '1') throw new Error(`${plan.owner.id}: schema was not provisioned`);
    const state = readState(plan.owner);
    plan.pending = validateOwnerState(plan.owner, plan.migrations, state);
    if (mode !== '--preflight') {
      verifyGrantList(plan.owner.dbCredential, plan.owner.schema, 'SELECT, INSERT, UPDATE, DELETE');
    }
  }
  if (mode === '--preflight') {
    console.log(`Read-only preflight passed for ${plans.length} external owner schemas`);
    return;
  }
  verifyGrantList('svc_iam', 'iam_service', 'ALL PRIVILEGES');
  if (mode === '--verify') {
    if (plans.some((plan) => plan.pending.length > 0)) {
      throw new Error('one or more external owner schemas still have pending migrations');
    }
    console.log(`Read-only history and grant verification passed for ${plans.length} external owners`);
    return;
  }
  console.log(`Preflight passed for ${plans.length} external owner schemas`);
  for (const plan of plans) migrate(plan);
  for (let index = 0; index < plans.length; index += 1) {
    const { owner, password, migrations } = plans[index];
    const state = readState(owner);
    const pending = validateOwnerState(owner, migrations, state);
    if (pending.length !== 0) throw new Error(`${owner.id}: migration history is incomplete`);
    verifyNoStaleMigrationUser(owner);
    verifyGrantList(owner.dbCredential, owner.schema, 'SELECT, INSERT, UPDATE, DELETE');
    verifyExternalGrant(owner, plans[(index + 1) % plans.length].owner, password);
  }
  verifyGrantList('svc_iam', 'iam_service', 'ALL PRIVILEGES');
  verifyIamGrant(plans[0].owner);
  console.log('All 13 external owner histories and runtime grants verified; IAM scoped DDL verified');
}

try {
  main();
} catch (error) {
  console.error(`clyunedev owner migration blocked: ${error.message}`);
  process.exitCode = 2;
}
