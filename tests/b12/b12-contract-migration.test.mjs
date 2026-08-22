import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const openApi = readJson('packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json')
const events = readJson('packages/contracts/events/v1/fragments/b12-gamification-social-notification.events.json')
const migration = readText('database/mysql/migrations/V0020__create_growth_social_notification_b12.sql')
const manifest = readJson('database/mysql/migrations/migration-manifest.json')

const requiredRoutes = [
  '/api/v1/gamification/me/summary',
  '/api/v1/gamification/me/ledger',
  '/api/v1/gamification/me/rewards',
  '/api/v1/gamification/me/rewards/{grantId}/probability',
  '/api/v1/gamification/me/rewards/{grantId}/claim',
  '/internal/v1/gamification/trusted-events/completions',
  '/api/v1/social/rooms/{roomId}/disconnect',
  '/api/v1/social/rooms/{roomId}/recover',
  '/api/v1/social/rooms/{roomId}/lease/renew',
  '/api/v1/social/rooms/{roomId}/focus',
  '/api/v1/social/rooms/{roomId}/interactions',
  '/api/v1/social/leaderboards',
  '/api/v1/social/me/visibility',
  '/api/v1/social/rooms/{roomId}/reports',
  '/api/v1/social/reports/{reportId}',
  '/internal/v1/social/trusted-events',
  '/internal/v1/notifications/trusted-events',
  '/internal/v1/notifications/retry',
  '/internal/v1/notifications/recovery',
  '/api/v1/admin/moderation/reports',
  '/api/v1/admin/moderation/reports/{reportId}/commands',
  '/api/v1/admin/recovery/tasks',
  '/api/v1/admin/recovery/tasks/{taskId}/commands',
]

const requiredEvents = [
  'gamification.session_started.v1',
  'gamification.xp.ledger_posted.v1',
  'gamification.reward.granted.v1',
  'gamification.avatar.equipped.v1',
  'study_room.joined.v1',
  'study_room.focus_started.v1',
  'study_room.left.v1',
  'leaderboard.refreshed.v1',
  'notification.requested.v1',
  'notification.retry_scheduled.v1',
  'notification.recovery.completed.v1',
]

function walk(value, visitor, location = '$') {
  visitor(value, location)
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) walk(child, visitor, `${location}.${key}`)
}

function resolve(document, ref) {
  assert.match(ref, /^#\//, `B12 refs must be local: ${ref}`)
  return ref.slice(2).split('/').reduce((current, segment) => current[segment.replaceAll('~1', '/').replaceAll('~0', '~')], document)
}

test('B12 OpenAPI covers the seven implementation boundaries and is fail-closed', () => {
  assert.equal(openApi.openapi, '3.0.3')
  for (const route of requiredRoutes) assert.ok(openApi.paths[route], `missing B12 route ${route}`)
  const operationIds = new Set()
  for (const [route, pathItem] of Object.entries(openApi.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
      assert.match(operation.operationId, /B12/)
      assert.equal(operationIds.has(operation.operationId), false, `duplicate operation ${operation.operationId}`)
      operationIds.add(operation.operationId)
      assert.ok(Array.isArray(operation.security) && operation.security.length > 0, `${method} ${route} security`)
      if (route.startsWith('/internal/v1/')) assert.ok(operation.security.some((entry) => Object.hasOwn(entry, 'B8WorkloadIdentity')), `${method} ${route} workload security`)
      if (['post', 'put', 'patch', 'delete'].includes(method)) assert.equal(operation['x-idempotency']?.required, true, `${method} ${route} idempotency`)
      walk(operation, (value, location) => {
        if (value && typeof value === 'object' && value.$ref) resolve(openApi, value.$ref)
      }, `${method} ${route}`)
    }
  }
  const forbiddenProperties = /^(xp|coins|points|delta|scoreDelta|rawAudio|audioBytes|recordingBytes|answerText|userInput|tenantId|ownerId|xRole)$/i
  walk(openApi.components.schemas, (value, location) => {
    if (!value || typeof value !== 'object') return
    if (value.type === 'object' && value.properties) assert.equal(value.additionalProperties, false, `${location} must be closed`)
    for (const name of Object.keys(value.properties ?? {})) assert.doesNotMatch(name, forbiddenProperties, `${location}.${name} is client/domain fact leakage`)
  })
})

test('B12 events use the canonical envelope, strict payloads and matching AsyncAPI channels', () => {
  assert.equal(events.version, '1.0.0')
  const names = new Set(events.events.map((event) => event.eventName))
  for (const eventName of requiredEvents) assert.ok(names.has(eventName), `missing B12 event ${eventName}`)
  for (const event of events.events) {
    for (const field of ['eventId', 'eventName', 'schema', 'version', 'occurredAt', 'aggregateType', 'aggregateId', 'actorId', 'traceId', 'requestId', 'schemaVersion', 'dedupeKey', 'payload']) assert.ok(event['x-envelope-required'].includes(field), `${event.eventName} envelope`)
    const payload = resolve(events, event.payloadSchema.$ref)
    assert.equal(payload.additionalProperties, false, `${event.eventName} payload closed`)
    walk(payload, (value, location) => {
      for (const name of Object.keys(value?.properties ?? {})) assert.doesNotMatch(name, /^(xp|coins|points|delta|rawAudio|audioBytes|userInput|answerText)$/i, `${location}.${name} unsafe`)
    })
    assert.ok(Object.values(events.asyncapi.channels).some((channel) => channel.address === event.eventName), `${event.eventName} channel`)
  }
})

test('B12 V0020 is additive, manifest-complete and protects compatibility facts', () => {
  const entry = manifest.migrations.find((item) => item.version === '0020')
  assert.ok(entry)
  assert.equal(entry.file, 'V0020__create_growth_social_notification_b12.sql')
  for (const table of entry.requiredTables) assert.match(migration, new RegExp('CREATE TABLE IF NOT EXISTS `' + table + '`'))
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)/i)
  for (const marker of ['tenant_id', 'event_id', 'dedupe_key', 'idempotency_key', 'domain_facts_untouched', 'read_only', 'route_mode', 'DLQ']) assert.match(migration, new RegExp(marker, 'i'))
  for (const forbidden of ['raw_audio', 'audio_bytes', 'recording_bytes', 'answer_text', 'token_text', 'object_key', 'signed_url']) assert.doesNotMatch(migration, new RegExp(`\\b${forbidden}\\b`, 'i'))
  assert.match(migration, /CHECK \(`read_only`\s*=\s*1\)/i)
  assert.match(migration, /CHECK \(`domain_facts_untouched`\s*=\s*1\)/i)
})
