import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = 'services/content-service/src/main/resources/db/migration/V23__unpublish_unbound_legacy_content.sql';
const seedPaths = [
  'services/content-service/src/main/resources/db/migration/V7__seed_b3_learner_experience_content.sql',
  'services/content-service/src/main/resources/db/migration/V11__complete_local_phonetics_catalog.sql',
  'services/content-service/src/main/resources/db/migration/V20__french_phonetics.sql',
];
const migration = await readFile(migrationPath, 'utf8');
const seedTexts = await Promise.all(seedPaths.map((path) => readFile(path, 'utf8')));
const b25Seed = await readFile(
  'services/content-service/src/main/resources/db/migration/V5__add_b25_learner_vocabulary_projection.sql',
  'utf8',
);
const b2Seed = await readFile(
  'services/content-service/src/main/resources/db/migration/V10__create_b2_content_chunks.sql',
  'utf8',
);

function seededB3Rows() {
  const pattern = /\('?(b3-[^']+)',\s*'platform',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*301,\s*'PUBLISHED'/g;
  return seedTexts.flatMap((source) => [...source.matchAll(pattern)].map((match) => ({
    id: match[1],
    domain: match[2],
    type: match[3],
    key: match[4],
  })));
}

function updateBlock(table) {
  const match = migration.match(new RegExp('UPDATE ' + table + '[\\s\\S]*?;', 'i'));
  assert.ok(match, 'migration must contain the ' + table + ' update');
  return match[0];
}

test('B3 migration roster exactly matches all unique V7/V11/V20 source IDs and metadata', () => {
  const rows = seededB3Rows();
  const sourceIds = rows.map((row) => row.id);
  assert.equal(rows.length, 113);
  assert.equal(new Set(sourceIds).size, 113);

  const update = updateBlock('b3_content_experience');
  const roster = update.match(/\(experience_id,\s*domain_code,\s*resource_type,\s*resource_key\)\s+IN\s*\(([\s\S]*?)\s*\)\s*AND content_version_id/i)?.[1];
  assert.ok(roster, 'B3 update must use an explicit ID and source-fact tuple roster');
  const tuplePattern = /\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g;
  const migrationRows = [...roster.matchAll(tuplePattern)].map((match) => ({
    id: match[1],
    domain: match[2],
    type: match[3],
    key: match[4],
  }));
  assert.equal(migrationRows.length, 113);
  assert.equal(new Set(migrationRows.map((row) => row.id)).size, 113);
  assert.equal((roster.match(/\)\s*,\s*\(/g) ?? []).length, 112, 'source tuples must be comma-separated');
  const rowKey = (row) => [row.id, row.domain, row.type, row.key].join('|');
  assert.deepEqual(migrationRows.map(rowKey).sort(), rows.map(rowKey).sort());
});

test('B3 correction is tenant, source, version, payload, status and canonical-binding guarded', () => {
  const update = updateBlock('b3_content_experience');
  for (const guard of [
    /tenant_id\s*=\s*'platform'/i,
    /experience_id\s+LIKE\s+'b3-%'/i,
    /content_version_id\s*=\s*301/i,
    /availability\s*=\s*'PUBLISHED'/i,
    /JSON_UNQUOTE\(JSON_EXTRACT\(payload_json,\s*'\$\.contentVersionId'\)\)\s*=\s*'301'/i,
    /NOT EXISTS\s*\([\s\S]*?FROM content_version[\s\S]*?JOIN content_definition[\s\S]*?current_published_version_id/i,
    /copyright_status\s*=\s*'ACTIVE'/i,
    /rights_allows_learning\s*=\s*TRUE/i,
    /authorization_evidence_ref/i,
    /rights_permitted_channels[\s\S]*?LEARNER/i,
  ]) assert.match(update, guard);
  assert.match(update, /SET availability\s*=\s*'UNPUBLISHED'/i);
  assert.doesNotMatch(update, /DELETE\s+FROM|DROP\s+TABLE|TRUNCATE/i);
});

test('B25 correction targets only the orphan vocabulary seed and preserves any valid owning unit/course', () => {
  const update = updateBlock('b25_content_vocabulary');
  assert.match(
    b25Seed,
    /'b25-item-001',\s*'unit-b25-foundations',\s*'hello',\s*'greeting\.hello',\s*'A1',\s*25001,\s*'PUBLISHED'/,
  );
  for (const guard of [
    /vocabulary_id\s*=\s*'b25-item-001'/i,
    /unit_code\s*=\s*'unit-b25-foundations'/i,
    /word_normalized\s*=\s*'hello'/i,
    /meaning_key\s*=\s*'greeting\.hello'/i,
    /cefr_level\s*=\s*'A1'/i,
    /content_version\s*=\s*25001/i,
    /audio_ref\s*=\s*'fixture\/core-foundation\/audio-placeholder-v1'/i,
    /availability\s*=\s*'PUBLISHED'/i,
    /NOT EXISTS\s*\([\s\S]*?FROM b25_content_unit[\s\S]*?JOIN b25_content_course[\s\S]*?rights_status\s*=\s*'VALID'/i,
  ]) assert.match(update, guard);
  assert.match(update, /owner_course\.content_version_id\s*=\s*b25_content_vocabulary\.content_version/i);
  assert.match(update, /owner_unit\.content_version\s*=\s*b25_content_vocabulary\.content_version/i);
  assert.match(update, /JOIN content_version[\s\S]*?JOIN content_definition/i);
  assert.match(update, /copyright_status\s*=\s*'ACTIVE'/i);
  assert.match(update, /authorization_evidence_ref/i);
  assert.match(update, /rights_permitted_channels[\s\S]*?LEARNER/i);
  assert.match(update, /SET availability\s*=\s*'UNPUBLISHED'/i);
});

test('B2 correction targets only the orphan chunk and requires canonical learner rights to keep it published', () => {
  const update = updateBlock('b2_content_chunk');
  assert.match(
    b2Seed,
    /32001,\s*'platform',\s*'build a habit',\s*'COLLOCATION'[\s\S]*?'DAILY_ROUTINE'[\s\S]*?'25001',\s*'PUBLISHED'/,
  );
  for (const guard of [
    /chunk_id\s*=\s*32001/i,
    /tenant_id\s*=\s*'platform'/i,
    /canonical_text\s*=\s*'build a habit'/i,
    /chunk_type\s*=\s*'COLLOCATION'/i,
    /meaning_cn\s*=\s*'养成一个习惯'/i,
    /scenario_code\s*=\s*'DAILY_ROUTINE'/i,
    /content_version\s*=\s*'25001'/i,
    /availability\s*=\s*'PUBLISHED'/i,
    /NOT EXISTS\s*\([\s\S]*?FROM content_version[\s\S]*?JOIN content_definition[\s\S]*?current_published_version_id/i,
    /copyright_status\s*=\s*'ACTIVE'/i,
    /rights_allows_learning\s*=\s*TRUE/i,
    /authorization_evidence_ref/i,
    /rights_permitted_channels[\s\S]*?LEARNER/i,
  ]) assert.match(update, guard);
  assert.match(update, /SET availability\s*=\s*'UNPUBLISHED'/i);
});

test('all updates are idempotent and only change availability', () => {
  for (const table of ['b3_content_experience', 'b25_content_vocabulary', 'b2_content_chunk']) {
    const update = updateBlock(table);
    assert.match(update, /availability\s*=\s*'PUBLISHED'/i);
    assert.match(update, /SET availability\s*=\s*'UNPUBLISHED'/i);
    assert.doesNotMatch(update, /UPDATE[\s\S]*?SET\s+(?!availability\b)[A-Za-z_]+\s*=/i);
  }
});
