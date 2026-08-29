import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
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
  assert.equal(result.topicCount, 6)
  assert.equal(result.eventCount, 7)
  assert.equal(result.payloadSchemaCount, 7)
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
  assert.ok(result.errors.some((error) => error.includes('kafka-rpc is missing')))
  assert.ok(result.errors.some((error) => error.includes('ACL policy must be explicit')))
  assert.ok(result.errors.some((error) => error.includes('Saga must not use Kafka RPC')))
  assert.ok(result.errors.some((error) => error.includes('client authority fact tenantId must be forbidden')))
})

test('B26 rejects unknown runtime claims at the root and inside otherwise valid structures', () => {
  const cases = [
    (candidate) => { candidate.runtimeAttestation = 'PASS' },
    (candidate) => { candidate.broker.certified = true },
    (candidate) => { candidate.consumerReliability.replay.verification = { state: 'PASS' } },
    (candidate) => { candidate.consumerReliability.replay.result = 'PASS' },
    (candidate) => { candidate.topics[0].operationalStatus = 'PASS' },
    (candidate) => { candidate.outbox.live = true },
  ]
  for (const mutate of cases) {
    const candidate = clone(manifest)
    mutate(candidate)
    const result = validateB26EventRuntime(candidate, fragment)
    assert.equal(result.result, 'FAIL')
    assert.ok(result.errors.some((error) => error.includes('unknown runtime proof') || error.includes('B26 manifest keys must be exactly')))
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
