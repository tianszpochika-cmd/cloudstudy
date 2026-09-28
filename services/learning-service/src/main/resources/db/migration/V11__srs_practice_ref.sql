-- V11: answer-free practice pointer on seeded SRS rows for the Today practice
-- binding. practice_ref_json carries {contentCode, contentVersionId,
-- questionItemId} pinned at ensure time (never stems, options or answer
-- rules); rows seeded before this column stay NULL and the Today read treats
-- them as display-only. Progress columns are never overwritten by ref fills.
ALTER TABLE b25_learning_srs_state
    ADD COLUMN practice_ref_json JSON NULL;
