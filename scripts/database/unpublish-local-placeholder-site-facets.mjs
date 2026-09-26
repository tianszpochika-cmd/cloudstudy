// Hide only identified local test placeholders from the public site projection.
// Dry-run by default and restricted to the local MySQL owner schema.
import { runMysql } from './lib/mysql-client.mjs';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

if (process.env.MYSQL_HOST && process.env.MYSQL_HOST !== '127.0.0.1') {
  throw new Error('local MySQL only');
}
if (process.env.MYSQL_PORT && process.env.MYSQL_PORT !== '13306') {
  throw new Error('local MySQL only');
}

const table = 'content_service.content_public_site_facet';
const unpublishPredicate = `status = 'PUBLISHED' AND (
  (facet_id LIKE 'local-10x-facet-%'
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.fixtureId')) = 'local-real-10x-v1')
  OR (facet_id = 'announcement-local-phase1-runtime'
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.announcementCode')) = 'announcement-local-phase1-runtime'
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title')) IN
      ('本地 Phase 1 真实运行态已就绪', 'Local Phase 1 runtime is ready'))
  OR (facet_type = 'ANNOUNCEMENT' AND ui_locale = 'en-US'
    AND facet_id LIKE 'bulk-100x-content_public_sit-facet-%'
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.fixtureId')) = 'bulk-100x-v1'
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.seed')) = 'bulk-100x'
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.table')) = 'content_public_site_facet'
    AND JSON_EXTRACT(payload_json, '$.title') IS NULL
    AND JSON_EXTRACT(payload_json, '$.announcementCode') IS NULL)
  OR (facet_type = 'COMPLIANCE' AND status = 'PUBLISHED'
    AND facet_id = 'compliance-privacy-data'
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.noticeCode')) = 'compliance-privacy-data'
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title')) IN ('隐私与数据处理', 'Privacy and data processing')
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.version')) IN ('公开说明', 'Public notice')
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.body')) IN (
      '官网仅展示公开信息，不收集登录后学习数据，不在公开页面提交密码、Token、录音或支付凭证。',
      'The official site exposes public information only. It does not submit learning data, passwords, tokens, recordings or payment credentials.'))
  OR (facet_type = 'COMPLIANCE' AND status = 'PUBLISHED'
    AND facet_id = 'compliance-adult-phase-boundary'
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.noticeCode')) = 'compliance-adult-phase-boundary'
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title')) IN ('成人阶段边界', 'Adult Phase 1 boundary')
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.version')) = 'Phase 1'
    AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.body')) IN (
      '当前产品面向成年用户与大学生；K12、儿童账号、监护绑定及未成年人支付能力在专项合规 Gate 前不会开放。',
      'The current product targets adults and university students. K12, child accounts, guardian binding and minor payments remain closed until a dedicated compliance gate passes.'))
)`;
const seededLoopbackWebPredicate = `facet_id = 'download-learner-web'
  AND ui_locale IN ('zh-CN', 'en-US') AND facet_type = 'DOWNLOAD' AND status = 'PUBLISHED'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.platform')) = 'WEB'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.status')) = 'AVAILABLE'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.downloadUrl')) = 'http://127.0.0.1:18182/start'`;
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
function selected() {
  const rows = mysql(`SELECT 'UNPUBLISH', facet_id, ui_locale, facet_type FROM ${table} WHERE ${unpublishPredicate}
UNION ALL
SELECT 'WEB_UNAVAILABLE', facet_id, ui_locale, facet_type FROM ${table} WHERE ${seededLoopbackWebPredicate}
ORDER BY 2, 3, 1;\n`);
  return rows ? rows.split(/\r?\n/).map((line) => line.split('\t')) : [];
}

const before = selected();
const apply = process.argv.includes('--apply');
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', count: before.length, rows: before }, null, 2));
if (!apply || before.length === 0) process.exit(0);

const backupArgument = process.argv.find((argument) => argument.startsWith('--backup-file='));
const backupFile = backupArgument?.slice('--backup-file='.length);
if (!backupFile || !path.isAbsolute(backupFile)) {
  throw new Error('--apply requires an absolute --backup-file path');
}
const originals = mysql(`SELECT JSON_OBJECT(
  'facetId', facet_id, 'uiLocale', ui_locale, 'facetType', facet_type,
  'status', status, 'payloadJson', payload_json,
  'updatedAt', DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s.%f'))
FROM ${table}
WHERE ${unpublishPredicate} OR (${seededLoopbackWebPredicate})
ORDER BY facet_id, ui_locale;\n`).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
if (originals.length !== before.length) throw new Error('backup row count differs from selected rows');
const backup = `${JSON.stringify({ capturedAt: new Date().toISOString(), table, rows: originals }, null, 2)}\n`;
writeFileSync(backupFile, backup, { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ backupFile, backupSha256: createHash('sha256').update(backup).digest('hex'),
  backupRows: originals.length }));

const updateCounts = mysql(`START TRANSACTION;
UPDATE ${table} SET status = 'UNPUBLISHED', updated_at = UTC_TIMESTAMP(6) WHERE ${unpublishPredicate};
SET @unpublished_rows = ROW_COUNT();
UPDATE ${table}
   SET payload_json = JSON_REMOVE(JSON_SET(payload_json, '$.status', 'UNAVAILABLE'), '$.downloadUrl'),
       updated_at = UTC_TIMESTAMP(6)
 WHERE ${seededLoopbackWebPredicate};
SET @web_rows = ROW_COUNT();
SELECT @unpublished_rows, @web_rows;
COMMIT;\n`).trim().split('\t').map(Number);
const remaining = selected();
const changed = updateCounts.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
console.log(JSON.stringify({ changed, remaining }, null, 2));
if (updateCounts.length !== 2 || changed !== before.length || remaining.length) process.exitCode = 1;
