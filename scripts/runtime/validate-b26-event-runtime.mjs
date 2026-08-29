import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..')
const manifestRelativePath = 'config/b26-event-runtime.json'
const fragmentRelativePath = 'packages/contracts/events/v1/fragments/b26-reliability.events.json'
const catalogRelativePath = 'packages/contracts/events/v1/catalog.json'
const localPortsRelativePath = 'config/local-ports.json'
const telemetrySchemaRelativePath = 'packages/telemetry/schemas/telemetry-event.schema.json'
const telemetryPolicyRelativePath = 'packages/telemetry/policies/telemetry-events.json'
const requiredEnvelope = [
  'eventId',
  'eventName',
  'schema',
  'version',
  'occurredAt',
  'aggregateType',
  'aggregateId',
  'actorId',
  'traceId',
  'requestId',
  'schemaVersion',
  'dedupeKey',
  'payload',
]
const forbiddenRuntimeResults = /(?:captured|verified|accepted|passed|go|ready|connected|published|running)/i
const forbiddenSecretValue = /(?:Bearer\s+[A-Za-z0-9._~+/=-]{16,}|-----BEGIN [A-Z ]+ PRIVATE KEY-----|(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function unique(values, label, errors) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index)
  if (duplicates.length > 0) errors.push(`${label} contains duplicate values: ${[...new Set(duplicates)].join(', ')}`)
}

function requireCondition(condition, message, errors) {
  if (!condition) errors.push(message)
}

function requireArray(value, label, errors, minimum = 1) {
  requireCondition(Array.isArray(value) && value.length >= minimum, `${label} must contain at least ${minimum} item(s)`, errors)
}

function requireString(value, label, errors) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`, errors)
}

function scanForUnsafeValues(value, location, errors) {
  if (typeof value === 'string') {
    if (forbiddenSecretValue.test(value)) errors.push(`${location} contains a credential, PII or token-like value`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForUnsafeValues(item, `${location}[${index}]`, errors))
    return
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => scanForUnsafeValues(item, `${location}.${key}`, errors))
  }
}

function validateIdentity(manifest, errors) {
  requireCondition(manifest?.schemaVersion === '1.0.0', 'B26 schemaVersion must be 1.0.0', errors)
  requireCondition(manifest?.batch === 'B26', 'B26 batch must be B26', errors)
  requireCondition(JSON.stringify(manifest?.taskIds) === JSON.stringify(['V2-B26-EVT-001', 'V2-B26-EVT-002']), 'B26 taskIds must cover EVT-001 and EVT-002 in order', errors)
  requireCondition(manifest?.phase === 'phase-1', 'B26 must remain in phase-1', errors)
  requireCondition(manifest?.mode === 'static-only', 'B26 validator must be static-only', errors)
  requireCondition(manifest?.status === 'static-foundation' && manifest?.staticDecision === 'PASS', 'B26 static state is invalid', errors)
  requireCondition(manifest?.runtimeStatus === 'pending', 'B26 runtimeStatus must remain pending', errors)
  requireCondition(manifest?.defaultDecision === 'NO-GO', 'B26 default decision must remain NO-GO', errors)
}

function validateExecutionAndSafety(manifest, errors) {
  const execution = manifest.execution
  requireCondition(execution?.defaultAction === 'static-validate-only', 'B26 default action must be static validation only', errors)
  for (const field of ['connectToExternalServicesByDefault', 'writeDatabaseByDefault', 'createTopicsByDefault']) {
    requireCondition(execution?.[field] === false, `B26 execution.${field} must be false`, errors)
  }
  requireCondition(execution?.runtimeEvidenceStatus === 'pending' && execution?.runtimeEvidence === null, 'B26 runtime evidence must be pending/null', errors)
  requireCondition(execution?.staticValidatorCannotPromoteRuntime === true && execution?.syntheticEvidenceCannotPromoteRuntime === true, 'B26 cannot promote runtime from static/synthetic evidence', errors)
  const safety = manifest.safety
  for (const field of ['syntheticOnly', 'clientAuthorityHeadersForbidden', 'serverDerivedAuthorizationOnly']) {
    requireCondition(safety?.[field] === true, `B26 safety.${field} must be true`, errors)
  }
  for (const field of ['realCredentialsAllowed', 'realSecretsAllowed', 'realPiiAllowed', 'rawMediaAllowed', 'paymentCredentialsAllowed', 'productionMutationAllowed']) {
    requireCondition(safety?.[field] === false, `B26 safety.${field} must be false`, errors)
  }
  requireArray(safety?.forbiddenClientAuthorityFacts, 'safety.forbiddenClientAuthorityFacts', errors, 7)
  for (const field of ['role', 'permission', 'tenantId', 'ownerId', 'phase', 'contentRights', 'ageVerified']) {
    requireCondition(safety.forbiddenClientAuthorityFacts.includes(field), `client authority fact ${field} must be forbidden`, errors)
  }
}

function validateRuntimeGate(manifest, errors) {
  const gate = manifest.runtimeGate
  requireCondition(gate?.status === 'blocked' && gate?.runtimeStatusWhenMissing === 'blocked', 'B26 runtime gate must remain blocked', errors)
  requireCondition(gate?.externalEvidenceRequired === true, 'B26 runtime gate must require external evidence', errors)
  requireArray(gate?.requiredEvidence, 'runtimeGate.requiredEvidence', errors, 5)
  requireArray(gate?.cannotBeSatisfiedBy, 'runtimeGate.cannotBeSatisfiedBy', errors, 5)
  for (const boundary of ['static-manifest-only', 'event-fragment-only', 'synthetic-fixture-only', 'health-http-200', 'empty-topic']) {
    requireCondition(gate.cannotBeSatisfiedBy.includes(boundary), `runtime gate boundary ${boundary} is missing`, errors)
  }
}

function validateBroker(manifest, localPorts, errors) {
  const broker = manifest.broker
  requireCondition(broker?.type === 'kafka-compatible' && broker?.protocol === 'kafka', 'B26 broker must be Kafka-compatible', errors)
  requireCondition(broker?.connectByDefault === false, 'B26 broker must not connect by default', errors)
  requireCondition(broker?.fixedLocalEndpoint?.host === '127.0.0.1', 'B26 local broker must bind to 127.0.0.1', errors)
  requireCondition(broker?.fixedLocalEndpoint?.port === localPorts?.services?.kafka?.port, 'B26 Kafka port must match config/local-ports.json', errors)
  requireCondition(broker?.fixedLocalEndpoint?.port === 19092, 'B26 Kafka fixed port must be 19092', errors)
  requireCondition(broker?.fixedLocalEndpoint?.sourcePath === localPortsRelativePath, 'B26 Kafka endpoint must cite local-ports source', errors)
  requireCondition(broker?.aclMode === 'deny-by-default-explicit-workload-principal' && broker?.aclWildcardAllowed === false, 'B26 ACL policy must be explicit and deny-by-default', errors)
  requireCondition(broker?.adminClientInApplication === false, 'B26 applications must not provision Kafka topics or ACLs', errors)
  requireCondition(broker?.healthProbe?.required === true && broker?.healthProbe?.mutating === false && broker?.healthProbe?.runtimeStatus === 'pending', 'B26 Kafka health probe must be non-mutating and pending', errors)
}

function validateTopics(manifest, errors) {
  const topics = manifest.topics ?? []
  requireArray(topics, 'topics', errors, 6)
  unique(topics.map((topic) => topic?.name), 'topic names', errors)
  const groupNames = []
  for (const topic of topics) {
    requireCondition(/^platform\.[a-z0-9.]+\.v[0-9]+$/.test(topic?.name ?? ''), `${topic?.name} topic name is invalid`, errors)
    requireString(topic?.ownerService, `${topic?.name}.ownerService`, errors)
    requireCondition(Number.isInteger(topic?.partitions) && topic.partitions >= 3, `${topic?.name} must have at least 3 partitions`, errors)
    requireCondition(topic?.partitionKey === 'aggregateId', `${topic?.name} partition key must be aggregateId`, errors)
    requireCondition(Number.isInteger(topic?.retentionMs) && topic.retentionMs >= 86400000, `${topic?.name} retention must be at least one day`, errors)
    requireCondition(topic?.cleanupPolicy === 'delete', `${topic?.name} cleanup policy must be delete`, errors)
    requireCondition(Number.isInteger(topic?.replicationFactor) && topic.replicationFactor >= 3, `${topic?.name} production replication factor must be at least 3`, errors)
    requireCondition(Number.isInteger(topic?.minInSyncReplicas) && topic.minInSyncReplicas >= 2 && topic.minInSyncReplicas < topic.replicationFactor, `${topic?.name} min ISR must be >=2 and below replication factor`, errors)
    requireCondition(topic?.localRuntimeOverride?.replicationFactor === 1 && topic?.localRuntimeOverride?.minInSyncReplicas === 1, `${topic?.name} local override must be explicit single-broker compatibility`, errors)
    requireString(topic?.producerPrincipal, `${topic?.name}.producerPrincipal`, errors)
    requireCondition(/^svc\.[a-z][a-z0-9-]+$/.test(topic?.producerPrincipal ?? ''), `${topic?.name} producer must be a workload principal`, errors)
    requireArray(topic?.consumerGroups, `${topic?.name}.consumerGroups`, errors, 1)
    requireArray(topic?.acl, `${topic?.name}.acl`, errors, 2)
    const allowedPrincipals = new Set([topic.producerPrincipal])
    for (const group of topic.consumerGroups ?? []) {
      groupNames.push(group?.name)
      allowedPrincipals.add(group?.principal)
      requireCondition(/^cg\.[a-z0-9.-]+$/.test(group?.name ?? ''), `${topic?.name} consumer group name is invalid`, errors)
      requireCondition(group?.principal === group?.name, `${topic?.name} consumer group principal must equal its group`, errors)
      requireString(group?.service, `${topic?.name}.consumerGroup.service`, errors)
      requireCondition(group?.replayEnabled === true, `${topic?.name}.${group?.name} replay must be enabled`, errors)
    }
    for (const acl of topic.acl ?? []) {
      requireCondition(acl?.effect === 'ALLOW', `${topic?.name} ACL entries must be explicit ALLOW`, errors)
      requireCondition(['READ', 'WRITE'].includes(acl?.operation), `${topic?.name} ACL operation must be READ or WRITE`, errors)
      requireCondition(allowedPrincipals.has(acl?.principal), `${topic?.name} ACL principal is not declared`, errors)
      requireCondition(acl?.principal !== '*' && !/client|browser|frontend/i.test(acl?.principal ?? ''), `${topic?.name} ACL must not grant client authority`, errors)
      if (acl?.operation === 'WRITE') requireCondition(acl.principal === topic.producerPrincipal, `${topic?.name} only its owner producer may WRITE`, errors)
      if (acl?.operation === 'READ') requireCondition(acl.principal !== topic.producerPrincipal, `${topic?.name} producer must not be granted READ by default`, errors)
    }
    const writeAcl = (topic.acl ?? []).filter((acl) => acl?.operation === 'WRITE')
    requireCondition(writeAcl.length === 1, `${topic?.name} must have exactly one WRITE ACL`, errors)
  }
  unique(groupNames, 'consumer group names', errors)
  requireCondition(topics.some((topic) => topic.name === 'platform.events.dlq.v1'), 'DLQ topic is missing', errors)
}

function validateOutboxAndRecovery(manifest, errors) {
  const outbox = manifest.outbox
  requireCondition(outbox?.storage === 'service-owned-mysql' && outbox?.sameTransactionAsAggregate === true && outbox?.publishAfterCommit === true, 'Outbox must be service-owned and committed with the aggregate', errors)
  requireCondition(outbox?.eventImmutableAfterCommit === true && outbox?.delivery === 'at-least-once' && outbox?.exactlyOnceClaim === false, 'Outbox delivery semantics are unsafe or overstated', errors)
  requireCondition(outbox?.publisher?.claimStrategy === 'row-lock-skip-locked', 'Outbox publisher must use bounded row claims', errors)
  requireCondition(outbox?.publisher?.publishConfirmation === 'broker-ack-before-mark-published', 'Outbox publisher must mark published after broker acknowledgement', errors)
  requireArray(outbox?.requiredFields, 'outbox.requiredFields', errors, 7)
  for (const field of ['eventId', 'requestId', 'traceId', 'schemaVersion', 'aggregateId', 'dedupeKey', 'payload']) requireCondition(outbox.requiredFields.includes(field), `Outbox required field ${field} is missing`, errors)
  for (const forbidden of ['kafka-rpc', 'distributed-two-phase-commit', 'shared-table-write']) requireCondition(outbox.forbiddenCoordination.includes(forbidden), `Outbox forbidden coordination ${forbidden} is missing`, errors)

  const reliability = manifest.consumerReliability
  requireCondition(reliability?.atLeastOnce === true, 'consumer reliability must be at-least-once', errors)
  const dedupe = reliability?.deduplication
  requireCondition(dedupe?.required === true && dedupe?.effectAndDeduplicationMustBeAtomic === true && dedupe?.offsetCommitAfterEffect === true && dedupe?.duplicateEffectForbidden === true, 'consumer deduplication boundary is incomplete', errors)
  requireCondition(JSON.stringify(dedupe?.uniqueKey) === JSON.stringify(['consumerGroup', 'eventId']), 'consumer dedupe key must be consumerGroup + eventId', errors)
  requireCondition(dedupe?.storage === 'consumer-service-owned-idempotency-record', 'consumer dedupe records must be service-owned', errors)
  const retry = reliability?.retry
  requireCondition(retry?.bounded === true && Number.isInteger(retry?.maxAttempts) && retry.maxAttempts >= 2 && retry.maxAttempts <= 10, 'retry must be bounded between 2 and 10 attempts', errors)
  requireCondition(retry?.backoff === 'exponential-with-jitter' && retry?.exhaustedAction === 'route-to-dlq', 'retry backoff or exhaustion action is invalid', errors)
  requireArray(retry?.retryableFailureCodes, 'retry.retryableFailureCodes', errors, 2)
  requireArray(retry?.nonRetryableFailureCodes, 'retry.nonRetryableFailureCodes', errors, 2)
  const dlq = reliability?.dlq
  requireCondition(dlq?.topic === 'platform.events.dlq.v1' && dlq?.operatorOnly === true && dlq?.domainFactsDirectWriteAllowed === false, 'DLQ boundary is incomplete', errors)
  requireCondition(dlq?.preserveRawAuthorizationHeaders === false, 'DLQ must not preserve authorization headers', errors)
  for (const field of ['eventId', 'requestId', 'traceId', 'schemaVersion', 'aggregateId', 'dedupeKey']) requireCondition(dlq.requiredOriginalFields.includes(field), `DLQ original field ${field} is missing`, errors)
  const replay = reliability?.replay
  requireCondition(replay?.source === 'immutable-outbox-or-dlq-record' && replay?.sameConsumerPath === true && replay?.dedupeStillEnabled === true, 'replay must use immutable source and the normal dedupe path', errors)
  requireCondition(replay?.replayRunIdRequired === true && replay?.auditRequired === true && replay?.operatorApprovalRequired === true && replay?.clientTriggered === false && replay?.directDomainWrite === false, 'replay authorization boundary is incomplete', errors)
  const ordering = reliability?.ordering
  requireCondition(ordering?.partitionKey === 'aggregateId' && ordering?.sameAggregateOrdered === true && ordering?.crossAggregateOrder === 'not-guaranteed', 'ordering policy must be aggregate scoped', errors)
  requireCondition(ordering?.sequenceField === 'payload.aggregateVersion' && ordering?.outOfOrderPolicy === 'bounded-hold-then-dlq', 'out-of-order policy is incomplete', errors)
  requireCondition(Number.isInteger(ordering?.maxBufferSize) && ordering.maxBufferSize > 0 && Number.isInteger(ordering?.maxWaitMs) && ordering.maxWaitMs > 0, 'out-of-order buffering must be bounded', errors)
  requireCondition(ordering?.staleEventPolicy === 'dedupe-audit-and-skip' && ordering?.manualRecoveryOwner === 'workflow-service', 'stale/out-of-order recovery boundary is unsafe', errors)
  const saga = manifest.saga
  requireCondition(saga?.coordinator === 'workflow-service' && saga?.integrationFactsOnly === true && saga?.commandsViaVersionedApi === true, 'Saga coordinator boundary is invalid', errors)
  requireCondition(saga?.kafkaRpc === false && saga?.twoPhaseCommit === false, 'Saga must not use Kafka RPC or two-phase commit', errors)
  requireCondition(saga?.compensation?.required === true && saga?.compensation?.idempotent === true && saga?.compensation?.neverDirectlyWritesForeignSchema === true, 'Saga compensation boundary is incomplete', errors)
  requireCondition(saga?.manualRecovery?.approvalRequired === true && saga?.manualRecovery?.twoPersonReview === true && saga?.manualRecovery?.clientTriggered === false && saga?.manualRecovery?.auditReferenceRequired === true, 'manual recovery boundary is incomplete', errors)
}

function resolvePointer(document, reference) {
  if (!reference?.startsWith('#/')) return undefined
  return reference.slice(2).split('/').reduce((current, segment) => current?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')], document)
}

function validateFragment(manifest, fragment, catalog, errors) {
  requireCondition(fragment?.version === '1.0.0', 'B26 event fragment version must be 1.0.0', errors)
  requireArray(fragment?.events, 'B26 event fragment events', errors, 7)
  requireCondition(isRecord(fragment?.payloadSchemas) && Object.keys(fragment.payloadSchemas).length === fragment.events.length, 'B26 payload schema count must match event count', errors)
  const names = []
  const routing = new Map((manifest.eventRouting ?? []).map((item) => [item.eventName, item]))
  const catalogEvents = new Map((catalog?.events ?? []).map((event) => [event.eventName, event]))
  for (const event of fragment.events ?? []) {
    names.push(event?.eventName)
    requireCondition(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+\.v[0-9]+$/.test(event?.eventName ?? ''), `${event?.eventName} event name is invalid`, errors)
    requireCondition(event?.version === 1 && event?.schema === 'workflow.event.v1' || event?.schema === 'workflow.saga.v1', `${event?.eventName} event version/schema is invalid`, errors)
    requireCondition(event?.['x-envelope-required']?.length === requiredEnvelope.length, `${event?.eventName} envelope length is invalid`, errors)
    for (const field of requiredEnvelope) requireCondition(event?.['x-envelope-required']?.includes(field), `${event?.eventName} missing envelope field ${field}`, errors)
    const payload = resolvePointer(fragment, event?.payloadSchema?.$ref)
    requireCondition(isRecord(payload) && payload.type === 'object' && payload.additionalProperties === false, `${event?.eventName} payload schema must be a closed object`, errors)
    requireCondition(Array.isArray(payload?.required) && payload.required.length >= 5, `${event?.eventName} payload must have required fields`, errors)
    requireCondition(event?.['x-kafka'] === undefined, `${event?.eventName} fragment must not duplicate canonical Kafka governance`, errors)
    const canonicalEvent = catalogEvents.get(event?.eventName)
    const governance = canonicalEvent?.['x-p1r-governance']
    requireCondition(canonicalEvent?.status === 'CANONICAL_D2', `${event?.eventName} must be a CANONICAL_D2 catalog event`, errors)
    requireCondition(governance?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${event?.eventName} runtime status must remain NOT_RUNTIME_VERIFIED`, errors)
    requireCondition(governance?.transport?.topic === routing.get(event?.eventName)?.topic, `${event?.eventName} Kafka topic routing mismatch`, errors)
    requireCondition(governance?.transport?.partitionKey === 'aggregateId' && governance?.transport?.delivery === 'at-least-once' && governance?.transport?.bindingVersion === '0.5.0', `${event?.eventName} Kafka governance is incomplete`, errors)
    const governedGroups = (governance?.consumers ?? []).map((consumer) => consumer.consumerGroup).sort()
    const routedGroups = [...(routing.get(event?.eventName)?.consumerGroups ?? [])].sort()
    requireCondition(JSON.stringify(governedGroups) === JSON.stringify(routedGroups), `${event?.eventName} consumer governance differs from B26 static routing`, errors)
    requireCondition(isRecord(event?.compatibility) && event.compatibility.strategy === 'additive', `${event?.eventName} compatibility policy must be additive`, errors)
  }
  unique(names, 'B26 event names', errors)
  unique(Object.keys(fragment.payloadSchemas ?? {}), 'B26 payload schema names', errors)
  requireCondition(names.length === (manifest.eventRouting ?? []).length, 'B26 event routing must cover every fragment event', errors)
  requireCondition(JSON.stringify(manifest.eventRouting.map((item) => item.eventName).sort()) === JSON.stringify(names.sort()), 'B26 event routing set differs from event fragment', errors)
  requireCondition(fragment.asyncapi === undefined, 'B26 fragment must not define a second AsyncAPI source', errors)
}

function validateTelemetryBridge(manifest, telemetrySchema, telemetryPolicy, errors) {
  const bridge = manifest.telemetryBridge
  requireCondition(bridge?.eventContractIsSeparateFromTelemetryEnvelope === true, 'B26 must keep event and telemetry envelopes distinct', errors)
  requireCondition(bridge?.rawEventPayloadInLogs === false && bridge?.sensitiveDataPolicy === 'redact-or-do-not-record', 'B26 telemetry payload policy is unsafe', errors)
  for (const field of ['eventId', 'requestId', 'traceId']) requireCondition(bridge?.requiredCorrelationFields?.includes(field), `B26 telemetry correlation field ${field} is missing`, errors)
  for (const field of ['eventId', 'requestId', 'traceId']) requireCondition(telemetrySchema?.required?.includes(field), `telemetry schema is missing ${field}`, errors)
  for (const field of ['eventId', 'requestId', 'traceId']) requireCondition(telemetryPolicy?.envelope?.required?.includes(field), `telemetry policy is missing ${field}`, errors)
  requireCondition(telemetrySchema?.additionalProperties === false && telemetryPolicy?.defaultEffect === 'deny', 'telemetry schema/policy must be closed and deny by default', errors)
}

export function validateB26EventRuntime(manifest, fragment, {
  localPorts = readJson(localPortsRelativePath),
  catalog = readJson(catalogRelativePath),
  telemetrySchema = readJson(telemetrySchemaRelativePath),
  telemetryPolicy = readJson(telemetryPolicyRelativePath),
  runtimeRequested = false,
} = {}) {
  const errors = []
  if (!isRecord(manifest)) errors.push('B26 manifest must be a JSON object')
  if (!isRecord(fragment)) errors.push('B26 event fragment must be a JSON object')
  if (!isRecord(catalog)) errors.push('canonical event catalog must be a JSON object')
  if (errors.length === 0) {
    scanForUnsafeValues(manifest, 'manifest', errors)
    scanForUnsafeValues(fragment, 'fragment', errors)
    validateIdentity(manifest, errors)
    validateExecutionAndSafety(manifest, errors)
    validateRuntimeGate(manifest, errors)
    validateBroker(manifest, localPorts, errors)
    validateTopics(manifest, errors)
    validateOutboxAndRecovery(manifest, errors)
    validateFragment(manifest, fragment, catalog, errors)
    validateTelemetryBridge(manifest, telemetrySchema, telemetryPolicy, errors)
  }
  if (runtimeRequested) {
    errors.push('runtime gate blocked; this validator never connects to Kafka, writes a database, creates topics, or accepts runtime evidence')
  }
  const staticErrors = errors.filter((error) => !error.startsWith('runtime gate blocked;'))
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    gate: 'B26',
    taskIds: manifest?.taskIds ?? [],
    staticStatus: staticErrors.length === 0 ? 'PASS' : 'FAIL',
    runtimeStatus: runtimeRequested ? 'blocked' : 'pending',
    runtimeGate: runtimeRequested ? 'blocked' : 'static-only',
    runtimeEvidencePending: manifest?.runtimeStatus === 'pending',
    topicCount: manifest?.topics?.length ?? 0,
    eventCount: fragment?.events?.length ?? 0,
    payloadSchemaCount: Object.keys(fragment?.payloadSchemas ?? {}).length,
    consumerGroupCount: (manifest?.topics ?? []).reduce((total, topic) => total + (topic?.consumerGroups?.length ?? 0), 0),
    errors,
  }
}

export function readB26Inputs() {
  return {
    manifest: readJson(manifestRelativePath),
    fragment: readJson(fragmentRelativePath),
    catalog: readJson(catalogRelativePath),
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    const { manifest, fragment } = readB26Inputs()
    const summary = validateB26EventRuntime(manifest, fragment, { runtimeRequested: process.argv.includes('--runtime') })
    console.log(JSON.stringify(summary, null, 2))
    if (summary.result !== 'PASS') process.exitCode = 1
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', gate: 'B26', errors: [error instanceof Error ? error.message : String(error)] }, null, 2))
    process.exitCode = 1
  }
}
