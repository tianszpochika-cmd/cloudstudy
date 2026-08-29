import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const libDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(libDirectory, '..', '..', '..');
export const migrationDirectory = path.join(repositoryRoot, 'database', 'mysql', 'migrations');

export const requiredTables = ['schema_version', 'idempotency_keys', 'outbox_events', 'audit_logs', 'media_assets'];

export const requiredColumns = {
  schema_version: ['migration_version', 'description', 'checksum_sha256', 'status'],
  idempotency_keys: ['scope_code', 'scope_subject', 'idempotency_key', 'request_hash', 'status', 'expires_at'],
  outbox_events: ['event_id', 'dedupe_key', 'payload_json', 'status', 'attempt_count', 'available_at'],
  audit_logs: ['audit_uuid', 'request_id', 'actor_subject', 'action_code', 'result_code', 'occurred_at'],
  media_assets: [
    'asset_uuid',
    'asset_key',
    'content_hash',
    'owner_type',
    'owner_id',
    'visibility',
    'copyright_owner',
    'retention_until',
    'content_length_bytes',
    'supports_range',
    'chunk_size_bytes',
    'part_count'
  ]
};

export const requiredIndexes = {
  schema_version: ['uk_schema_version'],
  idempotency_keys: ['uk_idempotency_scope_key', 'idx_idempotency_expiry', 'idx_idempotency_processing'],
  outbox_events: ['uk_outbox_event_id', 'uk_outbox_dedupe_key', 'idx_outbox_dispatch'],
  audit_logs: ['uk_audit_uuid', 'idx_audit_resource_time', 'idx_audit_retention'],
  media_assets: ['uk_media_asset_uuid', 'uk_media_asset_key_version', 'idx_media_hash_kind', 'idx_media_status_retention']
};

export function normalizeSql(sql) {
  return sql.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

export function sha256Normalized(sql) {
  return crypto.createHash('sha256').update(normalizeSql(sql), 'utf8').digest('hex');
}

export function loadManifest() {
  const manifestPath = path.join(migrationDirectory, 'migration-manifest.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function readMigrations() {
  const manifest = loadManifest();
  const files = fs
    .readdirSync(migrationDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^V\d{4,}__[a-z0-9][a-z0-9_-]*\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const migrations = files.map((file) => {
    const match = file.match(/^V(\d{4,})__([a-z0-9][a-z0-9_-]*)\.sql$/i);
    const sql = fs.readFileSync(path.join(migrationDirectory, file), 'utf8');
    return {
      version: match[1],
      file,
      descriptionFromFile: match[2].replace(/[-_]/g, ' '),
      sql,
      checksumSha256: sha256Normalized(sql)
    };
  });

  return { manifest, migrations };
}

export function validateMigrationSet() {
  const errors = [];
  let loaded;
  try {
    loaded = readMigrations();
  } catch (error) {
    return { errors: [`无法读取迁移清单: ${error.message}`], migrations: [], manifest: null };
  }

  const { manifest, migrations } = loaded;
  const manifestMigrations = manifest?.migrations ?? [];
  const manifestByFile = new Map(manifestMigrations.map((item) => [item.file, item]));
  const seenVersions = new Set();

  if (manifest?.formatVersion !== 1) errors.push('migration-manifest.json formatVersion 必须为 1');
  if (manifest?.checksumAlgorithm !== 'sha256-normalized-utf8') {
    errors.push('migration-manifest.json checksumAlgorithm 不符合约定');
  }

  for (const migration of migrations) {
    if (seenVersions.has(migration.version)) errors.push(`迁移版本重复: ${migration.version}`);
    seenVersions.add(migration.version);

    const manifestItem = manifestByFile.get(migration.file);
    if (!manifestItem) {
      errors.push(`迁移未登记在 manifest: ${migration.file}`);
    } else if (manifestItem.version !== migration.version) {
      errors.push(`迁移版本与 manifest 不一致: ${migration.file}`);
    }

    const migrationKind = manifestItem?.kind ?? 'create';
    if (!['create', 'alter'].includes(migrationKind)) {
      errors.push(`${migration.file} 的迁移类型必须为 create 或 alter`);
    }

    if (migrationKind === 'create') {
      if (!/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i.test(migration.sql)) {
        errors.push(`建表迁移缺少可重复执行的 CREATE TABLE IF NOT EXISTS: ${migration.file}`);
      }
      for (const table of manifestItem?.requiredTables ?? []) {
        const tablePattern = new RegExp('CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+`?' + table + '`?', 'i');
        if (!tablePattern.test(migration.sql)) errors.push(`${migration.file} 未创建清单要求的表 ${table}`);
      }
      if ((manifestItem?.requiredExistingTables ?? []).length > 0) {
        errors.push(`${migration.file} 是 create 迁移，不应声明 requiredExistingTables`);
      }
    }

    if (migrationKind === 'alter') {
      const existingTables = manifestItem?.requiredExistingTables ?? [];
      if (!Array.isArray(existingTables) || existingTables.length === 0) {
        errors.push(`${migration.file} 是 alter 迁移，必须声明 requiredExistingTables`);
      }
      if ((manifestItem?.requiredTables ?? []).length > 0) {
        errors.push(`${migration.file} 是 alter 迁移，不应声明 requiredTables`);
      }
      if (!/\b(?:ALTER\s+TABLE|UPDATE)\b/i.test(migration.sql)) {
        errors.push(`变更迁移缺少 ALTER TABLE 或 UPDATE: ${migration.file}`);
      }
      for (const table of existingTables) {
        const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tablePattern = new RegExp('\\b(?:ALTER\\s+TABLE|UPDATE)\\s+`?' + escapedTable + '`?\\b', 'i');
        if (!tablePattern.test(migration.sql)) errors.push(`${migration.file} 未变更清单要求的既有表 ${table}`);
      }
    }

    if (/\bDROP\s+(DATABASE|SCHEMA|TABLE|VIEW)\b|\bTRUNCATE\s+TABLE\b|\bCREATE\s+DATABASE\b/i.test(migration.sql)) {
      errors.push(`迁移包含禁止的破坏性语句: ${migration.file}`);
    }
    if (/--\s*down\b|\/\*\s*down\b/i.test(migration.sql)) {
      errors.push(`迁移不得混入隐式 down 脚本: ${migration.file}`);
    }

  }

  const manifestFiles = manifestMigrations.map((item) => item.file).sort();
  const migrationFiles = migrations.map((item) => item.file).sort();
  if (JSON.stringify(manifestFiles) !== JSON.stringify(migrationFiles)) {
    errors.push('migration-manifest.json 与实际 V*.sql 文件集合不一致');
  }

  const expectedVersions = manifestMigrations.map((item) => item.version).sort();
  if (expectedVersions.some((version, index) => version !== String(index + 1).padStart(4, '0'))) {
    errors.push('基础迁移版本必须从 0001 连续递增，不能跳号');
  }

  return { errors, migrations, manifest };
}

export function sqlString(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
}

export function parseFlag(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

export function printMigrationPlan(migrations) {
  for (const migration of migrations) {
    process.stdout.write(`${migration.version} ${migration.file} sha256=${migration.checksumSha256}\n`);
  }
}
