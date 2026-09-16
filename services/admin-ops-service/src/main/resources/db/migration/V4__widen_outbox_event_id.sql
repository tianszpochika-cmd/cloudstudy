-- P1-LIVE-016: admin_ops_outbox_event.event_id was CHAR(36) for bare UUIDs, but the
-- application writes prefixed command ids ("cmd_" + UUID = 40 chars), so every
-- command forward (ticket transitions included) rolled back with Data truncation.
-- Widen to VARCHAR(64); existing 36-char rows are unaffected.
ALTER TABLE admin_ops_outbox_event MODIFY COLUMN event_id VARCHAR(64) NOT NULL;
