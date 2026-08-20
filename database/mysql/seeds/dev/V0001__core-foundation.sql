-- Synthetic-only development fixture. It contains metadata, not media bytes.
-- Re-running this file is safe because every row uses a foundation unique key.
SET @seed_run_id = 'seed-core-foundation-v1';

INSERT INTO media_assets (
  asset_uuid, asset_key, asset_kind, storage_provider, bucket_name, object_key,
  object_version, content_hash, content_hash_algorithm, mime_type,
  content_length_bytes, etag, owner_type, owner_id, visibility, storage_status,
  supports_range, chunk_size_bytes, part_count, last_modified_at,
  content_disposition, copyright_owner, license_code, attribution_required,
  rights_metadata_json, retention_policy_code, retention_until, created_by
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'fixture/core-foundation/audio-placeholder-v1',
  'AUDIO', 'local-fixture', 'fixture-bucket', 'fixtures/audio/placeholder-0001.bin',
  'v1', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'SHA-256',
  'audio/mpeg', 1024, 'fixture-etag-0001', 'SYSTEM_FIXTURE', 'fixture-owner-0001',
  'AUTHENTICATED', 'ACTIVE', 1, 256, 4, CURRENT_TIMESTAMP(6),
  'inline', 'synthetic-fixture', 'DEV-ONLY', 0,
  JSON_OBJECT('synthetic', TRUE, 'seedRunId', @seed_run_id, 'bytesPresent', FALSE),
  'DEV_FIXTURE_30D', DATE_ADD(CURRENT_TIMESTAMP(6), INTERVAL 30 DAY), 'seed-core-foundation'
)
ON DUPLICATE KEY UPDATE media_asset_id = media_asset_id;

INSERT INTO idempotency_keys (
  scope_code, scope_subject, idempotency_key, request_hash, http_method,
  request_path, status, response_status, response_body_json, response_headers_json,
  resource_type, resource_id, first_request_id, processing_expires_at, expires_at
) VALUES (
  'fixture', 'seed-core-foundation', 'fixture-idempotency-0001',
  UNHEX('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
  'POST', '/api/v1/fixtures/core-foundation', 'SUCCEEDED', 201,
  JSON_OBJECT('synthetic', TRUE, 'seedRunId', @seed_run_id),
  JSON_OBJECT('contentType', 'application/json'), 'fixture', 'core-foundation-0001',
  'fixture-request-00000001', NULL, DATE_ADD(CURRENT_TIMESTAMP(6), INTERVAL 24 HOUR)
)
ON DUPLICATE KEY UPDATE idempotency_id = idempotency_id;

INSERT INTO outbox_events (
  event_id, owner_domain, aggregate_type, aggregate_id, event_type, event_version,
  dedupe_key, payload_json, headers_json, actor_subject, request_id, occurred_at,
  status, attempt_count, available_at
) VALUES (
  '00000000-0000-4000-8000-000000000002', 'fixture', 'fixture', 'core-foundation-0001',
  'fixture.foundation.created.v1', 'v1', 'fixture:core-foundation:event-0001',
  JSON_OBJECT('synthetic', TRUE, 'seedRunId', @seed_run_id),
  JSON_OBJECT('schema', 'fixture.foundation.created.v1'), 'seed-core-foundation',
  'fixture-request-00000001', CURRENT_TIMESTAMP(6), 'PENDING', 0, CURRENT_TIMESTAMP(6)
)
ON DUPLICATE KEY UPDATE outbox_id = outbox_id;

INSERT INTO audit_logs (
  audit_uuid, request_id, actor_type, actor_subject, action_code, resource_type,
  resource_id, result_code, reason_code, metadata_json, occurred_at, retention_until
) VALUES (
  '00000000-0000-4000-8000-000000000003', 'fixture-request-00000001',
  'SYSTEM_FIXTURE', 'seed-core-foundation', 'FIXTURE_SEED', 'fixture',
  'core-foundation-0001', 'SUCCESS', 'DEV_FIXTURE_CORE_FOUNDATION',
  JSON_OBJECT('synthetic', TRUE, 'seedRunId', @seed_run_id), CURRENT_TIMESTAMP(6),
  DATE_ADD(CURRENT_TIMESTAMP(6), INTERVAL 365 DAY)
)
ON DUPLICATE KEY UPDATE audit_log_id = audit_log_id;
