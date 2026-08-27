ALTER TABLE soc_report
  MODIFY room_id VARCHAR(64) NULL,
  MODIFY target_seat_index SMALLINT UNSIGNED NULL,
  ADD COLUMN appeal_code VARCHAR(32) NULL AFTER client_event_id,
  ADD COLUMN appeal_subject_id VARCHAR(160) NULL AFTER appeal_code,
  ADD COLUMN appealed_at DATETIME(3) NULL AFTER appeal_subject_id,
  ADD UNIQUE KEY uk_soc_report_client_event (tenant_id, reporter_subject_id, client_event_id);
