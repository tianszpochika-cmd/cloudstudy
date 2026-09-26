-- The content definition owns the revision of all of its versions. Existing facts are
-- backfilled from the persisted version revisions; no content or rights are synthesized.
ALTER TABLE content_definition
    ADD COLUMN state_version BIGINT NOT NULL DEFAULT 0;

UPDATE content_definition definition
   SET state_version = (
       SELECT COALESCE(SUM(COALESCE(version.state_version, 0)), 0)
         FROM content_version version
        WHERE version.content_id = definition.content_id
   )
 WHERE EXISTS (
       SELECT 1 FROM content_version version
        WHERE version.content_id = definition.content_id
   );

-- The table's AUTO_INCREMENT allocator is transactional-safe across service processes.
-- Seed above every existing version id (including historical manually assigned ids).
CREATE TABLE content_version_id_sequence (
    id BIGINT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO content_version_id_sequence (id)
SELECT GREATEST(COALESCE(MAX(content_version_id), 25000), 25000)
  FROM content_version;
