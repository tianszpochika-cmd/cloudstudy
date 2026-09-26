// Read-only local audit. No learner payloads, contact details or credentials are printed.
import { runMysql } from '../../scripts/database/lib/mysql-client.mjs'

const host = process.env.MYSQL_HOST || '127.0.0.1'
const port = process.env.MYSQL_PORT || '13306'
if (host !== '127.0.0.1' || port !== '13306') throw new Error('local MySQL only')
const args = ['--protocol=TCP', '--host', host, '--port', port, '--user',
  process.env.MYSQL_ADMIN_USER || 'root', '--default-character-set=utf8mb4',
  '--batch', '--skip-column-names', '--raw']
const password = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only'
const query = `
SELECT 'TYPE', resource_type, COUNT(*),
       SUM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.fixtureId')), '') = 'local-real-10x-v1'),
       MIN(content_version_id), MAX(content_version_id)
  FROM content_service.b3_content_experience
 WHERE availability = 'PUBLISHED'
 GROUP BY resource_type ORDER BY resource_type;
SELECT 'AVAILABILITY', availability, COUNT(*)
  FROM content_service.b3_content_experience
 GROUP BY availability ORDER BY availability;
SELECT 'PIN_STATUS', e.content_version_id, COUNT(*),
       COUNT(v.content_version_id),
       SUM(v.status = 'PUBLISHED'),
       SUM(d.current_published_version_id = e.content_version_id),
       SUM(v.rights_allows_learning = 1)
  FROM content_service.b3_content_experience e
  LEFT JOIN content_service.content_version v ON v.content_version_id = e.content_version_id
  LEFT JOIN content_service.content_definition d ON d.content_id = v.content_id
 WHERE e.availability = 'PUBLISHED'
 GROUP BY e.content_version_id;
SELECT 'RIGHTS_FIELD', COUNT(*),
       SUM(JSON_EXTRACT(payload_json, '$.rightsStatus') IS NOT NULL),
       SUM(JSON_EXTRACT(payload_json, '$.mediaRef.availability') IS NOT NULL)
  FROM content_service.b3_content_experience
 WHERE availability = 'PUBLISHED';
SELECT 'ROW', experience_id, resource_type, resource_key,
       COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.fixtureId')), ''), content_version_id
  FROM content_service.b3_content_experience
 WHERE availability = 'PUBLISHED' AND resource_type NOT IN ('PHONEME', 'MINIMAL_PAIR')
 ORDER BY resource_type, experience_id;
SELECT 'COLUMN', table_schema, table_name, column_name
  FROM information_schema.columns
 WHERE table_schema IN ('learning_service', 'assessment_service', 'learner_service')
   AND (column_name REGEXP 'content|resource|material|article|prompt|exercise|item|version'
        OR table_name REGEXP 'b3_|b10_')
 ORDER BY table_schema, table_name, ordinal_position;
SELECT 'LEARNING_REF', domain_code, action_code, resource_key, COUNT(*)
  FROM learning_service.b3_learning_interaction
 GROUP BY domain_code, action_code, resource_key ORDER BY domain_code, action_code, resource_key;
SELECT 'ASSESSMENT_REF', content_code, content_version_id, COUNT(*)
  FROM assessment_service.b10_assessment_session
 GROUP BY content_code, content_version_id ORDER BY content_code, content_version_id;
SELECT 'TASK_REF', content_code, COUNT(*)
  FROM learner_service.b25_learner_daily_task
 GROUP BY content_code ORDER BY content_code;
`
console.log(runMysql({ mysqlBin: process.env.MYSQL_BIN || 'mysql', mysqlArgs: args,
  password, cwd: process.cwd(), input: query }))
