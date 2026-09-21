-- TENANT-B4-01 word language ribbon: first-class BCP-47 language on lexeme rows
-- plus an open accent tag on pronunciation rows.
--
-- Old rows inherit en-US via the column default so pre-B4 English behavior is
-- unchanged. The pronunciation accent CHECK is dropped (open tag; US/UK/SLOW
-- stay as conventional values) and the column widens to 16 characters.
ALTER TABLE lexeme
    ADD COLUMN language VARCHAR(16) NOT NULL DEFAULT 'en-US' AFTER headword,
    ADD KEY idx_lexeme_pack_language (tenant_id, pack_code, language, availability);

ALTER TABLE lexeme_pronunciation
    MODIFY COLUMN accent VARCHAR(16) NOT NULL,
    DROP CHECK chk_lexeme_pron_accent;
