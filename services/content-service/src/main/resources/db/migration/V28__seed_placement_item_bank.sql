-- V28: automatic P1_PLACEMENT_V1 seed (R1-025 / BC-020).
-- Same ten rows as scripts/database/seed-placement-bank.mjs. Clean replay of this
-- migration inserts them; INSERT IGNORE keeps a second run, or a repair that
-- already wrote these ids, from failing the migration. Do not add another bank table.
-- answer_rule_json stays in this table. The placement-bank delivery route does not
-- return it. 判分口留给 R1-021.

INSERT IGNORE INTO content_definition (
    content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code,
    created_by, created_at, current_published_version_id, content_epoch, projection_version, state_version
) VALUES (
    'p1-placement-bank-v1', 'platform', 'p1.placement.v1', 'COURSE', 'P1 placement bank v1',
    'en-US', 'A1', 'DAILY_ENGLISH', 'placement-bank-fixture', UTC_TIMESTAMP(6), 266100, 1, 1, 1
);

INSERT IGNORE INTO content_version (
    content_version_id, content_id, version_no, status, copyright_status, payload_hash,
    published_at, created_at, kind, payload_json, rights_source_code, rights_license_code,
    rights_allows_learning, rights_permitted_channels, rights_starts_at, rights_expires_at,
    authorization_evidence_ref, editor, release_note, first_reviewer, final_reviewer, publisher,
    archived_at, rollback_of_version_id, first_review_version, final_review_version, state_version
) VALUES (
    266100, 'p1-placement-bank-v1', 1, 'PUBLISHED', 'ACTIVE',
    '88a4cb9c762b875807926f576950ae4f176450ab40d0c370f4f55d2df540cf7d',
    UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'COURSE',
    '{"title":"P1 placement bank v1","summary":"Sealed ten-item P1 placement bank (3/3/2/2). Items live in content_placement_item; served only via /internal/v1/content/placement-bank/sealed.","locale":"en-US","targetLevel":"A1","bank":"P1_PLACEMENT_V1","sealedItems":"content_placement_item","servedBy":"/internal/v1/content/placement-bank/sealed","items":[{"itemId":266001,"itemCode":"p1.place.vocab.01","dimension":"VOCABULARY","displayOrder":1},{"itemId":266002,"itemCode":"p1.place.vocab.02","dimension":"VOCABULARY","displayOrder":2},{"itemId":266003,"itemCode":"p1.place.vocab.03","dimension":"VOCABULARY","displayOrder":3},{"itemId":266004,"itemCode":"p1.place.grammar.01","dimension":"BASIC_GRAMMAR","displayOrder":4},{"itemId":266005,"itemCode":"p1.place.grammar.02","dimension":"BASIC_GRAMMAR","displayOrder":5},{"itemId":266006,"itemCode":"p1.place.grammar.03","dimension":"BASIC_GRAMMAR","displayOrder":6},{"itemId":266007,"itemCode":"p1.place.reading.01","dimension":"READING","displayOrder":7},{"itemId":266008,"itemCode":"p1.place.reading.02","dimension":"READING","displayOrder":8},{"itemId":266009,"itemCode":"p1.place.listening.01","dimension":"LISTENING","displayOrder":9},{"itemId":266010,"itemCode":"p1.place.listening.02","dimension":"LISTENING","displayOrder":10}]}',
    'LOCAL_FIXTURE', 'LOCAL_FIXTURE', TRUE, '["SEALED"]', UTC_TIMESTAMP(6), NULL,
    'placement-bank-authorization', 'placement-bank-editor', 'p1 bank release',
    'placement-bank-reviewer-1', 'placement-bank-reviewer-2', 'placement-bank-publisher',
    NULL, NULL, 1, 1, 1
);

INSERT IGNORE INTO content_version_id_sequence (id) VALUES (266100);

INSERT IGNORE INTO content_placement_item (
    placement_item_id, tenant_id, bank_code, dimension, display_order, item_code, item_type,
    stem, options_json, answer_rule_json, question_type, scoring_version, max_score,
    content_version_id, content_code, copyright_status, rights_allows_learning, status, created_at
) VALUES
(266001, 'platform', 'P1_PLACEMENT_V1', 'VOCABULARY', 1, 'p1.place.vocab.01', 'VOCABULARY',
 'Choose the word closest in meaning to ''happy''.',
 '[{"optionId":"a","label":"glad"},{"optionId":"b","label":"angry"},{"optionId":"c","label":"tired"}]',
 '{"correctOption":"a"}', 'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED', UTC_TIMESTAMP(6)),
(266002, 'platform', 'P1_PLACEMENT_V1', 'VOCABULARY', 2, 'p1.place.vocab.02', 'VOCABULARY',
 'Choose the word closest in meaning to ''quick''.',
 '[{"optionId":"a","label":"slow"},{"optionId":"b","label":"fast"},{"optionId":"c","label":"late"}]',
 '{"correctOption":"b"}', 'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED', UTC_TIMESTAMP(6)),
(266003, 'platform', 'P1_PLACEMENT_V1', 'VOCABULARY', 3, 'p1.place.vocab.03', 'VOCABULARY',
 'Choose the word closest in meaning to ''begin''.',
 '[{"optionId":"a","label":"start"},{"optionId":"b","label":"finish"},{"optionId":"c","label":"stop"}]',
 '{"correctOption":"a"}', 'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED', UTC_TIMESTAMP(6)),
(266004, 'platform', 'P1_PLACEMENT_V1', 'BASIC_GRAMMAR', 4, 'p1.place.grammar.01', 'GRAMMAR',
 'She ___ to school every day.',
 '[{"optionId":"a","label":"go"},{"optionId":"b","label":"goes"},{"optionId":"c","label":"going"}]',
 '{"correctOption":"b"}', 'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED', UTC_TIMESTAMP(6)),
(266005, 'platform', 'P1_PLACEMENT_V1', 'BASIC_GRAMMAR', 5, 'p1.place.grammar.02', 'GRAMMAR',
 'There ___ two books on the desk.',
 '[{"optionId":"a","label":"is"},{"optionId":"b","label":"are"},{"optionId":"c","label":"am"}]',
 '{"correctOption":"b"}', 'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED', UTC_TIMESTAMP(6)),
(266006, 'platform', 'P1_PLACEMENT_V1', 'BASIC_GRAMMAR', 6, 'p1.place.grammar.03', 'GRAMMAR',
 'I usually have breakfast ___ seven o''clock.',
 '[{"optionId":"a","label":"in"},{"optionId":"b","label":"on"},{"optionId":"c","label":"at"}]',
 '{"correctOption":"c"}', 'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED', UTC_TIMESTAMP(6)),
(266007, 'platform', 'P1_PLACEMENT_V1', 'READING', 7, 'p1.place.reading.01', 'READING',
 'Li Lei gets up at six thirty. He eats breakfast at seven. Then he walks to school. What time does Li Lei get up?',
 '[{"optionId":"a","label":"six thirty"},{"optionId":"b","label":"seven"},{"optionId":"c","label":"eight"}]',
 '{"correctOption":"a"}', 'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED', UTC_TIMESTAMP(6)),
(266008, 'platform', 'P1_PLACEMENT_V1', 'READING', 8, 'p1.place.reading.02', 'READING',
 'The library is quiet. Students read books there every afternoon. Where do students read books?',
 '[{"optionId":"a","label":"at home"},{"optionId":"b","label":"in the library"},{"optionId":"c","label":"at school"}]',
 '{"correctOption":"b"}', 'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED', UTC_TIMESTAMP(6)),
(266009, 'platform', 'P1_PLACEMENT_V1', 'LISTENING', 9, 'p1.place.listening.01', 'LISTENING',
 '读下面这段话并作答：Good morning. The train leaves at nine. Please be on time. What time does the train leave?',
 '[{"optionId":"a","label":"eight"},{"optionId":"b","label":"nine"},{"optionId":"c","label":"ten"}]',
 '{"correctOption":"b"}', 'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED', UTC_TIMESTAMP(6)),
(266010, 'platform', 'P1_PLACEMENT_V1', 'LISTENING', 10, 'p1.place.listening.02', 'LISTENING',
 '读下面这段话并作答：It is sunny today. We play football after school. What do they do after school?',
 '[{"optionId":"a","label":"swim"},{"optionId":"b","label":"play football"},{"optionId":"c","label":"read"}]',
 '{"correctOption":"b"}', 'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED', UTC_TIMESTAMP(6));
