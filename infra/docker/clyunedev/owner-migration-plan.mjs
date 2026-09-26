import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const migrationName = /^V([1-9][0-9]*)__([A-Za-z0-9_]+)\.sql$/u;
const metadataTables = new Set(['p1r_schema_history', 'p1r_migration_guard']);

export function passwordEnvName(owner) {
  return `${owner.id.replace(/-service$/u, '').replaceAll('-', '_').toUpperCase()}_DB_PASSWORD`;
}

export function loadMigrations(root, owner) {
  const directory = path.join(root, path.dirname(owner.migrationPath));
  const names = fs.readdirSync(directory).filter((name) => /\.sql$/iu.test(name));
  if (!names.includes(path.basename(owner.migrationPath))) {
    throw new Error(`${owner.id}: manifest V1 migration is missing`);
  }
  const migrations = names.map((name) => {
    const match = migrationName.exec(name);
    if (!match) throw new Error(`${owner.id}: invalid migration filename ${name}`);
    if (name.length > 128) throw new Error(`${owner.id}: migration filename exceeds history column`);
    const version = Number(match[1]);
    if (!Number.isSafeInteger(version) || version > 2147483647) {
      throw new Error(`${owner.id}: migration version exceeds history column`);
    }
    const sql = fs.readFileSync(path.join(directory, name), 'utf8');
    if (!sql.trim()) throw new Error(`${owner.id}: empty migration ${name}`);
    return {
      version,
      name,
      checksum: crypto.createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex'),
      sql
    };
  }).sort((a, b) => a.version - b.version);
  if (migrations.length === 0 || migrations[0].version !== 1) {
    throw new Error(`${owner.id}: migrations must start with V1`);
  }
  for (let index = 1; index < migrations.length; index += 1) {
    if (migrations[index].version === migrations[index - 1].version) {
      throw new Error(`${owner.id}: duplicate V${migrations[index].version}`);
    }
  }
  return migrations;
}

export function validateOwnerState(owner, migrations, state) {
  const tables = new Set(state.tables);
  const historyPresent = tables.has('p1r_schema_history');
  if (!historyPresent && tables.size > 0) {
    throw new Error(`${owner.id}: existing schema lacks authoritative p1r history; manual adoption required`);
  }
  if (state.guardRows.length > 0) {
    throw new Error(`${owner.id}: interrupted migration guard present; restore or repair before retry`);
  }
  if (state.historyRows.length > 0 && !historyPresent) {
    throw new Error(`${owner.id}: history rows without history table`);
  }
  if (state.historyRows.length === 0 && [...tables].some((table) => !metadataTables.has(table))) {
    throw new Error(`${owner.id}: existing business tables lack recorded migrations`);
  }
  if (!historyPresent && state.guardPresent) {
    throw new Error(`${owner.id}: guard exists without history`);
  }
  if (state.historyRows.length > migrations.length) {
    throw new Error(`${owner.id}: history contains unknown future version`);
  }
  state.historyRows.forEach((row, index) => {
    const expected = migrations[index];
    if (!expected || Number(row.version) !== expected.version) {
      throw new Error(`${owner.id}: history is not a prefix of the repository migration sequence`);
    }
    if (String(row.checksum) !== expected.checksum) {
      throw new Error(`${owner.id}: V${row.version} checksum drift`);
    }
  });
  for (const row of state.flywayRows) {
    if (Number(row.success) !== 1) {
      throw new Error(`${owner.id}: Flyway contains a failed migration`);
    }
    if (row.version !== null && !state.historyRows.some((history) => String(history.version) === String(row.version))) {
      throw new Error(`${owner.id}: Flyway version ${row.version} is absent from authoritative history`);
    }
  }
  return migrations.slice(state.historyRows.length);
}
