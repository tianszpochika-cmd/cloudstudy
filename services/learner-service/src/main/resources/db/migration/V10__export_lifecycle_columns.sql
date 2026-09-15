-- M6-007: export lifecycle columns. Downloads are short-lived descriptors, never raw
-- cross-owner bytes; expiry is evaluated on read so no sweeper can resurrect a download.
ALTER TABLE b25_learner_privacy_export
    ADD COLUMN expires_at DATETIME(6) NULL AFTER created_at,
    ADD COLUMN downloaded_at DATETIME(6) NULL AFTER expires_at,
    ADD COLUMN receipt_json JSON NULL AFTER downloaded_at;
