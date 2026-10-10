// B3 practice fixture for the canonical bank ("供 B3 练").
// Clean-database replay is Flyway V29__seed_b3_practice_bindings.sql (same five
// keys, stems and bindings). This script only delete-then-inserts that set on
// local MySQL. It reads stems/options LIVE from content_placement_item (single
// source of truth) and writes stem-only b3_content_experience rows +
// content_b3_item_binding rows. No answers ever enter B3 payloads; grading
// lives in B10 via the sealed bank. Only GRAMMAR_EXERCISE (3) and
// READING_QUESTION (2) are mapped: listening/vocab bank items need projected
// question endpoints (follow-up). Five rows do not open the learner catalog.
// Local MySQL only. Run: node scripts/database/seed-b3-bank-practice.mjs
import { runMysql } from './lib/mysql-client.mjs';

const TENANT_ID = 'platform';
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = String(process.env.MYSQL_PORT || '13306');
if ((host !== '127.0.0.1' && host !== 'localhost') || port !== '13306') {
  throw new Error(`B3 bank practice 只允许写入本机 MySQL 127.0.0.1:13306；当前为 ${host}:${port}。`);
}
const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const password = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only';
const mysqlArgs = ['--protocol=TCP', '--host', host, '--port', port, '--user',
  process.env.MYSQL_ADMIN_USER || 'root', '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw'];
const db = (sql) => runMysql({ mysqlBin, mysqlArgs, password, cwd: process.cwd(), input: sql + '\n' });
const q = (v) => `'${String(v).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;

// resource mapping: [bankItemId, b3Domain, b3Type, b3Key, payloadKind]
const MAP = [
  [266004, 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-01', 'exercise'],
  [266005, 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-02', 'exercise'],
  [266006, 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-03', 'exercise'],
  [266007, 'READING', 'READING_QUESTION', 'p1-b3-reading-01', 'question'],
  [266008, 'READING', 'READING_QUESTION', 'p1-b3-reading-02', 'question'],
];

const cell = (text) => text.split('\t');
const bankRows = db(`SELECT placement_item_id, dimension, item_code, item_type, stem, options_json, content_version_id FROM content_service.content_placement_item WHERE tenant_id = '${TENANT_ID}' AND bank_code = 'P1_PLACEMENT_V1' AND status = 'PUBLISHED' ORDER BY placement_item_id;`)
  .split('\n').filter(Boolean).map((line) => {
    const [id, dim, code, type, stem, optionsJson, version] = cell(line);
    return { id: Number(id), dim, code, type, stem, options: JSON.parse(optionsJson), version: Number(version) };
  });
if (bankRows.length !== 10) throw new Error(`bank 必须恰好 10 题，当前 ${bankRows.length}。`);

const statements = ['START TRANSACTION;'];
for (const row of MAP.map(([id]) => bankRows.find((r) => r.id === id))) {
  if (!row) throw new Error('bank 缺题：先跑 seed-placement-bank.mjs。');
}
for (const [bankId, domain, type, key, kind] of MAP) {
  const row = bankRows.find((r) => r.id === bankId);
  const options = row.options.map((o) => ({ optionCode: o.optionId, label: o.label }));
  const payload = kind === 'exercise'
    ? { exerciseId: row.id, type: 'CHOICE', promptText: row.stem, options, contentVersionId: row.version, ruleVersion: 'p1-choice-v1', bankItemCode: row.code }
    : { questionId: row.id, stemText: row.stem, options, contentVersionId: row.version, ruleVersion: 'p1-choice-v1', bankItemCode: row.code };
  statements.push(`DELETE FROM content_service.b3_content_experience WHERE tenant_id = '${TENANT_ID}' AND domain_code = '${domain}' AND resource_type = '${type}' AND resource_key = '${key}';`);
  statements.push(`INSERT INTO content_service.b3_content_experience (experience_id, tenant_id, domain_code, resource_type, resource_key, content_version_id, availability, payload_json) VALUES (${q(key)}, '${TENANT_ID}', '${domain}', '${type}', ${q(key)}, ${row.version}, 'PUBLISHED', ${q(JSON.stringify(payload))});`);
  statements.push(`DELETE FROM content_service.content_b3_item_binding WHERE tenant_id = '${TENANT_ID}' AND b3_domain = '${domain}' AND b3_resource_type = '${type}' AND b3_resource_key = ${q(key)};`);
  statements.push(`INSERT INTO content_service.content_b3_item_binding (tenant_id, b3_domain, b3_resource_type, b3_resource_key, b3_experience_id, content_code, content_version_id, question_item_id, status) VALUES ('${TENANT_ID}', '${domain}', '${type}', ${q(key)}, ${q(key)}, 'p1.placement.v1', ${row.version}, '${row.id}', 'ACTIVE');`);
}
statements.push('COMMIT;');
db(statements.join('\n'));
console.log(JSON.stringify({ status: 'SEEDED', fixtureId: 'b3-bank-practice-v1', rows: MAP.length }));
