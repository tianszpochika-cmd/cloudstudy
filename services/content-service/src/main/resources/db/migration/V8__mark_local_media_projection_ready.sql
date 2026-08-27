-- V7 is immutable after it has been applied.  The local-real media fixture is
-- now backed by a real MinIO object, so publish that state as a new migration.
UPDATE b3_content_experience
   SET payload_json = REPLACE(payload_json, 'NOT_READY', 'READY'),
       updated_at = CURRENT_TIMESTAMP(3)
 WHERE tenant_id = 'platform'
   AND resource_type IN ('LISTENING_MATERIAL', 'LISTENING_CLIP')
   AND resource_key IN ('3401', '3410')
   AND availability = 'PUBLISHED';
