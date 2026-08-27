-- Front/back vocabulary projection for the local Phase 1 learner journey.
-- The answer fields belong to content-service and are returned only by the
-- full detail projection; the front projection intentionally omits them.

ALTER TABLE b25_content_vocabulary
    ADD COLUMN meaning_cn VARCHAR(512) NULL,
    ADD COLUMN definition_en VARCHAR(1024) NULL,
    ADD COLUMN part_of_speech VARCHAR(64) NULL,
    ADD COLUMN examples_json JSON NULL,
    ADD COLUMN collocations_json JSON NULL;

INSERT INTO b25_content_vocabulary (
    vocabulary_id, unit_code, word_normalized, meaning_key, cefr_level,
    content_version, availability, audio_ref, meaning_cn, definition_en,
    part_of_speech, examples_json, collocations_json
) VALUES (
    'b25-item-001', 'unit-b25-foundations', 'hello', 'greeting.hello', 'A1',
    25001, 'PUBLISHED', 'fixture/core-foundation/audio-placeholder-v1',
    '你好；问候', 'A word used when meeting or greeting someone.', 'interjection',
    JSON_ARRAY(JSON_OBJECT('sentence', 'Hello, it is nice to meet you.', 'translation', '你好，很高兴认识你。')),
    JSON_ARRAY('say hello', 'hello again')
)
ON DUPLICATE KEY UPDATE
    word_normalized = VALUES(word_normalized), meaning_key = VALUES(meaning_key),
    content_version = VALUES(content_version), availability = VALUES(availability),
    meaning_cn = VALUES(meaning_cn), definition_en = VALUES(definition_en),
    part_of_speech = VALUES(part_of_speech), examples_json = VALUES(examples_json),
    collocations_json = VALUES(collocations_json);

