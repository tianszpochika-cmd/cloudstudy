import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validateCanonicalEventPayloadMappings,
  validateEventPayloadSchemas,
} from '../contracts/event-catalog-policy.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..')
const manifestRelativePath = 'config/b26-event-runtime.json'
const fragmentRelativePath = 'packages/contracts/events/v1/fragments/b26-reliability.events.json'
const m1016FragmentRelativePath = 'packages/contracts/events/v1/fragments/m1-016-notification-sync-support-v2.events.json'
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
const expectedManifestKeys = [
  '$schema',
  'schemaVersion',
  'batch',
  'taskIds',
  'phase',
  'mode',
  'status',
  'staticDecision',
  'runtimeStatus',
  'defaultDecision',
  'scope',
  'sourceRefs',
  'execution',
  'runtimeGate',
  'safety',
  'broker',
  'topics',
  'outbox',
  'consumerReliability',
  'saga',
  'eventEnvelope',
  'eventRouting',
  'telemetryBridge',
]
const expectedManifestObjectKeys = new Map([
  ['manifest', expectedManifestKeys],
  ['manifest.execution', ['defaultAction', 'connectToExternalServicesByDefault', 'writeDatabaseByDefault', 'createTopicsByDefault', 'runtimeEvidenceStatus', 'runtimeEvidence', 'staticValidatorCannotPromoteRuntime', 'syntheticEvidenceCannotPromoteRuntime', 'noUnverifiedKafkaClaim']],
  ['manifest.runtimeGate', ['status', 'runtimeStatusWhenMissing', 'requiredEvidence', 'externalEvidenceRequired', 'cannotBeSatisfiedBy']],
  ['manifest.safety', ['syntheticOnly', 'realCredentialsAllowed', 'realSecretsAllowed', 'realPiiAllowed', 'rawMediaAllowed', 'paymentCredentialsAllowed', 'productionMutationAllowed', 'clientAuthorityHeadersForbidden', 'serverDerivedAuthorizationOnly', 'forbiddenClientAuthorityFacts', 'forbiddenHeaders', 'forbiddenPayloadFieldPatterns']],
  ['manifest.broker', ['type', 'protocol', 'fixedLocalEndpoint', 'nonLocalBootstrapServers', 'authentication', 'credentialsSource', 'tlsConfigurationSource', 'connectByDefault', 'topicNaming', 'defaultPartitionKey', 'defaultDelivery', 'aclMode', 'aclWildcardAllowed', 'adminClientInApplication', 'healthProbe']],
  ['manifest.broker.fixedLocalEndpoint', ['host', 'port', 'sourcePath', 'sourceKey', 'listener']],
  ['manifest.broker.healthProbe', ['required', 'check', 'mutating', 'runtimeStatus']],
  ['manifest.topics[]', ['name', 'ownerService', 'purpose', 'partitions', 'partitionKey', 'retentionMs', 'cleanupPolicy', 'replicationFactor', 'minInSyncReplicas', 'localRuntimeOverride', 'producerPrincipal', 'consumerGroups', 'acl']],
  ['manifest.topics[].localRuntimeOverride', ['replicationFactor', 'minInSyncReplicas']],
  ['manifest.topics[].consumerGroups[]', ['name', 'service', 'principal', 'replayEnabled']],
  ['manifest.topics[].acl[]', ['principal', 'operation', 'effect']],
  ['manifest.outbox', ['storage', 'tablePattern', 'sameTransactionAsAggregate', 'publishAfterCommit', 'eventImmutableAfterCommit', 'delivery', 'exactlyOnceClaim', 'publisher', 'stateModel', 'requiredFields', 'forbiddenCoordination']],
  ['manifest.outbox.publisher', ['claimStrategy', 'leaseMs', 'batchSize', 'maxInFlight', 'publishConfirmation', 'offsetOrState']],
  ['manifest.consumerReliability', ['atLeastOnce', 'deduplication', 'retry', 'dlq', 'replay', 'ordering']],
  ['manifest.consumerReliability.deduplication', ['required', 'uniqueKey', 'secondaryKey', 'storage', 'effectAndDeduplicationMustBeAtomic', 'offsetCommitAfterEffect', 'duplicateEffectForbidden']],
  ['manifest.consumerReliability.retry', ['bounded', 'maxAttempts', 'backoff', 'baseDelayMs', 'maxDelayMs', 'retryableFailureCodes', 'nonRetryableFailureCodes', 'exhaustedAction']],
  ['manifest.consumerReliability.dlq', ['topic', 'requiredOriginalFields', 'requiredFailureFields', 'preserveRawAuthorizationHeaders', 'operatorOnly', 'domainFactsDirectWriteAllowed']],
  ['manifest.consumerReliability.replay', ['source', 'sameConsumerPath', 'replayRunIdRequired', 'dedupeStillEnabled', 'auditRequired', 'operatorApprovalRequired', 'clientTriggered', 'directDomainWrite', 'maxBatchSize', 'runtimeStatus']],
  ['manifest.consumerReliability.ordering', ['partitionKey', 'sameAggregateOrdered', 'crossAggregateOrder', 'sequenceField', 'outOfOrderPolicy', 'maxBufferSize', 'maxWaitMs', 'staleEventPolicy', 'manualRecoveryOwner', 'runtimeStatus']],
  ['manifest.saga', ['coordinator', 'integrationFactsOnly', 'commandsViaVersionedApi', 'kafkaRpc', 'twoPhaseCommit', 'compensation', 'manualRecovery']],
  ['manifest.saga.compensation', ['required', 'idempotent', 'versioned', 'neverDirectlyWritesForeignSchema', 'failureState']],
  ['manifest.saga.manualRecovery', ['requiredFor', 'owner', 'approvalRequired', 'twoPersonReview', 'clientTriggered', 'auditReferenceRequired']],
  ['manifest.eventEnvelope', ['required', 'serverOwned', 'partitionKey', 'payloadMustBeObject', 'immutableAfterCommit']],
  ['manifest.eventRouting[]', ['eventName', 'topic', 'partitionKey', 'consumerGroups']],
  ['manifest.telemetryBridge', ['eventContractIsSeparateFromTelemetryEnvelope', 'schemaPath', 'policyPath', 'requiredCorrelationFields', 'schemaVersionMapping', 'sensitiveDataPolicy', 'rawEventPayloadInLogs', 'runtimeStatus']],
])
const expectedScope = [
  'Kafka topic and ACL baseline',
  'service-owned MySQL Outbox',
  'at-least-once delivery',
  'idempotent consumers',
  'bounded retry and DLQ',
  'operator-approved replay',
  'same-aggregate ordering and out-of-order recovery',
  'Saga compensation and manual recovery boundary',
]
const expectedSourceRefs = [
  'config/g1-contract-data.json',
  'config/g2-implementation-interaction.json',
  'config/g3-test-security-observability.json',
  'packages/contracts/events/v1/catalog.json',
  'packages/contracts/events/v1/fragments/m1-016-notification-sync-support-v2.events.json',
  'packages/telemetry/schemas/telemetry-event.schema.json',
  'packages/telemetry/policies/telemetry-events.json',
  'requirements/backlog/v2-B23plus-Phase1-真实运行与实机测试任务基线.md',
]
const expectedRuntimeEvidence = [
  'B26-EV-KAFKA-TOPIC-ACL',
  'B26-EV-OUTBOX-DELIVERY',
  'B26-EV-CONSUMER-DEDUPE',
  'B26-EV-RETRY-DLQ-REPLAY',
  'B26-EV-ORDERING-SAGA-RECOVERY',
]
const expectedRuntimeExclusions = [
  'static-manifest-only',
  'event-fragment-only',
  'unit-test-only',
  'synthetic-fixture-only',
  'health-http-200',
  'unexecuted-command-list',
  'empty-topic',
  'same-process-test-double',
]
const expectedForbiddenAuthorityFacts = ['role', 'permission', 'tenantId', 'ownerId', 'phase', 'contentRights', 'ageVerified']
const expectedForbiddenHeaders = ['Authorization-from-client-payload', 'Cookie-from-event-payload', 'X-Role', 'X-B5-Role', 'X-Tenant-Id', 'X-Owner-Id']
const expectedForbiddenPayloadPatterns = ['password', 'secret', 'token', 'authorization', 'cookie', 'rawAudio', 'recordingBytes', 'paymentCredential', 'jws', 'answerKey', 'rawAnswer']
const expectedB26PayloadRequired = {
  B26WorkflowOutboxPublished: ['outboxId', 'producerService', 'eventType', 'aggregateId', 'dedupeKey', 'aggregateVersion', 'publishedAt', 'attempt'],
  B26WorkflowDeliveryFailed: ['failedEventId', 'consumerGroup', 'failureCode', 'retryable', 'attempt', 'failedAt'],
  B26WorkflowDeadLettered: ['failedEventId', 'consumerGroup', 'failureCode', 'attempt', 'failedAt', 'recoveryState'],
  B26WorkflowReplayRequested: ['replayRunId', 'sourceTopic', 'sourceEventId', 'requestedByRef', 'approvalRef', 'reasonCode', 'mode'],
  B26WorkflowOrderingDeferred: ['aggregateId', 'receivedVersion', 'expectedVersion', 'bufferedAt', 'expiresAt', 'action'],
  B26WorkflowCompensationRequested: ['sagaId', 'step', 'aggregateId', 'compensationCode', 'reasonCode', 'state'],
  B26WorkflowManualRecoveryRequested: ['recoveryId', 'sagaId', 'aggregateId', 'failedStep', 'reasonCode', 'approvalState', 'runbookRef'],
}
const expectedM1016Events = {
  'notification.requested.v2': {
    domain: 'notification',
    schema: 'notification.event.v2',
    aggregateType: 'notification_delivery',
    aggregateIdField: 'notificationId',
    payloadSchema: 'M1016NotificationRequested',
    topic: 'platform.notification.v1',
    producer: 'notification-service',
    consumers: [
      ['workflow-service', 'cg.workflow-from-notification.v1'],
      ['analytics-service', 'cg.analytics-from-notification.v1'],
    ],
  },
  'notification.retry_scheduled.v2': {
    domain: 'notification',
    schema: 'notification.event.v2',
    aggregateType: 'notification_delivery',
    aggregateIdField: 'notificationId',
    payloadSchema: 'M1016NotificationRetryScheduled',
    topic: 'platform.notification.v1',
    producer: 'notification-service',
    consumers: [['workflow-service', 'cg.workflow-from-notification.v1']],
  },
  'notification.recovery.completed.v2': {
    domain: 'notification',
    schema: 'notification.event.v2',
    aggregateType: 'notification_recovery',
    aggregateIdField: 'notificationId',
    payloadSchema: 'M1016NotificationRecoveryCompleted',
    topic: 'platform.notification.v1',
    producer: 'notification-service',
    consumers: [
      ['workflow-service', 'cg.workflow-from-notification.v1'],
      ['analytics-service', 'cg.analytics-from-notification.v1'],
    ],
  },
  'sync.command_receipted.v2': {
    domain: 'learning',
    schema: 'learning.event.v2',
    aggregateType: 'offline_sync_command',
    aggregateIdField: 'clientEventId',
    payloadSchema: 'M1016SyncCommandReceipted',
    topic: 'platform.learning.v1',
    producer: 'learning-service',
    consumers: [['workflow-service', 'cg.workflow-from-learning.v1']],
  },
  'sync.conflict_detected.v2': {
    domain: 'learning',
    schema: 'learning.event.v2',
    aggregateType: 'offline_sync_conflict',
    aggregateIdField: 'conflictId',
    payloadSchema: 'M1016SyncConflictDetected',
    topic: 'platform.learning.v1',
    producer: 'learning-service',
    consumers: [['workflow-service', 'cg.workflow-from-learning.v1']],
  },
  'sync.recovered.v2': {
    domain: 'learning',
    schema: 'learning.event.v2',
    aggregateType: 'offline_sync_recovery',
    aggregateIdField: 'conflictId',
    payloadSchema: 'M1016SyncRecovered',
    topic: 'platform.learning.v1',
    producer: 'learning-service',
    consumers: [['workflow-service', 'cg.workflow-from-learning.v1']],
  },
  'support.ticket.created.v2': {
    domain: 'support',
    schema: 'support.event.v2',
    aggregateType: 'support_ticket',
    aggregateIdField: 'ticketId',
    payloadSchema: 'M1016SupportTicketCreated',
    topic: 'platform.admin-ops.v1',
    producer: 'admin-ops-service',
    consumers: [
      ['notification-service', 'cg.notification-from-admin-ops.v1'],
      ['workflow-service', 'cg.workflow-from-admin-ops.v1'],
      ['audit-service', 'cg.audit-from-admin-ops.v1'],
    ],
  },
  'support.ticket.resolved.v2': {
    domain: 'support',
    schema: 'support.event.v2',
    aggregateType: 'support_ticket',
    aggregateIdField: 'ticketId',
    payloadSchema: 'M1016SupportTicketResolved',
    topic: 'platform.admin-ops.v1',
    producer: 'admin-ops-service',
    consumers: [
      ['notification-service', 'cg.notification-from-admin-ops.v1'],
      ['workflow-service', 'cg.workflow-from-admin-ops.v1'],
      ['audit-service', 'cg.audit-from-admin-ops.v1'],
    ],
  },
}
const expectedM1016EventNames = Object.keys(expectedM1016Events)
const expectedM1016PayloadSchemaNames = Object.values(expectedM1016Events).map((event) => event.payloadSchema).sort()
const expectedTopicBindings = [
  {
    name: 'platform.assessment.v1',
    ownerService: 'assessment-service',
    producerPrincipal: 'svc.assessment-service',
    consumerGroups: [
      'cg.gamification-from-assessment.v1:gamification-service:cg.gamification-from-assessment.v1:true',
      'cg.learning-from-assessment.v1:learning-service:cg.learning-from-assessment.v1:true',
      'cg.workflow-from-assessment.v1:workflow-service:cg.workflow-from-assessment.v1:true',
    ],
    acl: [
      'cg.gamification-from-assessment.v1:READ:ALLOW',
      'cg.learning-from-assessment.v1:READ:ALLOW',
      'cg.workflow-from-assessment.v1:READ:ALLOW',
      'svc.assessment-service:WRITE:ALLOW',
    ],
  },
  {
    name: 'platform.commerce.v1',
    ownerService: 'commerce-service',
    producerPrincipal: 'svc.commerce-service',
    consumerGroups: [
      'cg.audit-from-commerce.v1:audit-service:cg.audit-from-commerce.v1:true',
      'cg.content-from-commerce.v1:content-service:cg.content-from-commerce.v1:true',
      'cg.learning-from-commerce.v1:learning-service:cg.learning-from-commerce.v1:true',
      'cg.notification-from-commerce.v1:notification-service:cg.notification-from-commerce.v1:true',
      'cg.workflow-from-commerce.v1:workflow-service:cg.workflow-from-commerce.v1:true',
    ],
    acl: [
      'cg.audit-from-commerce.v1:READ:ALLOW',
      'cg.content-from-commerce.v1:READ:ALLOW',
      'cg.learning-from-commerce.v1:READ:ALLOW',
      'cg.notification-from-commerce.v1:READ:ALLOW',
      'cg.workflow-from-commerce.v1:READ:ALLOW',
      'svc.commerce-service:WRITE:ALLOW',
    ],
  },
  {
    name: 'platform.admin-ops.v1',
    ownerService: 'admin-ops-service',
    producerPrincipal: 'svc.admin-ops-service',
    consumerGroups: [
      'cg.audit-from-admin-ops.v1:audit-service:cg.audit-from-admin-ops.v1:true',
      'cg.notification-from-admin-ops.v1:notification-service:cg.notification-from-admin-ops.v1:true',
      'cg.workflow-from-admin-ops.v1:workflow-service:cg.workflow-from-admin-ops.v1:true',
    ],
    acl: [
      'cg.audit-from-admin-ops.v1:READ:ALLOW',
      'cg.notification-from-admin-ops.v1:READ:ALLOW',
      'cg.workflow-from-admin-ops.v1:READ:ALLOW',
      'svc.admin-ops-service:WRITE:ALLOW',
    ],
  },
  {
    name: 'platform.content.v1',
    ownerService: 'content-service',
    producerPrincipal: 'svc.content-service',
    consumerGroups: [
      'cg.admin-ops-from-content.v1:admin-ops-service:cg.admin-ops-from-content.v1:true',
      'cg.assessment-from-content.v1:assessment-service:cg.assessment-from-content.v1:true',
      'cg.audit-from-content.v1:audit-service:cg.audit-from-content.v1:true',
      'cg.learner-from-content.v1:learner-service:cg.learner-from-content.v1:true',
      'cg.learning-from-content.v1:learning-service:cg.learning-from-content.v1:true',
    ],
    acl: [
      'cg.admin-ops-from-content.v1:READ:ALLOW',
      'cg.assessment-from-content.v1:READ:ALLOW',
      'cg.audit-from-content.v1:READ:ALLOW',
      'cg.learner-from-content.v1:READ:ALLOW',
      'cg.learning-from-content.v1:READ:ALLOW',
      'svc.content-service:WRITE:ALLOW',
    ],
  },
  {
    name: 'platform.events.dlq.v1',
    ownerService: 'workflow-service',
    producerPrincipal: 'svc.workflow-service',
    consumerGroups: [
      'cg.workflow-manual-recovery-dlq.v1:workflow-service:cg.workflow-manual-recovery-dlq.v1:true',
    ],
    acl: [
      'cg.workflow-manual-recovery-dlq.v1:READ:ALLOW',
      'svc.workflow-service:WRITE:ALLOW',
    ],
  },
  {
    name: 'platform.gamification.v1',
    ownerService: 'gamification-service',
    producerPrincipal: 'svc.gamification-service',
    consumerGroups: [
      'cg.audit-from-gamification.v1:audit-service:cg.audit-from-gamification.v1:true',
      'cg.social-from-gamification.v1:social-service:cg.social-from-gamification.v1:true',
      'cg.workflow-from-gamification.v1:workflow-service:cg.workflow-from-gamification.v1:true',
    ],
    acl: [
      'cg.audit-from-gamification.v1:READ:ALLOW',
      'cg.social-from-gamification.v1:READ:ALLOW',
      'cg.workflow-from-gamification.v1:READ:ALLOW',
      'svc.gamification-service:WRITE:ALLOW',
    ],
  },
  {
    name: 'platform.learner.v1',
    ownerService: 'learner-service',
    producerPrincipal: 'svc.learner-service',
    consumerGroups: [
      'cg.learning-from-learner.v1:learning-service:cg.learning-from-learner.v1:true',
      'cg.workflow-from-learner.v1:workflow-service:cg.workflow-from-learner.v1:true',
    ],
    acl: [
      'cg.learning-from-learner.v1:READ:ALLOW',
      'cg.workflow-from-learner.v1:READ:ALLOW',
      'svc.learner-service:WRITE:ALLOW',
    ],
  },
  {
    name: 'platform.learning.v1',
    ownerService: 'learning-service',
    producerPrincipal: 'svc.learning-service',
    consumerGroups: [
      'cg.assessment-from-learning.v1:assessment-service:cg.assessment-from-learning.v1:true',
      'cg.gamification-from-learning.v1:gamification-service:cg.gamification-from-learning.v1:true',
      'cg.notification-from-learning.v1:notification-service:cg.notification-from-learning.v1:true',
      'cg.social-from-learning.v1:social-service:cg.social-from-learning.v1:true',
      'cg.workflow-from-learning.v1:workflow-service:cg.workflow-from-learning.v1:true',
    ],
    acl: [
      'cg.assessment-from-learning.v1:READ:ALLOW',
      'cg.gamification-from-learning.v1:READ:ALLOW',
      'cg.notification-from-learning.v1:READ:ALLOW',
      'cg.social-from-learning.v1:READ:ALLOW',
      'cg.workflow-from-learning.v1:READ:ALLOW',
      'svc.learning-service:WRITE:ALLOW',
    ],
  },
  {
    name: 'platform.notification.v1',
    ownerService: 'notification-service',
    producerPrincipal: 'svc.notification-service',
    consumerGroups: [
      'cg.analytics-from-notification.v1:analytics-service:cg.analytics-from-notification.v1:true',
      'cg.workflow-from-notification.v1:workflow-service:cg.workflow-from-notification.v1:true',
    ],
    acl: [
      'cg.analytics-from-notification.v1:READ:ALLOW',
      'cg.workflow-from-notification.v1:READ:ALLOW',
      'svc.notification-service:WRITE:ALLOW',
    ],
  },
  {
    name: 'platform.social.v1',
    ownerService: 'social-service',
    producerPrincipal: 'svc.social-service',
    consumerGroups: [
      'cg.admin-ops-from-social.v1:admin-ops-service:cg.admin-ops-from-social.v1:true',
      'cg.analytics-from-social.v1:analytics-service:cg.analytics-from-social.v1:true',
      'cg.audit-from-social.v1:audit-service:cg.audit-from-social.v1:true',
      'cg.workflow-from-social.v1:workflow-service:cg.workflow-from-social.v1:true',
    ],
    acl: [
      'cg.admin-ops-from-social.v1:READ:ALLOW',
      'cg.analytics-from-social.v1:READ:ALLOW',
      'cg.audit-from-social.v1:READ:ALLOW',
      'cg.workflow-from-social.v1:READ:ALLOW',
      'svc.social-service:WRITE:ALLOW',
    ],
  },
  {
    name: 'platform.workflow.v1',
    ownerService: 'workflow-service',
    producerPrincipal: 'svc.workflow-service',
    consumerGroups: [
      'cg.audit-from-workflow.v1:audit-service:cg.audit-from-workflow.v1:true',
      'cg.workflow-manual-recovery.v1:workflow-service:cg.workflow-manual-recovery.v1:true',
      'cg.workflow-reliability.v1:workflow-service:cg.workflow-reliability.v1:true',
    ],
    acl: [
      'cg.audit-from-workflow.v1:READ:ALLOW',
      'cg.workflow-manual-recovery.v1:READ:ALLOW',
      'cg.workflow-reliability.v1:READ:ALLOW',
      'svc.workflow-service:WRITE:ALLOW',
    ],
  },
]
const expectedEventRoutingBindings = [
  'assessment.item.assessed.v2|platform.assessment.v1|aggregateId|cg.gamification-from-assessment.v1,cg.learning-from-assessment.v1,cg.workflow-from-assessment.v1',
  'assessment.placement.completed.v1|platform.assessment.v1|aggregateId|cg.learning-from-assessment.v1,cg.workflow-from-assessment.v1',
  'commerce.entitlement.activated.v2|platform.commerce.v1|aggregateId|cg.audit-from-commerce.v1,cg.content-from-commerce.v1,cg.learning-from-commerce.v1,cg.notification-from-commerce.v1',
  'commerce.entitlement.revoked.v2|platform.commerce.v1|aggregateId|cg.audit-from-commerce.v1,cg.content-from-commerce.v1,cg.learning-from-commerce.v1',
  'commerce.order.created.v2|platform.commerce.v1|aggregateId|cg.audit-from-commerce.v1,cg.workflow-from-commerce.v1',
  'commerce.payment.callback_received.v2|platform.commerce.v1|aggregateId|cg.audit-from-commerce.v1,cg.workflow-from-commerce.v1',
  'commerce.payment.requested.v2|platform.commerce.v1|aggregateId|cg.audit-from-commerce.v1,cg.workflow-from-commerce.v1',
  'commerce.payment.verified.v2|platform.commerce.v1|aggregateId|cg.audit-from-commerce.v1,cg.workflow-from-commerce.v1',
  'commerce.reconciliation.discrepancy_recorded.v2|platform.commerce.v1|aggregateId|cg.audit-from-commerce.v1,cg.workflow-from-commerce.v1',
  'commerce.reconciliation.recovery_receipted.v2|platform.commerce.v1|aggregateId|cg.audit-from-commerce.v1',
  'commerce.refund.settled.v2|platform.commerce.v1|aggregateId|cg.audit-from-commerce.v1,cg.content-from-commerce.v1,cg.learning-from-commerce.v1,cg.notification-from-commerce.v1',
  'content.version.published.v1|platform.content.v1|aggregateId|cg.admin-ops-from-content.v1,cg.assessment-from-content.v1,cg.audit-from-content.v1,cg.learner-from-content.v1,cg.learning-from-content.v1',
  'content.version.reviewed.v1|platform.content.v1|aggregateId|cg.admin-ops-from-content.v1,cg.audit-from-content.v1',
  'content.version.rolled_back.v1|platform.content.v1|aggregateId|cg.admin-ops-from-content.v1,cg.assessment-from-content.v1,cg.audit-from-content.v1,cg.learner-from-content.v1,cg.learning-from-content.v1',
  'content.version.submitted.v1|platform.content.v1|aggregateId|cg.admin-ops-from-content.v1,cg.audit-from-content.v1',
  'content.version.unpublished.v1|platform.content.v1|aggregateId|cg.admin-ops-from-content.v1,cg.assessment-from-content.v1,cg.audit-from-content.v1,cg.learner-from-content.v1,cg.learning-from-content.v1',
  'gamification.reward.granted.v2|platform.gamification.v1|aggregateId|cg.audit-from-gamification.v1,cg.workflow-from-gamification.v1',
  'gamification.xp.ledger_posted.v2|platform.gamification.v1|aggregateId|cg.audit-from-gamification.v1,cg.social-from-gamification.v1,cg.workflow-from-gamification.v1',
  'leaderboard.snapshot_published.v2|platform.social.v1|aggregateId|cg.analytics-from-social.v1,cg.audit-from-social.v1,cg.workflow-from-social.v1',
  'learner.target.updated.v1|platform.learner.v1|aggregateId|cg.learning-from-learner.v1,cg.workflow-from-learner.v1',
  'learning.mastery.projected.v2|platform.learning.v1|aggregateId|cg.assessment-from-learning.v1,cg.gamification-from-learning.v1,cg.social-from-learning.v1,cg.workflow-from-learning.v1',
  'learning.review.scheduled.v2|platform.learning.v1|aggregateId|cg.assessment-from-learning.v1,cg.notification-from-learning.v1,cg.workflow-from-learning.v1',
  'learning.task.completed.v2|platform.learning.v1|aggregateId|cg.gamification-from-learning.v1,cg.workflow-from-learning.v1',
  'social.report.created.v2|platform.social.v1|aggregateId|cg.admin-ops-from-social.v1,cg.audit-from-social.v1,cg.workflow-from-social.v1',
  'study_room.focus_started.v2|platform.social.v1|aggregateId|cg.analytics-from-social.v1,cg.audit-from-social.v1,cg.workflow-from-social.v1',
  'study_room.seat_joined.v2|platform.social.v1|aggregateId|cg.analytics-from-social.v1,cg.audit-from-social.v1,cg.workflow-from-social.v1',
  'study_room.seat_left.v2|platform.social.v1|aggregateId|cg.analytics-from-social.v1,cg.audit-from-social.v1,cg.workflow-from-social.v1',
  'workflow.event.dead_lettered.v1|platform.workflow.v1|aggregateId|cg.audit-from-workflow.v1,cg.workflow-manual-recovery.v1',
  'workflow.event.delivery_failed.v1|platform.workflow.v1|aggregateId|cg.audit-from-workflow.v1,cg.workflow-reliability.v1',
  'workflow.event.ordering_deferred.v1|platform.workflow.v1|aggregateId|cg.workflow-manual-recovery.v1,cg.workflow-reliability.v1',
  'workflow.event.replay_requested.v1|platform.workflow.v1|aggregateId|cg.workflow-manual-recovery.v1,cg.workflow-reliability.v1',
  'workflow.outbox.published.v1|platform.workflow.v1|aggregateId|cg.audit-from-workflow.v1,cg.workflow-reliability.v1',
  'workflow.saga.compensation_requested.v1|platform.workflow.v1|aggregateId|cg.audit-from-workflow.v1,cg.workflow-reliability.v1',
  'workflow.saga.manual_recovery_requested.v1|platform.workflow.v1|aggregateId|cg.audit-from-workflow.v1,cg.workflow-manual-recovery.v1',
  'notification.recovery.completed.v2|platform.notification.v1|aggregateId|cg.analytics-from-notification.v1,cg.workflow-from-notification.v1',
  'notification.requested.v2|platform.notification.v1|aggregateId|cg.analytics-from-notification.v1,cg.workflow-from-notification.v1',
  'notification.retry_scheduled.v2|platform.notification.v1|aggregateId|cg.workflow-from-notification.v1',
  'support.ticket.created.v2|platform.admin-ops.v1|aggregateId|cg.audit-from-admin-ops.v1,cg.notification-from-admin-ops.v1,cg.workflow-from-admin-ops.v1',
  'support.ticket.resolved.v2|platform.admin-ops.v1|aggregateId|cg.audit-from-admin-ops.v1,cg.notification-from-admin-ops.v1,cg.workflow-from-admin-ops.v1',
  'sync.command_receipted.v2|platform.learning.v1|aggregateId|cg.workflow-from-learning.v1',
  'sync.conflict_detected.v2|platform.learning.v1|aggregateId|cg.workflow-from-learning.v1',
  'sync.recovered.v2|platform.learning.v1|aggregateId|cg.workflow-from-learning.v1',
]
const runtimeClaimSubject = /(?:\bruntime\b|\bkafka\b|\bbroker\b|\btopic\b|\boutbox\b|\bdelivery\b|\bconsumer\b|\bsaga\b|\breplay\b)/i
const forbiddenRuntimeResults = /(?:\bcaptured\b|\bverified\b|\baccepted\b|\bpassed\b|\bready\b|\bconnected\b|\bconfirmed\b|\brunning\b|\bhealthy\b|\bsuccessful\b|\bsucceeded\b|\bcompleted?\b|\bavailable\b|\bonline\b|\breachable\b|\bcertified\b|\bdeployed\b|\boperational\b)/i
const forbiddenRuntimeClaimKeySegments = new Set(['runtime', 'attestation', 'certified', 'deployed', 'operational', 'promotion', 'promoted'])
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

function requireExactKeys(value, expected, label, errors) {
  requireCondition(isRecord(value), `${label} must be an object`, errors)
  if (!isRecord(value)) return
  const actualKeys = Object.keys(value).sort()
  const expectedKeys = [...expected].sort()
  requireCondition(JSON.stringify(actualKeys) === JSON.stringify(expectedKeys), `${label} keys must be exactly ${expectedKeys.join(', ')}`, errors)
}

function requireExactArray(value, expected, label, errors) {
  requireCondition(JSON.stringify(value) === JSON.stringify(expected), `${label} must exactly match the frozen static policy`, errors)
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function validateManifestShape(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach((item) => validateManifestShape(item, `${location}[]`, errors))
    return
  }
  if (!isRecord(value)) return
  const expectedKeys = expectedManifestObjectKeys.get(location)
  if (!expectedKeys) {
    errors.push(`${location} has no declared B26 static manifest schema`)
    return
  }
  requireExactKeys(value, expectedKeys, location, errors)
  for (const [key, item] of Object.entries(value)) validateManifestShape(item, `${location}.${key}`, errors)
}

function scanForUnsafeValues(value, location, errors) {
  if (typeof value === 'string') {
    if (forbiddenSecretValue.test(value)) errors.push(`${location} contains a credential, PII or token-like value`)
    const normalized = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_./:-]+/g, ' ')
    if (runtimeClaimSubject.test(normalized) && forbiddenRuntimeResults.test(normalized)) {
      errors.push(`${location} contains a runtime success claim that a static B26 manifest cannot make`)
    }
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
  requireCondition(manifest?.$schema === 'https://json-schema.org/draft/2020-12/schema', 'B26 $schema must remain JSON Schema 2020-12', errors)
  requireCondition(manifest?.schemaVersion === '1.0.0', 'B26 schemaVersion must be 1.0.0', errors)
  requireCondition(manifest?.batch === 'B26', 'B26 batch must be B26', errors)
  requireCondition(JSON.stringify(manifest?.taskIds) === JSON.stringify(['V2-B26-EVT-001', 'V2-B26-EVT-002']), 'B26 taskIds must cover EVT-001 and EVT-002 in order', errors)
  requireCondition(manifest?.phase === 'phase-1', 'B26 must remain in phase-1', errors)
  requireCondition(manifest?.mode === 'static-only', 'B26 validator must be static-only', errors)
  requireCondition(manifest?.status === 'static-foundation' && manifest?.staticDecision === 'PASS', 'B26 static state is invalid', errors)
  requireCondition(manifest?.runtimeStatus === 'pending', 'B26 runtimeStatus must remain pending', errors)
  requireCondition(manifest?.defaultDecision === 'NO-GO', 'B26 default decision must remain NO-GO', errors)
  requireExactArray(manifest?.scope, expectedScope, 'B26 scope', errors)
  requireExactArray(manifest?.sourceRefs, expectedSourceRefs, 'B26 sourceRefs', errors)
}

function scanFragmentRuntimeClaimKeys(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanFragmentRuntimeClaimKeys(item, `${location}[${index}]`, errors))
    return
  }
  if (!isRecord(value)) return
  for (const [key, item] of Object.entries(value)) {
    const segments = String(key).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().split(/[^a-z0-9]+/)
    if (segments.some((segment) => forbiddenRuntimeClaimKeySegments.has(segment))) {
      errors.push(`${location}.${key} is an unknown runtime proof or attestation field`)
    }
    scanFragmentRuntimeClaimKeys(item, `${location}.${key}`, errors)
  }
}

function validateExecutionAndSafety(manifest, errors) {
  const execution = manifest.execution
  requireCondition(execution?.defaultAction === 'static-validate-only', 'B26 default action must be static validation only', errors)
  for (const field of ['connectToExternalServicesByDefault', 'writeDatabaseByDefault', 'createTopicsByDefault']) {
    requireCondition(execution?.[field] === false, `B26 execution.${field} must be false`, errors)
  }
  requireCondition(execution?.runtimeEvidenceStatus === 'pending' && execution?.runtimeEvidence === null, 'B26 runtime evidence must be pending/null', errors)
  requireCondition(execution?.staticValidatorCannotPromoteRuntime === true && execution?.syntheticEvidenceCannotPromoteRuntime === true, 'B26 cannot promote runtime from static/synthetic evidence', errors)
  requireCondition(execution?.noUnverifiedKafkaClaim === true, 'B26 execution must prohibit unverified Kafka claims', errors)
  const safety = manifest.safety
  for (const field of ['syntheticOnly', 'clientAuthorityHeadersForbidden', 'serverDerivedAuthorizationOnly']) {
    requireCondition(safety?.[field] === true, `B26 safety.${field} must be true`, errors)
  }
  for (const field of ['realCredentialsAllowed', 'realSecretsAllowed', 'realPiiAllowed', 'rawMediaAllowed', 'paymentCredentialsAllowed', 'productionMutationAllowed']) {
    requireCondition(safety?.[field] === false, `B26 safety.${field} must be false`, errors)
  }
  requireExactArray(safety?.forbiddenClientAuthorityFacts, expectedForbiddenAuthorityFacts, 'safety.forbiddenClientAuthorityFacts', errors)
  requireExactArray(safety?.forbiddenHeaders, expectedForbiddenHeaders, 'safety.forbiddenHeaders', errors)
  requireExactArray(safety?.forbiddenPayloadFieldPatterns, expectedForbiddenPayloadPatterns, 'safety.forbiddenPayloadFieldPatterns', errors)
}

function validateRuntimeGate(manifest, errors) {
  const gate = manifest.runtimeGate
  requireCondition(gate?.status === 'blocked' && gate?.runtimeStatusWhenMissing === 'blocked', 'B26 runtime gate must remain blocked', errors)
  requireCondition(gate?.externalEvidenceRequired === true, 'B26 runtime gate must require external evidence', errors)
  requireExactArray(gate?.requiredEvidence, expectedRuntimeEvidence, 'runtimeGate.requiredEvidence', errors)
  requireExactArray(gate?.cannotBeSatisfiedBy, expectedRuntimeExclusions, 'runtimeGate.cannotBeSatisfiedBy', errors)
}

function validateBroker(manifest, localPorts, errors) {
  const broker = manifest.broker
  requireCondition(broker?.type === 'kafka-compatible' && broker?.protocol === 'kafka', 'B26 broker must be Kafka-compatible', errors)
  requireCondition(broker?.connectByDefault === false, 'B26 broker must not connect by default', errors)
  requireCondition(broker?.fixedLocalEndpoint?.host === '127.0.0.1', 'B26 local broker must bind to 127.0.0.1', errors)
  requireCondition(broker?.fixedLocalEndpoint?.port === localPorts?.services?.kafka?.port, 'B26 Kafka port must match config/local-ports.json', errors)
  requireCondition(broker?.fixedLocalEndpoint?.port === 19092, 'B26 Kafka fixed port must be 19092', errors)
  requireCondition(broker?.fixedLocalEndpoint?.sourcePath === localPortsRelativePath, 'B26 Kafka endpoint must cite local-ports source', errors)
  requireCondition(broker?.fixedLocalEndpoint?.sourceKey === 'kafka.port' && broker?.fixedLocalEndpoint?.listener === 'external', 'B26 Kafka endpoint source metadata is invalid', errors)
  requireCondition(broker?.nonLocalBootstrapServers === 'runtime-env-only' && broker?.credentialsSource === 'runtime-env-only' && broker?.tlsConfigurationSource === 'runtime-env-only', 'B26 non-local broker configuration must remain runtime-env-only', errors)
  requireCondition(broker?.authentication === 'runtime-configured-workload-identity', 'B26 broker authentication must use runtime workload identity', errors)
  requireCondition(broker?.topicNaming === 'platform.<domain>.v1' && broker?.defaultPartitionKey === 'aggregateId' && broker?.defaultDelivery === 'at-least-once', 'B26 broker defaults are invalid', errors)
  requireCondition(broker?.aclMode === 'deny-by-default-explicit-workload-principal' && broker?.aclWildcardAllowed === false, 'B26 ACL policy must be explicit and deny-by-default', errors)
  requireCondition(broker?.adminClientInApplication === false, 'B26 applications must not provision Kafka topics or ACLs', errors)
  requireCondition(broker?.healthProbe?.required === true && broker?.healthProbe?.check === 'metadata-only' && broker?.healthProbe?.mutating === false && broker?.healthProbe?.runtimeStatus === 'pending', 'B26 Kafka health probe must be metadata-only, non-mutating and pending', errors)
}

function validateTopics(manifest, errors) {
  const topics = manifest.topics ?? []
  requireArray(topics, 'topics', errors, 10)
  unique(topics.map((topic) => topic?.name), 'topic names', errors)
  const actualTopicBindings = topics
    .map((topic) => ({
      name: topic?.name,
      ownerService: topic?.ownerService,
      producerPrincipal: topic?.producerPrincipal,
      consumerGroups: (topic?.consumerGroups ?? [])
        .map((group) => `${group?.name}:${group?.service}:${group?.principal}:${String(group?.replayEnabled)}`)
        .sort(),
      acl: (topic?.acl ?? [])
        .map((entry) => `${entry?.principal}:${entry?.operation}:${entry?.effect}`)
        .sort(),
    }))
    .sort((left, right) => String(left.name).localeCompare(String(right.name), 'en'))
  requireCondition(
    stableJson(actualTopicBindings) === stableJson([...expectedTopicBindings]
      .sort((left, right) => String(left.name).localeCompare(String(right.name), 'en'))),
    'B26 topic owner, consumer-group and ACL bindings must exactly match the frozen M1-006/M1-015 policy',
    errors,
  )
  const groupNames = []
  for (const topic of topics) {
    requireCondition(/^platform\.[a-z0-9.-]+\.v[0-9]+$/.test(topic?.name ?? ''), `${topic?.name} topic name is invalid`, errors)
    requireString(topic?.ownerService, `${topic?.name}.ownerService`, errors)
    requireCondition(/^[a-z][a-z0-9-]+-service$/.test(topic?.ownerService ?? '') && topic.ownerService !== 'api-gateway', `${topic?.name} ownerService must be a domain or platform service`, errors)
    requireString(topic?.purpose, `${topic?.name}.purpose`, errors)
    requireCondition(Number.isInteger(topic?.partitions) && topic.partitions >= 3, `${topic?.name} must have at least 3 partitions`, errors)
    requireCondition(topic?.partitionKey === 'aggregateId', `${topic?.name} partition key must be aggregateId`, errors)
    requireCondition(Number.isInteger(topic?.retentionMs) && topic.retentionMs >= 86400000, `${topic?.name} retention must be at least one day`, errors)
    requireCondition(topic?.cleanupPolicy === 'delete', `${topic?.name} cleanup policy must be delete`, errors)
    requireCondition(Number.isInteger(topic?.replicationFactor) && topic.replicationFactor >= 3, `${topic?.name} production replication factor must be at least 3`, errors)
    requireCondition(Number.isInteger(topic?.minInSyncReplicas) && topic.minInSyncReplicas >= 2 && topic.minInSyncReplicas < topic.replicationFactor, `${topic?.name} min ISR must be >=2 and below replication factor`, errors)
    requireCondition(topic?.localRuntimeOverride?.replicationFactor === 1 && topic?.localRuntimeOverride?.minInSyncReplicas === 1, `${topic?.name} local override must be explicit single-broker compatibility`, errors)
    requireString(topic?.producerPrincipal, `${topic?.name}.producerPrincipal`, errors)
    requireCondition(/^svc\.[a-z][a-z0-9-]+$/.test(topic?.producerPrincipal ?? ''), `${topic?.name} producer must be a workload principal`, errors)
    requireCondition(topic?.producerPrincipal === `svc.${topic?.ownerService}`, `${topic?.name} producer principal must match its owner service`, errors)
    requireArray(topic?.consumerGroups, `${topic?.name}.consumerGroups`, errors, 1)
    requireArray(topic?.acl, `${topic?.name}.acl`, errors, 2)
    const allowedPrincipals = new Set([topic.producerPrincipal])
    for (const group of topic.consumerGroups ?? []) {
      groupNames.push(group?.name)
      allowedPrincipals.add(group?.principal)
      requireCondition(/^cg\.[a-z0-9.-]+$/.test(group?.name ?? ''), `${topic?.name} consumer group name is invalid`, errors)
      requireCondition(group?.principal === group?.name, `${topic?.name} consumer group principal must equal its group`, errors)
      requireString(group?.service, `${topic?.name}.consumerGroup.service`, errors)
      requireCondition(/^[a-z][a-z0-9-]+-service$/.test(group?.service ?? '') && group.service !== 'api-gateway', `${topic?.name}.${group?.name} consumer must be a service`, errors)
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
    const aclIdentities = (topic.acl ?? []).map((acl) => `${acl?.principal}:${acl?.operation}`)
    unique(aclIdentities, `${topic?.name} ACL identities`, errors)
    requireCondition((topic.acl ?? []).length === (topic.consumerGroups ?? []).length + 1, `${topic?.name} must grant exactly one WRITE and one READ per consumer group`, errors)
    for (const group of topic.consumerGroups ?? []) {
      requireCondition((topic.acl ?? []).filter((acl) => acl?.principal === group?.principal && acl?.operation === 'READ').length === 1, `${topic?.name}.${group?.name} must have exactly one READ ACL`, errors)
    }
  }
  unique(groupNames, 'consumer group names', errors)
  requireCondition(topics.some((topic) => topic.name === 'platform.events.dlq.v1'), 'DLQ topic is missing', errors)
}

function validateOutboxAndRecovery(manifest, errors) {
  const outbox = manifest.outbox
  requireCondition(outbox?.storage === 'service-owned-mysql' && outbox?.sameTransactionAsAggregate === true && outbox?.publishAfterCommit === true, 'Outbox must be service-owned and committed with the aggregate', errors)
  requireCondition(outbox?.tablePattern === '<service>_outbox_event', 'Outbox table pattern must remain service-owned', errors)
  requireCondition(outbox?.eventImmutableAfterCommit === true && outbox?.delivery === 'at-least-once' && outbox?.exactlyOnceClaim === false, 'Outbox delivery semantics are unsafe or overstated', errors)
  requireCondition(outbox?.publisher?.claimStrategy === 'row-lock-skip-locked', 'Outbox publisher must use bounded row claims', errors)
  requireCondition(outbox?.publisher?.publishConfirmation === 'broker-ack-before-mark-published', 'Outbox publisher must mark published after broker acknowledgement', errors)
  requireCondition(outbox?.publisher?.leaseMs === 30000 && outbox?.publisher?.batchSize === 100 && outbox?.publisher?.maxInFlight === 100, 'Outbox publisher bounds must match the static foundation', errors)
  requireCondition(outbox?.publisher?.offsetOrState === 'service-owned-outbox-state', 'Outbox publisher state must remain service-owned', errors)
  requireExactArray(outbox?.stateModel, ['PENDING', 'PUBLISHING', 'PUBLISHED', 'RETRY', 'DLQ'], 'outbox.stateModel', errors)
  requireExactArray(outbox?.requiredFields, ['eventId', 'eventName', 'requestId', 'traceId', 'schemaVersion', 'aggregateId', 'dedupeKey', 'payload'], 'outbox.requiredFields', errors)
  requireExactArray(outbox?.forbiddenCoordination, ['kafka-rpc', 'distributed-two-phase-commit', 'shared-table-write'], 'outbox.forbiddenCoordination', errors)

  const reliability = manifest.consumerReliability
  requireCondition(reliability?.atLeastOnce === true, 'consumer reliability must be at-least-once', errors)
  const dedupe = reliability?.deduplication
  requireCondition(dedupe?.required === true && dedupe?.effectAndDeduplicationMustBeAtomic === true && dedupe?.offsetCommitAfterEffect === true && dedupe?.duplicateEffectForbidden === true, 'consumer deduplication boundary is incomplete', errors)
  requireCondition(JSON.stringify(dedupe?.uniqueKey) === JSON.stringify(['consumerGroup', 'eventId']), 'consumer dedupe key must be consumerGroup + eventId', errors)
  requireCondition(dedupe?.storage === 'consumer-service-owned-idempotency-record', 'consumer dedupe records must be service-owned', errors)
  requireCondition(dedupe?.secondaryKey === 'dedupeKey', 'consumer secondary dedupe key must be dedupeKey', errors)
  const retry = reliability?.retry
  requireCondition(retry?.bounded === true && Number.isInteger(retry?.maxAttempts) && retry.maxAttempts >= 2 && retry.maxAttempts <= 10, 'retry must be bounded between 2 and 10 attempts', errors)
  requireCondition(retry?.backoff === 'exponential-with-jitter' && retry?.exhaustedAction === 'route-to-dlq', 'retry backoff or exhaustion action is invalid', errors)
  requireCondition(retry?.baseDelayMs === 1000 && retry?.maxDelayMs === 60000, 'retry timing bounds must match the static foundation', errors)
  requireExactArray(retry?.retryableFailureCodes, ['TIMEOUT', 'TEMPORARY_UNAVAILABLE', 'CONFLICT_RETRYABLE'], 'retry.retryableFailureCodes', errors)
  requireExactArray(retry?.nonRetryableFailureCodes, ['SCHEMA_INVALID', 'FORBIDDEN', 'OWNER_MISMATCH', 'STALE_VERSION'], 'retry.nonRetryableFailureCodes', errors)
  const dlq = reliability?.dlq
  requireCondition(dlq?.topic === 'platform.events.dlq.v1' && dlq?.operatorOnly === true && dlq?.domainFactsDirectWriteAllowed === false, 'DLQ boundary is incomplete', errors)
  requireCondition(dlq?.preserveRawAuthorizationHeaders === false, 'DLQ must not preserve authorization headers', errors)
  requireExactArray(dlq?.requiredOriginalFields, ['eventId', 'requestId', 'traceId', 'schemaVersion', 'aggregateId', 'dedupeKey'], 'dlq.requiredOriginalFields', errors)
  requireExactArray(dlq?.requiredFailureFields, ['consumerGroup', 'failureCode', 'attempt', 'failedAt', 'recoveryState'], 'dlq.requiredFailureFields', errors)
  const replay = reliability?.replay
  requireCondition(replay?.source === 'immutable-outbox-or-dlq-record' && replay?.sameConsumerPath === true && replay?.dedupeStillEnabled === true, 'replay must use immutable source and the normal dedupe path', errors)
  requireCondition(replay?.replayRunIdRequired === true && replay?.auditRequired === true && replay?.operatorApprovalRequired === true && replay?.clientTriggered === false && replay?.directDomainWrite === false, 'replay authorization boundary is incomplete', errors)
  requireCondition(replay?.maxBatchSize === 1000 && replay?.runtimeStatus === 'pending', 'replay must remain bounded and runtime-pending', errors)
  const ordering = reliability?.ordering
  requireCondition(ordering?.partitionKey === 'aggregateId' && ordering?.sameAggregateOrdered === true && ordering?.crossAggregateOrder === 'not-guaranteed', 'ordering policy must be aggregate scoped', errors)
  requireCondition(ordering?.sequenceField === 'payload.aggregateVersion' && ordering?.outOfOrderPolicy === 'bounded-hold-then-dlq', 'out-of-order policy is incomplete', errors)
  requireCondition(Number.isInteger(ordering?.maxBufferSize) && ordering.maxBufferSize > 0 && Number.isInteger(ordering?.maxWaitMs) && ordering.maxWaitMs > 0, 'out-of-order buffering must be bounded', errors)
  requireCondition(ordering?.staleEventPolicy === 'dedupe-audit-and-skip' && ordering?.manualRecoveryOwner === 'workflow-service', 'stale/out-of-order recovery boundary is unsafe', errors)
  requireCondition(ordering?.runtimeStatus === 'pending', 'ordering runtime status must remain pending', errors)
  const saga = manifest.saga
  requireCondition(saga?.coordinator === 'workflow-service' && saga?.integrationFactsOnly === true && saga?.commandsViaVersionedApi === true, 'Saga coordinator boundary is invalid', errors)
  requireCondition(saga?.kafkaRpc === false && saga?.twoPhaseCommit === false, 'Saga must not use Kafka RPC or two-phase commit', errors)
  requireCondition(saga?.compensation?.required === true && saga?.compensation?.idempotent === true && saga?.compensation?.versioned === true && saga?.compensation?.neverDirectlyWritesForeignSchema === true && saga?.compensation?.failureState === 'COMPENSATION_PENDING', 'Saga compensation boundary is incomplete', errors)
  requireExactArray(saga?.manualRecovery?.requiredFor, ['compensation-exhausted', 'irreconcilable-ordering-gap', 'schema-incompatible-event'], 'saga.manualRecovery.requiredFor', errors)
  requireCondition(saga?.manualRecovery?.owner === 'workflow-service' && saga?.manualRecovery?.approvalRequired === true && saga?.manualRecovery?.twoPersonReview === true && saga?.manualRecovery?.clientTriggered === false && saga?.manualRecovery?.auditReferenceRequired === true, 'manual recovery boundary is incomplete', errors)
  requireExactArray(manifest.eventEnvelope?.required, requiredEnvelope, 'eventEnvelope.required', errors)
  requireExactArray(manifest.eventEnvelope?.serverOwned, ['eventId', 'occurredAt', 'actorId', 'traceId', 'requestId', 'schemaVersion', 'dedupeKey'], 'eventEnvelope.serverOwned', errors)
  requireCondition(manifest.eventEnvelope?.partitionKey === 'aggregateId' && manifest.eventEnvelope?.payloadMustBeObject === true && manifest.eventEnvelope?.immutableAfterCommit === true, 'event envelope static boundary is incomplete', errors)
}

function resolvePointer(document, reference) {
  if (!reference?.startsWith('#/')) return undefined
  return reference.slice(2).split('/').reduce((current, segment) => current?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')], document)
}

function validateFragment(manifest, fragment, catalog, errors) {
  requireExactKeys(fragment, ['version', 'events', 'payloadSchemas'], 'B26 event fragment', errors)
  requireCondition(fragment?.version === '1.0.0', 'B26 event fragment version must be 1.0.0', errors)
  requireArray(fragment?.events, 'B26 event fragment events', errors, 7)
  requireCondition(isRecord(fragment?.payloadSchemas) && Object.keys(fragment.payloadSchemas).length === fragment.events.length, 'B26 payload schema count must match event count', errors)
  requireCondition(JSON.stringify(Object.keys(fragment?.payloadSchemas ?? {}).sort()) === JSON.stringify(Object.keys(expectedB26PayloadRequired).sort()), 'B26 payload schema registry must match the exact seven frozen seed schemas', errors)
  for (const [schemaName, requiredFields] of Object.entries(expectedB26PayloadRequired)) {
    requireExactArray(fragment?.payloadSchemas?.[schemaName]?.required, requiredFields, `${schemaName}.required`, errors)
  }
  const names = []
  const actualRoutingBindings = (manifest.eventRouting ?? [])
    .map((item) => `${item?.eventName}|${item?.topic}|${item?.partitionKey}|${[...(item?.consumerGroups ?? [])].sort().join(',')}`)
    .sort()
  requireCondition(
    stableJson(actualRoutingBindings) === stableJson([...expectedEventRoutingBindings].sort()),
    'B26 event routing topic, partition key and consumer groups must exactly match the frozen M1-006/M1-008/M1-015 policy',
    errors,
  )
  const routing = new Map((manifest.eventRouting ?? []).map((item) => [item.eventName, item]))
  const catalogEvents = new Map((catalog?.events ?? []).map((event) => [event.eventName, event]))
  for (const event of fragment.events ?? []) {
    requireExactKeys(event, ['eventName', 'domain', 'version', 'schema', 'aggregateType', 'aggregateIdField', 'x-envelope-required', 'payloadSchema', 'compatibility'], `${event?.eventName ?? 'B26 event'} fragment`, errors)
    requireExactKeys(event?.payloadSchema, ['$ref'], `${event?.eventName ?? 'B26 event'} payloadSchema`, errors)
    requireExactKeys(event?.compatibility, ['strategy', 'breakingChange', 'consumerRule'], `${event?.eventName ?? 'B26 event'} compatibility`, errors)
    names.push(event?.eventName)
    requireCondition(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+\.v[0-9]+$/.test(event?.eventName ?? ''), `${event?.eventName} event name is invalid`, errors)
    requireCondition(event?.version === 1 && (event?.schema === 'workflow.event.v1' || event?.schema === 'workflow.saga.v1'), `${event?.eventName} event version/schema is invalid`, errors)
    requireCondition(event?.['x-envelope-required']?.length === requiredEnvelope.length, `${event?.eventName} envelope length is invalid`, errors)
    for (const field of requiredEnvelope) requireCondition(event?.['x-envelope-required']?.includes(field), `${event?.eventName} missing envelope field ${field}`, errors)
    const payload = resolvePointer(fragment, event?.payloadSchema?.$ref)
    requireCondition(isRecord(payload) && payload.type === 'object' && payload.additionalProperties === false, `${event?.eventName} payload schema must be a closed object`, errors)
    requireCondition(Array.isArray(payload?.required) && payload.required.length >= 5, `${event?.eventName} payload must have required fields`, errors)
    requireCondition(event?.['x-kafka'] === undefined, `${event?.eventName} fragment must not duplicate canonical Kafka governance`, errors)
    const canonicalEvent = catalogEvents.get(event?.eventName)
    const governance = canonicalEvent?.['x-p1r-governance']
    requireCondition(canonicalEvent?.status === 'CANONICAL_D2', `${event?.eventName} must be a CANONICAL_D2 catalog event`, errors)
    for (const field of ['domain', 'version', 'schema', 'aggregateType', 'aggregateIdField']) {
      requireCondition(event?.[field] === canonicalEvent?.[field], `${event?.eventName} fragment ${field} must exactly match the canonical catalog`, errors)
    }
    requireCondition(stableJson(event?.payloadSchema) === stableJson(canonicalEvent?.payloadSchema), `${event?.eventName} fragment payloadSchema must exactly match the canonical catalog`, errors)
    requireCondition(stableJson(event?.['x-envelope-required']) === stableJson(canonicalEvent?.['x-envelope-required']), `${event?.eventName} fragment envelope fields must exactly match the canonical catalog`, errors)
    requireCondition(stableJson(event?.compatibility) === stableJson(canonicalEvent?.compatibility), `${event?.eventName} fragment compatibility must exactly match the canonical catalog`, errors)
    requireCondition(stableJson(payload) === stableJson(resolvePointer(catalog, canonicalEvent?.payloadSchema?.$ref)), `${event?.eventName} fragment payload definition must exactly match the canonical catalog`, errors)
    requireCondition(governance?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${event?.eventName} runtime status must remain NOT_RUNTIME_VERIFIED`, errors)
    requireCondition(governance?.transport?.topic === routing.get(event?.eventName)?.topic, `${event?.eventName} Kafka topic routing mismatch`, errors)
    requireCondition(governance?.transport?.partitionKey === 'aggregateId' && governance?.transport?.delivery === 'at-least-once' && governance?.transport?.bindingVersion === '0.5.0', `${event?.eventName} Kafka governance is incomplete`, errors)
    requireCondition(routing.get(event?.eventName)?.partitionKey === 'aggregateId', `${event?.eventName} B26 routing partition key must be aggregateId`, errors)
    const governedGroups = (governance?.consumers ?? []).map((consumer) => consumer.consumerGroup).sort()
    const routedGroups = [...(routing.get(event?.eventName)?.consumerGroups ?? [])].sort()
    requireCondition(JSON.stringify(governedGroups) === JSON.stringify(routedGroups), `${event?.eventName} consumer governance differs from B26 static routing`, errors)
    requireCondition(isRecord(event?.compatibility) && event.compatibility.strategy === 'additive', `${event?.eventName} compatibility policy must be additive`, errors)
  }
  unique(names, 'B26 event names', errors)
  unique(Object.keys(fragment.payloadSchemas ?? {}), 'B26 payload schema names', errors)
  requireCondition(names.every((eventName) => routing.has(eventName)), 'B26 event routing must cover every B26 reliability fragment event', errors)
  requireCondition(fragment.asyncapi === undefined, 'B26 fragment must not define a second AsyncAPI source', errors)
}

function validateM1016Fragment(manifest, fragment, catalog, errors) {
  requireExactKeys(fragment, ['version', 'events', 'payloadSchemas'], 'M1-016 notification/sync/support event fragment', errors)
  requireCondition(fragment?.version === '2.0.0', 'M1-016 event fragment version must be 2.0.0', errors)
  requireCondition(Array.isArray(fragment?.events) && fragment.events.length === expectedM1016EventNames.length, 'M1-016 event fragment must contain exactly eight events', errors)
  requireCondition(
    stableJson((fragment?.events ?? []).map((event) => event?.eventName)) === stableJson(expectedM1016EventNames),
    'M1-016 event fragment event order and names must exactly match the frozen v2 source',
    errors,
  )
  requireCondition(
    isRecord(fragment?.payloadSchemas)
      && stableJson(Object.keys(fragment.payloadSchemas).sort()) === stableJson(expectedM1016PayloadSchemaNames),
    'M1-016 payload schema registry must exactly match the eight frozen v2 event payloads',
    errors,
  )
  requireCondition(fragment?.asyncapi === undefined, 'M1-016 fragment must not define a second AsyncAPI source', errors)

  const routing = new Map((manifest?.eventRouting ?? []).map((item) => [item?.eventName, item]))
  const catalogEvents = new Map((catalog?.events ?? []).map((event) => [event?.eventName, event]))
  const names = []
  for (const event of fragment?.events ?? []) {
    const expected = expectedM1016Events[event?.eventName]
    names.push(event?.eventName)
    requireCondition(expected !== undefined, `${event?.eventName ?? 'M1-016 event'} is not an allowed M1-016 event`, errors)
    requireExactKeys(event, ['eventName', 'domain', 'version', 'schema', 'aggregateType', 'aggregateIdField', 'x-envelope-required', 'payloadSchema', 'compatibility'], `${event?.eventName ?? 'M1-016 event'} fragment`, errors)
    requireExactKeys(event?.payloadSchema, ['$ref'], `${event?.eventName ?? 'M1-016 event'} payloadSchema`, errors)
    requireExactKeys(event?.compatibility, ['strategy', 'breakingChange', 'consumerRule'], `${event?.eventName ?? 'M1-016 event'} compatibility`, errors)
    if (!expected) continue

    requireCondition(event?.version === 2 && event?.domain === expected.domain && event?.schema === expected.schema, `${event.eventName} version/domain/schema is invalid`, errors)
    requireCondition(event?.aggregateType === expected.aggregateType && event?.aggregateIdField === expected.aggregateIdField, `${event.eventName} aggregate identity is invalid`, errors)
    requireCondition(event?.payloadSchema?.$ref === `#/payloadSchemas/${expected.payloadSchema}`, `${event.eventName} payloadSchema.$ref must match the frozen M1-016 mapping`, errors)
    requireExactArray(event?.['x-envelope-required'], requiredEnvelope, `${event.eventName}.x-envelope-required`, errors)
    requireCondition(event?.compatibility?.strategy === 'additive', `${event.eventName} compatibility policy must be additive`, errors)

    const payload = resolvePointer(fragment, event?.payloadSchema?.$ref)
    requireCondition(isRecord(payload) && payload.type === 'object' && payload.additionalProperties === false, `${event.eventName} payload schema must be a closed object`, errors)
    requireCondition(Array.isArray(payload?.required) && payload.required.length > 0, `${event.eventName} payload must have required fields`, errors)
    requireCondition(event?.['x-kafka'] === undefined, `${event.eventName} fragment must not duplicate canonical Kafka governance`, errors)

    const route = routing.get(event.eventName)
    requireCondition(route?.topic === expected.topic && route?.partitionKey === 'aggregateId', `${event.eventName} B26 routing must match its exact topic and aggregate partition key`, errors)
    requireCondition(stableJson(route?.consumerGroups) === stableJson(expected.consumers.map(([, group]) => group)), `${event.eventName} B26 consumer groups must exactly match the frozen source subscriptions`, errors)

    const canonicalEvent = catalogEvents.get(event.eventName)
    const governance = canonicalEvent?.['x-p1r-governance']
    requireCondition(canonicalEvent?.status === 'CANONICAL_D2', `${event.eventName} must be a CANONICAL_D2 catalog event`, errors)
    for (const field of ['domain', 'version', 'schema', 'aggregateType', 'aggregateIdField']) {
      requireCondition(event?.[field] === canonicalEvent?.[field], `${event.eventName} fragment ${field} must exactly match the canonical catalog`, errors)
    }
    requireCondition(stableJson(event?.payloadSchema) === stableJson(canonicalEvent?.payloadSchema), `${event.eventName} fragment payloadSchema must exactly match the canonical catalog`, errors)
    requireCondition(stableJson(event?.['x-envelope-required']) === stableJson(canonicalEvent?.['x-envelope-required']), `${event.eventName} fragment envelope fields must exactly match the canonical catalog`, errors)
    requireCondition(stableJson(event?.compatibility) === stableJson(canonicalEvent?.compatibility), `${event.eventName} fragment compatibility must exactly match the canonical catalog`, errors)
    requireCondition(stableJson(payload) === stableJson(resolvePointer(catalog, canonicalEvent?.payloadSchema?.$ref)), `${event.eventName} fragment payload definition must exactly match the canonical catalog`, errors)
    requireCondition(governance?.status === 'CANONICAL_D2' && governance?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${event.eventName} catalog governance must remain canonical D2 and NOT_RUNTIME_VERIFIED`, errors)
    requireCondition(governance?.scope === 'CROSS_SERVICE_INTEGRATION_FACT', `${event.eventName} governance scope must be a cross-service integration fact`, errors)
    requireCondition(governance?.producer?.service === expected.producer && governance?.producer?.dataOwner === expected.producer && governance?.producer?.outboxRequired === true, `${event.eventName} producer/data owner governance is invalid`, errors)
    requireCondition(governance?.transport?.protocol === 'kafka' && governance?.transport?.topic === expected.topic && governance?.transport?.partitionKey === 'aggregateId' && governance?.transport?.aggregateIdSource === `payload.${expected.aggregateIdField}` && governance?.transport?.delivery === 'at-least-once' && governance?.transport?.bindingVersion === '0.5.0', `${event.eventName} Kafka governance is incomplete`, errors)
    const governedConsumers = (governance?.consumers ?? []).map((consumer) => [consumer?.service, consumer?.consumerGroup])
    requireCondition(stableJson(governedConsumers) === stableJson(expected.consumers), `${event.eventName} consumer governance differs from the frozen source subscriptions`, errors)
    requireCondition(governance?.schema?.schemaVersion === expected.schema && governance?.schema?.payloadRef === event?.payloadSchema?.$ref && governance?.schema?.compatibility === 'additive', `${event.eventName} schema governance is incomplete`, errors)
  }
  unique(names, 'M1-016 event names', errors)
  requireCondition(names.every((eventName) => routing.has(eventName)), 'B26 routing must cover every M1-016 notification/sync/support event', errors)
}

function validateTelemetryBridge(manifest, telemetrySchema, telemetryPolicy, errors) {
  const bridge = manifest.telemetryBridge
  requireCondition(bridge?.eventContractIsSeparateFromTelemetryEnvelope === true, 'B26 must keep event and telemetry envelopes distinct', errors)
  requireCondition(bridge?.rawEventPayloadInLogs === false && bridge?.sensitiveDataPolicy === 'redact-or-do-not-record', 'B26 telemetry payload policy is unsafe', errors)
  requireCondition(bridge?.schemaPath === telemetrySchemaRelativePath && bridge?.policyPath === telemetryPolicyRelativePath, 'B26 telemetry bridge source paths are invalid', errors)
  requireExactArray(bridge?.requiredCorrelationFields, ['eventId', 'requestId', 'traceId'], 'telemetryBridge.requiredCorrelationFields', errors)
  requireCondition(bridge?.schemaVersionMapping === 'eventName-and-eventVersion' && bridge?.runtimeStatus === 'pending', 'B26 telemetry bridge version/runtime boundary is invalid', errors)
  for (const field of ['eventId', 'requestId', 'traceId']) requireCondition(telemetrySchema?.required?.includes(field), `telemetry schema is missing ${field}`, errors)
  for (const field of ['eventId', 'requestId', 'traceId']) requireCondition(telemetryPolicy?.envelope?.required?.includes(field), `telemetry policy is missing ${field}`, errors)
  requireCondition(telemetrySchema?.additionalProperties === false && telemetryPolicy?.defaultEffect === 'deny', 'telemetry schema/policy must be closed and deny by default', errors)
}

export function validateB26EventRuntime(manifest, fragment, {
  localPorts = readJson(localPortsRelativePath),
  catalog = readJson(catalogRelativePath),
  telemetrySchema = readJson(telemetrySchemaRelativePath),
  telemetryPolicy = readJson(telemetryPolicyRelativePath),
  m1016Fragment,
  runtimeRequested = false,
} = {}) {
  const errors = []
  if (!isRecord(manifest)) errors.push('B26 manifest must be a JSON object')
  if (!isRecord(fragment)) errors.push('B26 event fragment must be a JSON object')
  if (!isRecord(catalog)) errors.push('canonical event catalog must be a JSON object')
  if (m1016Fragment !== undefined && !isRecord(m1016Fragment)) errors.push('M1-016 event fragment must be a JSON object')
  if (errors.length === 0) {
    validateManifestShape(manifest, 'manifest', errors)
    scanForUnsafeValues(manifest, 'manifest', errors)
    scanForUnsafeValues(fragment, 'fragment', errors)
    scanFragmentRuntimeClaimKeys(fragment, 'fragment', errors)
    errors.push(...validateEventPayloadSchemas(fragment.payloadSchemas, 'B26 fragment payloadSchemas'))
    if (m1016Fragment !== undefined) {
      scanForUnsafeValues(m1016Fragment, 'm1016Fragment', errors)
      scanFragmentRuntimeClaimKeys(m1016Fragment, 'm1016Fragment', errors)
      errors.push(...validateEventPayloadSchemas(m1016Fragment.payloadSchemas, 'M1-016 fragment payloadSchemas'))
    }
    errors.push(...validateCanonicalEventPayloadMappings(catalog.events, 'B26 canonical catalog events'))
    validateIdentity(manifest, errors)
    validateExecutionAndSafety(manifest, errors)
    validateRuntimeGate(manifest, errors)
    validateBroker(manifest, localPorts, errors)
    validateTopics(manifest, errors)
    validateOutboxAndRecovery(manifest, errors)
    validateFragment(manifest, fragment, catalog, errors)
    if (m1016Fragment !== undefined) validateM1016Fragment(manifest, m1016Fragment, catalog, errors)
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
    fragmentEventCount: fragment?.events?.length ?? 0,
    m1016EventCount: m1016Fragment?.events?.length ?? 0,
    routedCanonicalEventCount: manifest?.eventRouting?.length ?? 0,
    fragmentPayloadSchemaCount: Object.keys(fragment?.payloadSchemas ?? {}).length,
    m1016PayloadSchemaCount: Object.keys(m1016Fragment?.payloadSchemas ?? {}).length,
    totalFragmentEventCount: (fragment?.events?.length ?? 0) + (m1016Fragment?.events?.length ?? 0),
    totalFragmentPayloadSchemaCount: Object.keys(fragment?.payloadSchemas ?? {}).length + Object.keys(m1016Fragment?.payloadSchemas ?? {}).length,
    // Compatibility aliases retained for existing callers. Prefer the explicit fields above.
    eventCount: fragment?.events?.length ?? 0,
    routeCount: manifest?.eventRouting?.length ?? 0,
    payloadSchemaCount: Object.keys(fragment?.payloadSchemas ?? {}).length,
    consumerGroupCount: (manifest?.topics ?? []).reduce((total, topic) => total + (topic?.consumerGroups?.length ?? 0), 0),
    errors,
  }
}

export function readB26Inputs() {
  return {
    manifest: readJson(manifestRelativePath),
    fragment: readJson(fragmentRelativePath),
    m1016Fragment: readJson(m1016FragmentRelativePath),
    catalog: readJson(catalogRelativePath),
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    const { manifest, fragment, m1016Fragment } = readB26Inputs()
    const summary = validateB26EventRuntime(manifest, fragment, { m1016Fragment, runtimeRequested: process.argv.includes('--runtime') })
    console.log(JSON.stringify(summary, null, 2))
    if (summary.result !== 'PASS') process.exitCode = 1
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', gate: 'B26', errors: [error instanceof Error ? error.message : String(error)] }, null, 2))
    process.exitCode = 1
  }
}
