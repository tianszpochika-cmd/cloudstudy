import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const openApi = readJson('packages/contracts/fragments/b11/b11-media-notification-offline.openapi.json');
const events = readJson('packages/contracts/events/v1/fragments/b11-media-notification-offline.events.json');
const migration = readText('database/mysql/migrations/V0019__create_media_notification_offline_b11.sql');
const manifest = readJson('database/mysql/migrations/migration-manifest.json');

const requiredRoutes = [
  '/api/v1/media/assets/{assetId}',
  '/api/v1/media/assets/{assetId}/manifest',
  '/api/v1/media/assets/{assetId}/signed-url',
  '/api/v1/media/assets/{assetId}/content',
  '/internal/v1/media/assets/{assetId}/revoke',
  '/internal/v1/compatibility/b11/media-assets/{assetId}',
  '/internal/v1/compatibility/b11/media-assets/reconciliations',
  '/internal/v1/compatibility/b11/media-assets/{assetId}/migrations',
  '/api/v1/settings/notifications',
  '/api/v1/messages',
  '/api/v1/messages/{messageId}/read',
  '/api/v1/sync/changes',
  '/api/v1/sync/cursor',
  '/api/v1/sync/conflicts',
  '/api/v1/sync/conflicts/{conflictId}/recovery',
  '/internal/v1/compatibility/b11/offline',
];

const requiredEvents = [
  'media.started.v1',
  'media.segment_completed.v1',
  'media.downloaded.v1',
  'notification.delivered.v1',
  'sync.enqueued.v1',
  'sync.conflict_detected.v1',
  'recording.saved.v1',
];

const requiredTables = [
  'med_b11_asset',
  'med_b11_rendition',
  'med_b11_manifest',
  'med_b11_manifest_item',
  'med_b11_access_grant',
  'med_b11_revocation',
  'ntf_b11_preference',
  'ntf_b11_message',
  'ntf_b11_delivery',
  'ntf_b11_outbox_event',
  'sync_b11_change',
  'sync_b11_cursor',
  'sync_b11_conflict',
  'sync_b11_recovery',
  'wf_b11_consumer_dedupe',
  'wf_b11_recovery_task',
  'cmp_b11_compatibility',
  'cmp_b11_migration',
];

const forbiddenPropertyNames = new Set([
  'rawAudio',
  'audioBytes',
  'recordingBytes',
  'rawRecording',
  'answer',
  'answerText',
  'answerContent',
  'userInput',
  'tokens',
  'tokenText',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function walk(value, visitor, location = '$') {
  visitor(value, location);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) walk(child, visitor, `${location}.${key}`);
}

function resolvePointer(document, reference) {
  assert.match(reference, /^#\//, `only local refs are allowed in B11 source: ${reference}`);
  return reference.slice(2).split('/').reduce((current, segment) => {
    const key = segment.replaceAll('~1', '/').replaceAll('~0', '~');
    assert.ok(current !== undefined && current !== null && Object.prototype.hasOwnProperty.call(current, key), `unresolved B11 ref ${reference}`);
    return current[key];
  }, document);
}

function propertyNames(document) {
  const names = [];
  walk(document, (value, location) => {
    if (!isRecord(value) || !isRecord(value.properties)) return;
    for (const name of Object.keys(value.properties)) names.push({ name, location });
  });
  return names;
}

test('B11 OpenAPI defines media, notification, offline and B3 compatibility boundaries', () => {
  assert.equal(openApi.openapi, '3.0.3');
  for (const route of requiredRoutes) assert.ok(openApi.paths[route], `missing B11 route ${route}`);

  const operationIds = new Set();
  for (const [route, pathItem] of Object.entries(openApi.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      assert.ok(operation.operationId?.startsWith('getB11') || operation.operationId?.startsWith('listB11') || operation.operationId?.startsWith('createB11') || operation.operationId?.startsWith('updateB11') || operation.operationId?.startsWith('markB11') || operation.operationId?.startsWith('enqueueB11') || operation.operationId?.startsWith('recoverB11') || operation.operationId?.startsWith('revokeB11') || operation.operationId?.startsWith('streamB11'), `${method} ${route} needs a B11 operation id`);
      assert.equal(operationIds.has(operation.operationId), false, `duplicate operation ${operation.operationId}`);
      operationIds.add(operation.operationId);
      assert.ok(Array.isArray(operation.security) && operation.security.length > 0, `${method} ${route} needs explicit security`);
      if (route.startsWith('/internal/v1/')) assert.ok(operation.security.some((entry) => Object.hasOwn(entry, 'B8WorkloadIdentity')), `${method} ${route} must use workload identity`);
      if (['post', 'put', 'patch', 'delete'].includes(method)) assert.equal(operation['x-idempotency']?.required, true, `${method} ${route} must declare idempotency`);
      walk(operation, (value, location) => {
        if (!isRecord(value) || !isRecord(value.$ref)) return;
        resolvePointer(openApi, value.$ref);
      });
    }
  }

  for (const schema of [
    'B11MediaAsset',
    'B11MediaManifest',
    'B11SignedMediaUrl',
    'B11MediaRevocation',
    'B11NotificationPreference',
    'B11Message',
    'B11SyncEnqueueRequest',
    'B11VectorClock',
    'B11SyncConflict',
    'B11SyncRecovery',
    'B11MediaCompatibility',
    'B11OfflineCompatibility',
  ]) assert.ok(openApi.components.schemas[schema], `missing B11 schema ${schema}`);

  const rangeOperation = openApi.paths['/api/v1/media/assets/{assetId}/content'].get;
  assert.ok(rangeOperation.parameters.some((parameter) => parameter.$ref.endsWith('/B11Range')));
  assert.ok(rangeOperation.responses['206']);
  assert.ok(rangeOperation.responses['416']);
  assert.equal(openApi.components.schemas.B11MediaRevocation.properties.rightsStatus.const, 'REVOKED');
  assert.equal(openApi.components.schemas.B11MediaMigration.properties.domainFactsUntouched.const, true);
  assert.equal(openApi.components.schemas.B11SyncRecovery.properties.domainFactsUntouched.const, true);

  for (const { name, location } of propertyNames(openApi)) {
    assert.equal(forbiddenPropertyNames.has(name), false, `${location}.${name} would leak a protected B11 field`);
  }
  assert.equal(Object.hasOwn(openApi.components.schemas.B11SyncChange.properties, 'payload'), false);
  assert.equal(Object.hasOwn(openApi.components.schemas.B11MediaAsset.properties, 'objectKey'), false);
});

test('B11 AsyncAPI events use the canonical envelope and safe summaries only', () => {
  assert.equal(events.version, '1.0.0');
  const byName = new Map();
  for (const event of events.events) {
    assert.equal(byName.has(event.eventName), false, `duplicate B11 event ${event.eventName}`);
    byName.set(event.eventName, event);
    assert.ok(Array.isArray(event['x-envelope-required']), `${event.eventName} is missing the global envelope declaration`);
    for (const field of ['eventId', 'eventName', 'schema', 'version', 'occurredAt', 'aggregateType', 'aggregateId', 'actorId', 'traceId', 'requestId', 'schemaVersion', 'dedupeKey', 'payload']) {
      assert.ok(event['x-envelope-required'].includes(field), `${event.eventName} missing envelope field ${field}`);
    }
    assert.ok(event.payloadSchema?.$ref, `${event.eventName} missing payload schema ref`);
    const payload = resolvePointer(events, event.payloadSchema.$ref);
    assert.equal(payload.additionalProperties, false, `${event.eventName} payload must be closed`);
    for (const { name, location } of propertyNames(payload)) {
      assert.equal(forbiddenPropertyNames.has(name), false, `${event.eventName} ${location}.${name} is forbidden`);
    }
  }
  for (const eventName of requiredEvents) assert.ok(byName.has(eventName), `missing required B11 event ${eventName}`);
  assert.equal(events.payloadSchemas.B11RecordingSaved.properties.aiScoringAvailable.const, false);
  assert.equal(events.payloadSchemas.B11ShadowingCompleted.properties.aiScoringAvailable.const, false);

  const addresses = new Set(Object.values(events.asyncapi.channels).map((channel) => channel.address));
  for (const eventName of byName.keys()) assert.ok(addresses.has(eventName), `AsyncAPI channel missing ${eventName}`);
  assert.ok(addresses.has('media.started.v1'));
  assert.ok(addresses.has('sync.conflict_detected.v1'));
});

test('B11 V0019 is additive, manifest-complete and replay-safe', () => {
  const entry = manifest.migrations.find((item) => item.version === '0019');
  assert.ok(entry, 'migration manifest must include version 0019');
  assert.equal(entry.file, 'V0019__create_media_notification_offline_b11.sql');
  for (const table of requiredTables) {
    assert.ok(entry.requiredTables.includes(table), `manifest missing table ${table}`);
    assert.match(migration, new RegExp('CREATE TABLE IF NOT EXISTS `' + table + '`'));
  }
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)/i);
  for (const marker of ['tenant_id', 'idempotency_key', 'client_event_id', 'payload_hash', 'vector_json', 'conflict', 'recovery', 'outbox', 'revoked_at', 'domain_facts_untouched']) {
    assert.match(migration, new RegExp(marker, 'i'));
  }
  for (const forbidden of ['raw_audio', 'audio_bytes', 'recording_bytes', 'answer_text', 'token_text', 'object_key', 'signed_url']) {
    assert.doesNotMatch(migration, new RegExp(`\\b${forbidden}\\b`, 'i'), `V0019 must not persist ${forbidden}`);
  }
  assert.match(migration, /JSON_TYPE\(`payload_json`\)\s*=\s*'OBJECT'/i);
  assert.match(migration, /CHECK \(`read_only`\s*=\s*1\)/i);
  assert.match(migration, /CHECK \(`domain_facts_untouched`\s*=\s*1\)/i);
});
