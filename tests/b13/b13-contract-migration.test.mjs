import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const readJson = (file) => JSON.parse(readText(file))

const openApi = readJson('packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json')
const events = readJson('packages/contracts/events/v1/fragments/b13-commerce-admin-analytics.events.json')
const canonicalOpenApi = readJson('packages/contracts/openapi/v1/openapi.json')
const canonicalEvents = readJson('packages/contracts/events/v1/catalog.json')
const migration = readText('database/mysql/migrations/V0021__create_commerce_admin_analytics_b13.sql')
const manifest = readJson('database/mysql/migrations/migration-manifest.json')

const requiredRoutes = [
  '/api/v1/public/commerce/catalog',
  '/api/v1/commerce/readiness',
  '/api/v1/commerce/skus',
  '/api/v1/commerce/entitlements/me',
  '/api/v1/commerce/orders',
  '/api/v1/commerce/orders/{orderId}/payment-intents',
  '/api/v1/commerce/orders/{orderId}/refunds',
  '/api/v1/commerce/activation-codes/redeem',
  '/internal/v1/commerce/entitlements/{entitlementId}/snapshot',
  '/internal/v1/commerce/entitlements/{entitlementId}/revoke',
  '/internal/v1/commerce/providers/{provider}/callbacks',
  '/internal/v1/commerce/reconciliation/replay',
  '/api/v1/admin/ops/commerce/orders',
  '/api/v1/admin/ops/tickets',
  '/api/v1/admin/ops/commands',
  '/api/v1/admin/ops/commands/prepare',
  '/api/v1/admin/ops/metrics',
  '/api/v1/admin/ops/audit',
  '/internal/v1/analytics/events',
  '/internal/v1/analytics/recompute',
]

const requiredEvents = [
  'commerce.order.created.v1',
  'commerce.payment.callback_received.v1',
  'commerce.entitlement.activated.v1',
  'commerce.refund.completed.v1',
  'commerce.order.reconciled.v1',
  'support.ticket.created.v1',
  'analytics.metric.projected.v1',
  'analytics.recompute.requested.v1',
]

const forbiddenProperty = /^(?:tenantId|ownerId|userId|role|roles|permission|permissions|xRole|xTenantId|xOwnerId|rawAudio|audioBytes|recordingBytes|rawAnswer|answerText|userInput|password|apiKey|paymentCallbackRaw|jws|signedPayload|webhookBody)$/i

function walk(value, visitor, location = '$') {
  visitor(value, location)
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) walk(child, visitor, `${location}.${key}`)
}

function resolve(document, ref) {
  assert.match(ref, /^#\//, `B13 reference must remain local: ${ref}`)
  return ref.slice(2).split('/').reduce((current, segment) => current[segment.replaceAll('~1', '/').replaceAll('~0', '~')], document)
}

function operations(document) {
  return Object.entries(document.paths).flatMap(([route, pathItem]) => Object.entries(pathItem)
    .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
    .map(([method, operation]) => ({ route, method, operation })))
}

test('B13 OpenAPI covers commerce, admin-ops, analytics and official-site boundaries', () => {
  assert.equal(openApi.openapi, '3.0.3')
  for (const route of requiredRoutes) assert.ok(openApi.paths[route], `missing B13 route ${route}`)

  const operationIds = new Set()
  for (const { route, method, operation } of operations(openApi)) {
    // Operation ids stay traceable to the requirement that introduced them; M1-017 reworked the
    // analytics telemetry intake, which is why that operation carries an M1017 id.
    assert.match(operation.operationId, /(?:B13|M1015|M1016|M1017)/, `${method} ${route} must have a B13/M1-015/M1-016/M1-017 operation id`)
    assert.equal(operationIds.has(operation.operationId), false, `duplicate operation ${operation.operationId}`)
    operationIds.add(operation.operationId)

    const isPublic = route === '/api/v1/public/commerce/catalog'
    if (isPublic) {
      assert.ok(!operation.security || operation.security.length === 0, `${method} ${route} must be public projection only`)
    } else {
      assert.ok(Array.isArray(operation.security) && operation.security.length > 0, `${method} ${route} must be secured`)
      if (route.startsWith('/internal/v1/')) {
        assert.ok(operation.security.some((entry) => Object.hasOwn(entry, 'B8WorkloadIdentity')), `${method} ${route} workload identity`)
      } else {
        assert.ok(operation.security.some((entry) => Object.hasOwn(entry, 'bearerAuth')), `${method} ${route} bearer auth`)
      }
    }

    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      if (operation.operationId === 'resolveM1015CommerceEntitlementSnapshot') {
        assert.equal(operation['x-idempotency']?.required, false, `${method} ${route} is a non-mutating snapshot read`)
        assert.equal(operation['x-p1r-idempotency-exception']?.owner, 'commerce-service')
      } else {
        assert.equal(operation['x-idempotency']?.required, true, `${method} ${route} must require Idempotency-Key`)
      }
    }
    walk(operation, (value, location) => {
      if (value && typeof value === 'object' && value.$ref) resolve(canonicalOpenApi, value.$ref)
    }, `${method} ${route}`)
  }

  walk(openApi.components.schemas, (value, location) => {
    if (!value || typeof value !== 'object') return
    const isM1016ScanStatusRefinement = /^\$\.M1016SupportUsable(?:Content|Attachment)Ref\.allOf\.1$/.test(location)
    if (value.type === 'object' && value.properties && !isM1016ScanStatusRefinement) {
      assert.equal(value.additionalProperties, false, `${location} must be closed`)
    }
    for (const name of Object.keys(value.properties ?? {})) {
      const isM1016ServerDerivedTenant = location === '$.M1016SupportTicket' && name === 'tenantId'
      if (isM1016ServerDerivedTenant) {
        assert.match(value['x-client-authority'] ?? '', /^NONE\b/, `${location}.${name} must remain server-derived`)
      } else {
        assert.doesNotMatch(name, forbiddenProperty, `${location}.${name} is a client authority or sensitive raw field`)
      }
    }
  })

  const publicCatalogProperties = Object.keys(openApi.components.schemas.B13PublicCatalog.properties)
  assert.doesNotMatch(publicCatalogProperties.join('|'), /order|payment|refund|activation/i, 'official site catalog must not expose write-domain facts')

  const historicalCreateAdapter = openApi.paths['/api/v1/admin/ops/tickets'].post
  assert.equal(historicalCreateAdapter.deprecated, true)
  assert.equal(historicalCreateAdapter['x-owner'], 'admin-ops-service')
  assert.equal(historicalCreateAdapter['x-data-owner'], 'admin-ops-service.support')
  assert.equal(historicalCreateAdapter['x-permission'], 'support.ticket.create.self')
  assert.equal(historicalCreateAdapter['x-contract']?.canonical, false)
  assert.equal(historicalCreateAdapter['x-contract']?.runtimeStatus, 'NOT_RUNTIME_VERIFIED')
  assert.equal(historicalCreateAdapter['x-contract']?.clientAuthority, 'NONE')
  assert.equal(historicalCreateAdapter['x-authorization']?.defaultDecision, 'DENY')
  assert.equal(historicalCreateAdapter['x-authorization']?.requiredPermission, 'support.ticket.create.self')
  assert.equal(historicalCreateAdapter['x-authorization']?.clientAuthority, 'NONE')
  assert.equal(
    historicalCreateAdapter.requestBody.content['application/json'].schema.$ref,
    '#/components/schemas/M1016SupportTicketCreateRequest',
  )
  assert.equal(
    Object.hasOwn(openApi.components.schemas.M1016SupportTicketCreateRequest.properties, 'priority'),
    false,
    'historical create adapter must not accept client-owned priority',
  )
})

test('B13 v1 events use the canonical envelope, closed payloads and remain historical-only', () => {
  assert.equal(events.version, '1.0.0')
  assert.equal(events.asyncapi, undefined, 'event fragments must not define a second AsyncAPI source')
  const names = new Set(events.events.map((event) => event.eventName))
  for (const eventName of requiredEvents) assert.ok(names.has(eventName), `missing B13 event ${eventName}`)

  for (const event of events.events) {
    for (const field of ['eventId', 'eventName', 'schema', 'version', 'occurredAt', 'aggregateType', 'aggregateId', 'actorId', 'traceId', 'requestId', 'schemaVersion', 'dedupeKey', 'payload']) {
      assert.ok(event['x-envelope-required'].includes(field), `${event.eventName} envelope missing ${field}`)
    }
    const catalogEntry = canonicalEvents.events.find((candidate) => candidate.eventName === event.eventName)
    assert.equal(catalogEntry?.status, 'HISTORICAL_CANDIDATE', `${event.eventName} must remain historical-only`)
    assert.equal(catalogEntry?.['x-p1r-governance'], undefined, `${event.eventName} must not gain canonical Kafka governance`)

    const payload = resolve(events, event.payloadSchema.$ref)
    assert.equal(payload.additionalProperties, false, `${event.eventName} payload must be closed`)
    walk(payload, (value, location) => {
      for (const name of Object.keys(value?.properties ?? {})) {
        assert.doesNotMatch(name, forbiddenProperty, `${location}.${name} is unsafe`)
        assert.notEqual(name, 'actorId', `${event.eventName} payload must not persist actor identity`)
      }
    })
  }
})

test('B13 V0021 is additive, manifest-complete and isolates recovery metadata', () => {
  const entry = manifest.migrations.find((item) => item.version === '0021')
  assert.ok(entry, 'migration manifest must contain V0021')
  assert.equal(entry.file, 'V0021__create_commerce_admin_analytics_b13.sql')
  for (const table of entry.requiredTables) {
    assert.match(migration, new RegExp('CREATE TABLE IF NOT EXISTS\\s+`' + table + '`', 'i'), `missing table ${table}`)
  }
  for (const marker of ['tenant_id', 'event_id', 'dedupe_key', 'idempotency_key', 'domain_facts_untouched', 'read_only', 'route_mode', 'dlq_state']) {
    assert.match(migration, new RegExp(`\\b${marker}\\b`, 'i'), `missing boundary marker ${marker}`)
  }
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)/i)
  for (const forbidden of ['raw_audio', 'audio_bytes', 'recording_bytes', 'answer_text', 'token_text', 'object_key', 'signed_url', 'webhook_body']) {
    assert.doesNotMatch(migration, new RegExp(`\\b${forbidden}\\b`, 'i'), `migration contains forbidden raw field ${forbidden}`)
  }
  assert.match(migration, /CHECK\s*\(`read_only`\s*=\s*1\)/i)
  assert.match(migration, /CHECK\s*\(`domain_facts_untouched`\s*=\s*1\)/i)
})

test('B13 fragments are merged into the generated canonical API and event catalogs', () => {
  for (const route of requiredRoutes) assert.ok(canonicalOpenApi.paths[route], `canonical OpenAPI is missing ${route}; run pnpm contracts:merge`)
  const names = new Set(canonicalEvents.events.map((event) => event.eventName))
  for (const eventName of requiredEvents) assert.ok(names.has(eventName), `canonical event catalog is missing ${eventName}; run pnpm contracts:merge`)
})
