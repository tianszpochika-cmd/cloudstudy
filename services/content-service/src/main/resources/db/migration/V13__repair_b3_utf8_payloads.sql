/*
 * V7 seeded the B3 JSON fixtures through a connection with an incorrect
 * character-set boundary.  The affected Chinese strings were stored as
 * UTF-8 bytes decoded as latin1 and then encoded a second time (for example
 * "规则" became the mojibake byte sequence C3A8...).  Repair only the known
 * localized JSON paths; English content and structural fields must remain
 * byte-for-byte unchanged.
 *
 * The conversion is intentionally byte-based and independent of the
 * migration client's locale.  The HEX guards make each update safe if a
 * local database is replayed against an already repaired row.
 */

UPDATE b3_content_experience
   SET payload_json = JSON_SET(
       payload_json,
       '$.title', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title')) USING latin1) AS BINARY) USING utf8mb4),
       '$.meaningCn', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.meaningCn')) USING latin1) AS BINARY) USING utf8mb4),
       '$.trapTags[0]', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.trapTags[0]')) USING latin1) AS BINARY) USING utf8mb4),
       '$.trapTags[1]', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.trapTags[1]')) USING latin1) AS BINARY) USING utf8mb4)
   )
 WHERE tenant_id = 'platform'
   AND domain_code = 'GRAMMAR'
   AND resource_type = 'GRAMMAR_POINT'
   AND resource_key IN ('3101', '3103')
   AND (
       HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title'))) LIKE 'C3%'
       OR HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.meaningCn'))) LIKE 'C3%'
       OR HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.trapTags[0]'))) LIKE 'C3%'
       OR HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.trapTags[1]'))) LIKE 'C3%'
   );

UPDATE b3_content_experience
   SET payload_json = JSON_SET(
       payload_json,
       '$.translation', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.translation')) USING latin1) AS BINARY) USING utf8mb4)
   )
 WHERE tenant_id = 'platform'
   AND domain_code = 'GRAMMAR'
   AND resource_type = 'SENTENCE'
   AND resource_key = '3201'
   AND HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.translation'))) LIKE 'C3%';

UPDATE b3_content_experience
   SET payload_json = JSON_SET(
       payload_json,
       '$.title', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title')) USING latin1) AS BINARY) USING utf8mb4),
       '$.taskText', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.taskText')) USING latin1) AS BINARY) USING utf8mb4)
   )
 WHERE tenant_id = 'platform'
   AND domain_code = 'WRITING'
   AND resource_type = 'WRITING_PROMPT'
   AND resource_key = '3301'
   AND (
       HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title'))) LIKE 'C3%'
       OR HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.taskText'))) LIKE 'C3%'
   );

UPDATE b3_content_experience
   SET payload_json = JSON_SET(
       payload_json,
       '$.title', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title')) USING latin1) AS BINARY) USING utf8mb4)
   )
 WHERE tenant_id = 'platform'
   AND domain_code = 'WRITING'
   AND resource_type = 'WRITING_PROMPT'
   AND resource_key = '3303'
   AND HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title'))) LIKE 'C3%';

UPDATE b3_content_experience
   SET payload_json = JSON_SET(
       payload_json,
       '$.title', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title')) USING latin1) AS BINARY) USING utf8mb4),
       '$.structure[0].label', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.structure[0].label')) USING latin1) AS BINARY) USING utf8mb4),
       '$.structure[1].label', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.structure[1].label')) USING latin1) AS BINARY) USING utf8mb4),
       '$.structure[2].label', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.structure[2].label')) USING latin1) AS BINARY) USING utf8mb4),
       '$.structure[3].label', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.structure[3].label')) USING latin1) AS BINARY) USING utf8mb4)
   )
 WHERE tenant_id = 'platform'
   AND domain_code = 'WRITING'
   AND resource_type = 'WRITING_TEMPLATE'
   AND resource_key = '3901'
   AND (
       HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title'))) LIKE 'C3%'
       OR HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.structure[0].label'))) LIKE 'C3%'
       OR HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.structure[1].label'))) LIKE 'C3%'
       OR HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.structure[2].label'))) LIKE 'C3%'
       OR HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.structure[3].label'))) LIKE 'C3%'
   );

UPDATE b3_content_experience
   SET payload_json = JSON_SET(
       payload_json,
       '$.title', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title')) USING latin1) AS BINARY) USING utf8mb4)
   )
 WHERE tenant_id = 'platform'
   AND domain_code = 'WRITING'
   AND resource_type = 'WRITING_MATERIAL'
   AND resource_key = '3910'
   AND HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.title'))) LIKE 'C3%';

UPDATE b3_content_experience
   SET payload_json = JSON_SET(
       payload_json,
       '$.explanation', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.explanation')) USING latin1) AS BINARY) USING utf8mb4)
   )
 WHERE tenant_id = 'platform'
   AND domain_code = 'WRITING'
   AND resource_type = 'PROOFREADING'
   AND resource_key = '3920'
   AND HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.explanation'))) LIKE 'C3%';

UPDATE b3_content_experience
   SET payload_json = JSON_SET(
       payload_json,
       '$.segments[0].translation', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.segments[0].translation')) USING latin1) AS BINARY) USING utf8mb4),
       '$.segments[0].annotations[0].label', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.segments[0].annotations[0].label')) USING latin1) AS BINARY) USING utf8mb4)
   )
 WHERE tenant_id = 'platform'
   AND domain_code = 'LISTENING'
   AND resource_type = 'LISTENING_MATERIAL'
   AND resource_key = '3401'
   AND (
       HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.segments[0].translation'))) LIKE 'C3%'
       OR HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.segments[0].annotations[0].label'))) LIKE 'C3%'
   );

UPDATE b3_content_experience
   SET payload_json = JSON_SET(
       payload_json,
       '$.blocks[0].translation', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.blocks[0].translation')) USING latin1) AS BINARY) USING utf8mb4),
       '$.blocks[1].translation', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.blocks[1].translation')) USING latin1) AS BINARY) USING utf8mb4)
   )
 WHERE tenant_id = 'platform'
   AND domain_code = 'READING'
   AND resource_type = 'READING_ARTICLE'
   AND resource_key = '3501'
   AND (
       HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.blocks[0].translation'))) LIKE 'C3%'
       OR HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.blocks[1].translation'))) LIKE 'C3%'
   );

UPDATE b3_content_experience
   SET payload_json = JSON_SET(
       payload_json,
       '$.meaningCn', CONVERT(CAST(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.meaningCn')) USING latin1) AS BINARY) USING utf8mb4)
   )
 WHERE tenant_id = 'platform'
   AND domain_code = 'READING'
   AND resource_type = 'DICTIONARY_ENTRY'
   AND resource_key = '3501:small'
   AND HEX(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.meaningCn'))) LIKE 'C3%';
