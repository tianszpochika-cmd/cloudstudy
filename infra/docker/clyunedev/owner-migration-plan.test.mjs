import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadMigrations, passwordEnvName, validateOwnerState } from './owner-migration-plan.mjs';

const owner = {
  id: 'assessment-service',
  migrationPath: 'services/assessment-service/src/main/resources/db/migration/V1__create.sql'
};

function fixture(names) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-migration-plan-'));
  const directory = path.join(root, path.dirname(owner.migrationPath));
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, sql] of Object.entries(names)) fs.writeFileSync(path.join(directory, name), sql);
  return root;
}

function state(overrides = {}) {
  return {
    tables: [], historyRows: [], guardPresent: false, guardRows: [], flywayRows: [],
    ...overrides
  };
}

const checksum = (sql) => crypto.createHash('sha256').update(sql).digest('hex');
const migrations = [
  { version: 1, name: 'V1__create.sql', checksum: checksum('CREATE TABLE alpha (id INT);') },
  { version: 3, name: 'V3__alter.sql', checksum: checksum('ALTER TABLE alpha ADD note INT;') }
];

test('server password name matches Compose owner credentials', () => {
  assert.equal(passwordEnvName(owner), 'ASSESSMENT_DB_PASSWORD');
  assert.equal(passwordEnvName({ id: 'admin-ops-service' }), 'ADMIN_OPS_DB_PASSWORD');
});

test('empty schema runs all versions, and complete history reruns nothing', () => {
  assert.deepEqual(validateOwnerState(owner, migrations, state()).map((migration) => migration.version), [1, 3]);
  const historyRows = migrations.map(({ version, checksum: digest }) => ({ version, checksum: digest }));
  assert.deepEqual(validateOwnerState(owner, migrations, state({
    tables: ['alpha', 'p1r_schema_history', 'p1r_migration_guard'], historyRows
  })), []);
});

test('recorded prefix permits only pending additive migration', () => {
  const pending = validateOwnerState(owner, migrations, state({
    tables: ['alpha', 'p1r_schema_history'],
    historyRows: [{ version: 1, checksum: migrations[0].checksum }]
  }));
  assert.deepEqual(pending.map((migration) => migration.version), [3]);
});

test('legacy nonempty schema without history never gets automatic baseline', () => {
  assert.throws(() => validateOwnerState(owner, migrations, state({ tables: ['alpha'] })), /manual adoption/);
  assert.throws(() => validateOwnerState(owner, migrations, state({
    tables: ['alpha', 'p1r_schema_history']
  })), /lack recorded migrations/);
});

test('checksum drift, unknown or skipped versions, and Flyway-only state fail closed', () => {
  assert.throws(() => validateOwnerState(owner, migrations, state({
    tables: ['alpha', 'p1r_schema_history'], historyRows: [{ version: 1, checksum: 'bad' }]
  })), /checksum drift/);
  assert.throws(() => validateOwnerState(owner, migrations, state({
    tables: ['alpha', 'p1r_schema_history'], historyRows: [{ version: 4, checksum: 'future' }]
  })), /prefix/);
  assert.throws(() => validateOwnerState(owner, migrations, state({
    tables: ['alpha', 'p1r_schema_history'], historyRows: [{ version: 3, checksum: migrations[1].checksum }]
  })), /prefix/);
  assert.throws(() => validateOwnerState(owner, migrations, state({
    tables: ['flyway_schema_history'], flywayRows: [{ version: '1', success: '1' }]
  })), /manual adoption/);
  assert.throws(() => validateOwnerState(owner, migrations, state({
    tables: ['alpha', 'p1r_schema_history', 'flyway_schema_history'],
    historyRows: [{ version: 1, checksum: migrations[0].checksum }],
    flywayRows: [{ version: '3', success: '1' }]
  })), /absent from authoritative history/);
});

test('partial execution and failed Flyway history block all retries', () => {
  assert.throws(() => validateOwnerState(owner, migrations, state({
    tables: ['alpha', 'p1r_schema_history', 'p1r_migration_guard'],
    historyRows: [{ version: 1, checksum: migrations[0].checksum }],
    guardPresent: true, guardRows: [['1', '3', migrations[1].checksum]]
  })), /interrupted migration guard/);
  assert.throws(() => validateOwnerState(owner, migrations, state({
    tables: ['alpha', 'p1r_schema_history', 'flyway_schema_history'],
    historyRows: [{ version: 1, checksum: migrations[0].checksum }],
    flywayRows: [{ version: '1', success: '0' }]
  })), /failed migration/);
});

test('duplicate V and CRLF drift are validated before database writes', (context) => {
  const duplicateRoot = fixture({
    'V1__create.sql': 'CREATE TABLE alpha (id INT);',
    'V1__duplicate.sql': 'CREATE TABLE beta (id INT);'
  });
  context.after(() => fs.rmSync(duplicateRoot, { recursive: true, force: true }));
  assert.throws(() => loadMigrations(duplicateRoot, owner), /duplicate V1/);

  const root = fixture({
    'V1__create.sql': 'CREATE TABLE alpha (id INT);\r\n',
    'V3__alter.sql': 'ALTER TABLE alpha ADD note INT;\n'
  });
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = loadMigrations(root, owner);
  assert.equal(files[0].checksum, checksum('CREATE TABLE alpha (id INT);\n'));
  assert.deepEqual(files.map((file) => file.version), [1, 3]);
});
