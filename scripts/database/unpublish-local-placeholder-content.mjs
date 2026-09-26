// Withdraw only named, synthetic 10x content rows that lack publication review.
// Dry-run by default; no deletion or cross-owner status changes.
import { runMysql } from './lib/mysql-client.mjs';

if (process.env.MYSQL_HOST && process.env.MYSQL_HOST !== '127.0.0.1') throw new Error('local MySQL only');
if (process.env.MYSQL_PORT && process.env.MYSQL_PORT !== '13306') throw new Error('local MySQL only');

const experienceTable = 'content_service.b3_content_experience';
const chunkTable = 'content_service.b2_content_chunk';
const experiencePredicate = `availability = 'PUBLISHED'
 AND experience_id LIKE 'local-10x-experience-%'
 AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.fixtureId')) = 'local-real-10x-v1'`;
const chunkPredicate = `availability = 'PUBLISHED'
 AND chunk_id BETWEEN 321001 AND 321010
 AND content_version = 'local-real-10x-v1'`;
const mysqlArgs = [
  '--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '--user', 'root',
  '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw',
];
function mysql(input) {
  return runMysql({
    mysqlBin: process.env.MYSQL_BIN || 'mysql', mysqlArgs,
    password: process.env.MYSQL_ROOT_PASSWORD || 'root-local-only',
    cwd: process.cwd(), input,
  });
}
function counts() {
  const values = mysql(`SELECT COUNT(*) FROM ${experienceTable} WHERE ${experiencePredicate};
SELECT COUNT(*) FROM ${chunkTable} WHERE ${chunkPredicate};\n`).split(/\r?\n/).map(Number);
  if (values.length !== 2 || values.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error('Could not inspect local placeholder content counts');
  }
  return { experiences: values[0], chunks: values[1] };
}

const before = counts();
const apply = process.argv.includes('--apply');
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', before }, null, 2));
if (!apply || (before.experiences === 0 && before.chunks === 0)) process.exit(0);

const changed = mysql(`START TRANSACTION;
UPDATE ${experienceTable} SET availability = 'UNPUBLISHED' WHERE ${experiencePredicate};
SELECT ROW_COUNT();
UPDATE ${chunkTable} SET availability = 'UNPUBLISHED' WHERE ${chunkPredicate};
SELECT ROW_COUNT();
COMMIT;\n`).split(/\r?\n/).map(Number);
const after = counts();
console.log(JSON.stringify({ changed: { experiences: changed[0], chunks: changed[1] }, after }, null, 2));
if (changed[0] !== before.experiences || changed[1] !== before.chunks
    || after.experiences !== 0 || after.chunks !== 0) process.exitCode = 1;
