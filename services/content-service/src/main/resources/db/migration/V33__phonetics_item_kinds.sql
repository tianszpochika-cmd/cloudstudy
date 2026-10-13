-- Content-ops 2026-10-13 capability 6: phonetics library maintenance.
-- PHONEME / MINIMAL_PAIR rows run the same content_item draft → review → publish
-- lifecycle (four-eyes, reject reason, optimistic lock) as the other kinds.
-- Widening only: the CHECK is re-issued with two extra values (same pattern as
-- V21); every existing row stays valid and no data is touched.
ALTER TABLE content_item
    DROP CHECK chk_content_item_kind,
    ADD CONSTRAINT chk_content_item_kind CHECK (kind IN (
        'QUESTION', 'EXAMPLE', 'GRAMMAR_POINT', 'PASSAGE', 'EXERCISE',
        'DICTATION', 'SHADOWING', 'PHONEME', 'MINIMAL_PAIR'));
