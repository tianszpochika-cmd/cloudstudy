// P1 placement bank seed: ten sealed items (3V/3G/2R/2L) with ACTIVE rights.
// kind='QUESTION' (parseable by ContentKind; the bank IS a question bank) and
// rights channels='["SEALED"]' (the sealed internal endpoint is the only
// outlet: LEARNER/PUBLIC projections 403-skip instead of leaking a bogus
// catalog card; a bogus 'PLACEMENT_BANK' kind used here before 2026-09-27
// broke ContentKind.valueOf and turned /content/learner/catalog into a 500).
// Local MySQL only, stable ids, UTC timestamps, delete-then-insert (deterministic).
// Run: node scripts/database/seed-placement-bank.mjs
import { runMysql } from './lib/mysql-client.mjs';
import { contentPayloadHash } from './local-real-10x-fixture.mjs';

const TENANT_ID = 'platform';
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = String(process.env.MYSQL_PORT || '13306');
if ((host !== '127.0.0.1' && host !== 'localhost') || port !== '13306') {
  throw new Error(`placement bank 只允许写入本机 MySQL 127.0.0.1:13306；当前为 ${host}:${port}。`);
}
const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const password = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only';
const mysqlArgs = ['--protocol=TCP', '--host', host, '--port', port, '--user',
  process.env.MYSQL_ADMIN_USER || 'root', '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw'];

const q = (v) => `'${String(v).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
const j = (v) => q(JSON.stringify(v));
const NOW = 'UTC_TIMESTAMP(6)';
const BANK_VERSION_ID = 266100;
const BANK_CODE = 'p1.placement.v1';
const O3 = (a, b, c) => [{ optionId: 'a', label: a }, { optionId: 'b', label: b }, { optionId: 'c', label: c }];

// [id, dimension, itemType, itemCode, stem, options, correct]
const ITEMS = [
  [266001, 'VOCABULARY', 'VOCABULARY', 'p1.place.vocab.01', "Choose the word closest in meaning to 'happy'.", O3('glad', 'angry', 'tired'), 'a'],
  [266002, 'VOCABULARY', 'VOCABULARY', 'p1.place.vocab.02', "Choose the word closest in meaning to 'quick'.", O3('slow', 'fast', 'late'), 'b'],
  [266003, 'VOCABULARY', 'VOCABULARY', 'p1.place.vocab.03', "Choose the word closest in meaning to 'begin'.", O3('start', 'finish', 'stop'), 'a'],
  [266004, 'BASIC_GRAMMAR', 'GRAMMAR', 'p1.place.grammar.01', 'She ___ to school every day.', O3('go', 'goes', 'going'), 'b'],
  [266005, 'BASIC_GRAMMAR', 'GRAMMAR', 'p1.place.grammar.02', 'There ___ two books on the desk.', O3('is', 'are', 'am'), 'b'],
  [266006, 'BASIC_GRAMMAR', 'GRAMMAR', 'p1.place.grammar.03', "I usually have breakfast ___ seven o'clock.", O3('in', 'on', 'at'), 'c'],
  [266007, 'READING', 'READING', 'p1.place.reading.01', 'Li Lei gets up at six thirty. He eats breakfast at seven. Then he walks to school. What time does Li Lei get up?', O3('six thirty', 'seven', 'eight'), 'a'],
  [266008, 'READING', 'READING', 'p1.place.reading.02', 'The library is quiet. Students read books there every afternoon. Where do students read books?', O3('at home', 'in the library', 'at school'), 'b'],
  [266009, 'LISTENING', 'LISTENING', 'p1.place.listening.01', '读下面这段话并作答：Good morning. The train leaves at nine. Please be on time. What time does the train leave?', O3('eight', 'nine', 'ten'), 'b'],
  [266010, 'LISTENING', 'LISTENING', 'p1.place.listening.02', '读下面这段话并作答：It is sunny today. We play football after school. What do they do after school?', O3('swim', 'play football', 'read'), 'b'],
];

const statements = ['START TRANSACTION;'];
statements.push(`DELETE FROM content_service.content_placement_item WHERE tenant_id = '${TENANT_ID}' AND bank_code = 'P1_PLACEMENT_V1';`);
statements.push(`DELETE FROM content_service.content_version WHERE content_version_id = ${BANK_VERSION_ID};`);
statements.push(`DELETE FROM content_service.content_definition WHERE content_id = 'p1-placement-bank-v1';`);
// The version row must satisfy the same rehydrate contract as every stored
// version (parseable kind, non-empty payload, matching payload_hash): it is a
// real version fact whose items live in content_placement_item, not a dummy.
// kinds: 'QUESTION' would demand embedded answer rules; 'COURSE' carries only
// honest pointer metadata. Channels 'SEALED' keep it out of LEARNER/PUBLIC
// projections (403-skip) since the sealed endpoint is the only outlet.
const BANK_PAYLOAD = {
  title: 'P1 placement bank v1',
  summary: 'Sealed ten-item P1 placement bank (3/3/2/2). Items live in content_placement_item; served only via /internal/v1/content/placement-bank/sealed.',
  locale: 'en-US',
  targetLevel: 'A1',
  bank: 'P1_PLACEMENT_V1',
  sealedItems: 'content_placement_item',
  servedBy: '/internal/v1/content/placement-bank/sealed',
  items: ITEMS.map(([id, dim, type, code], n) => ({ itemId: id, itemCode: code, dimension: dim, displayOrder: n + 1 })),
};
const BANK_HASH = contentPayloadHash(BANK_PAYLOAD);
statements.push(`INSERT INTO content_service.content_definition (content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code, created_by, created_at, current_published_version_id, content_epoch, projection_version) VALUES ('p1-placement-bank-v1', '${TENANT_ID}', '${BANK_CODE}', 'COURSE', 'P1 placement bank v1', 'en-US', 'A1', 'DAILY_ENGLISH', 'placement-bank-fixture', ${NOW}, ${BANK_VERSION_ID}, 1, 1);`);
statements.push(`INSERT INTO content_service.content_version (content_version_id, content_id, version_no, status, copyright_status, payload_hash, published_at, created_at, kind, payload_json, rights_source_code, rights_license_code, rights_allows_learning, rights_permitted_channels, rights_starts_at, rights_expires_at, authorization_evidence_ref, editor, release_note, first_reviewer, final_reviewer, publisher, archived_at, rollback_of_version_id, first_review_version, final_review_version, state_version) VALUES (${BANK_VERSION_ID}, 'p1-placement-bank-v1', 1, 'PUBLISHED', 'ACTIVE', '${BANK_HASH}', ${NOW}, ${NOW}, 'COURSE', ${j(BANK_PAYLOAD)}, 'LOCAL_FIXTURE', 'LOCAL_FIXTURE', TRUE, ${q(JSON.stringify(['SEALED']))}, ${NOW}, NULL, 'placement-bank-authorization', 'placement-bank-editor', 'p1 bank release', 'placement-bank-reviewer-1', 'placement-bank-reviewer-2', 'placement-bank-publisher', NULL, NULL, 1, 1, 1);`);
ITEMS.forEach(([id, dim, type, code, stem, options, correct], n) => {
  statements.push(`INSERT INTO content_service.content_placement_item (placement_item_id, tenant_id, bank_code, dimension, display_order, item_code, item_type, stem, options_json, answer_rule_json, question_type, scoring_version, max_score, content_version_id, content_code, copyright_status, rights_allows_learning, status, created_at) VALUES (${id}, '${TENANT_ID}', 'P1_PLACEMENT_V1', '${dim}', ${n + 1}, ${q(code)}, '${type}', ${q(stem)}, ${j(options)}, ${j({ correctOption: correct })}, 'CHOICE', 'p1-choice-v1', 10, ${BANK_VERSION_ID}, '${BANK_CODE}', 'ACTIVE', TRUE, 'PUBLISHED', ${NOW});`);
});
statements.push('COMMIT;');
runMysql({ mysqlBin, mysqlArgs, password, cwd: process.cwd(), input: statements.join('\n') + '\n' });
console.log(JSON.stringify({ status: 'SEEDED', fixtureId: 'placement-bank-v1', items: ITEMS.length }));
