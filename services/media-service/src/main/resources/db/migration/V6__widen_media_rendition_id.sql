-- P1R-M3-004: media_rendition.rendition_id carries "assetId:renditionKey"
-- which exceeds CHAR(36). Same widening species as the V5 outbox fix.
ALTER TABLE media_rendition MODIFY COLUMN rendition_id VARCHAR(128) NOT NULL;
