-- P1R-M3-004: media_outbox_event.event_id must hold the domain event id
-- ("evt-" + UUID = 40 chars). Same widening precedent as admin-ops V4.
ALTER TABLE media_outbox_event MODIFY COLUMN event_id VARCHAR(64) NOT NULL;
