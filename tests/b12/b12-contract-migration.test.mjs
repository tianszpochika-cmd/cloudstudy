import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { projectCanonicalAsyncApi } from '../../scripts/contracts/event-governance-projection.mjs'

const root = path.resolve(import.meta.dirname, '..', '..')
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const fragmentOpenApi = readJson('packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json')
const mergedOpenApi = readJson('packages/contracts/openapi/v1/openapi.json')
const fragmentEvents = readJson('packages/contracts/events/v1/fragments/b12-gamification-social-notification.events.json')
const eventCatalog = readJson('packages/contracts/events/v1/catalog.json')
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
  'social.report.created.v1',
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
  const resolved = ref.slice(2).split('/').reduce((current, segment) => current?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')], document)
  assert.notEqual(resolved, undefined, `B12 ref must resolve in its declared source: ${ref}`)
  return resolved
}

function assertNoClientAuthorityInRequest(document, schema, location, visitedRefs = new Set()) {
  if (!schema || typeof schema !== 'object') return
  if (typeof schema.$ref === 'string') {
    if (visitedRefs.has(schema.$ref)) return
    visitedRefs.add(schema.$ref)
    assertNoClientAuthorityInRequest(document, resolve(document, schema.$ref), location, visitedRefs)
    return
  }
  for (const propertyName of Object.keys(schema.properties ?? {})) {
    assert.doesNotMatch(propertyName, /^(tenantId|ownerId|xRole)$/i, `${location}.${propertyName} must be server-derived, never client authority`)
  }
  for (const value of Object.values(schema)) {
    if (Array.isArray(value)) value.forEach((item) => assertNoClientAuthorityInRequest(document, item, location, visitedRefs))
    else assertNoClientAuthorityInRequest(document, value, location, visitedRefs)
  }
}

test('B12 OpenAPI fragment remains a fail-closed composition input without shared-header or AsyncAPI ownership', () => {
  assert.equal(fragmentOpenApi.openapi, '3.0.3')
  assert.equal(fragmentOpenApi.components.headers, undefined)
  assert.equal(fragmentOpenApi.asyncapi, undefined)
  for (const route of requiredRoutes) assert.ok(fragmentOpenApi.paths[route], `missing B12 fragment route ${route}`)
  const operationIds = new Set()
  for (const [route, pathItem] of Object.entries(fragmentOpenApi.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
      assert.match(operation.operationId, /(?:B12|M1014|M1016)/)
      assert.equal(operationIds.has(operation.operationId), false, `duplicate operation ${operation.operationId}`)
      operationIds.add(operation.operationId)
      assert.ok(Array.isArray(operation.security) && operation.security.length > 0, `${method} ${route} security`)
      if (route.startsWith('/internal/v1/')) assert.ok(operation.security.some((entry) => Object.hasOwn(entry, 'B8WorkloadIdentity')), `${method} ${route} workload security`)
      if (['post', 'put', 'patch', 'delete'].includes(method)) assert.equal(operation['x-idempotency']?.required, true, `${method} ${route} idempotency`)
    }
  }
  const forbiddenProperties = /^(xp|coins|points|delta|scoreDelta|rawAudio|audioBytes|recordingBytes|answerText|userInput)$/i
  const serverOwnedProperties = /^(tenantId|ownerId|xRole)$/i
  walk(fragmentOpenApi.components.schemas, (value, location) => {
    if (!value || typeof value !== 'object') return
    if (value.type === 'object' && value.properties) assert.equal(value.additionalProperties, false, `${location} must be closed`)
    for (const name of Object.keys(value.properties ?? {})) {
      assert.doesNotMatch(name, forbiddenProperties, `${location}.${name} is client/domain fact leakage`)
      if (serverOwnedProperties.test(name)) assert.ok(value['x-server-derived']?.includes(name), `${location}.${name} must be explicitly server-derived`)
    }
  })
  for (const [route, pathItem] of Object.entries(fragmentOpenApi.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['post', 'put', 'patch', 'delete'].includes(method)) continue
      const workloadOnly = operation.security?.some((entry) => Object.hasOwn(entry, 'B8WorkloadIdentity')) === true
      if (workloadOnly) {
        if (operation['x-authorization'] !== undefined) {
          assert.match(operation['x-authorization']?.clientAuthority ?? '', /none/i, `${method} ${route} workload route must deny client authority`)
        }
        continue
      }
      for (const media of Object.values(operation.requestBody?.content ?? {})) {
        assertNoClientAuthorityInRequest(fragmentOpenApi, media.schema, `${method} ${route} request`)
      }
    }
  }
})

test('B12 merged OpenAPI is the canonical projection that resolves shared components', () => {
  assert.ok(mergedOpenApi.components.headers.XRequestId)
  for (const route of requiredRoutes) {
    assert.ok(mergedOpenApi.paths[route], `missing merged B12 route ${route}`)
    for (const [method, fragmentOperation] of Object.entries(fragmentOpenApi.paths[route])) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
      const mergedOperation = mergedOpenApi.paths[route][method]
      assert.ok(mergedOperation, `missing merged B12 operation ${method} ${route}`)
      assert.equal(mergedOperation.operationId, fragmentOperation.operationId, `${method} ${route} operation projection`)
      walk(mergedOperation, (value) => {
        if (value && typeof value === 'object' && value.$ref) resolve(mergedOpenApi, value.$ref)
      }, `${method} ${route}`)
    }
  }
})

test('B12 historical events use strict local payloads while AsyncAPI comes only from the catalog projection', () => {
  const projectedAsyncApi = projectCanonicalAsyncApi(eventCatalog)
  assert.equal(fragmentEvents.version, '1.0.0')
  assert.equal(fragmentEvents.asyncapi, undefined)
  const names = new Set(fragmentEvents.events.map((event) => event.eventName))
  for (const eventName of requiredEvents) assert.ok(names.has(eventName), `missing B12 event ${eventName}`)
  assert.deepEqual(eventCatalog.asyncapi, projectedAsyncApi)
  const projectedNames = new Set(Object.values(projectedAsyncApi.channels).map((channel) => channel.messages?.event?.['x-event-name']))
  for (const event of fragmentEvents.events) {
    for (const field of ['eventId', 'eventName', 'schema', 'version', 'occurredAt', 'aggregateType', 'aggregateId', 'actorId', 'traceId', 'requestId', 'schemaVersion', 'dedupeKey', 'payload']) assert.ok(event['x-envelope-required'].includes(field), `${event.eventName} envelope`)
    const payload = resolve(fragmentEvents, event.payloadSchema.$ref)
    assert.equal(payload.additionalProperties, false, `${event.eventName} payload closed`)
    walk(payload, (value, location) => {
      for (const name of Object.keys(value?.properties ?? {})) assert.doesNotMatch(name, /^(xp|coins|points|delta|rawAudio|audioBytes|userInput|answerText)$/i, `${location}.${name} unsafe`)
    })
    const catalogEvent = eventCatalog.events.find((candidate) => candidate.eventName === event.eventName)
    assert.equal(catalogEvent?.status, 'HISTORICAL_CANDIDATE', `${event.eventName} remains historical until explicitly promoted`)
    assert.equal(projectedNames.has(event.eventName), false, `${event.eventName} must not create a canonical AsyncAPI channel`)
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
