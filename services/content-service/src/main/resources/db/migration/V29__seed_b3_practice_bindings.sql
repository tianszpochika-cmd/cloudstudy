-- V29: automatic B3 practice bindings (R1-026 / BC-021).
-- Same five rows as scripts/database/seed-b3-bank-practice.mjs: three
-- GRAMMAR_EXERCISE and two READING_QUESTION, pinned to placement items
-- 266004-266008 on the existing content_b3_item_binding table. No second
-- binding table. Payloads are stems and options only; answer_rule_json stays
-- in content_placement_item and is not copied. The owning version stays
-- SEALED, not LEARNER, so these five rows do not open the C9 learner catalog.
-- INSERT IGNORE keeps a repair that already wrote these keys from failing.

INSERT IGNORE INTO b3_content_experience (
    experience_id, tenant_id, domain_code, resource_type, resource_key,
    content_version_id, availability, payload_json
) VALUES
('p1-b3-grammar-01', 'platform', 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-01', 266100, 'PUBLISHED',
 '{"exerciseId":266004,"type":"CHOICE","promptText":"She ___ to school every day.","options":[{"optionCode":"a","label":"go"},{"optionCode":"b","label":"goes"},{"optionCode":"c","label":"going"}],"contentVersionId":266100,"ruleVersion":"p1-choice-v1","bankItemCode":"p1.place.grammar.01"}'),
('p1-b3-grammar-02', 'platform', 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-02', 266100, 'PUBLISHED',
 '{"exerciseId":266005,"type":"CHOICE","promptText":"There ___ two books on the desk.","options":[{"optionCode":"a","label":"is"},{"optionCode":"b","label":"are"},{"optionCode":"c","label":"am"}],"contentVersionId":266100,"ruleVersion":"p1-choice-v1","bankItemCode":"p1.place.grammar.02"}'),
('p1-b3-grammar-03', 'platform', 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-03', 266100, 'PUBLISHED',
 '{"exerciseId":266006,"type":"CHOICE","promptText":"I usually have breakfast ___ seven o''clock.","options":[{"optionCode":"a","label":"in"},{"optionCode":"b","label":"on"},{"optionCode":"c","label":"at"}],"contentVersionId":266100,"ruleVersion":"p1-choice-v1","bankItemCode":"p1.place.grammar.03"}'),
('p1-b3-reading-01', 'platform', 'READING', 'READING_QUESTION', 'p1-b3-reading-01', 266100, 'PUBLISHED',
 '{"questionId":266007,"stemText":"Li Lei gets up at six thirty. He eats breakfast at seven. Then he walks to school. What time does Li Lei get up?","options":[{"optionCode":"a","label":"six thirty"},{"optionCode":"b","label":"seven"},{"optionCode":"c","label":"eight"}],"contentVersionId":266100,"ruleVersion":"p1-choice-v1","bankItemCode":"p1.place.reading.01"}'),
('p1-b3-reading-02', 'platform', 'READING', 'READING_QUESTION', 'p1-b3-reading-02', 266100, 'PUBLISHED',
 '{"questionId":266008,"stemText":"The library is quiet. Students read books there every afternoon. Where do students read books?","options":[{"optionCode":"a","label":"at home"},{"optionCode":"b","label":"in the library"},{"optionCode":"c","label":"at school"}],"contentVersionId":266100,"ruleVersion":"p1-choice-v1","bankItemCode":"p1.place.reading.02"}');

INSERT IGNORE INTO content_b3_item_binding (
    tenant_id, b3_domain, b3_resource_type, b3_resource_key, b3_experience_id,
    content_code, content_version_id, question_item_id, status
) VALUES
('platform', 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-01', 'p1-b3-grammar-01', 'p1.placement.v1', 266100, '266004', 'ACTIVE'),
('platform', 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-02', 'p1-b3-grammar-02', 'p1.placement.v1', 266100, '266005', 'ACTIVE'),
('platform', 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-03', 'p1-b3-grammar-03', 'p1.placement.v1', 266100, '266006', 'ACTIVE'),
('platform', 'READING', 'READING_QUESTION', 'p1-b3-reading-01', 'p1-b3-reading-01', 'p1.placement.v1', 266100, '266007', 'ACTIVE'),
('platform', 'READING', 'READING_QUESTION', 'p1-b3-reading-02', 'p1-b3-reading-02', 'p1.placement.v1', 266100, '266008', 'ACTIVE');

-- Fail the migration (check constraint) unless the five dry rows match the
-- live placement stems, carry no answer keys, and the placement bank is still
-- the untouched 10-row SEALED set. Counts are taken first so the guard insert
-- does not read its own target table. A correct seed inserts nothing here.
SET @r1_026_bindings = (
    SELECT COUNT(*) FROM content_b3_item_binding
     WHERE tenant_id = 'platform' AND status = 'ACTIVE' AND content_code = 'p1.placement.v1'
       AND content_version_id = 266100
       AND (b3_domain, b3_resource_type, b3_resource_key, b3_experience_id, question_item_id) IN (
           ('GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-01', 'p1-b3-grammar-01', '266004'),
           ('GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-02', 'p1-b3-grammar-02', '266005'),
           ('GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-03', 'p1-b3-grammar-03', '266006'),
           ('READING', 'READING_QUESTION', 'p1-b3-reading-01', 'p1-b3-reading-01', '266007'),
           ('READING', 'READING_QUESTION', 'p1-b3-reading-02', 'p1-b3-reading-02', '266008'))
);
SET @r1_026_dry = (
    SELECT COUNT(*) FROM b3_content_experience e
      JOIN content_placement_item p
        ON p.placement_item_id = CASE e.experience_id
             WHEN 'p1-b3-grammar-01' THEN 266004
             WHEN 'p1-b3-grammar-02' THEN 266005
             WHEN 'p1-b3-grammar-03' THEN 266006
             WHEN 'p1-b3-reading-01' THEN 266007
             WHEN 'p1-b3-reading-02' THEN 266008
           END
       AND p.tenant_id = 'platform' AND p.bank_code = 'P1_PLACEMENT_V1'
       AND p.content_version_id = 266100 AND p.content_code = 'p1.placement.v1'
       AND e.content_version_id = 266100 AND e.availability = 'PUBLISHED'
       AND JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,
             IF(e.domain_code = 'GRAMMAR', '$.promptText', '$.stemText'))) = p.stem
       AND JSON_UNQUOTE(JSON_EXTRACT(e.payload_json, '$.bankItemCode')) = p.item_code
       AND JSON_EXTRACT(e.payload_json, '$.correctOption') IS NULL
       AND JSON_EXTRACT(e.payload_json, '$.answerRule') IS NULL
       AND JSON_EXTRACT(e.payload_json, '$.answerRules') IS NULL
       AND JSON_EXTRACT(e.payload_json, '$.answer') IS NULL
     WHERE e.tenant_id = 'platform'
       AND e.experience_id IN (
           'p1-b3-grammar-01', 'p1-b3-grammar-02', 'p1-b3-grammar-03',
           'p1-b3-reading-01', 'p1-b3-reading-02')
);
SET @r1_026_placement = (
    SELECT COUNT(*) FROM content_placement_item WHERE bank_code = 'P1_PLACEMENT_V1'
);
SET @r1_026_vocab = (SELECT COUNT(*) FROM content_placement_item WHERE dimension = 'VOCABULARY');
SET @r1_026_grammar = (SELECT COUNT(*) FROM content_placement_item WHERE dimension = 'BASIC_GRAMMAR');
SET @r1_026_reading = (SELECT COUNT(*) FROM content_placement_item WHERE dimension = 'READING');
SET @r1_026_listening = (SELECT COUNT(*) FROM content_placement_item WHERE dimension = 'LISTENING');
SET @r1_026_sealed_only = (
    SELECT COUNT(*) FROM content_version
     WHERE content_version_id = 266100
       AND JSON_LENGTH(rights_permitted_channels) = 1
       AND JSON_CONTAINS(rights_permitted_channels, '"SEALED"')
       AND NOT JSON_CONTAINS(rights_permitted_channels, '"LEARNER"')
       AND NOT JSON_CONTAINS(rights_permitted_channels, '"*"')
);
SET @r1_026_legacy_published = (
    SELECT COUNT(*) FROM b3_content_experience
     WHERE experience_id LIKE 'b3-%' AND availability = 'PUBLISHED'
);

INSERT INTO content_b3_item_binding (
    tenant_id, b3_domain, b3_resource_type, b3_resource_key, b3_experience_id,
    content_code, content_version_id, question_item_id, status
)
SELECT 'platform', 'GRAMMAR', 'GRAMMAR_EXERCISE', 'r1-026-seed-guard', 'r1-026-seed-guard',
       'p1.placement.v1', 266100, '0', 'NOT_A_STATUS'
  FROM DUAL
 WHERE NOT (
        @r1_026_bindings = 5
    AND @r1_026_dry = 5
    AND @r1_026_placement = 10
    AND @r1_026_vocab = 3
    AND @r1_026_grammar = 3
    AND @r1_026_reading = 2
    AND @r1_026_listening = 2
    AND @r1_026_sealed_only = 1
    AND @r1_026_legacy_published = 0
 );
