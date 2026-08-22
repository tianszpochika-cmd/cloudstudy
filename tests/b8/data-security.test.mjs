import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('B8 IAM migration owns principal, identity, device, session, consent, policy and audit facts', () => {
  const sql = read('database/mysql/migrations/V0016__create_iam_control_plane_b8.sql');
  const manifest = JSON.parse(read('database/mysql/migrations/migration-manifest.json'));
  const iamMigration = manifest.migrations.find((migration) => migration.version === '0016');
  assert.ok(iamMigration, 'B8 migration must remain addressable after later append-only migrations');
  for (const table of ['iam_principal', 'iam_external_identity', 'iam_device', 'iam_session', 'iam_consent', 'iam_policy_version', 'iam_decision_audit']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    assert.ok(iamMigration.requiredTables.includes(table));
  }
  assert.equal(iamMigration.version, '0016');
});

test('IAM persistence derives the platform tenant and stores only hashes for sensitive credentials', () => {
  const sql = read('database/mysql/migrations/V0016__create_iam_control_plane_b8.sql');
  assert.match(sql, /tenant_id VARCHAR\(64\) NOT NULL DEFAULT 'platform'/);
  assert.match(sql, /CHECK \(tenant_id = 'platform'\)/);
  assert.match(sql, /subject_hash BINARY\(32\)/);
  assert.match(sql, /refresh_token_hash BINARY\(32\)/);
  assert.doesNotMatch(sql, /refresh_token\s+VARCHAR|access_token\s+VARCHAR|client_secret/i);
  assert.doesNotMatch(sql, /DROP\s+TABLE|TRUNCATE\s+TABLE/i);
});
