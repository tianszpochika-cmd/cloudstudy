-- Content-ops 2026-10-13 (Luna sign-off condition): turn the legacy phonetics catalog
-- (V7/V11/V12/V20 rows in b3_content_experience, content_version_id 301, unpublished by V23)
-- into editable content_item DRAFTs so the admin phonetics maintenance flow can review them.
--
-- Guarantees:
--   * DRAFT only: no APPROVED/PUBLISHED rows, no reviewer/publisher columns set.
--   * No learner projection: b3_content_experience is only READ here; the legacy rows keep
--     their V23 availability, and no 'b3-phonetics-item-*' row is written.
--   * No placeholder version: contentVersionId (301) is stripped from the copied payload; the
--     pack definitions are created without any version (current_published_version_id NULL),
--     so JdbcPhoneticsCatalog keeps answering PACK_NOT_PUBLISHED until a real, rights-checked
--     pack version is published through the content workbench.
--   * Controlled rights codes on every row: SOURCE-PLATFORM-PHONETICS / LICENSE-INTERNAL-REF.
--   * Idempotent: INSERT IGNORE on stable ids (legacy-phoneme-{key}, legacy-pair-{key});
--     pack definitions are inserted only when the code is missing.
--   * utf8mb4: IPA symbols are copied with JSON functions from the utf8mb4 source table.

INSERT IGNORE INTO content_definition
    (content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code,
     created_by, created_at, current_published_version_id, content_epoch, projection_version, state_version)
SELECT pack.code, 'platform', pack.code, 'VOCABULARY', pack.title, pack.locale, 'A1', 'PHASE1',
       'legacy-phonetics-backfill', CURRENT_TIMESTAMP(6), NULL, 0, 0, 0
  FROM (SELECT 'PHONETICS' AS code, 'English phonetics library' AS title, 'en-US' AS locale
        UNION ALL
        SELECT 'PHONETICS-FR', 'Bibliothèque phonétique française', 'fr-FR') pack
 WHERE NOT EXISTS (SELECT 1 FROM content_definition existing
                    WHERE existing.tenant_id = 'platform' AND existing.content_code = pack.code);

-- Phonemes: symbol becomes the stem; the old phonemeId stays in fields for traceability.
INSERT IGNORE INTO content_item
    (item_id, tenant_id, pack_code, kind, stem, availability, state_version,
     created_by, updated_by, first_reviewer, final_reviewer, publisher,
     source_code, license_code, fields_json, created_at, updated_at)
SELECT CONCAT('legacy-phoneme-', legacy.resource_key), 'platform', legacy.domain_code, 'PHONEME',
       JSON_UNQUOTE(JSON_EXTRACT(legacy.payload_json, '$.symbol')), 'DRAFT', 1,
       'legacy-phonetics-backfill', 'legacy-phonetics-backfill', NULL, NULL, NULL,
       'SOURCE-PLATFORM-PHONETICS', 'LICENSE-INTERNAL-REF',
       JSON_SET(JSON_REMOVE(legacy.payload_json, '$.contentVersionId'),
                '$.legacyExperienceId', legacy.experience_id),
       CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
  FROM b3_content_experience legacy
 WHERE legacy.tenant_id = 'platform'
   AND legacy.domain_code IN ('PHONETICS', 'PHONETICS-FR')
   AND legacy.resource_type = 'PHONEME'
   AND legacy.experience_id NOT LIKE 'b3-phonetics-item-%'
   AND JSON_VALID(legacy.payload_json)
   AND CHAR_LENGTH(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(legacy.payload_json, '$.symbol')), '')) BETWEEN 1 AND 16
   AND JSON_UNQUOTE(JSON_EXTRACT(legacy.payload_json, '$.group')) REGEXP BINARY '^[A-Z][A-Z_]{1,31}$';

-- Minimal pairs: keep pairId / leftPhonemeId / rightPhonemeId and add the new item references.
INSERT IGNORE INTO content_item
    (item_id, tenant_id, pack_code, kind, stem, availability, state_version,
     created_by, updated_by, first_reviewer, final_reviewer, publisher,
     source_code, license_code, fields_json, created_at, updated_at)
SELECT CONCAT('legacy-pair-', legacy.resource_key), 'platform', legacy.domain_code, 'MINIMAL_PAIR',
       CONCAT(JSON_UNQUOTE(JSON_EXTRACT(legacy.payload_json, '$.leftWord')), ' / ',
              JSON_UNQUOTE(JSON_EXTRACT(legacy.payload_json, '$.rightWord'))),
       'DRAFT', 1,
       'legacy-phonetics-backfill', 'legacy-phonetics-backfill', NULL, NULL, NULL,
       'SOURCE-PLATFORM-PHONETICS', 'LICENSE-INTERNAL-REF',
       JSON_SET(JSON_REMOVE(legacy.payload_json, '$.contentVersionId'),
                '$.leftItemId', CONCAT('legacy-phoneme-', JSON_EXTRACT(legacy.payload_json, '$.leftPhonemeId')),
                '$.rightItemId', CONCAT('legacy-phoneme-', JSON_EXTRACT(legacy.payload_json, '$.rightPhonemeId')),
                '$.legacyExperienceId', legacy.experience_id),
       CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
  FROM b3_content_experience legacy
 WHERE legacy.tenant_id = 'platform'
   AND legacy.domain_code IN ('PHONETICS', 'PHONETICS-FR')
   AND legacy.resource_type = 'MINIMAL_PAIR'
   AND legacy.experience_id NOT LIKE 'b3-phonetics-item-%'
   AND JSON_VALID(legacy.payload_json)
   AND CHAR_LENGTH(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(legacy.payload_json, '$.leftWord')), '')) BETWEEN 1 AND 64
   AND CHAR_LENGTH(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(legacy.payload_json, '$.rightWord')), '')) BETWEEN 1 AND 64;
