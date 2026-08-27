/*
 * The first B3 phonetics migration inserted two IPA values through a
 * connection that treated UTF-8 bytes as latin1 characters.  Keep the
 * repair byte-based so it is independent of the migration client's locale.
 */
UPDATE b3_content_experience
   SET payload_json = JSON_SET(payload_json, '$.symbol', CONVERT(0x69CB90 USING utf8mb4))
 WHERE tenant_id = 'platform'
   AND domain_code = 'PHONETICS'
   AND resource_type = 'PHONEME'
   AND resource_key = '3601';

UPDATE b3_content_experience
   SET payload_json = JSON_SET(payload_json, '$.symbol', CONVERT(0xC9AA USING utf8mb4))
 WHERE tenant_id = 'platform'
   AND domain_code = 'PHONETICS'
   AND resource_type = 'PHONEME'
   AND resource_key = '3603';
