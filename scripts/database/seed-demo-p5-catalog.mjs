// Demo P5 catalog seed: six synthetic learner-visible catalog entries with full
// LEARNER rights. Mirrors local-real-10x-fixture conventions (local MySQL only,
// stable ids, UTC timestamps). Payloads use only public/learner projection keys
// and carry no answer rules. Run: pnpm db:seed:demo-p5
import { createHash } from 'node:crypto';
import { runMysql } from './lib/mysql-client.mjs';
import { contentPayloadHash } from './local-real-10x-fixture.mjs';

const FIXTURE_ID = 'demo-p5-v1';
const TENANT_ID = 'platform';
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = String(process.env.MYSQL_PORT || '13306');
if ((host !== '127.0.0.1' && host !== 'localhost') || port !== '13306') {
  throw new Error(`demo-p5 只允许写入本机 MySQL 127.0.0.1:13306；当前为 ${host}:${port}。`);
}
const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const password = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only';
const mysqlArgs = ['--protocol=TCP', '--host', host, '--port', port, '--user',
  process.env.MYSQL_ADMIN_USER || 'root', '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw'];

const sha256 = (v) => createHash('sha256').update(String(v)).digest('hex');
const q = (v) => `'${String(v).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
const j = (v) => q(JSON.stringify(v));
const NOW = 'UTC_TIMESTAMP(6)';

const ITEMS = [
  { code: 'DEMO-P5-VOCAB-A1', kind: 'VOCABULARY', title: 'Demo A1 daily words', level: 'A1', payload: { title: 'Demo A1 daily words', summary: 'Five starter words with meanings and examples.', locale: 'en-US', targetLevel: 'A1', items: [{ term: 'about', definition: '关于', example: 'Tell me about your morning.' }, { term: 'morning', definition: '早晨', example: 'Good morning!' }, { term: 'study', definition: '学习', example: 'I study English every day.' }, { term: 'water', definition: '水', example: 'Drink some water.' }, { term: 'book', definition: '书', example: 'This book is mine.' }] } },
  { code: 'DEMO-P5-VOCAB-A2', kind: 'VOCABULARY', title: 'Demo A2 daily words', level: 'A2', payload: { title: 'Demo A2 daily words', summary: 'Five elementary words with meanings and examples.', locale: 'en-US', targetLevel: 'A2', items: [{ term: 'journey', definition: '旅程', example: 'Enjoy your journey.' }, { term: 'culture', definition: '文化', example: 'Food is part of culture.' }, { term: 'accent', definition: '口音', example: 'She speaks with an accent.' }, { term: 'chance', definition: '机会', example: 'Give me a chance.' }, { term: 'reason', definition: '原因', example: 'What is the reason?' }] } },
  { code: 'DEMO-P5-GRAMMAR-A1', kind: 'GRAMMAR', title: 'Demo present simple', level: 'A1', payload: { title: 'Demo present simple', summary: 'Subject plus base verb for habits.', locale: 'en-US', targetLevel: 'A1', rule: 'subject + base verb', explanation: '单数主语使用第三人称单数形式。', examples: ['The learner studies every day.', 'I drink water in the morning.'] } },
  { code: 'DEMO-P5-READ-A2', kind: 'COURSE_UNIT', title: 'Demo morning routine', level: 'A2', payload: { title: 'Demo morning routine', summary: 'A short graded paragraph.', locale: 'en-US', targetLevel: 'A2', blocks: [{ text: 'I wake up at seven.', translation: '我七点起床。' }, { text: 'I study English every morning.', translation: '我每天早晨学英语。' }] } },
  { code: 'DEMO-P5-LISTEN-A2', kind: 'COURSE_UNIT', title: 'Demo listening minute', level: 'A2', payload: { title: 'Demo listening minute', summary: 'One minute of scripted audio text.', locale: 'en-US', targetLevel: 'A2', transcript: 'Good morning. Today we study five new words. Listen and repeat after me.', durationSeconds: 60 } },
  { code: 'DEMO-P5-SENT-B1', kind: 'SENTENCE', title: 'Demo sentence train', level: 'B1', payload: { title: 'Demo sentence train', summary: 'Build one sentence at a time.', locale: 'en-US', targetLevel: 'B1', sentence: 'Study a little every day.', example: 'Study a little every day.' } },
];

const statements = ['START TRANSACTION;'];
// Namespaced delete-then-insert: deterministic re-runs. (ON DUPLICATE KEY
// UPDATE was observed to silently keep stale payload_hash values on this
// table through the batched docker-exec chain, so plain INSERTs are used.)
statements.push(`DELETE FROM content_service.b25_content_course WHERE content_code LIKE 'DEMO-P5-%';`);
statements.push(`DELETE FROM content_service.content_version WHERE content_version_id BETWEEN 265101 AND 265199;`);
statements.push(`DELETE FROM content_service.content_definition WHERE content_id LIKE 'demo-p5-content-%';`);
for (const [i, item] of ITEMS.entries()) {
  const contentId = `demo-p5-content-${i + 1}`;
  const versionId = 265101 + i;
  const payloadJson = JSON.stringify(item.payload);
  const hash = contentPayloadHash(item.payload);
  statements.push(`INSERT INTO content_service.content_definition (content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code, created_by, created_at, current_published_version_id, content_epoch, projection_version) VALUES (${q(contentId)}, ${q(TENANT_ID)}, ${q(item.code)}, ${q(item.kind)}, ${q(item.title)}, 'en-US', ${q(item.level)}, 'DAILY_ENGLISH', 'demo-p5-fixture', ${NOW}, ${versionId}, 1, 1);`);
  statements.push(`INSERT INTO content_service.content_version (content_version_id, content_id, version_no, status, copyright_status, payload_hash, published_at, created_at, kind, payload_json, rights_source_code, rights_license_code, rights_allows_learning, rights_permitted_channels, rights_starts_at, rights_expires_at, authorization_evidence_ref, editor, release_note, first_reviewer, final_reviewer, publisher, archived_at, rollback_of_version_id, first_review_version, final_review_version, state_version) VALUES (${versionId}, ${q(contentId)}, 1, 'PUBLISHED', 'ACTIVE', ${q(hash)}, ${NOW}, ${NOW}, ${q(item.kind)}, ${q(payloadJson)}, 'LOCAL_FIXTURE', 'LOCAL_FIXTURE', TRUE, ${q(JSON.stringify(['LEARNER', 'PUBLIC']))}, ${NOW}, NULL, 'demo-p5-authorization', 'demo-p5-editor', 'demo-p5 release', 'demo-p5-reviewer-1', 'demo-p5-reviewer-2', 'demo-p5-publisher', NULL, NULL, 1, 1, 1);`);
  statements.push(`INSERT INTO content_service.b25_content_course (content_code, tenant_id, content_type, title, summary, content_locale, target_level, content_version_id, availability, rights_status, definition_json, published_at, updated_at) VALUES (${q(item.code)}, ${q(TENANT_ID)}, 'COURSE', ${q(item.title)}, ${q(item.payload.summary)}, 'en-US', ${q(item.level)}, ${versionId}, 'PUBLISHED', 'VALID', ${j({ fixtureId: FIXTURE_ID, courseCode: item.code })}, ${NOW}, ${NOW});`);
}
statements.push('COMMIT;');
runMysql({ mysqlBin, mysqlArgs, password, cwd: process.cwd(), input: statements.join('\n') + '\n' });
console.log(JSON.stringify({ status: 'SEEDED', fixtureId: FIXTURE_ID, items: ITEMS.length }));
