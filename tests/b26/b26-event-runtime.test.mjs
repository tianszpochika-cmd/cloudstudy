import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { projectCanonicalAsyncApi } from '../../scripts/contracts/event-governance-projection.mjs'
import { readB26Inputs, validateB26EventRuntime } from '../../scripts/runtime/validate-b26-event-runtime.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const { manifest, fragment, catalog } = readB26Inputs()

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('B26 static Kafka/Outbox baseline passes while runtime evidence remains pending', () => {
  const result = validateB26EventRuntime(manifest, fragment)
  assert.equal(result.result, 'PASS', result.errors.join('\n'))
  assert.equal(result.gate, 'B26')
  assert.deepEqual(result.taskIds, ['V2-B26-EVT-001', 'V2-B26-EVT-002'])
  assert.equal(result.staticStatus, 'PASS')
  assert.equal(result.runtimeStatus, 'pending')
  assert.equal(result.runtimeGate, 'static-only')
  assert.equal(result.topicCount, 9)
  assert.equal(result.fragmentEventCount, 7)
  assert.equal(result.routedCanonicalEventCount, 25)
  assert.equal(result.fragmentPayloadSchemaCount, 7)
  assert.equal(result.eventCount, 7)
  assert.equal(result.routeCount, 25)
  assert.equal(result.payloadSchemaCount, 7)
  assert.equal(result.consumerGroupCount, 28)
  assert.equal(result.runtimeEvidencePending, true)
})

test('B26 event envelope and Kafka routing carry server-owned correlation and dedupe fields', () => {
  const required = manifest.eventEnvelope.required
  for (const field of ['eventId', 'requestId', 'traceId', 'schemaVersion', 'aggregateId', 'dedupeKey', 'payload']) assert.ok(required.includes(field), `${field} is required`)
  assert.equal(manifest.eventEnvelope.partitionKey, 'aggregateId')
  for (const event of fragment.events) {
    assert.deepEqual(event['x-envelope-required'], required)
    assert.equal(event['x-kafka'], undefined)
    const canonical = catalog.events.find((candidate) => candidate.eventName === event.eventName)
    assert.equal(canonical.status, 'CANONICAL_D2')
    assert.equal(canonical['x-p1r-governance'].runtimeStatus, 'NOT_RUNTIME_VERIFIED')
    assert.equal(canonical['x-p1r-governance'].transport.partitionKey, 'aggregateId')
    assert.equal(canonical['x-p1r-governance'].transport.delivery, 'at-least-once')
    assert.equal(manifest.eventRouting.find((route) => route.eventName === event.eventName).topic, canonical['x-p1r-governance'].transport.topic)
  }
})

test('B26 freezes assessment placement completion on the assessment topic with both governed consumers', () => {
  const route = manifest.eventRouting.find((candidate) => candidate.eventName === 'assessment.placement.completed.v1')
  assert.deepEqual(route, {
    eventName: 'assessment.placement.completed.v1',
    topic: 'platform.assessment.v1',
    partitionKey: 'aggregateId',
    consumerGroups: ['cg.learning-from-assessment.v1', 'cg.workflow-from-assessment.v1'],
  })
  const topic = manifest.topics.find((candidate) => candidate.name === route.topic)
  assert.equal(topic.ownerService, 'assessment-service')
  assert.deepEqual(topic.consumerGroups.filter((group) => route.consumerGroups.includes(group.name)).map((group) => group.service), ['learning-service', 'workflow-service'])
  const event = catalog.events.find((candidate) => candidate.eventName === route.eventName)
  assert.equal(event.status, 'CANONICAL_D2')
  assert.equal(event['x-p1r-governance'].runtimeStatus, 'NOT_RUNTIME_VERIFIED')
})

test('B26 freezes M1-014 trusted source, gamification, and social routes with least-privilege consumer groups', () => {
  const expectedRoutes = {
    'assessment.item.assessed.v2': ['platform.assessment.v1', ['cg.learning-from-assessment.v1', 'cg.gamification-from-assessment.v1', 'cg.workflow-from-assessment.v1']],
    'learning.task.completed.v2': ['platform.learning.v1', ['cg.gamification-from-learning.v1', 'cg.workflow-from-learning.v1']],
    'learning.mastery.projected.v2': ['platform.learning.v1', ['cg.assessment-from-learning.v1', 'cg.gamification-from-learning.v1', 'cg.social-from-learning.v1', 'cg.workflow-from-learning.v1']],
    'gamification.xp.ledger_posted.v2': ['platform.gamification.v1', ['cg.workflow-from-gamification.v1', 'cg.audit-from-gamification.v1', 'cg.social-from-gamification.v1']],
    'gamification.reward.granted.v2': ['platform.gamification.v1', ['cg.workflow-from-gamification.v1', 'cg.audit-from-gamification.v1']],
    'study_room.seat_joined.v2': ['platform.social.v1', ['cg.analytics-from-social.v1', 'cg.workflow-from-social.v1', 'cg.audit-from-social.v1']],
    'study_room.focus_started.v2': ['platform.social.v1', ['cg.analytics-from-social.v1', 'cg.workflow-from-social.v1', 'cg.audit-from-social.v1']],
    'study_room.seat_left.v2': ['platform.social.v1', ['cg.analytics-from-social.v1', 'cg.workflow-from-social.v1', 'cg.audit-from-social.v1']],
    'leaderboard.snapshot_published.v2': ['platform.social.v1', ['cg.analytics-from-social.v1', 'cg.workflow-from-social.v1', 'cg.audit-from-social.v1']],
    'social.report.created.v2': ['platform.social.v1', ['cg.admin-ops-from-social.v1', 'cg.audit-from-social.v1', 'cg.workflow-from-social.v1']],
  }
  for (const [eventName, [topic, consumerGroups]] of Object.entries(expectedRoutes)) {
    assert.deepEqual(manifest.eventRouting.find((route) => route.eventName === eventName), {
      eventName,
      topic,
      partitionKey: 'aggregateId',
      consumerGroups,
    })
  }
  const reviewRoute = manifest.eventRouting.find((route) => route.eventName === 'learning.review.scheduled.v2')
  assert.ok(reviewRoute)
  assert.equal(reviewRoute.consumerGroups.includes('cg.gamification-from-learning.v1'), false)

  for (const [topicName, ownerService] of [['platform.gamification.v1', 'gamification-service'], ['platform.social.v1', 'social-service']]) {
    const topic = manifest.topics.find((candidate) => candidate.name === topicName)
    assert.equal(topic.ownerService, ownerService)
    assert.equal(topic.producerPrincipal, `svc.${ownerService}`)
    assert.equal(topic.acl.filter((entry) => entry.operation === 'WRITE').length, 1)
    assert.equal(topic.acl.find((entry) => entry.operation === 'WRITE').principal, topic.producerPrincipal)
    assert.ok(topic.acl.filter((entry) => entry.operation === 'READ').every((entry) => topic.consumerGroups.some((group) => group.name === entry.principal)))
  }
})

test('B26 topics use fixed local port, aggregate partitioning, explicit ACL and isolated consumer groups', () => {
  const ports = JSON.parse(fs.readFileSync(path.join(root, 'config/local-ports.json'), 'utf8'))
  assert.equal(manifest.broker.fixedLocalEndpoint.port, ports.services.kafka.port)
  assert.equal(manifest.broker.fixedLocalEndpoint.port, 19092)
  const groups = []
  for (const topic of manifest.topics) {
    assert.equal(topic.partitionKey, 'aggregateId')
    assert.equal(topic.acl.filter((acl) => acl.operation === 'WRITE').length, 1)
    assert.equal(topic.acl.find((acl) => acl.operation === 'WRITE').principal, topic.producerPrincipal)
    for (const group of topic.consumerGroups) groups.push(group.name)
    assert.ok(topic.acl.every((acl) => acl.principal !== '*' && !/client|browser|frontend/i.test(acl.principal)))
  }
  assert.equal(new Set(groups).size, groups.length)
  assert.equal(manifest.broker.aclWildcardAllowed, false)
})

test('B26 freezes the exact topic, owner, consumer-group, ACL and event-routing bindings', () => {
  const cases = [
    (candidate) => {
      const extra = clone(candidate.topics[0])
      extra.name = 'platform.extra.v1'
      extra.purpose = 'otherwise valid but unbound integration topic'
      extra.consumerGroups = [{
        name: 'cg.workflow-from-extra.v1',
        service: 'workflow-service',
        principal: 'cg.workflow-from-extra.v1',
        replayEnabled: true,
      }]
      extra.acl = [
        { principal: extra.producerPrincipal, operation: 'WRITE', effect: 'ALLOW' },
        { principal: 'cg.workflow-from-extra.v1', operation: 'READ', effect: 'ALLOW' },
      ]
      candidate.topics.push(extra)
    },
    (candidate) => {
      const workflow = candidate.topics.find((topic) => topic.name === 'platform.workflow.v1')
      workflow.consumerGroups.push({
        name: 'cg.workflow-unused.v1',
        service: 'workflow-service',
        principal: 'cg.workflow-unused.v1',
        replayEnabled: true,
      })
      workflow.acl.push({ principal: 'cg.workflow-unused.v1', operation: 'READ', effect: 'ALLOW' })
    },
    (candidate) => {
      const workflow = candidate.topics.find((topic) => topic.name === 'platform.workflow.v1')
      workflow.ownerService = 'audit-service'
      workflow.producerPrincipal = 'svc.audit-service'
      workflow.acl.find((entry) => entry.operation === 'WRITE').principal = 'svc.audit-service'
    },
    (candidate) => { candidate.eventRouting[0].partitionKey = 'eventId' },
  ]

  for (const mutate of cases) {
    const candidate = clone(manifest)
    mutate(candidate)
    const result = validateB26EventRuntime(candidate, fragment)
    assert.equal(result.result, 'FAIL')
    assert.ok(result.errors.some((error) => error.includes('frozen M1-006') || error.includes('routing partition key must be aggregateId')))
  }
})

test('B26 reliability policy covers Outbox, at-least-once, idempotency, retry, DLQ, replay, ordering and Saga recovery', () => {
  assert.equal(manifest.outbox.sameTransactionAsAggregate, true)
  assert.equal(manifest.outbox.publishAfterCommit, true)
  assert.equal(manifest.outbox.delivery, 'at-least-once')
  assert.equal(manifest.outbox.exactlyOnceClaim, false)
  assert.deepEqual(manifest.consumerReliability.deduplication.uniqueKey, ['consumerGroup', 'eventId'])
  assert.equal(manifest.consumerReliability.retry.exhaustedAction, 'route-to-dlq')
  assert.equal(manifest.consumerReliability.dlq.topic, 'platform.events.dlq.v1')
  assert.equal(manifest.consumerReliability.replay.sameConsumerPath, true)
  assert.equal(manifest.consumerReliability.replay.operatorApprovalRequired, true)
  assert.equal(manifest.consumerReliability.ordering.outOfOrderPolicy, 'bounded-hold-then-dlq')
  assert.equal(manifest.saga.kafkaRpc, false)
  assert.equal(manifest.saga.twoPhaseCommit, false)
  assert.equal(manifest.saga.manualRecovery.twoPersonReview, true)
})

test('B26 runtime request fails closed and never turns static evidence into Kafka evidence', () => {
  const result = validateB26EventRuntime(manifest, fragment, { runtimeRequested: true })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.staticStatus, 'PASS')
  assert.equal(result.runtimeStatus, 'blocked')
  assert.equal(result.runtimeGate, 'blocked')
  assert.ok(result.errors.some((error) => error.includes('never connects to Kafka')))
})

test('B26 rejects forged runtime status, Kafka RPC widening, wildcard ACL and client authority', () => {
  const candidate = clone(manifest)
  candidate.runtimeStatus = 'captured'
  candidate.outbox.forbiddenCoordination = candidate.outbox.forbiddenCoordination.filter((value) => value !== 'kafka-rpc')
  candidate.broker.aclWildcardAllowed = true
  candidate.saga.kafkaRpc = true
  candidate.safety.forbiddenClientAuthorityFacts = candidate.safety.forbiddenClientAuthorityFacts.filter((value) => value !== 'tenantId')
  const result = validateB26EventRuntime(candidate, fragment)
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('runtimeStatus must remain pending')))
  assert.ok(result.errors.some((error) => error.includes('outbox.forbiddenCoordination must exactly match')))
  assert.ok(result.errors.some((error) => error.includes('ACL policy must be explicit')))
  assert.ok(result.errors.some((error) => error.includes('Saga must not use Kafka RPC')))
  assert.ok(result.errors.some((error) => error.includes('safety.forbiddenClientAuthorityFacts must exactly match')))
})

test('B26 rejects unknown runtime claims at the root and inside otherwise valid structures', () => {
  const cases = [
    (candidate) => { candidate.runtimeAttestation = 'PASS' },
    (candidate) => { candidate.broker.certified = true },
    (candidate) => { candidate.broker.connectionConfirmed = true },
    (candidate) => { candidate.broker.healthy = true },
    (candidate) => { candidate.consumerReliability.replay.verification = { state: 'PASS' } },
    (candidate) => { candidate.consumerReliability.replay.result = 'PASS' },
    (candidate) => { candidate.consumerReliability.replay.lastRunSucceeded = true },
    (candidate) => { candidate.topics[0].operationalStatus = 'PASS' },
    (candidate) => { candidate.topics[0].availability = 'available' },
    (candidate) => { candidate.outbox.live = true },
    (candidate) => { candidate.outbox.deliverySuccessful = true },
    (candidate) => { candidate.saga.executionComplete = true },
  ]
  for (const mutate of cases) {
    const candidate = clone(manifest)
    mutate(candidate)
    const result = validateB26EventRuntime(candidate, fragment)
    assert.equal(result.result, 'FAIL')
    assert.ok(result.errors.some((error) => error.includes('keys must be exactly')))
  }
})

test('B26 rejects runtime-success prose in otherwise allowed static fields', () => {
  const cases = [
    (candidate) => { candidate.sourceRefs.push('Kafka runtime verified and connected') },
    (candidate) => { candidate.scope.push('Kafka runtime passed') },
    (candidate) => { candidate.runtimeGate.requiredEvidence.push('Kafka runtime passed') },
    (candidate) => { candidate.runtimeGate.cannotBeSatisfiedBy.push('runtime accepted') },
    (candidate) => { candidate.topics[0].purpose = 'Kafka broker connected and healthy' },
    (candidate) => { candidate.topics[0].purpose = 'KafkaRuntimeVerified' },
  ]
  for (const mutate of cases) {
    const candidate = clone(manifest)
    mutate(candidate)
    const result = validateB26EventRuntime(candidate, fragment)
    assert.equal(result.result, 'FAIL')
    assert.ok(result.errors.some((error) => error.includes('runtime success claim') || error.includes('must exactly match')))
  }
})

test('B26 standalone validation binds fragment semantics exactly to the canonical catalog', () => {
  const cases = [
    (candidate) => { candidate.events.find((event) => event.schema === 'workflow.saga.v1').version = 2 },
    (candidate) => { candidate.events.find((event) => event.schema === 'workflow.event.v1').schema = 'workflow.saga.v1' },
    (candidate) => { candidate.events[0].payloadSchema = structuredClone(candidate.events[1].payloadSchema) },
    (candidate) => { candidate.events[0].aggregateIdField = 'changedId' },
    (candidate) => { candidate.events[0].compatibility.breakingChange = 'publish something else' },
    (candidate) => {
      const schemaName = candidate.events[0].payloadSchema.$ref.split('/').at(-1)
      candidate.payloadSchemas[schemaName].runtimeProof = true
    },
    (candidate) => { candidate.payloadSchemas.B26WorkflowOutboxPublished.description = 'KafkaBrokerOnline' },
    (candidate) => { candidate.payloadSchemas.B26WorkflowOutboxPublished.connectionConfirmed = true },
    (candidate) => { candidate.payloadSchemas.B26WorkflowOutboxPublished.executionSucceeded = true },
    (candidate) => { candidate.payloadSchemas.B26WorkflowOutboxPublished.properties.brokerUp = { type: 'boolean', const: true } },
    (candidate) => { candidate.payloadSchemas.B26WorkflowOutboxPublished.properties.deliveryState = { type: 'string', enum: ['BROKER_UP'] } },
    (candidate) => { candidate.payloadSchemas.B26WorkflowOutboxPublished.properties.migrationNote = { type: 'string', maxLength: 64 } },
    (candidate) => { candidate.payloadSchemas.B26WorkflowOutboxPublished.properties.outboxId.maxLength = 64 },
    (candidate) => { candidate.payloadSchemas.B26WorkflowOutboxPublished.required = candidate.payloadSchemas.B26WorkflowOutboxPublished.required.filter((field) => field !== 'attempt') },
  ]
  for (const mutate of cases) {
    const candidate = clone(fragment)
    mutate(candidate)
    const result = validateB26EventRuntime(manifest, candidate)
    assert.equal(result.result, 'FAIL')
    assert.ok(result.errors.some((error) => /must exactly match the canonical catalog|version\/schema is invalid|unknown runtime proof or attestation field|not an allowed M1-006 payload schema keyword|must exactly match the frozen static policy|frozen B26 canonical payload digest/.test(error)))
  }
})

test('B26 standalone rejects a synchronized canonical event-to-payload ref swap', () => {
  const candidateFragment = clone(fragment)
  const candidateCatalog = clone(catalog)
  const failed = candidateCatalog.events.find((event) => event.eventName === 'workflow.event.delivery_failed.v1')
  const dead = candidateCatalog.events.find((event) => event.eventName === 'workflow.event.dead_lettered.v1')
  const failedRef = failed.payloadSchema.$ref
  failed.payloadSchema.$ref = dead.payloadSchema.$ref
  dead.payloadSchema.$ref = failedRef
  failed['x-p1r-governance'].schema.payloadRef = failed.payloadSchema.$ref
  dead['x-p1r-governance'].schema.payloadRef = dead.payloadSchema.$ref

  const fragmentFailed = candidateFragment.events.find((event) => event.eventName === failed.eventName)
  const fragmentDead = candidateFragment.events.find((event) => event.eventName === dead.eventName)
  const fragmentFailedRef = fragmentFailed.payloadSchema.$ref
  fragmentFailed.payloadSchema.$ref = fragmentDead.payloadSchema.$ref
  fragmentDead.payloadSchema.$ref = fragmentFailedRef
  projectCanonicalAsyncApi(candidateCatalog)

  const result = validateB26EventRuntime(manifest, candidateFragment, { catalog: candidateCatalog })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('frozen M1-006 event-to-payload mapping')))
})

test('B26 frozen payload digests reject synchronized catalog and fragment runtime-shape forgery', () => {
  const cases = [
    (schema) => { schema.description = 'KafkaBrokerOnline' },
    (schema) => { schema.connectionConfirmed = true },
    (schema) => { schema.executionSucceeded = true },
    (schema) => { schema.properties.brokerCondition = { type: 'boolean', const: true } },
    (schema) => { schema.properties.channelAlive = { type: 'boolean', const: true } },
    (schema) => { schema.properties.deliveryState = { type: 'string', enum: ['BROKER_UP'] } },
    (schema) => { schema.properties.migrationNote = { type: 'string', maxLength: 64 } },
    (schema) => { schema.properties.outboxId.maxLength = 64 },
    (schema) => { schema.required = schema.required.filter((field) => field !== 'outboxId') },
  ]
  for (const mutate of cases) {
    const candidateFragment = clone(fragment)
    const candidateCatalog = clone(catalog)
    mutate(candidateFragment.payloadSchemas.B26WorkflowOutboxPublished)
    mutate(candidateCatalog.payloadSchemas.B26WorkflowOutboxPublished)
    const result = validateB26EventRuntime(manifest, candidateFragment, { catalog: candidateCatalog })
    assert.equal(result.result, 'FAIL')
    assert.ok(result.errors.some((error) => error.includes('frozen B26 canonical payload digest') || error.includes('not an allowed M1-006 payload schema keyword') || error.includes('must exactly match the frozen static policy')))
  }
})

test('B26 event and manifest fixtures contain no real secret, PII, payment or raw-media value', () => {
  const serialized = JSON.stringify({ manifest, fragment })
  assert.doesNotMatch(serialized, /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/i)
  assert.doesNotMatch(serialized, /-----BEGIN [A-Z ]+ PRIVATE KEY-----/i)
  assert.doesNotMatch(serialized, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.doesNotMatch(serialized, /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/)
  assert.equal(manifest.safety.realSecretsAllowed, false)
  assert.equal(manifest.safety.paymentCredentialsAllowed, false)
  assert.equal(manifest.safety.rawMediaAllowed, false)
})
