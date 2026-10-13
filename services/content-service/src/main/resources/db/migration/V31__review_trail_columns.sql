-- Content-ops R2 (2026-10-13): review reject/rework loop, author/reviewer
-- separation and post-publish revisions for row-level lexemes and items.
-- Additive only: nullable columns / defaulted flag, no data rewrite.
--   submitted_by        account that sent the current draft to review (cannot approve it)
--   last_review_*       latest reviewer verdict + reason shown to the author
--   revision_of_live    DRAFT that reworks a published row; learners keep the live copy
ALTER TABLE lexeme ADD COLUMN submitted_by VARCHAR(128) NULL;
ALTER TABLE lexeme ADD COLUMN last_review_decision VARCHAR(48) NULL;
ALTER TABLE lexeme ADD COLUMN last_review_note VARCHAR(512) NULL;
ALTER TABLE lexeme ADD COLUMN last_reviewer VARCHAR(128) NULL;
ALTER TABLE lexeme ADD COLUMN last_reviewed_at DATETIME(6) NULL;
ALTER TABLE lexeme ADD COLUMN revision_of_live TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE content_item ADD COLUMN submitted_by VARCHAR(128) NULL;
ALTER TABLE content_item ADD COLUMN last_review_decision VARCHAR(48) NULL;
ALTER TABLE content_item ADD COLUMN last_review_note VARCHAR(512) NULL;
ALTER TABLE content_item ADD COLUMN last_reviewer VARCHAR(128) NULL;
ALTER TABLE content_item ADD COLUMN last_reviewed_at DATETIME(6) NULL;
ALTER TABLE content_item ADD COLUMN revision_of_live TINYINT(1) NOT NULL DEFAULT 0;
