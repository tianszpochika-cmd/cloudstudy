import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  B3_EXPERIENCE_ROW_COUNT,
  B3_RESOURCE_TYPES,
  FEATURE_STATE_ROW_COUNT,
  FIXTURE_ID,
  FUNCTION_CHECK_COUNT,
  GAMIFICATION_FEATURE_KEYS,
  ROWS_PER_FUNCTION,
  SUBJECTS,
  TABLE_CHECKS,
  buildFixtureSql,
} from '../../scripts/database/local-real-10x-fixture.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(readFileSync(path.join(root, 'database/mysql/fixtures/local-real-10x.json'), 'utf8'));

test('local-real-10x manifest is synthetic and matches the generator', () => {
  assert.equal(manifest.fixtureId, FIXTURE_ID);
  assert.equal(manifest.synthetic, true);
  assert.equal(manifest.subjects, SUBJECTS.length);
  assert.equal(manifest.rowsPerFunction, ROWS_PER_FUNCTION);
  assert.equal(manifest.functionalCheckItems, FUNCTION_CHECK_COUNT);
  assert.deepEqual(manifest.b3ResourceTypes, B3_RESOURCE_TYPES);
  assert.deepEqual(manifest.gamificationFeatureKeys, GAMIFICATION_FEATURE_KEYS);
  assert.deepEqual(manifest.dataPolicy, {
    onlyLocalDatabase: true,
    noRawAudio: true,
    noPersonalInformation: true,
    noCredentialsOrTokens: true,
    repeatableUpserts: true,
  });
});

test('local-real-10x generator covers the expected expanded features', () => {
  assert.equal(B3_EXPERIENCE_ROW_COUNT, B3_RESOURCE_TYPES.length * ROWS_PER_FUNCTION);
  assert.equal(FEATURE_STATE_ROW_COUNT, GAMIFICATION_FEATURE_KEYS.length * ROWS_PER_FUNCTION);
  assert.ok(TABLE_CHECKS.every(([, , , minimum]) => minimum >= ROWS_PER_FUNCTION));
  assert.equal(new Set(SUBJECTS).size, ROWS_PER_FUNCTION);
});

test('local-real-10x SQL is repeatable and stays inside approved owner schemas', () => {
  const sql = buildFixtureSql();
  assert.match(sql, /START TRANSACTION;/);
  assert.match(sql, /COMMIT;/);
  assert.match(sql, /ON DUPLICATE KEY UPDATE/);
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE)\s+(DATABASE|SCHEMA|TABLE)?/i);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(sql, /core[-_]api|ai[-_]orchestrator|realtime[-_]voice/i);

  const approvedSchemas = new Set(manifest.databaseOwners.map((name) => name.replaceAll('-', '_')));
  const referencedSchemas = [...sql.matchAll(/INSERT INTO ([a-z0-9_]+)\./gi)].map((match) => match[1]);
  assert.ok(referencedSchemas.length > 0);
  assert.ok(referencedSchemas.every((schema) => approvedSchemas.has(schema)));
});

test('each declared check is tied to a local fixture marker', () => {
  for (const [name, table, predicate, minimum] of TABLE_CHECKS) {
    assert.ok(name.length > 0);
    assert.match(table, /^[a-z0-9_]+\.[a-z0-9_]+$/);
    assert.ok(predicate.length > 0);
    assert.ok(minimum >= ROWS_PER_FUNCTION);
  }
});
