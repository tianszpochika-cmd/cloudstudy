-- TENANT-B4-05 sentence/exercise kinds: listening dictation and speaking
-- shadowing rows run the same draft/review/publish lifecycle as the five
-- historical kinds. content_definition.kind carries no CHECK (plain VARCHAR),
-- so only the row-level content_item CHECK is re-issued here.
ALTER TABLE content_item
    DROP CHECK chk_content_item_kind,
    ADD CONSTRAINT chk_content_item_kind CHECK (kind IN (
        'QUESTION', 'EXAMPLE', 'GRAMMAR_POINT', 'PASSAGE', 'EXERCISE',
        'DICTATION', 'SHADOWING'));
