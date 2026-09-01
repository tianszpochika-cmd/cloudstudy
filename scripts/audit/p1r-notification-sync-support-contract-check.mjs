import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * P1R-M1-016 is a contract/static gate.  This module intentionally never
 * turns a Java smoke test, an in-memory adapter, or a B26 manifest into
 * runtime evidence.  The policy and all projections are source-bound and
 * unknown data fails closed.
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = path.resolve(moduleDir, '../..');
export const DEFAULT_POLICY_PATH = 'config/p1r-notification-sync-support-contract.v1.json';
export const DEFAULT_CANONICAL_OPENAPI = 'packages/contracts/openapi/v1/openapi.json';
export const DEFAULT_EVENT_CATALOG = 'packages/contracts/events/v1/catalog.json';
export const DEFAULT_B26_RUNTIME = 'config/b26-event-runtime.json';
export const DEFAULT_GATEWAY_SOURCE = DEFAULT_CANONICAL_OPENAPI;

// The policy is frozen at the source checkpoint.  Update this constant only
// in the same reviewed change as the policy; the pending sentinel is a gate
// failure rather than an opt-out.
export const FROZEN_POLICY_SHA256 = 'f5beb694bb91ecde227d1405c56f7fdc73d71169d2bbe7b5c32378c3235f8ea7';

export const ROOT_KEYS = Object.freeze([
  '$schema', 'schemaVersion', 'task', 'phase', 'startCommit', 'sourceBaseline',
  'maturity', 'runtimeStatus', 'collectionPolicy', 'canonicalSources',
  'compatibilityPromotion', 'ownership', 'authority', 'notification', 'sync',
  'support', 'events', 'legacyCompatibility', 'runtimeBoundary',
  'requiredAcceptanceEvidence', 'adversarialCases',
]);

const COLLECTION_KEYS = Object.freeze([
  'unknownFieldDecision', 'unknownEnumDecision', 'additionalProperties',
  'clientAuthorityExpansion', 'unverifiedRuntimeClaim', 'implicitDefault',
]);
const CANONICAL_SOURCE_KEYS = Object.freeze([
  'productRequirements', 'featureMatrix', 'phase1BusinessJourney',
  'phase1BusinessOperations', 'phase1IntegrationMatrix', 'phase1StateAndRecovery',
  'ownershipDecision', 'architectureRules', 'sourceBaseline',
  'historicalNotificationOpenApi', 'canonicalNotificationOpenApiFamily',
  'historicalLearnerSupportOpenApi', 'historicalAdminSupportOpenApi',
  'gatewayBoundary', 'canonicalEventFragment',
  'eventCatalog', 'eventReliabilityPolicy',
]);
const PROMOTION_KEYS = Object.freeze([
  'id', 'sourceContractBaseline', 'previousPromotion', 'previousPromotionContract',
  'immutableGovernanceBaseline', 'runtimeStatus', 'scope', 'promotionMode',
  'allowsHistoricalV1Promotion', 'allowsDualPublish', 'approvedSourceFiles',
  'requiredCompatibilityChecks', 'b26StaticPolicy', 'canonicalOpenApiSource',
  'canonicalEventSource',
]);
const B26_PROMOTION_KEYS = Object.freeze([
  'contract', 'classification', 'runtimeEvidence', 'allowsRuntimePromotion',
  'requiresSeparateRuntimeEvidence',
]);
const OPENAPI_PROMOTION_KEYS = Object.freeze([
  'runtimeEvidence', 'sources', 'canonicalPolicySource',
  'promotionRequiresExactProjection', 'b11B5B13V1Promotion', 'b12Semantics',
]);
const OPENAPI_SOURCE_KEYS = Object.freeze([
  'surface', 'sourceFile', 'canonicalV2Projection', 'canonicalV2ProjectionMode', 'historicalV1Semantics',
  'classification', 'v2Policy',
]);
const EVENT_PROMOTION_KEYS = Object.freeze([
  'sourceFile', 'classification', 'runtimeEvidence', 'v1Semantics',
  'catalogProjection', 'promotionRequires',
]);
const CANONICAL_OPENAPI_SOURCE_SPECS = Object.freeze([
  {
    surface: 'B11_SYNC',
    sourceFile: 'packages/contracts/fragments/b11/b11-media-notification-offline.openapi.json',
    canonicalV2Projection: true,
    historicalV1Semantics: 'HISTORICAL_V1_OPERATIONS_ONLY',
    classification: 'M1016_SYNC_POLICY_PROJECTION_SOURCE',
    v2Policy: 'M1016_SYNC_FIELDS_AND_OWNER_POLICY',
  },
  {
    surface: 'B12_NOTIFICATION',
    sourceFile: 'packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json',
    canonicalV2Projection: true,
    historicalV1Semantics: 'HISTORICAL_V1_CANDIDATES_ONLY',
    classification: 'M1016_B12_CANONICAL_NOTIFICATION_FAMILY',
    v2Policy: 'M1016_NOTIFICATION_POLICY_PROJECTION',
  },
  {
    surface: 'B5_LEARNER_SUPPORT',
    sourceFile: 'packages/contracts/fragments/b5-commerce-admin.openapi.json',
    canonicalV2Projection: true,
    canonicalV2ProjectionMode: 'FIXED_PATH_METHOD_OPERATION_ID_ALLOWLIST',
    historicalV1Semantics: 'HISTORICAL_V1_OPERATIONS_ONLY',
    classification: 'M1016_SUPPORT_POLICY_PROJECTION_SOURCE',
    v2Policy: 'M1016_SUPPORT_SINGLE_OWNER_ADAPTER',
  },
  {
    surface: 'B13_ADMIN_SUPPORT',
    sourceFile: 'packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json',
    canonicalV2Projection: true,
    historicalV1Semantics: 'HISTORICAL_V1_OPERATIONS_ONLY',
    classification: 'M1016_SUPPORT_POLICY_PROJECTION_SOURCE',
    v2Policy: 'M1016_SUPPORT_SINGLE_OWNER_ADAPTER',
  },
]);
const APPROVED_SOURCE_FILES = Object.freeze([
  'config/p1r-notification-sync-support-contract.v1.json',
  'requirements/feature-matrix.md',
  'docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md',
  'docs/06-design/v2-980plus/phase1-business-operation/05-后台内容运营与客服业务流程.md',
  'docs/06-design/v2-980plus/phase1-business-operation/06-业务联调矩阵.md',
  'docs/06-design/v2-980plus/phase1-business-operation/07-状态权限异常恢复矩阵.md',
  'packages/contracts/fragments/b11/b11-media-notification-offline.openapi.json',
  'packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json',
  'packages/contracts/fragments/b5-commerce-admin.openapi.json',
  'packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json',
  'packages/contracts/fragments/p1r-gateway-boundary.openapi.json',
  'scripts/contracts/merge-b1-fragments.mjs',
  'packages/contracts/events/v1/fragments/m1-016-notification-sync-support-v2.events.json',
  'config/b26-event-runtime.json',
  'packages/contracts/events/v1/catalog.json',
  'packages/contracts/events/v1/reliability-policy.json',
]);
const FROZEN_POLICY_SOURCE_BASELINE = '878f9ebc0591844467ac79facf4f00296058137f';
const FROZEN_POLICY_START_COMMIT = '334447782ba22ceaa9c97dc2a6044c91ba75400a';
const CANONICAL_SOURCE_VALUES = Object.freeze({
  productRequirements: 'requirements/product-requirements.md',
  featureMatrix: 'requirements/feature-matrix.md',
  phase1BusinessJourney: 'docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md',
  phase1BusinessOperations: 'docs/06-design/v2-980plus/phase1-business-operation/05-后台内容运营与客服业务流程.md',
  phase1IntegrationMatrix: 'docs/06-design/v2-980plus/phase1-business-operation/06-业务联调矩阵.md',
  phase1StateAndRecovery: 'docs/06-design/v2-980plus/phase1-business-operation/07-状态权限异常恢复矩阵.md',
  ownershipDecision: 'docs/10-decisions/0014-phase1-support-privacy-ownership.md',
  architectureRules: 'AGENTS.md',
  sourceBaseline: FROZEN_POLICY_SOURCE_BASELINE,
  historicalNotificationOpenApi: 'packages/contracts/fragments/b11/b11-media-notification-offline.openapi.json',
  canonicalNotificationOpenApiFamily: 'packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json',
  historicalLearnerSupportOpenApi: 'packages/contracts/fragments/b5-commerce-admin.openapi.json',
  historicalAdminSupportOpenApi: 'packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json',
  gatewayBoundary: 'packages/contracts/fragments/p1r-gateway-boundary.openapi.json',
  canonicalEventFragment: 'packages/contracts/events/v1/fragments/m1-016-notification-sync-support-v2.events.json',
  eventCatalog: 'packages/contracts/events/v1/catalog.json',
  eventReliabilityPolicy: 'packages/contracts/events/v1/reliability-policy.json',
});
const REQUIRED_COMPATIBILITY_CHECKS = Object.freeze([
  'M1016_POLICY_SCHEMA_STRICT_AND_FAIL_CLOSED',
  'B12_NOTIFICATION_CANONICAL_B11_HISTORICAL',
  'B5_B13_SUPPORT_HISTORICAL_ADAPTER_ONLY',
  'NOTIFICATION_EVENT_TEMPLATE_SUBSCRIPTION_EXACT',
  'NOTIFICATION_SMS_ALLOWLIST_EXACT',
  'NOTIFICATION_RETRY_MAX_FIVE_INCLUDING_FIRST',
  'SYNC_OWNER_SPECIFIC_UNIQUE_WRITER',
  'SYNC_HASH_REPLAY_AND_CONFLICT_MATRIX',
  'SUPPORT_SINGLE_OWNER_ROUTE_SCHEMA_STATE',
  'SUPPORT_CONTENT_SCAN_REDACTION_AND_LEGAL_HOLD_DENY',
  'NO_HISTORICAL_V1_PROMOTION',
  'NO_DUAL_PUBLISH',
  'NO_RUNTIME_STATUS_PROMOTION',
]);
const AUTHORITY_KEYS = Object.freeze([
  'principalAndTenant', 'deviceBinding', 'notificationOwner', 'syncWriter',
  'supportOwner', 'workflowRole', 'clientMaySet', 'serverDerivedFields',
  'forbiddenClientAuthorityFields',
]);
const NOTIFICATION_KEYS = Object.freeze([
  'canonicalFamily', 'canonicalStatus', 'historicalFamilies', 'channels', 'allowedLocales',
  'categories', 'smsPolicy', 'preference', 'template', 'message', 'delivery', 'retry',
  'subscriptionPromotion', 'exactSubscriptions', 'futureUnboundTemplateAllowlist',
]);
const SUBSCRIPTION_PROMOTION_KEYS = Object.freeze([
  'status', 'exactSourceEventsOnly', 'futureUnboundSubscriptionsAreActive',
  'unknownProducerDecision', 'dualPublish',
]);
const SMS_KEYS = Object.freeze([
  'allowlistPurposes', 'allowlistCategories', 'prohibitedCategories',
  'securityAndNecessaryTransactionOverride', 'unknownPurposeDecision', 'marketingSms',
]);
const PREFERENCE_KEYS = Object.freeze([
  'requiredFields', 'allowedFields', 'clientWritableFields', 'serverDerivedFields',
  'compareAndSet', 'dndWindow', 'frequencyPolicy',
]);
const CAS_KEYS = Object.freeze(['required', 'versionField', 'expectedField', 'sameVersionSameDigest', 'staleVersion', 'missingVersion']);
const DND_KEYS = Object.freeze(['defaultStart', 'defaultEnd', 'timezone', 'securityAndNecessaryTransactionBypass']);
const FREQUENCY_KEYS = Object.freeze(['allowed', 'serverEnforced', 'unknownDecision']);
const TEMPLATE_KEYS = Object.freeze([
  'requiredFields', 'status', 'parameterValues', 'rawFreeText', 'rawTokenAudioPaymentCredential',
  'deepLinkPolicy', 'expiryPolicy', 'pinPolicy', 'redactionPolicy',
]);
const MESSAGE_KEYS = Object.freeze(['requiredFields', 'allowedFields', 'clientWritableFields', 'forbiddenFields', 'readReceipt']);
const READ_RECEIPT_KEYS = Object.freeze(['owner', 'writeKey', 'clientMaySet', 'readAt']);
const DELIVERY_KEYS = Object.freeze(['owner', 'states', 'terminalStates', 'dedupeKey', 'domainFactRollback', 'unknownChannelDecision']);
const RETRY_KEYS = Object.freeze([
  'policyRef', 'maxAttemptsIncludingFirst', 'firstAttemptNumber', 'maxRetriesAfterFirst', 'strategy',
  'retryableFailureClasses', 'nonRetryableFailureClasses', 'unknownFailureDecision',
  'workflowOnlyOperations', 'notificationOwnerKeepsDeliveryFact', 'domainFactMutation',
]);
const SYNC_KEYS = Object.freeze([
  'canonicalMode', 'centralWriter', 'clientKafkaProducer', 'requiredFields', 'contentVersionBinding',
  'serverDerivedFields', 'clientForbiddenFields', 'sequence', 'outcomes', 'conflict', 'ownerMap',
  'workflowRecovery',
]);
const CONTENT_VERSION_KEYS = Object.freeze(['requiredField', 'nonContentValue', 'clientMayOmit', 'clientMayInvent', 'staleOrUnknownDecision']);
const SEQUENCE_KEYS = Object.freeze([
  'scope', 'startsAt', 'ordering', 'sameEventSameHash', 'sameEventDifferentHash', 'gap', 'outOfOrder',
  'staleBaseVersion', 'futureBaseVersion', 'blindLastWriteWins',
]);
const CONFLICT_KEYS = Object.freeze(['requiredFields', 'reasonCodes', 'allowedResolutions', 'clientMerge', 'serverFactRollback']);
const WORKFLOW_RECOVERY_KEYS = Object.freeze(['owner', 'taskFields', 'mayWriteOwnerFact', 'closureRequiresOwnerReconciliation']);
const SUPPORT_KEYS = Object.freeze([
  'owner', 'canonicalRoutes', 'states', 'initialStates', 'terminalStates', 'transitions', 'categories',
  'ticket', 'contentReference', 'attachmentReference', 'message', 'assignment', 'sla', 'resolution',
  'retention', 'events',
]);
const SUPPORT_ROUTES_KEYS = Object.freeze(['learner', 'admin', 'sameOwnerSchema', 'sameStateMachine', 'sameIdempotencyDomain', 'routeAdapterRequiredUntilMigration']);
const TICKET_KEYS = Object.freeze(['requiredFields', 'clientWritableFields', 'serverDerivedFields', 'expectedVersion', 'unknownCategoryDecision']);
const EXPECTED_VERSION_KEYS = Object.freeze(['requiredForMutation', 'missingDecision', 'staleDecision', 'sameVersionSameDigest']);
const CONTENT_REF_KEYS = Object.freeze(['requiredFields', 'sha256Pattern', 'scanStatus', 'usableStatus', 'unknownScanDecision', 'rawFreeTextInTicketOrEvent', 'safePreview']);
const ATTACHMENT_REF_KEYS = Object.freeze(['requiredFields', 'scanStatus', 'usableStatus', 'authorization', 'forbiddenFields', 'unknownScanDecision']);
const SUPPORT_MESSAGE_KEYS = Object.freeze(['requiredFields', 'authorTypes', 'clientWritableFields', 'bodyContentRefUses', 'rawFreeTextInEventLogOrOrdinaryAudit', 'messageOrder', 'unknownAuthorDecision']);
const ASSIGNMENT_KEYS = Object.freeze(['requiredFields', 'historyRequired', 'historyFields', 'clientMaySet', 'unknownAssignmentDecision']);
const SLA_KEYS = Object.freeze(['requiredFields', 'statuses', 'historyRequired', 'historyFields', 'publicPromise', 'clientMaySet', 'unknownStatusDecision']);
const RESOLUTION_KEYS = Object.freeze(['requiredOn', 'requiredFields', 'ownerFactMutation', 'closeRequiresOwnerReconciliation']);
const RETENTION_KEYS = Object.freeze(['requiredFields', 'legalHoldStates', 'unknownLegalHoldDecision', 'purgeRequires', 'ttlIsNotRetentionPolicy', 'ownerReceiptRequired', 'policyOwner']);
const SUPPORT_EVENTS_KEYS = Object.freeze(['version', 'dualPublish', 'canonical', 'payloadForbiddenFields', 'payloadRequiredFields', 'sourceFactOwner']);
const EVENTS_KEYS = Object.freeze([
  'canonicalVersion', 'historicalVersion', 'dualPublish', 'canonicalPlanned', 'historicalOnly',
  'governanceBindings', 'sourceSubscriptionBindings', 'b26StaticProjection',
  'producerOwnerRequired', 'consumerBindingRequired', 'topicAndPartitionRequired', 'promotionStatus',
  'unboundEventDecision', 'payloadPolicy',
]);
const PAYLOAD_POLICY_KEYS = Object.freeze(['requiredEnvelopeFields', 'forbiddenFields']);

const EXACT_EVENT_GOVERNANCE_BINDINGS = Object.freeze([
  {
    eventName: 'notification.requested.v2',
    producer: 'notification-service',
    dataOwner: 'notification-service',
    topic: 'platform.notification.v1',
    aggregateIdSource: 'payload.notificationId',
    consumers: [
      { service: 'workflow-service', consumerGroup: 'cg.workflow-from-notification.v1' },
      { service: 'analytics-service', consumerGroup: 'cg.analytics-from-notification.v1' },
    ],
    partitionKey: 'aggregateId',
  },
  {
    eventName: 'notification.retry_scheduled.v2',
    producer: 'notification-service',
    dataOwner: 'notification-service',
    topic: 'platform.notification.v1',
    aggregateIdSource: 'payload.notificationId',
    consumers: [
      { service: 'workflow-service', consumerGroup: 'cg.workflow-from-notification.v1' },
    ],
    partitionKey: 'aggregateId',
  },
  {
    eventName: 'notification.recovery.completed.v2',
    producer: 'notification-service',
    dataOwner: 'notification-service',
    topic: 'platform.notification.v1',
    aggregateIdSource: 'payload.notificationId',
    consumers: [
      { service: 'workflow-service', consumerGroup: 'cg.workflow-from-notification.v1' },
      { service: 'analytics-service', consumerGroup: 'cg.analytics-from-notification.v1' },
    ],
    partitionKey: 'aggregateId',
  },
  {
    eventName: 'sync.command_receipted.v2',
    producer: 'learning-service',
    dataOwner: 'learning-service',
    topic: 'platform.learning.v1',
    aggregateIdSource: 'payload.clientEventId',
    consumers: [
      { service: 'workflow-service', consumerGroup: 'cg.workflow-from-learning.v1' },
    ],
    partitionKey: 'aggregateId',
  },
  {
    eventName: 'sync.conflict_detected.v2',
    producer: 'learning-service',
    dataOwner: 'learning-service',
    topic: 'platform.learning.v1',
    aggregateIdSource: 'payload.conflictId',
    consumers: [
      { service: 'workflow-service', consumerGroup: 'cg.workflow-from-learning.v1' },
    ],
    partitionKey: 'aggregateId',
  },
  {
    eventName: 'sync.recovered.v2',
    producer: 'learning-service',
    dataOwner: 'learning-service',
    topic: 'platform.learning.v1',
    aggregateIdSource: 'payload.conflictId',
    consumers: [
      { service: 'workflow-service', consumerGroup: 'cg.workflow-from-learning.v1' },
    ],
    partitionKey: 'aggregateId',
  },
  {
    eventName: 'support.ticket.created.v2',
    producer: 'admin-ops-service',
    dataOwner: 'admin-ops-service',
    topic: 'platform.admin-ops.v1',
    aggregateIdSource: 'payload.ticketId',
    consumers: [
      { service: 'notification-service', consumerGroup: 'cg.notification-from-admin-ops.v1' },
      { service: 'workflow-service', consumerGroup: 'cg.workflow-from-admin-ops.v1' },
      { service: 'audit-service', consumerGroup: 'cg.audit-from-admin-ops.v1' },
    ],
    partitionKey: 'aggregateId',
  },
  {
    eventName: 'support.ticket.resolved.v2',
    producer: 'admin-ops-service',
    dataOwner: 'admin-ops-service',
    topic: 'platform.admin-ops.v1',
    aggregateIdSource: 'payload.ticketId',
    consumers: [
      { service: 'notification-service', consumerGroup: 'cg.notification-from-admin-ops.v1' },
      { service: 'workflow-service', consumerGroup: 'cg.workflow-from-admin-ops.v1' },
      { service: 'audit-service', consumerGroup: 'cg.audit-from-admin-ops.v1' },
    ],
    partitionKey: 'aggregateId',
  },
]);
const EXACT_SOURCE_SUBSCRIPTION_BINDINGS = Object.freeze([
  { sourceEvent: 'learning.review.scheduled.v2', topic: 'platform.learning.v1', consumerGroup: 'cg.notification-from-learning.v1' },
  { sourceEvent: 'commerce.entitlement.activated.v2', topic: 'platform.commerce.v1', consumerGroup: 'cg.notification-from-commerce.v1' },
  { sourceEvent: 'support.ticket.created.v2', topic: 'platform.admin-ops.v1', consumerGroup: 'cg.notification-from-admin-ops.v1' },
  { sourceEvent: 'support.ticket.resolved.v2', topic: 'platform.admin-ops.v1', consumerGroup: 'cg.notification-from-admin-ops.v1' },
  { sourceEvent: 'commerce.refund.settled.v2', topic: 'platform.commerce.v1', consumerGroup: 'cg.notification-from-commerce.v1' },
]);
const EXACT_B26_ADMIN_OPS_TOPIC = {
  name: 'platform.admin-ops.v1',
  ownerService: 'admin-ops-service',
  purpose: 'support ticket integration facts owned by admin-ops-service.support',
  partitions: 6,
  partitionKey: 'aggregateId',
  retentionMs: 2592000000,
  cleanupPolicy: 'delete',
  replicationFactor: 3,
  minInSyncReplicas: 2,
  localRuntimeOverride: { replicationFactor: 1, minInSyncReplicas: 1 },
  producerPrincipal: 'svc.admin-ops-service',
  consumerGroups: [
    { name: 'cg.notification-from-admin-ops.v1', service: 'notification-service', principal: 'cg.notification-from-admin-ops.v1', replayEnabled: true },
    { name: 'cg.workflow-from-admin-ops.v1', service: 'workflow-service', principal: 'cg.workflow-from-admin-ops.v1', replayEnabled: true },
    { name: 'cg.audit-from-admin-ops.v1', service: 'audit-service', principal: 'cg.audit-from-admin-ops.v1', replayEnabled: true },
  ],
  acl: [
    { principal: 'svc.admin-ops-service', operation: 'WRITE', effect: 'ALLOW' },
    { principal: 'cg.notification-from-admin-ops.v1', operation: 'READ', effect: 'ALLOW' },
    { principal: 'cg.workflow-from-admin-ops.v1', operation: 'READ', effect: 'ALLOW' },
    { principal: 'cg.audit-from-admin-ops.v1', operation: 'READ', effect: 'ALLOW' },
  ],
};
const EXACT_B26_STATIC_PROJECTION = Object.freeze({
  newTopic: EXACT_B26_ADMIN_OPS_TOPIC,
  runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  mode: 'STATIC_GOVERNANCE_ONLY',
  defaultDecision: 'NO-GO',
});
const LEGACY_KEYS = Object.freeze(['notification', 'support', 'sync']);
const LEGACY_NOTIFICATION_KEYS = Object.freeze(['B12', 'B11', 'dualPublish']);
const LEGACY_SUPPORT_KEYS = Object.freeze(['B5', 'B13', 'dualPublish', 'adapterMappingRequired', 'adapterMayCreateSecondFact']);
const LEGACY_SYNC_KEYS = Object.freeze(['legacyBaseCursor', 'legacyEntityVersion', 'legacyPayloadHashAlias', 'canonicalFields']);
const RUNTIME_KEYS = Object.freeze([
  'contractOnly', 'runtimeEvidence', 'd2Status', 'productionNotificationProviders', 'realSmsEmailPushTraffic',
  'realKafkaBroker', 'realDatabaseSchemaAndMigrations', 'realOutboxAndConsumerDeduplication',
  'realRetryDlqReplay', 'realSupportPepAndCrossTenantEvidence', 'realRetentionLegalHoldPurge',
  'realBrowserDeviceE2E', 'prohibitedRuntimeClaims', 'deferredTasks',
]);
const ACCEPTANCE_KEYS = Object.freeze(['contract', 'runtime']);

const CANONICAL_NOTIFICATION_OPERATIONS = Object.freeze([
  ['GET', '/api/v1/notifications/preferences', 'listM1016NotificationPreferences'],
  ['PUT', '/api/v1/notifications/preferences/{notificationType}/{channel}', 'updateM1016NotificationPreference'],
  ['GET', '/api/v1/notifications/messages', 'listM1016NotificationMessages'],
  ['PUT', '/api/v1/notifications/messages/{messageId}/read', 'markM1016NotificationMessageRead'],
  ['PUT', '/api/v1/notifications/messages/read-all', 'markAllM1016NotificationMessagesRead'],
  ['POST', '/internal/v1/notifications/retry', 'retryM1016NotificationDelivery'],
  ['POST', '/internal/v1/notifications/recovery', 'recoverM1016NotificationDelivery'],
]);
const CANONICAL_NOTIFICATION_PERMISSIONS = Object.freeze({
  listM1016NotificationPreferences: 'notification.preference.read.self',
  updateM1016NotificationPreference: 'notification.preference.write.self',
  listM1016NotificationMessages: 'notification.message.read.self',
  markM1016NotificationMessageRead: 'notification.message.read-state.write.self',
  markAllM1016NotificationMessagesRead: 'notification.message.read-state.write.self',
  retryM1016NotificationDelivery: 'notification.delivery.retry.workload',
  recoverM1016NotificationDelivery: 'notification.delivery.recovery.workload',
});
const SYNC_PERMISSIONS = Object.freeze({
  listM1016LearningSyncReceipts: 'learning.sync.receipt.read.self',
  getM1016LearningSyncCursor: 'learning.sync.cursor.read.self',
  listM1016LearningSyncConflicts: 'learning.sync.conflict.read.self',
  recoverM1016LearningSyncConflict: 'learning.sync.conflict.recover.self',
});
const SUPPORT_PERMISSIONS = Object.freeze({
  listM1016LearnerSupportTickets: 'support.ticket.read.self',
  createM1016SupportTicket: 'support.ticket.create.self',
  getM1016LearnerSupportTicket: 'support.ticket.read.self',
  addM1016LearnerSupportTicketMessage: 'support.ticket.message.create.self',
  listM1016AdminSupportTickets: 'support.ticket.read.admin',
  getM1016AdminSupportTicket: 'support.ticket.read.admin',
  addM1016AdminSupportTicketMessage: 'support.ticket.message.create.admin',
  submitM1016SupportTicketCommand: 'support.ticket.command',
});
const SYNC_OPERATIONS = Object.freeze([
  ['GET', '/api/v1/learning/sync/receipts', 'listM1016LearningSyncReceipts'],
  ['GET', '/api/v1/learning/sync/cursor', 'getM1016LearningSyncCursor'],
  ['GET', '/api/v1/learning/sync/conflicts', 'listM1016LearningSyncConflicts'],
  ['POST', '/api/v1/learning/sync/conflicts/{conflictId}/recovery', 'recoverM1016LearningSyncConflict'],
]);
const LEARNER_SUPPORT_OPERATIONS = Object.freeze([
  ['GET', '/api/v1/support/tickets', 'listM1016LearnerSupportTickets'],
  ['POST', '/api/v1/support/tickets', 'createM1016SupportTicket'],
  ['GET', '/api/v1/support/tickets/{ticketId}', 'getM1016LearnerSupportTicket'],
  ['POST', '/api/v1/support/tickets/{ticketId}/messages', 'addM1016LearnerSupportTicketMessage'],
]);
const ADMIN_SUPPORT_OPERATIONS = Object.freeze([
  ['GET', '/api/v1/admin/ops/tickets', 'listM1016AdminSupportTickets'],
  ['GET', '/api/v1/admin/ops/tickets/{ticketId}', 'getM1016AdminSupportTicket'],
  ['POST', '/api/v1/admin/ops/tickets/{ticketId}/messages', 'addM1016AdminSupportTicketMessage'],
  ['POST', '/api/v1/admin/ops/tickets/{ticketId}/commands', 'submitM1016SupportTicketCommand'],
]);
const SYNC_SCHEMAS = Object.freeze([
  'M1016SyncProtocolContext', 'M1016SyncReceipt', 'M1016SyncCursor', 'M1016SyncConflict',
  'M1016SyncRecoveryRequest', 'M1016SyncRecoveryResult',
]);
const SYNC_HISTORICAL_ADAPTERS = Object.freeze([
  'enqueueB11SyncChanges', 'listB11SyncChanges', 'updateB11SyncCursor', 'getB11SyncCursor',
  'listB11SyncConflicts', 'recoverB11SyncConflict', 'getB11NotificationPreference',
  'updateB11NotificationPreference', 'listB11Messages', 'markB11MessageRead',
]);
const SUPPORT_SCHEMAS = Object.freeze([
  'M1016SupportTicket', 'M1016SupportTicketCreateRequest', 'M1016SupportMessage',
  'M1016SupportMessageCreateRequest', 'M1016SupportAdminCommandRequest', 'M1016SupportCommandResult',
]);
const SUPPORT_SCHEMA_NAMES = Object.freeze([
  'M1016SupportRestrictedContentRef', 'M1016SupportAttachmentRef',
  'M1016SupportUsableContentRef', 'M1016SupportUsableAttachmentRef',
  'M1016SupportAssignmentHistory', 'M1016SupportAssignment',
  'M1016SupportSlaHistory', 'M1016SupportSla', 'M1016SupportResolution',
  'M1016SupportRetention', 'M1016SupportTicket', 'M1016SupportTicketCreateRequest',
  'M1016SupportMessage', 'M1016SupportMessageCreateRequest',
  'M1016SupportAssignCommand', 'M1016SupportTransitionCommand',
  'M1016SupportResolveCommand', 'M1016SupportAdminCommandRequest',
  'M1016SupportCommandResult',
]);
const CANONICAL_NOTIFICATION_SCHEMAS = Object.freeze([
  'M1016NotificationDndWindow', 'M1016NotificationPreference', 'M1016NotificationPreferenceCommand',
  'M1016NotificationMessage', 'M1016NotificationReadReceipt', 'M1016NotificationReadAllReceipt',
  'M1016NotificationRetryCommand', 'M1016NotificationRetryResult', 'M1016NotificationRecoveryCommand',
  'M1016NotificationRecoveryResult',
]);
const EXACT_NOTIFICATION_SUBSCRIPTIONS = Object.freeze([
  {
    sourceEvent: 'learning.review.scheduled.v2',
    sourceEventStatus: 'M1016_PLANNED_CANONICAL_PRODUCER_FACT',
    templateKey: 'learning.review.due',
    templateVersion: 1,
    category: 'REVIEW',
    channels: ['IN_APP', 'PUSH'],
    locales: ['zh-CN'],
    parameterAllowlist: ['reviewQueueId', 'dueAt', 'contentVersionId'],
    deepLink: '/learn/review',
    expiry: 'P7D',
    pinned: false,
    dedupeKey: ['sourceEventId', 'principalId', 'reviewQueueId', 'channel'],
    sms: 'DENY',
  },
  {
    sourceEvent: 'commerce.entitlement.activated.v2',
    sourceEventStatus: 'EXISTING_M1015_CANONICAL_PRODUCER_FACT',
    templateKey: 'commerce.entitlement.activated',
    templateVersion: 1,
    category: 'MEMBERSHIP',
    channels: ['IN_APP', 'EMAIL'],
    locales: ['zh-CN'],
    parameterAllowlist: ['entitlementId', 'entitlementVersion', 'scopeCode'],
    deepLink: '/account/entitlements',
    expiry: 'P180D',
    pinned: false,
    dedupeKey: ['sourceEventId', 'principalId', 'entitlementId', 'channel'],
    sms: 'DENY',
  },
  {
    sourceEvent: 'support.ticket.created.v2',
    sourceEventStatus: 'M1016_PLANNED_CANONICAL_PRODUCER_FACT',
    templateKey: 'support.ticket.created',
    templateVersion: 1,
    category: 'SYSTEM',
    channels: ['IN_APP', 'EMAIL'],
    locales: ['zh-CN'],
    parameterAllowlist: ['ticketId', 'ticketState', 'slaDueAt'],
    deepLink: '/support/tickets',
    expiry: 'P30D',
    pinned: false,
    dedupeKey: ['sourceEventId', 'principalId', 'ticketId', 'channel'],
    sms: 'DENY',
  },
  {
    sourceEvent: 'support.ticket.resolved.v2',
    sourceEventStatus: 'M1016_PLANNED_CANONICAL_PRODUCER_FACT',
    templateKey: 'support.ticket.resolved',
    templateVersion: 1,
    category: 'SYSTEM',
    channels: ['IN_APP', 'EMAIL'],
    locales: ['zh-CN'],
    parameterAllowlist: ['ticketId', 'ticketState', 'resolutionCode'],
    deepLink: '/support/tickets',
    expiry: 'P90D',
    pinned: false,
    dedupeKey: ['sourceEventId', 'principalId', 'ticketId', 'channel'],
    sms: 'DENY',
  },
  {
    sourceEvent: 'commerce.refund.settled.v2',
    sourceEventStatus: 'EXISTING_M1015_CANONICAL_PRODUCER_FACT',
    templateKey: 'commerce.refund.settled',
    templateVersion: 1,
    category: 'PAYMENT',
    channels: ['IN_APP', 'EMAIL'],
    locales: ['zh-CN'],
    parameterAllowlist: ['orderId', 'refundId', 'entitlementVersion'],
    deepLink: '/commerce/orders',
    expiry: 'P180D',
    pinned: false,
    dedupeKey: ['sourceEventId', 'principalId', 'orderId', 'channel'],
    sms: 'DENY',
  },
]);
const FUTURE_UNBOUND_TEMPLATE = Object.freeze({
  templateKey: 'security.account.alert',
  templateVersion: 1,
  category: 'SECURITY',
  channels: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'],
  locales: ['zh-CN'],
  parameterAllowlist: ['alertCode', 'occurredAt', 'deviceLabel'],
  deepLink: '/settings/security',
  expiry: 'P30D',
  pinned: true,
  sms: 'SECURITY_ALERT',
  promotionStatus: 'UNBOUND_NO_CANONICAL_SOURCE_EVENT',
  active: false,
});
const REQUIRED_SYNC_FIELDS = Object.freeze([
  'clientEventId', 'clientSeq', 'baseVersion', 'contentVersionId', 'payloadHash',
  'entityType', 'entityId', 'operation', 'occurredAt', 'idempotencyKey',
]);
const M1016_EVENT_PAYLOAD_REQUIRED_FIELDS = Object.freeze({
  'notification.requested.v2': ['notificationId', 'deliveryVersion', 'sourceEventId', 'notificationType', 'category', 'channel', 'templateKey', 'templateVersion', 'locale', 'parameterDigest', 'dedupeKey', 'contentVersionId'],
  'notification.retry_scheduled.v2': ['notificationId', 'deliveryVersion', 'attempt', 'maxAttempts', 'failureClass', 'nextAttemptAt', 'workflowTaskRef', 'notificationStatus'],
  'notification.recovery.completed.v2': ['notificationId', 'deliveryVersion', 'action', 'state', 'recoveryReceiptId', 'domainFactsUntouched', 'notificationStatus'],
  'sync.command_receipted.v2': ['clientEventId', 'clientSeq', 'baseVersion', 'contentVersionId', 'payloadHash', 'entityType', 'entityId', 'operation', 'occurredAt', 'idempotencyKey', 'outcome', 'serverVersion', 'receiptId', 'ownerService'],
  'sync.conflict_detected.v2': ['conflictId', 'clientEventId', 'entityType', 'entityId', 'baseVersion', 'localVersion', 'serverVersion', 'contentVersionId', 'reasonCode', 'safeServerReference', 'allowedResolution', 'recoveryTaskId'],
  'sync.recovered.v2': ['conflictId', 'clientEventId', 'entityType', 'entityId', 'contentVersionId', 'action', 'recoveryReceiptId', 'outcome', 'domainFactsUntouched'],
  'support.ticket.created.v2': ['eventId', 'traceId', 'requestId', 'schemaVersion', 'ticketId', 'ticketVersion', 'state', 'categoryCode', 'slaPolicyRef', 'redactionVersion', 'auditId'],
  'support.ticket.resolved.v2': ['eventId', 'traceId', 'requestId', 'schemaVersion', 'ticketId', 'ticketVersion', 'state', 'categoryCode', 'slaPolicyRef', 'resolutionCode', 'ownerResultRef', 'redactionVersion', 'auditId'],
});
const M1016_EVENT_PAYLOAD_FIELD_TYPES = Object.freeze({
  notificationId: 'string', deliveryVersion: 'integer', sourceEventId: 'string', notificationType: 'string',
  category: 'string', channel: 'string', templateKey: 'string', templateVersion: 'integer', locale: 'string',
  parameterDigest: 'string', dedupeKey: 'string', contentVersionId: 'string', attempt: 'integer',
  maxAttempts: 'integer', failureClass: 'string', nextAttemptAt: 'string', workflowTaskRef: 'string',
  notificationStatus: 'string', action: 'string', state: 'string', recoveryReceiptId: 'string',
  domainFactsUntouched: 'boolean', clientEventId: 'string', clientSeq: 'integer', baseVersion: 'integer',
  payloadHash: 'string', entityType: 'string', entityId: 'string', operation: 'string', occurredAt: 'string',
  idempotencyKey: 'string', outcome: 'string', serverVersion: 'integer', receiptId: 'string', ownerService: 'string',
  conflictId: 'string', localVersion: 'integer', reasonCode: 'string', safeServerReference: 'string',
  allowedResolution: 'string', recoveryTaskId: 'string', eventId: 'string', traceId: 'string', requestId: 'string',
  schemaVersion: 'integer', ticketId: 'string', ticketVersion: 'integer', categoryCode: 'string', slaPolicyRef: 'string',
  redactionVersion: 'integer', auditId: 'string', resolutionCode: 'string', ownerResultRef: 'string',
});

const M1016_REQUEST_SCHEMA_PROPERTIES = Object.freeze({
  M1016NotificationPreferenceCommand: ['category', 'enabled', 'locale', 'consentVersion', 'dndWindow', 'frequencyPolicy', 'expectedVersion'],
  M1016NotificationRetryCommand: ['notificationId', 'deliveryVersion', 'expectedVersion', 'reasonCode'],
  M1016NotificationRecoveryCommand: ['notificationId', 'deliveryVersion', 'expectedVersion', 'action', 'reasonCode'],
  M1016SyncProtocolContext: ['clientEventId', 'clientSeq', 'baseVersion', 'contentVersionId', 'payloadHash', 'entityType', 'entityId', 'operation', 'occurredAt', 'idempotencyKey'],
  M1016SyncRecoveryRequest: ['expectedVersion', 'action'],
  M1016SupportTicketCreateRequest: ['categoryCode', 'resourceRef', 'descriptionContentRef', 'attachmentRefs', 'idempotencyKey'],
  M1016SupportMessageCreateRequest: ['clientMessageRef', 'bodyContentRef', 'attachmentRefs', 'expectedVersion', 'idempotencyKey'],
  M1016SupportAssignCommand: ['commandType', 'queueId', 'assigneeRef', 'reasonCode'],
  M1016SupportTransitionCommand: ['commandType', 'toState', 'reasonCode'],
  M1016SupportResolveCommand: ['commandType', 'resolution'],
  M1016SupportAdminCommandRequest: ['command', 'expectedVersion'],
  M1016SupportResolution: ['resolutionCode', 'explanationContentRef', 'ownerResultRef', 'decidedAt', 'auditId'],
});

function assertExactRequestSchemaProperties(schema, name, errors, location) {
  const expected = M1016_REQUEST_SCHEMA_PROPERTIES[name];
  if (!expected) return;
  exactArray(errors, Object.keys(schema?.properties ?? {}), expected, `${location}.${name}.properties`);
}

function assertEventPayloadFieldTypes(payload, eventName, errors) {
  for (const field of (M1016_EVENT_PAYLOAD_REQUIRED_FIELDS[eventName] ?? [])) {
    exact(errors, payload?.properties?.[field]?.type, M1016_EVENT_PAYLOAD_FIELD_TYPES[field], `${eventName} payload.${field}.type`);
  }
}
const REQUIRED_SUPPORT_STATES = Object.freeze(['OPEN', 'ASSIGNED', 'WAITING_USER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED', 'REOPENED']);
const REQUIRED_SUPPORT_CATEGORIES = Object.freeze(['ACCOUNT_SECURITY', 'CONTENT_CORRECTION', 'LEARNING_SYNC', 'MEDIA_DEVICE', 'ENTITLEMENT_ORDER', 'PRIVACY', 'OTHER']);
const FORBIDDEN_CLIENT_FIELDS = Object.freeze([
  'tenant', 'tenantId', 'subject', 'subjectId', 'principalId', 'role', 'permission',
  'owner', 'ownerService', 'assignment', 'assignee', 'queueId', 'sla',
  'slaDueAt', 'priority', 'state', 'stateVersion', 'deliveryStatus', 'readAt', 'retentionPolicyRef',
  'legalHold', 'auditId',
]);
const FORBIDDEN_PAYLOAD_FIELDS = /(?:password|secret|token|cookie|rawAudio|rawText|rawBody|rawContent|rawDescription|audioBytes|recordingBytes|rawAttachmentBytes|answerKey|rawAnswer|paymentCredential|unredactedFreeText|unredactedDescription|freeText|plainText|objectKey|signedUrl|downloadUrl|uploadUrl|https?:\/\/)/i;
// `description` and `body` are valid JSON-Schema metadata keys, so they cannot
// be rejected as arbitrary object keys.  They are nevertheless forbidden when
// they occur in a schema `properties` map (including nested composition/ref
// branches), where they denote client/event payload fields.
const FORBIDDEN_PAYLOAD_PROPERTY_FIELDS = new Set([
  'description', 'body', 'rawtext', 'rawbody', 'rawcontent', 'rawdescription', 'freetext', 'plaintext',
]);
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

// These strings are contract metadata, not free-form authorization prose.  A
// prefix check would let an attacker append a forged policy after a valid
// `NONE` prefix, so every M1-016 operation is pinned to its complete value.
const M1016_CLIENT_AUTHORITY = Object.freeze({
  listM1016NotificationPreferences: Object.freeze({
    contract: 'NONE; subject, tenant, owner and current preference version are server-derived',
    authorization: 'NONE',
  }),
  updateM1016NotificationPreference: Object.freeze({
    contract: 'NONE; only enabled, locale, consent version, DND and frequency intent are client inputs',
    authorization: 'NONE for subject, tenant, owner, version and audit identity',
  }),
  listM1016NotificationMessages: Object.freeze({
    contract: 'NONE; message body, template, delivery and expiry facts are server-derived',
    authorization: 'NONE for message, subject, tenant, owner or delivery state',
  }),
  markM1016NotificationMessageRead: Object.freeze({
    contract: 'NONE; principal, tenant, message ownership and read timestamp are server-derived',
    authorization: 'NONE for subject, tenant, owner, readAt or message state',
  }),
  markAllM1016NotificationMessagesRead: Object.freeze({
    contract: 'NONE; selection, principal, tenant and read timestamp are server-derived',
    authorization: 'NONE for message selection, subject, tenant, owner or read timestamp',
  }),
  retryM1016NotificationDelivery: Object.freeze({
    contract: 'NONE; notification, attempt and delivery state are server-derived',
    authorization: 'NONE for subject, tenant, owner, attempt, status or next run time',
  }),
  recoverM1016NotificationDelivery: Object.freeze({
    contract: 'NONE; task state, notification ownership and recovery result are server-derived',
    authorization: 'NONE for subject, tenant, owner, delivery state or recovery receipt',
  }),
  listM1016LearningSyncReceipts: Object.freeze({
    contract: 'NONE; receipt, owner, tenant and server version are server-derived',
    authorization: 'NONE for receipt identity, server version or owner',
  }),
  getM1016LearningSyncCursor: Object.freeze({
    contract: 'NONE; cursor and version are server-derived',
    authorization: 'NONE for cursor, owner or version',
  }),
  listM1016LearningSyncConflicts: Object.freeze({
    contract: 'NONE; conflict, versions and owner are server-derived',
    authorization: 'NONE for conflict identity, owner or server versions',
  }),
  recoverM1016LearningSyncConflict: Object.freeze({
    contract: 'NONE; conflict state, server version and recovery receipt are server-derived',
    authorization: 'NONE for owner, server facts, merge outcome or recovery receipt',
  }),
  listM1016LearnerSupportTickets: Object.freeze({
    contract: 'NONE; subject, tenant, assignment, SLA and state are server-derived',
    authorization: 'NONE for requester, tenant, owner, assignment or SLA',
  }),
  createM1016SupportTicket: Object.freeze({
    contract: 'NONE; requesterSubjectId, tenantId, priority, assignment, SLA and state are server-derived',
    authorization: 'NONE for requester, tenant, priority, assignment, SLA or state',
  }),
  getM1016LearnerSupportTicket: Object.freeze({
    contract: 'NONE; requester, tenant and workflow facts are server-derived',
    authorization: 'NONE for requester, tenant, assignment, SLA or state',
  }),
  addM1016LearnerSupportTicketMessage: Object.freeze({
    contract: 'NONE; author and tenant facts are server-derived',
    authorization: 'NONE for author, tenant, role or state',
  }),
  listM1016AdminSupportTickets: Object.freeze({
    contract: 'NONE; tenant, requester, priority, assignment, SLA and state are server-derived',
    authorization: 'NONE for tenant, requester, assignment, SLA or state',
  }),
  getM1016AdminSupportTicket: Object.freeze({
    contract: 'NONE; tenant, requester, priority, assignment, SLA and state are server-derived',
    authorization: 'NONE for tenant, requester, assignment, SLA or state',
  }),
  addM1016AdminSupportTicketMessage: Object.freeze({
    contract: 'NONE; author, tenant and state are server-derived',
    authorization: 'NONE for author, tenant, role or state',
  }),
  submitM1016SupportTicketCommand: Object.freeze({
    contract: 'NONE; tenant, assignment, priority, SLA and resulting state are server-derived',
    authorization: 'NONE for tenant, requester, priority, assignment or SLA',
  }),
});

const EXACT_B26_SOURCE_REFS = Object.freeze([
  'config/g1-contract-data.json',
  'config/g2-implementation-interaction.json',
  'config/g3-test-security-observability.json',
  'packages/contracts/events/v1/catalog.json',
  'packages/contracts/events/v1/fragments/m1-016-notification-sync-support-v2.events.json',
  'packages/contracts/events/v1/fragments/m1-017-privacy-deletion-v2.events.json',
  'packages/telemetry/schemas/telemetry-event.schema.json',
  'packages/telemetry/policies/telemetry-events.json',
  'requirements/backlog/v2-B23plus-Phase1-真实运行与实机测试任务基线.md',
]);

const EXACT_B26_M1016_TOPIC_ACCESS = Object.freeze({
  'platform.learning.v1': Object.freeze({
    ownerService: 'learning-service',
    producerPrincipal: 'svc.learning-service',
    consumerGroups: [
      { name: 'cg.assessment-from-learning.v1', service: 'assessment-service', principal: 'cg.assessment-from-learning.v1', replayEnabled: true },
      { name: 'cg.gamification-from-learning.v1', service: 'gamification-service', principal: 'cg.gamification-from-learning.v1', replayEnabled: true },
      { name: 'cg.notification-from-learning.v1', service: 'notification-service', principal: 'cg.notification-from-learning.v1', replayEnabled: true },
      { name: 'cg.social-from-learning.v1', service: 'social-service', principal: 'cg.social-from-learning.v1', replayEnabled: true },
      { name: 'cg.workflow-from-learning.v1', service: 'workflow-service', principal: 'cg.workflow-from-learning.v1', replayEnabled: true },
    ],
    acl: [
      { principal: 'svc.learning-service', operation: 'WRITE', effect: 'ALLOW' },
      { principal: 'cg.assessment-from-learning.v1', operation: 'READ', effect: 'ALLOW' },
      { principal: 'cg.gamification-from-learning.v1', operation: 'READ', effect: 'ALLOW' },
      { principal: 'cg.notification-from-learning.v1', operation: 'READ', effect: 'ALLOW' },
      { principal: 'cg.social-from-learning.v1', operation: 'READ', effect: 'ALLOW' },
      { principal: 'cg.workflow-from-learning.v1', operation: 'READ', effect: 'ALLOW' },
    ],
  }),
  'platform.notification.v1': Object.freeze({
    ownerService: 'notification-service',
    producerPrincipal: 'svc.notification-service',
    consumerGroups: [
      { name: 'cg.workflow-from-notification.v1', service: 'workflow-service', principal: 'cg.workflow-from-notification.v1', replayEnabled: true },
      { name: 'cg.analytics-from-notification.v1', service: 'analytics-service', principal: 'cg.analytics-from-notification.v1', replayEnabled: true },
    ],
    acl: [
      { principal: 'svc.notification-service', operation: 'WRITE', effect: 'ALLOW' },
      { principal: 'cg.workflow-from-notification.v1', operation: 'READ', effect: 'ALLOW' },
      { principal: 'cg.analytics-from-notification.v1', operation: 'READ', effect: 'ALLOW' },
    ],
  }),
  'platform.commerce.v1': Object.freeze({
    ownerService: 'commerce-service',
    producerPrincipal: 'svc.commerce-service',
    consumerGroups: [
      { name: 'cg.content-from-commerce.v1', service: 'content-service', principal: 'cg.content-from-commerce.v1', replayEnabled: true },
      { name: 'cg.learning-from-commerce.v1', service: 'learning-service', principal: 'cg.learning-from-commerce.v1', replayEnabled: true },
      { name: 'cg.notification-from-commerce.v1', service: 'notification-service', principal: 'cg.notification-from-commerce.v1', replayEnabled: true },
      { name: 'cg.workflow-from-commerce.v1', service: 'workflow-service', principal: 'cg.workflow-from-commerce.v1', replayEnabled: true },
      { name: 'cg.audit-from-commerce.v1', service: 'audit-service', principal: 'cg.audit-from-commerce.v1', replayEnabled: true },
    ],
    acl: [
      { principal: 'svc.commerce-service', operation: 'WRITE', effect: 'ALLOW' },
      { principal: 'cg.content-from-commerce.v1', operation: 'READ', effect: 'ALLOW' },
      { principal: 'cg.learning-from-commerce.v1', operation: 'READ', effect: 'ALLOW' },
      { principal: 'cg.notification-from-commerce.v1', operation: 'READ', effect: 'ALLOW' },
      { principal: 'cg.workflow-from-commerce.v1', operation: 'READ', effect: 'ALLOW' },
      { principal: 'cg.audit-from-commerce.v1', operation: 'READ', effect: 'ALLOW' },
    ],
  }),
  'platform.admin-ops.v1': Object.freeze({
    ownerService: 'admin-ops-service',
    producerPrincipal: 'svc.admin-ops-service',
    consumerGroups: [
      { name: 'cg.notification-from-admin-ops.v1', service: 'notification-service', principal: 'cg.notification-from-admin-ops.v1', replayEnabled: true },
      { name: 'cg.workflow-from-admin-ops.v1', service: 'workflow-service', principal: 'cg.workflow-from-admin-ops.v1', replayEnabled: true },
      { name: 'cg.audit-from-admin-ops.v1', service: 'audit-service', principal: 'cg.audit-from-admin-ops.v1', replayEnabled: true },
    ],
    acl: [
      { principal: 'svc.admin-ops-service', operation: 'WRITE', effect: 'ALLOW' },
      { principal: 'cg.notification-from-admin-ops.v1', operation: 'READ', effect: 'ALLOW' },
      { principal: 'cg.workflow-from-admin-ops.v1', operation: 'READ', effect: 'ALLOW' },
      { principal: 'cg.audit-from-admin-ops.v1', operation: 'READ', effect: 'ALLOW' },
    ],
  }),
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('non-finite number in JSON');
  return JSON.stringify(value);
}

export function policyDigest(policy) {
  return createHash('sha256').update(stable(policy)).digest('hex');
}

function same(left, right) {
  return stable(left) === stable(right);
}

function exact(errors, actual, expected, label) {
  add(errors, same(actual, expected), `${label} must equal the frozen value`);
}

function keys(errors, value, allowed, required = allowed, label = 'object') {
  add(errors, isRecord(value), `${label} must be an object`);
  if (!isRecord(value)) return false;
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (unknown.length) errors.push(`${label} contains unknown field(s): ${unknown.join(', ')}`);
  if (missing.length) errors.push(`${label} is missing required field(s): ${missing.join(', ')}`);
  return unknown.length === 0 && missing.length === 0;
}

function list(errors, value, label, { min = 1, exactLength, unique = true } = {}) {
  add(errors, Array.isArray(value), `${label} must be an array`);
  if (!Array.isArray(value)) return false;
  if (exactLength !== undefined) add(errors, value.length === exactLength, `${label} must contain exactly ${exactLength} item(s)`);
  else add(errors, value.length >= min, `${label} must contain at least ${min} item(s)`);
  if (unique) {
    const seen = new Set();
    const duplicate = value.some((item) => { const id = stable(item); if (seen.has(id)) return true; seen.add(id); return false; });
    add(errors, !duplicate, `${label} must not contain duplicate items`);
  }
  return true;
}

function exactArray(errors, actual, expected, label) {
  exact(errors, actual, expected, label);
}

function exactSet(errors, actual, expected, label) {
  if (!list(errors, actual, label, { exactLength: expected.length })) return;
  exact(errors, [...actual].sort(), [...expected].sort(), label);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sha256(value) {
  return typeof value === 'string' && /^[A-Fa-f0-9]{64}$/.test(value);
}

function assertNoRuntimePromotion(value, errors, location = '$', insideBoundary = false) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoRuntimePromotion(entry, errors, `${location}[${index}]`, insideBoundary));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const current = `${location}.${key}`;
    if (!insideBoundary && /(?:runtimeProof|runtimeAttestation|runtimeCertification|runtimeVerified|productionReady|liveTraffic|e2ePass|browserPass|providerDelivered)/i.test(key)) {
      errors.push(`${current} is forbidden in D2/static evidence`);
    }
    if (key === 'runtimeStatus' && !['NOT_RUNTIME_VERIFIED', 'pending'].includes(nested)) {
      errors.push(`${current} must remain NOT_RUNTIME_VERIFIED/pending`);
    }
    assertNoRuntimePromotion(nested, errors, current, insideBoundary || key === 'runtimeBoundary');
  }
}

function checkForbiddenPayload(value, errors, location = '$', document, propertyMap = false, seenRefs = new Set(), fallbackDocument) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => checkForbiddenPayload(entry, errors, `${location}[${index}]`, document, false, seenRefs, fallbackDocument));
    return;
  }
  if (!isRecord(value)) return;

  // Payload checks must follow local references.  Otherwise a request body
  // containing only `$ref` can hide a raw field in the referenced schema.
  if (typeof value.$ref === 'string' && document) {
    const resolved = resolveRefFromDocuments(document, value, fallbackDocument);
    add(errors, isRecord(resolved), `${location}.$ref must resolve to a local schema`);
    if (isRecord(resolved) && !seenRefs.has(value.$ref)) {
      seenRefs.add(value.$ref);
      checkForbiddenPayload(resolved, errors, `${location}(${value.$ref})`, document, false, seenRefs, fallbackDocument);
    }
  }
  for (const [key, nested] of Object.entries(value)) {
    const current = `${location}.${key}`;
    const forbiddenProperty = propertyMap && FORBIDDEN_PAYLOAD_PROPERTY_FIELDS.has(key.toLowerCase());
    add(errors, !forbiddenProperty && !FORBIDDEN_PAYLOAD_FIELDS.test(key), `${current} is forbidden in event/API payload`);
    if (typeof nested === 'string') add(errors, !FORBIDDEN_PAYLOAD_FIELDS.test(nested), `${current} contains forbidden sensitive text`);
    checkForbiddenPayload(nested, errors, current, document, key === 'properties', seenRefs, fallbackDocument);
  }
}

function checkOpenApiPayloadSchemas(operation, errors, location, document, fallbackDocument) {
  if (!isRecord(operation)) return;
  const schemas = [];
  const collectContent = (container) => {
    if (!isRecord(container?.content)) return;
    for (const [mediaType, media] of Object.entries(container.content)) {
      if (isRecord(media?.schema)) schemas.push([media.schema, `${location}.content.${mediaType}.schema`]);
    }
  };
  collectContent(operation.requestBody);
  for (const parameter of (Array.isArray(operation.parameters) ? operation.parameters : [])) {
    if (isRecord(parameter?.schema)) schemas.push([parameter.schema, `${location}.parameter.${parameter.name ?? '<unnamed>'}.schema`]);
  }
  for (const [status, response] of Object.entries(isRecord(operation.responses) ? operation.responses : {})) collectContent(response);
  for (const [schema, schemaLocation] of schemas) checkForbiddenPayload(schema, errors, schemaLocation, document, false, new Set(), fallbackDocument);
}

function resolveRef(document, ref) {
  if (!isRecord(ref) || typeof ref.$ref !== 'string') return ref;
  if (!ref.$ref.startsWith('#/')) return undefined;
  return ref.$ref.slice(2).split('/').reduce((current, segment) => {
    const key = segment.replaceAll('~1', '/').replaceAll('~0', '~');
    return current && Object.hasOwn(current, key) ? current[key] : undefined;
  }, document);
}

function resolveRefFromDocuments(document, ref, fallbackDocument) {
  const resolved = resolveRef(document, ref);
  if (resolved !== undefined) return resolved;
  if (fallbackDocument && fallbackDocument !== document) return resolveRef(fallbackDocument, ref);
  return undefined;
}

function assertAllRefsResolve(document, value, errors, location = '$', seenRefs = new Set(), fallbackDocument) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertAllRefsResolve(document, entry, errors, `${location}[${index}]`, seenRefs, fallbackDocument));
    return;
  }
  if (!isRecord(value)) return;
  if (Object.hasOwn(value, '$ref')) {
    const ref = value.$ref;
    add(errors, typeof ref === 'string' && ref.startsWith('#/'), `${location}.$ref must be a local JSON pointer`);
    const resolved = typeof ref === 'string' ? resolveRefFromDocuments(document, value, fallbackDocument) : undefined;
    add(errors, isRecord(resolved), `${location}.$ref must resolve to a local object`);
    if (isRecord(resolved) && !seenRefs.has(ref)) {
      seenRefs.add(ref);
      assertAllRefsResolve(document, resolved, errors, `${location}(${ref})`, seenRefs, fallbackDocument);
    }
  }
  for (const [key, nested] of Object.entries(value)) {
    if (key !== '$ref') assertAllRefsResolve(document, nested, errors, `${location}.${key}`, seenRefs, fallbackDocument);
  }
}

function containsExactRef(value, expectedRef) {
  if (Array.isArray(value)) return value.some((entry) => containsExactRef(entry, expectedRef));
  if (!isRecord(value)) return false;
  if (value.$ref === expectedRef) return true;
  return Object.values(value).some((nested) => containsExactRef(nested, expectedRef));
}

function operationAt(document, method, route) {
  return document?.paths?.[route]?.[method.toLowerCase()];
}

function schemaAt(document, name) {
  const schema = document?.components?.schemas?.[name];
  return isRecord(schema) ? schema : undefined;
}

function schemaProperty(schema, field) {
  return isRecord(schema?.properties) && Object.hasOwn(schema.properties, field) ? schema.properties[field] : undefined;
}

function validateClosedSchema(document, name, errors, label, { required, forbiddenFields = [], referenceDocument } = {}) {
  const schema = schemaAt(document, name);
  add(errors, isRecord(schema), `${label} missing schema ${name}`);
  if (!isRecord(schema)) return undefined;
  // A composition-only wrapper (for example a CLEAN refinement expressed as
  // allOf[$ref, {properties}]) cannot safely repeat additionalProperties:false:
  // the base schema owns the closed object boundary and the refinement owns
  // only its exact predicate.  Requiring the keyword on the wrapper would
  // reject the valid source shape while giving no stronger JSON-Schema
  // guarantee.  Concrete object/base schemas remain closed below.
  if (schema.type === 'object' || isRecord(schema.properties)) {
    exact(errors, schema.additionalProperties, false, `${label}.${name}.additionalProperties`);
  }
  if (required) exactArray(errors, schema.required, required, `${label}.${name}.required`);
  for (const field of forbiddenFields) add(errors, !Object.hasOwn(schema.properties ?? {}, field), `${label}.${name} must not expose client authority field ${field}`);
  checkForbiddenPayload(schema, errors, `${label}.${name}`, document, false, new Set(), referenceDocument);
  return schema;
}

const REFINEMENT_SCHEMA_KEYS = Object.freeze(['$ref', 'type', 'properties', 'required', 'not']);

function assertRefinementShape(child, errors, location) {
  add(errors, isRecord(child), `${location} must be a schema object`);
  if (!isRecord(child)) return;
  if (typeof child.$ref === 'string') {
    keys(errors, child, ['$ref'], ['$ref'], location);
    return;
  }
  // Inline allOf/oneOf refinements are deliberately not object-closed on
  // their own: inherited properties belong to the base/root schema.  They
  // are nevertheless an exact, non-extensible predicate shape.
  keys(errors, child, REFINEMENT_SCHEMA_KEYS, [], location);
  if (isRecord(child.not)) keys(errors, child.not, ['required'], [], `${location}.not`);
}

function assertClosedSchemaGraph(document, schema, errors, location, seen = new Set(), { requireClosed = true } = {}) {
  if (!isRecord(schema)) return;
  if (typeof schema.$ref === 'string') {
    const seenKey = `${schema.$ref}|${requireClosed ? 'closed' : 'refinement'}`;
    if (seen.has(seenKey)) return;
    seen.add(seenKey);
    const resolved = resolveRef(document, schema);
    // A reference resolves the actual base schema, so it must be checked as
    // a concrete/root object even when it appears inside a refinement branch.
    add(errors, isRecord(resolved), `${location}.$ref must resolve to a local schema`);
    if (isRecord(resolved)) assertClosedSchemaGraph(document, resolved, errors, `${location}(${schema.$ref})`, seen, { requireClosed: true });
    return;
  }
  if (Object.hasOwn(schema, 'properties')) add(errors, isRecord(schema.properties), `${location}.properties must be an object`);
  if (Object.hasOwn(schema, 'items')) add(errors, isRecord(schema.items), `${location}.items must be a schema object`);
  if (schema.type === 'object' || isRecord(schema.properties)) {
    if (requireClosed) exact(errors, schema.additionalProperties, false, `${location}.additionalProperties`);
    for (const [name, child] of Object.entries(schema.properties ?? {})) {
      assertClosedSchemaGraph(document, child, errors, `${location}.properties.${name}`, seen, { requireClosed: true });
    }
  }
  if (schema.items) assertClosedSchemaGraph(document, schema.items, errors, `${location}.items`, seen, { requireClosed: true });
  for (const keyword of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) {
    if (Object.hasOwn(schema, keyword)) add(errors, Array.isArray(schema[keyword]), `${location}.${keyword} must be an array`);
    for (const [index, child] of (Array.isArray(schema[keyword]) ? schema[keyword] : []).entries()) {
      assertRefinementShape(child, errors, `${location}.${keyword}[${index}]`);
      assertClosedSchemaGraph(document, child, errors, `${location}.${keyword}[${index}]`, seen, { requireClosed: false });
    }
  }
  for (const keyword of ['not', 'if', 'then', 'else']) {
    if (Object.hasOwn(schema, keyword)) add(errors, isRecord(schema[keyword]), `${location}.${keyword} must be a schema object`);
    if (isRecord(schema[keyword])) {
      assertClosedSchemaGraph(document, schema[keyword], errors, `${location}.${keyword}`, seen, { requireClosed: false });
    }
  }
}

function refName(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/components/schemas/')) return undefined;
  return ref.slice('#/components/schemas/'.length);
}

function authorityFieldsForRef(ref, forbiddenFields) {
  const name = refName(ref);
  if (name === 'M1016SupportAssignCommand') {
    const allowed = new Set(forbiddenFields);
    // queueId is an explicit routing intent in the closed ASSIGN command; the
    // server still derives the effective assignment and audit facts.
    allowed.delete('queueId');
    return allowed;
  }
  if (name === 'M1016SupportResolution') {
    const allowed = new Set(forbiddenFields);
    // Resolution is currently shared by the response and command projection;
    // auditId is an owner receipt in that frozen shared shape.  Any newly
    // introduced authority field in the referenced schema remains rejected.
    allowed.delete('auditId');
    return allowed;
  }
  return forbiddenFields;
}

function assertNoClientAuthorityFields(document, schema, errors, location, forbiddenFields, seen = new Set()) {
  if (Array.isArray(schema)) {
    schema.forEach((entry, index) => assertNoClientAuthorityFields(document, entry, errors, `${location}[${index}]`, forbiddenFields, seen));
    return;
  }
  if (!isRecord(schema)) return;
  if (typeof schema.$ref === 'string') {
    const resolved = resolveRef(document, schema);
    add(errors, isRecord(resolved), `${location}.$ref must resolve before checking client authority fields`);
    const key = `${schema.$ref}|${[...forbiddenFields].sort().join(',')}`;
    if (isRecord(resolved) && !seen.has(key)) {
      seen.add(key);
      assertNoClientAuthorityFields(document, resolved, errors, `${location}(${schema.$ref})`, authorityFieldsForRef(schema.$ref, forbiddenFields), seen);
    }
    // Sibling keywords are legal with a local JSON Schema reference.  Walk
    // them as well instead of treating `$ref` as an early return.
  }
  if (Object.hasOwn(schema, 'properties')) add(errors, isRecord(schema.properties), `${location}.properties must be an object`);
  if (isRecord(schema.properties)) {
    for (const [field, child] of Object.entries(schema.properties)) {
      add(errors, !forbiddenFields.has(field), `${location}.properties.${field} must not be a client authority field`);
      assertNoClientAuthorityFields(document, child, errors, `${location}.properties.${field}`, forbiddenFields, seen);
    }
  }
  if (Object.hasOwn(schema, 'items')) add(errors, isRecord(schema.items), `${location}.items must be a schema object`);
  if (isRecord(schema.items)) assertNoClientAuthorityFields(document, schema.items, errors, `${location}.items`, forbiddenFields, seen);
  for (const keyword of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) {
    if (Object.hasOwn(schema, keyword)) add(errors, Array.isArray(schema[keyword]), `${location}.${keyword} must be an array`);
    for (const [index, child] of (Array.isArray(schema[keyword]) ? schema[keyword] : []).entries()) {
      assertNoClientAuthorityFields(document, child, errors, `${location}.${keyword}[${index}]`, forbiddenFields, seen);
    }
  }
  for (const keyword of ['not', 'if', 'then', 'else']) {
    if (Object.hasOwn(schema, keyword)) add(errors, isRecord(schema[keyword]), `${location}.${keyword} must be a schema object`);
    if (isRecord(schema[keyword])) assertNoClientAuthorityFields(document, schema[keyword], errors, `${location}.${keyword}`, forbiddenFields, seen);
  }
}

function assertClientAuthorityMetadata(operation, operationId, errors, label) {
  const frozen = M1016_CLIENT_AUTHORITY[operationId];
  add(errors, isRecord(frozen), `${label}.${operationId} has no frozen clientAuthority policy`);
  if (!isRecord(frozen)) return;
  exact(errors, operation['x-contract']?.clientAuthority, frozen.contract, `${label}.${operationId}.contract.clientAuthority`);
  exact(errors, operation['x-authorization']?.clientAuthority, frozen.authorization, `${label}.${operationId}.authorization.clientAuthority`);
}

function notificationRequestAuthorityFields(policy, name) {
  const fields = new Set(FORBIDDEN_CLIENT_FIELDS);
  if (name === 'M1016NotificationPreferenceCommand') {
    for (const field of (policy?.notification?.preference?.serverDerivedFields ?? [])) fields.add(field);
  }
  return fields;
}

function syncRequestAuthorityFields(policy) {
  return new Set([
    ...FORBIDDEN_CLIENT_FIELDS,
    ...(policy?.sync?.clientForbiddenFields ?? []),
    ...(policy?.sync?.serverDerivedFields ?? []),
  ]);
}

function supportRequestAuthorityFields(name) {
  const fields = new Set(FORBIDDEN_CLIENT_FIELDS);
  // queueId is an allowed routing intent in the closed ASSIGN command; the
  // referenced command scanner still checks every other authority field.
  if (name === 'M1016SupportAdminCommandRequest' || name.endsWith('Command')) fields.delete('queueId');
  return fields;
}

function validateCanonicalOperation(operation, method, route, operationId, owner, errors, label, {
  document,
  referenceDocument,
  dataOwner,
  requiredPermission,
  pep,
  allowedActors,
  trustedFacts,
  workload = false,
  requestSchema,
  responseSchema,
  requireConflict = false,
} = {}) {
  add(errors, isRecord(operation), `${label} missing canonical operation ${operationId}`);
  if (!isRecord(operation)) return;
  exact(errors, operation.operationId, operationId, `${label}.${operationId}.operationId`);
  exact(errors, operation['x-owner'], owner, `${label}.${operationId}.owner`);
  if (dataOwner !== undefined) exact(errors, operation['x-data-owner'], dataOwner, `${label}.${operationId}.dataOwner`);
  const contractKeys = ['task', 'canonical', 'maturity', 'runtimeStatus', 'clientAuthority'];
  if (keys(errors, operation['x-contract'], contractKeys, contractKeys, `${label}.${operationId}.x-contract`)) {
    exact(errors, operation['x-contract'].task, 'P1R-M1-016', `${label}.${operationId}.task`);
    exact(errors, operation['x-contract'].canonical, true, `${label}.${operationId}.canonical`);
    exact(errors, operation['x-contract'].maturity, 'D2_CONTRACT_READY', `${label}.${operationId}.maturity`);
    exact(errors, operation['x-contract'].runtimeStatus, 'NOT_RUNTIME_VERIFIED', `${label}.${operationId}.runtimeStatus`);
  }
  const authKeys = ['defaultDecision', 'requiredPermission', 'pep', 'allowedActors', 'trustedFacts', 'clientAuthority'];
  if (keys(errors, operation['x-authorization'], authKeys, authKeys, `${label}.${operationId}.x-authorization`)) {
    exact(errors, operation['x-authorization'].defaultDecision, 'DENY', `${label}.${operationId}.authorization.defaultDecision`);
    if (requiredPermission) exact(errors, operation['x-authorization'].requiredPermission, requiredPermission, `${label}.${operationId}.authorization.permission`);
    if (pep) exact(errors, operation['x-authorization'].pep, pep, `${label}.${operationId}.authorization.pep`);
    if (allowedActors) exactArray(errors, operation['x-authorization'].allowedActors, allowedActors, `${label}.${operationId}.authorization.allowedActors`);
    if (trustedFacts) exactArray(errors, operation['x-authorization'].trustedFacts, trustedFacts, `${label}.${operationId}.authorization.trustedFacts`);
  }
  assertClientAuthorityMetadata(operation, operationId, errors, label);
  if (requiredPermission) exact(errors, operation['x-permission'], requiredPermission, `${label}.${operationId}.permission`);
  add(errors, Array.isArray(operation.security) && operation.security.length === 1, `${label}.${operationId} must have exactly one security requirement`);
  add(errors, Object.hasOwn(operation.security?.[0] ?? {}, workload ? 'B8WorkloadIdentity' : 'bearerAuth'), `${label}.${operationId} must use ${workload ? 'B8WorkloadIdentity' : 'bearerAuth'}`);
  if (method !== 'GET') {
    exact(errors, operation['x-idempotency']?.required, true, `${label}.${operationId}.idempotency.required`);
    exact(errors, operation['x-idempotency']?.keyHeader, 'Idempotency-Key', `${label}.${operationId}.idempotency.keyHeader`);
    add(errors, isRecord(operation.responses?.['401']) && isRecord(operation.responses?.['403']), `${label}.${operationId} must expose explicit 401/403`);
    if (requireConflict) add(errors, isRecord(operation.responses?.['409']), `${label}.${operationId} must expose explicit 409`);
  }
  if (requestSchema) {
    const expectedRef = { $ref: `#/components/schemas/${requestSchema}` };
    exact(errors, operation.requestBody?.content?.['application/json']?.schema, expectedRef, `${label}.${operationId}.requestBody.schema`);
    add(errors, containsExactRef(operation.requestBody, expectedRef.$ref), `${label}.${operationId} must accept ${requestSchema}`);
  }
  if (responseSchema) {
    add(errors, containsExactRef(operation.responses, `#/components/schemas/${responseSchema}`), `${label}.${operationId} must return ${responseSchema}`);
  }
  checkOpenApiPayloadSchemas(operation, errors, `${label}.${operationId}`, document, referenceDocument);
}

function assertPolicySections(policy, errors) {
  if (!keys(errors, policy, ROOT_KEYS, ROOT_KEYS, 'M1-016 policy')) return;
  exact(errors, policy.schemaVersion, 'p1r.notification-sync-support-contract.v1', 'policy.schemaVersion');
  exact(errors, policy.task, 'P1R-M1-016', 'policy.task');
  exact(errors, policy.phase, 'P1', 'policy.phase');
  exact(errors, policy.startCommit, FROZEN_POLICY_START_COMMIT, 'policy.startCommit');
  exact(errors, policy.sourceBaseline, FROZEN_POLICY_SOURCE_BASELINE, 'policy.sourceBaseline');
  exact(errors, policy.maturity, 'D2_CONTRACT_READY', 'policy.maturity');
  exact(errors, policy.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'policy.runtimeStatus');
  keys(errors, policy.collectionPolicy, COLLECTION_KEYS, COLLECTION_KEYS, 'collectionPolicy');
  exact(errors, policy.collectionPolicy, {
    unknownFieldDecision: 'DENY', unknownEnumDecision: 'DENY', additionalProperties: 'DENY',
    clientAuthorityExpansion: 'PROHIBITED', unverifiedRuntimeClaim: 'DENY', implicitDefault: 'DENY',
  }, 'collectionPolicy');
  keys(errors, policy.canonicalSources, CANONICAL_SOURCE_KEYS, CANONICAL_SOURCE_KEYS, 'canonicalSources');
  if (isRecord(policy.canonicalSources)) {
    exact(errors, policy.canonicalSources, CANONICAL_SOURCE_VALUES, 'canonicalSources');
    for (const [name, value] of Object.entries(policy.canonicalSources)) add(errors, nonEmpty(value), `canonicalSources.${name} must be a non-empty path/ref`);
  }
  keys(errors, policy.compatibilityPromotion, PROMOTION_KEYS, PROMOTION_KEYS, 'compatibilityPromotion');
  const promotion = policy.compatibilityPromotion;
  if (isRecord(promotion)) {
    exact(errors, promotion.id, 'P1R-M1-016', 'compatibilityPromotion.id');
    exact(errors, promotion.sourceContractBaseline, policy.sourceBaseline, 'compatibilityPromotion.sourceContractBaseline');
    exact(errors, promotion.immutableGovernanceBaseline, '868c2177f62b6d2cf613bed702686dddcfe6943f', 'compatibilityPromotion.immutableGovernanceBaseline');
    exact(errors, promotion.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'compatibilityPromotion.runtimeStatus');
    exact(errors, promotion.scope, 'M1016_OPENAPI_EVENT_GOVERNANCE_B26_STATIC_WITH_B11_B5_B13_V1_HISTORICAL', 'compatibilityPromotion.scope');
    exact(errors, promotion.promotionMode, 'FUTURE_M1016_V2_ONLY', 'compatibilityPromotion.promotionMode');
    exact(errors, promotion.allowsHistoricalV1Promotion, false, 'compatibilityPromotion.allowsHistoricalV1Promotion');
    exact(errors, promotion.allowsDualPublish, false, 'compatibilityPromotion.allowsDualPublish');
    exactArray(errors, promotion.approvedSourceFiles, APPROVED_SOURCE_FILES, 'compatibilityPromotion.approvedSourceFiles');
    exactArray(errors, promotion.requiredCompatibilityChecks, REQUIRED_COMPATIBILITY_CHECKS, 'compatibilityPromotion.requiredCompatibilityChecks');
    keys(errors, promotion.b26StaticPolicy, B26_PROMOTION_KEYS, B26_PROMOTION_KEYS, 'compatibilityPromotion.b26StaticPolicy');
    keys(errors, promotion.canonicalOpenApiSource, OPENAPI_PROMOTION_KEYS, OPENAPI_PROMOTION_KEYS, 'compatibilityPromotion.canonicalOpenApiSource');
    keys(errors, promotion.canonicalEventSource, EVENT_PROMOTION_KEYS, EVENT_PROMOTION_KEYS, 'compatibilityPromotion.canonicalEventSource');
    exact(errors, promotion.b26StaticPolicy, {
      contract: 'config/b26-event-runtime.json',
      classification: 'STATIC_GOVERNANCE_ONLY',
      runtimeEvidence: 'NOT_RUNTIME_VERIFIED',
      allowsRuntimePromotion: false,
      requiresSeparateRuntimeEvidence: true,
    }, 'compatibilityPromotion.b26StaticPolicy');
    exact(errors, promotion.b26StaticPolicy?.runtimeEvidence, 'NOT_RUNTIME_VERIFIED', 'compatibilityPromotion.b26StaticPolicy.runtimeEvidence');
    exact(errors, promotion.b26StaticPolicy?.allowsRuntimePromotion, false, 'compatibilityPromotion.b26StaticPolicy.allowsRuntimePromotion');
    exact(errors, promotion.canonicalOpenApiSource?.runtimeEvidence, 'NOT_RUNTIME_VERIFIED', 'canonicalOpenApiSource.runtimeEvidence');
    list(errors, promotion.canonicalOpenApiSource?.sources, 'canonicalOpenApiSource.sources', { exactLength: CANONICAL_OPENAPI_SOURCE_SPECS.length });
    if (Array.isArray(promotion.canonicalOpenApiSource?.sources)) {
      for (const [index, source] of promotion.canonicalOpenApiSource.sources.entries()) {
        const requiredSourceKeys = index === 2
          ? OPENAPI_SOURCE_KEYS
          : OPENAPI_SOURCE_KEYS.filter((key) => key !== 'canonicalV2ProjectionMode');
        if (keys(errors, source, OPENAPI_SOURCE_KEYS, requiredSourceKeys, `canonicalOpenApiSource.sources[${index}]`)) {
          exact(errors, source, CANONICAL_OPENAPI_SOURCE_SPECS[index], `canonicalOpenApiSource.sources[${index}]`);
        }
      }
    }
    exact(errors, promotion.canonicalOpenApiSource?.canonicalPolicySource, DEFAULT_POLICY_PATH, 'canonicalOpenApiSource.canonicalPolicySource');
    exact(errors, promotion.canonicalOpenApiSource?.promotionRequiresExactProjection, true, 'canonicalOpenApiSource.promotionRequiresExactProjection');
    exact(errors, promotion.canonicalOpenApiSource?.b11B5B13V1Promotion, 'PROHIBITED', 'canonicalOpenApiSource.b11B5B13V1Promotion');
    exact(errors, promotion.canonicalOpenApiSource?.b12Semantics, 'CANONICAL_V2_POLICY_TARGET', 'canonicalOpenApiSource.b12Semantics');
    exact(errors, promotion.canonicalEventSource?.runtimeEvidence, 'NOT_RUNTIME_VERIFIED', 'canonicalEventSource.runtimeEvidence');
    exact(errors, promotion.canonicalEventSource?.v1Semantics, 'HISTORICAL_INPUT_ONLY', 'canonicalEventSource.v1Semantics');
    exact(errors, promotion.canonicalEventSource?.sourceFile, 'packages/contracts/events/v1/fragments/m1-016-notification-sync-support-v2.events.json', 'canonicalEventSource.sourceFile');
    exact(errors, promotion.canonicalEventSource?.classification, 'M1016_V2_EVENT_GOVERNANCE_SOURCE', 'canonicalEventSource.classification');
    exact(errors, promotion.canonicalEventSource?.catalogProjection, 'packages/contracts/events/v1/catalog.json', 'canonicalEventSource.catalogProjection');
    exactArray(errors, promotion.canonicalEventSource?.promotionRequires, ['producer', 'dataOwner', 'consumerGroup', 'topic', 'aggregatePartition', 'payloadSchema', 'dedupeAndReplayPolicy'], 'canonicalEventSource.promotionRequires');
  }
  assertAuthority(policy.authority, errors);
  assertOwnership(policy.ownership, errors);
  assertNotification(policy.notification, errors);
  assertSync(policy.sync, errors);
  assertSupport(policy.support, errors);
  assertEvents(policy.events, errors);
  assertLegacy(policy.legacyCompatibility, errors);
  assertRuntimeBoundary(policy.runtimeBoundary, errors);
  keys(errors, policy.requiredAcceptanceEvidence, ACCEPTANCE_KEYS, ACCEPTANCE_KEYS, 'requiredAcceptanceEvidence');
  list(errors, policy.requiredAcceptanceEvidence?.contract, 'requiredAcceptanceEvidence.contract');
  exact(errors, policy.requiredAcceptanceEvidence?.runtime, 'REQUIRES_SEPARATE_M2_M6_M8_EVIDENCE_AND_CANNOT_BE_SATISFIED_BY_THIS_POLICY', 'requiredAcceptanceEvidence.runtime');
  list(errors, policy.adversarialCases, 'adversarialCases', { min: 20 });
  exact(errors, policyDigest(policy), FROZEN_POLICY_SHA256, 'M1-016 policy digest');
  assertNoRuntimePromotion(policy, errors);
}

function assertAuthority(authority, errors) {
  if (!keys(errors, authority, AUTHORITY_KEYS, AUTHORITY_KEYS, 'authority')) return;
  exact(errors, authority.principalAndTenant, 'SERVER_DERIVED_FROM_VERIFIED_TOKEN', 'authority.principalAndTenant');
  exact(errors, authority.deviceBinding, 'SERVER_DERIVED_FROM_VERIFIED_SESSION_AND_DEVICE', 'authority.deviceBinding');
  exact(errors, authority.notificationOwner, 'notification-service', 'authority.notificationOwner');
  exact(errors, authority.syncWriter, 'OWNER_SPECIFIC_DOMAIN_SERVICE_ONLY', 'authority.syncWriter');
  exact(errors, authority.supportOwner, 'admin-ops-service.support', 'authority.supportOwner');
  exact(errors, authority.workflowRole, 'RETRY_DLQ_RECOVERY_ORCHESTRATION_ONLY', 'authority.workflowRole');
  exactArray(errors, authority.clientMaySet, [
    'clientEventId', 'clientSeq', 'baseVersion', 'contentVersionId', 'payloadHash',
    'entityType', 'entityId', 'operation', 'occurredAt', 'idempotencyKey',
  ], 'authority.clientMaySet');
  list(errors, authority.serverDerivedFields, 'authority.serverDerivedFields');
  list(errors, authority.forbiddenClientAuthorityFields, 'authority.forbiddenClientAuthorityFields');
  if (Array.isArray(authority.forbiddenClientAuthorityFields)) {
    for (const field of FORBIDDEN_CLIENT_FIELDS) add(errors, authority.forbiddenClientAuthorityFields.includes(field), `authority must forbid ${field}`);
  }
}

function assertOwnership(ownership, errors) {
  const expectedOwners = {
    'notification-service': ['canonicalFacts', 'mayWriteDomainFacts', 'mayWriteSupportFacts'],
    'workflow-service': ['canonicalFacts', 'mayWriteNotificationMessage', 'mayWriteDomainFacts', 'mayWriteSupportFacts'],
    'owner-specific-domain-service': ['canonicalFacts', 'uniqueWriter', 'mayUseCentralSyncWriter'],
    'admin-ops-service.support': ['canonicalFacts', 'uniqueWriter', 'mayCopyDomainFacts', 'mayReadDomainContext'],
    'audit-service': ['canonicalFacts', 'appendOnly', 'mayWriteBusinessFacts'],
  };
  if (!keys(errors, ownership, Object.keys(expectedOwners), Object.keys(expectedOwners), 'ownership')) return;
  for (const [owner, ownerKeys] of Object.entries(expectedOwners)) {
    if (!keys(errors, ownership[owner], ownerKeys, ownerKeys, `ownership.${owner}`)) continue;
    const facts = ownership[owner].canonicalFacts;
    list(errors, facts, `ownership.${owner}.canonicalFacts`);
    if (owner !== 'owner-specific-domain-service' && Array.isArray(facts)) add(errors, facts.every((fact) => !/raw|password|token|credential/i.test(fact)), `ownership.${owner} must not own raw secrets`);
  }
  exact(errors, ownership['notification-service']?.mayWriteDomainFacts, false, 'notification owner domain write');
  exact(errors, ownership['notification-service']?.mayWriteSupportFacts, false, 'notification owner support write');
  exact(errors, ownership['workflow-service']?.mayWriteNotificationMessage, false, 'workflow notification write');
  exact(errors, ownership['workflow-service']?.mayWriteDomainFacts, false, 'workflow domain write');
  exact(errors, ownership['workflow-service']?.mayWriteSupportFacts, false, 'workflow support write');
  exact(errors, ownership['owner-specific-domain-service']?.uniqueWriter, true, 'sync owner unique writer');
  exact(errors, ownership['owner-specific-domain-service']?.mayUseCentralSyncWriter, false, 'central sync writer');
  exact(errors, ownership['admin-ops-service.support']?.uniqueWriter, true, 'support unique writer');
  exact(errors, ownership['admin-ops-service.support']?.mayCopyDomainFacts, false, 'support domain-copy boundary');
  exact(errors, ownership['audit-service']?.appendOnly, true, 'audit append-only');
  exact(errors, ownership['audit-service']?.mayWriteBusinessFacts, false, 'audit business write');
}

function assertNotification(notification, errors) {
  if (!keys(errors, notification, NOTIFICATION_KEYS, NOTIFICATION_KEYS, 'notification')) return;
  exact(errors, notification.canonicalFamily, 'B12', 'notification.canonicalFamily');
  exact(errors, notification.canonicalStatus, 'D2_CANONICAL_B12_NOTIFICATION_B11_HISTORICAL', 'notification.canonicalStatus');
  exactArray(errors, notification.historicalFamilies, ['B11'], 'notification.historicalFamilies');
  exactArray(errors, notification.channels, ['IN_APP', 'PUSH', 'EMAIL', 'SMS'], 'notification.channels');
  exactArray(errors, notification.allowedLocales, ['zh-CN'], 'notification.allowedLocales');
  exactArray(errors, notification.categories, ['LEARNING', 'REVIEW', 'STREAK', 'EXAM', 'CHECKPOINT', 'STUDY_ROOM', 'REWARDS', 'COURSE', 'MEMBERSHIP', 'MARKETING', 'SECURITY', 'ACCOUNT', 'PAYMENT', 'SYSTEM'], 'notification.categories');
  if (keys(errors, notification.smsPolicy, SMS_KEYS, SMS_KEYS, 'notification.smsPolicy')) {
    exactArray(errors, notification.smsPolicy.allowlistPurposes, ['ACCOUNT_VERIFICATION', 'SECURITY_ALERT', 'PHONE_BINDING_CHANGE', 'CRITICAL_ACCOUNT_PAYMENT'], 'notification.smsPolicy.allowlistPurposes');
    exactArray(errors, notification.smsPolicy.allowlistCategories, ['SECURITY', 'ACCOUNT', 'PAYMENT'], 'notification.smsPolicy.allowlistCategories');
    exactArray(errors, notification.smsPolicy.prohibitedCategories, ['LEARNING', 'REVIEW', 'STREAK', 'EXAM', 'CHECKPOINT', 'STUDY_ROOM', 'REWARDS', 'COURSE', 'MEMBERSHIP', 'MARKETING', 'SYSTEM'], 'notification.smsPolicy.prohibitedCategories');
    exact(errors, notification.smsPolicy.securityAndNecessaryTransactionOverride, true, 'notification.smsPolicy.security override');
    exact(errors, notification.smsPolicy.unknownPurposeDecision, 'DENY', 'notification.smsPolicy.unknownPurposeDecision');
    exact(errors, notification.smsPolicy.marketingSms, 'DENY', 'notification.smsPolicy.marketingSms');
  }
  assertNotificationPreference(notification.preference, errors);
  assertNotificationTemplate(notification.template, errors);
  assertNotificationMessage(notification.message, errors);
  if (keys(errors, notification.delivery, DELIVERY_KEYS, DELIVERY_KEYS, 'notification.delivery')) {
    exact(errors, notification.delivery.owner, 'notification-service', 'notification.delivery.owner');
    exactArray(errors, notification.delivery.states, ['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RETRY_SCHEDULED', 'CANCELLED', 'DEAD_LETTER', 'MANUAL_RECOVERY'], 'notification.delivery.states');
    exactArray(errors, notification.delivery.terminalStates, ['DELIVERED', 'FAILED', 'CANCELLED', 'DEAD_LETTER'], 'notification.delivery.terminalStates');
    exactArray(errors, notification.delivery.dedupeKey, ['sourceEventId', 'principalId', 'category', 'channel', 'businessDedupeKey'], 'notification.delivery.dedupeKey');
    exact(errors, notification.delivery.domainFactRollback, 'PROHIBITED', 'notification.delivery.domainFactRollback');
    exact(errors, notification.delivery.unknownChannelDecision, 'DENY', 'notification.delivery.unknownChannelDecision');
  }
  assertNotificationRetry(notification.retry, errors);
  if (keys(errors, notification.subscriptionPromotion, SUBSCRIPTION_PROMOTION_KEYS, SUBSCRIPTION_PROMOTION_KEYS, 'notification.subscriptionPromotion')) {
    exact(errors, notification.subscriptionPromotion.status, 'D2_EXACT_SUBSCRIPTIONS_FROZEN_NOT_RUNTIME_VERIFIED', 'notification.subscriptionPromotion.status');
    exact(errors, notification.subscriptionPromotion.exactSourceEventsOnly, true, 'notification.subscriptionPromotion.exactSourceEventsOnly');
    exact(errors, notification.subscriptionPromotion.futureUnboundSubscriptionsAreActive, false, 'notification.subscriptionPromotion.futureUnboundSubscriptionsAreActive');
    exact(errors, notification.subscriptionPromotion.unknownProducerDecision, 'DENY', 'notification.subscriptionPromotion.unknownProducerDecision');
    exact(errors, notification.subscriptionPromotion.dualPublish, false, 'notification.subscriptionPromotion.dualPublish');
  }
  assertSubscriptions(notification.exactSubscriptions, errors);
  list(errors, notification.futureUnboundTemplateAllowlist, 'notification.futureUnboundTemplateAllowlist', { exactLength: 1 });
  if (Array.isArray(notification.futureUnboundTemplateAllowlist) && notification.futureUnboundTemplateAllowlist.length === 1) {
    exact(errors, notification.futureUnboundTemplateAllowlist[0], FUTURE_UNBOUND_TEMPLATE, 'notification.futureUnboundTemplateAllowlist[0]');
  }
}

function assertNotificationPreference(preference, errors) {
  if (!keys(errors, preference, PREFERENCE_KEYS, PREFERENCE_KEYS, 'notification.preference')) return;
  exactArray(errors, preference.requiredFields, ['category', 'channel', 'enabled', 'locale', 'consentVersion', 'dndWindow', 'frequencyPolicy', 'version', 'updatedAt'], 'notification.preference.requiredFields');
  exactArray(errors, preference.allowedFields, ['category', 'channel', 'enabled', 'locale', 'consentVersion', 'dndWindow', 'frequencyPolicy', 'version', 'expectedVersion', 'updatedAt'], 'notification.preference.allowedFields');
  exactArray(errors, preference.clientWritableFields, ['category', 'channel', 'enabled', 'locale', 'consentVersion', 'dndWindow', 'frequencyPolicy', 'expectedVersion'], 'notification.preference.clientWritableFields');
  exactArray(errors, preference.serverDerivedFields, ['tenantId', 'principalId', 'version', 'updatedAt'], 'notification.preference.serverDerivedFields');
  if (keys(errors, preference.compareAndSet, CAS_KEYS, CAS_KEYS, 'notification.preference.compareAndSet')) {
    exact(errors, preference.compareAndSet.required, true, 'notification preference CAS required');
    exact(errors, preference.compareAndSet.versionField, 'version', 'notification preference version field');
    exact(errors, preference.compareAndSet.expectedField, 'expectedVersion', 'notification preference expected field');
    exact(errors, preference.compareAndSet.sameVersionSameDigest, 'REPLAY_OR_CURRENT_RESULT', 'notification preference same-version replay');
    exact(errors, preference.compareAndSet.staleVersion, 'CONFLICT', 'notification preference stale version');
    exact(errors, preference.compareAndSet.missingVersion, 'DENY', 'notification preference missing version');
  }
  if (keys(errors, preference.dndWindow, DND_KEYS, DND_KEYS, 'notification.preference.dndWindow')) {
    exact(errors, preference.dndWindow.defaultStart, '23:00', 'notification DND start');
    exact(errors, preference.dndWindow.defaultEnd, '08:00', 'notification DND end');
    exact(errors, preference.dndWindow.timezone, 'SERVER_DERIVED_IANA_TIMEZONE', 'notification DND timezone');
    exact(errors, preference.dndWindow.securityAndNecessaryTransactionBypass, true, 'notification DND security override');
  }
  if (keys(errors, preference.frequencyPolicy, FREQUENCY_KEYS, FREQUENCY_KEYS, 'notification.preference.frequencyPolicy')) {
    exactArray(errors, preference.frequencyPolicy.allowed, ['IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST', 'DISABLED'], 'notification frequency allowed');
    exact(errors, preference.frequencyPolicy.serverEnforced, true, 'notification frequency server enforcement');
    exact(errors, preference.frequencyPolicy.unknownDecision, 'DENY', 'notification frequency unknown decision');
  }
}

function assertNotificationTemplate(template, errors) {
  if (!keys(errors, template, TEMPLATE_KEYS, TEMPLATE_KEYS, 'notification.template')) return;
  exactArray(errors, template.requiredFields, ['templateKey', 'templateVersion', 'category', 'locale', 'parameterAllowlist', 'deepLinkPolicy', 'expiryPolicy', 'pinPolicy', 'redactionPolicy', 'status'], 'notification.template.requiredFields');
  exactArray(errors, template.status, ['ACTIVE', 'DEPRECATED', 'DISABLED'], 'notification.template.status');
  exact(errors, template.parameterValues, 'STRUCTURED_ALLOWLIST_ONLY', 'notification.template.parameterValues');
  exact(errors, template.rawFreeText, 'DENY', 'notification.template.rawFreeText');
  exact(errors, template.rawTokenAudioPaymentCredential, 'DENY', 'notification.template.sensitive values');
  exact(errors, template.deepLinkPolicy, 'ALLOWLISTED_INTERNAL_ROUTE_ONLY', 'notification.template.deepLinkPolicy');
  exact(errors, template.expiryPolicy, 'EXPLICIT_PER_TEMPLATE', 'notification.template.expiryPolicy');
  exact(errors, template.pinPolicy, 'EXPLICIT_PER_TEMPLATE', 'notification.template.pinPolicy');
  exact(errors, template.redactionPolicy, 'SAFE_RENDERED_BODY_ONLY', 'notification.template.redactionPolicy');
}

function assertNotificationMessage(message, errors) {
  if (!keys(errors, message, MESSAGE_KEYS, MESSAGE_KEYS, 'notification.message')) return;
  exactArray(errors, message.requiredFields, ['messageId', 'sourceEventId', 'requestId', 'principalId', 'notificationType', 'category', 'channel', 'templateKey', 'templateVersion', 'locale', 'parameterDigest', 'dedupeKey', 'createdAt', 'expiresAt', 'pinned', 'readAt', 'deliveryStatus', 'contentVersionId', 'version'], 'notification.message.requiredFields');
  exactArray(errors, message.allowedFields, ['messageId', 'sourceEventId', 'requestId', 'principalId', 'notificationType', 'category', 'channel', 'templateKey', 'templateVersion', 'locale', 'parameterDigest', 'safeTitle', 'safeBody', 'deepLink', 'dedupeKey', 'createdAt', 'expiresAt', 'pinned', 'readAt', 'deliveryStatus', 'contentVersionId', 'version'], 'notification.message.allowedFields');
  exactArray(errors, message.clientWritableFields, [], 'notification.message.clientWritableFields');
  exactArray(errors, message.forbiddenFields, ['token', 'password', 'rawAudio', 'paymentCredential', 'unredactedFreeText', 'clientPrincipalId', 'clientTenantId'], 'notification.message.forbiddenFields');
  if (keys(errors, message.readReceipt, READ_RECEIPT_KEYS, READ_RECEIPT_KEYS, 'notification.message.readReceipt')) {
    exact(errors, message.readReceipt.owner, 'notification-service', 'notification read receipt owner');
    exact(errors, message.readReceipt.writeKey, 'messageId', 'notification read receipt key');
    exactArray(errors, message.readReceipt.clientMaySet, ['messageId'], 'notification read receipt client fields');
    exact(errors, message.readReceipt.readAt, 'SERVER_CLOCK', 'notification read receipt clock');
  }
}

function assertNotificationRetry(retry, errors) {
  if (!keys(errors, retry, RETRY_KEYS, RETRY_KEYS, 'notification.retry')) return;
  exact(errors, retry.policyRef, 'P1R-M1-007', 'notification.retry.policyRef');
  exact(errors, retry.maxAttemptsIncludingFirst, 5, 'notification.retry.maxAttemptsIncludingFirst');
  exact(errors, retry.firstAttemptNumber, 1, 'notification.retry.firstAttemptNumber');
  exact(errors, retry.maxRetriesAfterFirst, 4, 'notification.retry.maxRetriesAfterFirst');
  exact(errors, retry.strategy, 'EXPONENTIAL_BACKOFF_WITH_JITTER', 'notification.retry.strategy');
  exactArray(errors, retry.retryableFailureClasses, ['TRANSIENT_PROVIDER', 'TIMEOUT', 'RATE_LIMIT', 'TEMPORARY_NETWORK'], 'notification.retry.retryableFailureClasses');
  exactArray(errors, retry.nonRetryableFailureClasses, ['CONSENT_REVOKED', 'INVALID_DESTINATION', 'TEMPLATE_INVALID', 'SENSITIVE_CONTENT', 'UNKNOWN'], 'notification.retry.nonRetryableFailureClasses');
  exact(errors, retry.unknownFailureDecision, 'DENY_TO_DLQ', 'notification.retry.unknownFailureDecision');
  exactArray(errors, retry.workflowOnlyOperations, ['SCHEDULE_RETRY', 'MOVE_TO_DLQ', 'REPLAY', 'MANUAL_RECOVERY'], 'notification.retry.workflowOnlyOperations');
  exact(errors, retry.notificationOwnerKeepsDeliveryFact, true, 'notification.retry.notificationOwnerKeepsDeliveryFact');
  exact(errors, retry.domainFactMutation, 'PROHIBITED', 'notification.retry.domainFactMutation');
}

function assertSubscriptions(subscriptions, errors) {
  list(errors, subscriptions, 'notification.exactSubscriptions', { exactLength: EXACT_NOTIFICATION_SUBSCRIPTIONS.length });
  if (!Array.isArray(subscriptions)) return;
  const seen = new Set();
  for (const [index, entry] of subscriptions.entries()) {
    const expected = EXACT_NOTIFICATION_SUBSCRIPTIONS[index];
    if (!expected) {
      errors.push(`notification.exactSubscriptions[${index}] is outside the frozen subscription set`);
      continue;
    }
    if (!keys(errors, entry, Object.keys(expected), Object.keys(expected), `notification.exactSubscriptions[${index}]`)) continue;
    add(errors, !seen.has(entry.sourceEvent), `notification subscription duplicate sourceEvent ${entry.sourceEvent}`);
    seen.add(entry.sourceEvent);
    exact(errors, entry, expected, `notification.exactSubscriptions[${index}]`);
  }
  exact(errors, [...seen].sort(), EXACT_NOTIFICATION_SUBSCRIPTIONS.map(({ sourceEvent }) => sourceEvent).sort(), 'notification subscription source allowlist');
}

function assertSync(sync, errors) {
  if (!keys(errors, sync, SYNC_KEYS, SYNC_KEYS, 'sync')) return;
  exact(errors, sync.canonicalMode, 'OWNER_SPECIFIC_COMMAND_ONLY', 'sync.canonicalMode');
  exact(errors, sync.centralWriter, 'PROHIBITED', 'sync.centralWriter');
  exact(errors, sync.clientKafkaProducer, false, 'sync.clientKafkaProducer');
  exactArray(errors, sync.requiredFields, REQUIRED_SYNC_FIELDS, 'sync.requiredFields');
  if (keys(errors, sync.contentVersionBinding, CONTENT_VERSION_KEYS, CONTENT_VERSION_KEYS, 'sync.contentVersionBinding')) {
    exact(errors, sync.contentVersionBinding.requiredField, 'contentVersionId', 'sync contentVersion required field');
    exact(errors, sync.contentVersionBinding.nonContentValue, 'NOT_APPLICABLE_EXPLICITLY_DECLARED_BY_OWNER', 'sync non-content version value');
    exact(errors, sync.contentVersionBinding.clientMayOmit, false, 'sync contentVersion client omission');
    exact(errors, sync.contentVersionBinding.clientMayInvent, false, 'sync contentVersion client invention');
    exact(errors, sync.contentVersionBinding.staleOrUnknownDecision, 'CONFLICT_OR_DENY', 'sync contentVersion stale decision');
  }
  exactArray(errors, sync.serverDerivedFields, ['tenantId', 'principalId', 'deviceId', 'ownerService', 'acceptedAt', 'serverVersion', 'conflictId', 'recoveryTaskId'], 'sync.serverDerivedFields');
  exactArray(errors, sync.clientForbiddenFields, ['tenantId', 'principalId', 'subjectId', 'ownerService', 'serverVersion', 'conflictId', 'recoveryTaskId', 'mastery', 'xp', 'entitlementState'], 'sync.clientForbiddenFields');
  if (keys(errors, sync.sequence, SEQUENCE_KEYS, SEQUENCE_KEYS, 'sync.sequence')) {
    exactArray(errors, sync.sequence.scope, ['principalId', 'deviceId'], 'sync sequence scope');
    exact(errors, sync.sequence.startsAt, 1, 'sync sequence startsAt');
    exact(errors, sync.sequence.ordering, 'STRICT_SERVER_ORDER', 'sync sequence ordering');
    exact(errors, sync.sequence.sameEventSameHash, 'REPLAY_OR_ORIGINAL_RESULT', 'sync same-hash replay');
    exact(errors, sync.sequence.sameEventDifferentHash, 'CONFLICT', 'sync different-hash conflict');
    for (const field of ['gap', 'outOfOrder', 'staleBaseVersion', 'futureBaseVersion']) exact(errors, sync.sequence[field], 'CONFLICT', `sync sequence ${field}`);
    exact(errors, sync.sequence.blindLastWriteWins, 'DENY', 'sync blind last-write-wins');
  }
  exactArray(errors, sync.outcomes, ['ACCEPTED', 'APPLIED', 'REPLAYED', 'PROCESSING', 'CONFLICT', 'REJECTED'], 'sync.outcomes');
  if (keys(errors, sync.conflict, CONFLICT_KEYS, CONFLICT_KEYS, 'sync.conflict')) {
    exactArray(errors, sync.conflict.requiredFields, ['conflictId', 'clientEventId', 'entityType', 'entityId', 'baseVersion', 'localVersion', 'serverVersion', 'contentVersionId', 'reasonCode', 'safeServerReference', 'allowedResolution', 'recoveryTaskId'], 'sync conflict.requiredFields');
    exactArray(errors, sync.conflict.reasonCodes, ['DUPLICATE_EVENT_DIFFERENT_HASH', 'OUT_OF_ORDER', 'SEQUENCE_GAP', 'STALE_BASE_VERSION', 'FUTURE_BASE_VERSION', 'CONTENT_VERSION_MISMATCH', 'OWNER_VERSION_MISMATCH', 'PERMISSION_OR_RIGHTS_CHANGED'], 'sync conflict.reasonCodes');
    exactArray(errors, sync.conflict.allowedResolutions, ['RELOAD_SERVER', 'KEEP_LOCAL_DRAFT', 'RETRY_WITH_NEW_BASE', 'CONTACT_SUPPORT', 'DISCARD_LOCAL'], 'sync conflict.allowedResolutions');
    exact(errors, sync.conflict.clientMerge, 'DENY_FOR_ATTEMPT_MASTERY_XP_ENTITLEMENT', 'sync conflict.clientMerge');
    exact(errors, sync.conflict.serverFactRollback, 'PROHIBITED', 'sync conflict.serverFactRollback');
  }
  const expectedOwnerMap = {
    LEARNING_PLAN: 'learning-service', LEARNING_PROGRESS: 'learning-service', SRS_REVIEW: 'learning-service', MASTERY_PROJECTION: 'learning-service',
    ASSESSMENT_SESSION: 'assessment-service', ASSESSMENT_CHECKPOINT: 'assessment-service', ATTEMPT: 'assessment-service',
    FAVORITE: 'learner-service', EXPRESSION_VOCAB: 'learner-service', NOTIFICATION_PREFERENCE: 'notification-service',
    SUPPORT_TICKET: 'admin-ops-service.support', UNKNOWN: 'DENY',
  };
  exact(errors, sync.ownerMap, expectedOwnerMap, 'sync.ownerMap');
  if (keys(errors, sync.workflowRecovery, WORKFLOW_RECOVERY_KEYS, WORKFLOW_RECOVERY_KEYS, 'sync.workflowRecovery')) {
    exact(errors, sync.workflowRecovery.owner, 'workflow-service', 'sync.workflowRecovery.owner');
    exactArray(errors, sync.workflowRecovery.taskFields, ['taskId', 'clientEventId', 'entityId', 'stage', 'retryCount', 'lastErrorCode', 'nextAction', 'ownerService', 'auditId', 'closureReceipt'], 'sync.workflowRecovery.taskFields');
    exact(errors, sync.workflowRecovery.mayWriteOwnerFact, false, 'sync workflow owner fact write');
    exact(errors, sync.workflowRecovery.closureRequiresOwnerReconciliation, true, 'sync recovery reconciliation');
  }
}

function assertSupport(support, errors) {
  if (!keys(errors, support, SUPPORT_KEYS, SUPPORT_KEYS, 'support')) return;
  exact(errors, support.owner, 'admin-ops-service.support', 'support.owner');
  if (keys(errors, support.canonicalRoutes, SUPPORT_ROUTES_KEYS, SUPPORT_ROUTES_KEYS, 'support.canonicalRoutes')) {
    exact(errors, support.canonicalRoutes.learner, '/api/v1/support/tickets', 'support learner route');
    exact(errors, support.canonicalRoutes.admin, '/api/v1/admin/ops/tickets', 'support admin route');
    exact(errors, support.canonicalRoutes.sameOwnerSchema, true, 'support same owner schema');
    exact(errors, support.canonicalRoutes.sameStateMachine, true, 'support same state machine');
    exact(errors, support.canonicalRoutes.sameIdempotencyDomain, true, 'support same idempotency domain');
    exact(errors, support.canonicalRoutes.routeAdapterRequiredUntilMigration, true, 'support adapter boundary');
  }
  exactArray(errors, support.states, REQUIRED_SUPPORT_STATES, 'support.states');
  exactArray(errors, support.initialStates, ['OPEN'], 'support.initialStates');
  exactArray(errors, support.terminalStates, ['CLOSED'], 'support.terminalStates');
  list(errors, support.transitions, 'support.transitions', { exactLength: 7 });
  const transitionKeys = ['from', 'to', 'requires'];
  const transitionFrom = new Set();
  for (const [index, transition] of (Array.isArray(support.transitions) ? support.transitions : []).entries()) {
    if (!keys(errors, transition, transitionKeys, transitionKeys, `support.transitions[${index}]`)) continue;
    add(errors, !transitionFrom.has(transition.from), `support transition duplicate from ${transition.from}`);
    transitionFrom.add(transition.from);
    add(errors, support.states.includes(transition.from), `support transition unknown from ${transition.from}`);
    add(errors, Array.isArray(transition.to) && transition.to.every((state) => support.states.includes(state)), `support transition ${transition.from} has unknown target`);
    list(errors, transition.requires, `support.transitions[${index}].requires`);
    add(errors, transition.requires.includes('auditId'), `support transition ${transition.from} must require auditId`);
  }
  exactArray(errors, support.categories, REQUIRED_SUPPORT_CATEGORIES, 'support.categories');
  assertSupportTicket(support.ticket, errors);
  assertContentReference(support.contentReference, errors);
  assertAttachmentReference(support.attachmentReference, errors);
  assertSupportMessage(support.message, errors);
  assertAssignment(support.assignment, errors);
  assertSla(support.sla, errors);
  assertResolution(support.resolution, errors);
  assertRetention(support.retention, errors);
  if (keys(errors, support.events, SUPPORT_EVENTS_KEYS, SUPPORT_EVENTS_KEYS, 'support.events')) {
    exact(errors, support.events.version, 'v2', 'support.events.version');
    exact(errors, support.events.dualPublish, false, 'support.events.dualPublish');
    exactArray(errors, support.events.canonical, ['support.ticket.created.v2', 'support.ticket.resolved.v2'], 'support.events.canonical');
    exactArray(errors, support.events.payloadRequiredFields, ['eventId', 'traceId', 'requestId', 'schemaVersion', 'ticketId', 'ticketVersion', 'state', 'categoryCode', 'slaPolicyRef', 'redactionVersion', 'auditId'], 'support.events.payloadRequiredFields');
    exact(errors, support.events.sourceFactOwner, 'admin-ops-service.support', 'support.events.sourceFactOwner');
    list(errors, support.events.payloadForbiddenFields, 'support.events.payloadForbiddenFields');
  }
}

function assertSupportTicket(ticket, errors) {
  if (!keys(errors, ticket, TICKET_KEYS, TICKET_KEYS, 'support.ticket')) return;
  exactArray(errors, ticket.requiredFields, ['ticketId', 'tenantId', 'requesterSubjectId', 'categoryCode', 'resourceRef', 'priority', 'descriptionContentRef', 'state', 'stateVersion', 'assignment', 'sla', 'retention', 'createdAt', 'lastAuditId'], 'support.ticket.requiredFields');
  exactArray(errors, ticket.clientWritableFields, ['categoryCode', 'resourceRef', 'descriptionContentRef', 'attachmentRefs', 'idempotencyKey'], 'support.ticket.clientWritableFields');
  exactArray(errors, ticket.serverDerivedFields, ['ticketId', 'tenantId', 'requesterSubjectId', 'priority', 'state', 'stateVersion', 'assignment', 'sla', 'retention', 'createdAt', 'lastAuditId'], 'support.ticket.serverDerivedFields');
  if (keys(errors, ticket.expectedVersion, EXPECTED_VERSION_KEYS, EXPECTED_VERSION_KEYS, 'support.ticket.expectedVersion')) {
    exact(errors, ticket.expectedVersion.requiredForMutation, true, 'support ticket expectedVersion required');
    exact(errors, ticket.expectedVersion.missingDecision, 'DENY', 'support ticket missing version');
    exact(errors, ticket.expectedVersion.staleDecision, 'CONFLICT', 'support ticket stale version');
    exact(errors, ticket.expectedVersion.sameVersionSameDigest, 'REPLAY_OR_ORIGINAL_RESULT', 'support ticket same-version replay');
  }
  exact(errors, ticket.unknownCategoryDecision, 'DENY', 'support ticket unknown category');
}

function assertContentReference(reference, errors) {
  if (!keys(errors, reference, CONTENT_REF_KEYS, CONTENT_REF_KEYS, 'support.contentReference')) return;
  exactArray(errors, reference.requiredFields, ['contentRefId', 'sha256', 'redactionVersion', 'scanStatus', 'objectVersion', 'safePreviewRef'], 'support.contentReference.requiredFields');
  exact(errors, reference.sha256Pattern, '^[A-Fa-f0-9]{64}$', 'support.contentReference.sha256Pattern');
  exactArray(errors, reference.scanStatus, ['PENDING', 'CLEAN', 'BLOCKED', 'ERROR'], 'support.contentReference.scanStatus');
  exact(errors, reference.usableStatus, 'CLEAN', 'support.contentReference.usableStatus');
  exact(errors, reference.unknownScanDecision, 'DENY', 'support.contentReference.unknownScanDecision');
  exact(errors, reference.rawFreeTextInTicketOrEvent, 'PROHIBITED', 'support.contentReference.rawFreeTextInTicketOrEvent');
  exact(errors, reference.safePreview, 'REDACTED_SERVER_RENDERED_REFERENCE_ONLY', 'support.contentReference.safePreview');
}

function assertAttachmentReference(reference, errors) {
  if (!keys(errors, reference, ATTACHMENT_REF_KEYS, ATTACHMENT_REF_KEYS, 'support.attachmentReference')) return;
  exactArray(errors, reference.requiredFields, ['mediaAssetId', 'assetVersion', 'authorizationRef', 'scanStatus'], 'support.attachmentReference.requiredFields');
  exactArray(errors, reference.scanStatus, ['PENDING', 'CLEAN', 'BLOCKED', 'ERROR'], 'support.attachmentReference.scanStatus');
  exact(errors, reference.usableStatus, 'CLEAN', 'support.attachmentReference.usableStatus');
  exact(errors, reference.authorization, 'MEDIA_OWNER_SIGNED_SCOPE_REFERENCE', 'support.attachmentReference.authorization');
  exactArray(errors, reference.forbiddenFields, ['url', 'signedUrl', 'objectKey', 'rawBytes', 'clientTenantId', 'clientSubjectId'], 'support.attachmentReference.forbiddenFields');
  exact(errors, reference.unknownScanDecision, 'DENY', 'support.attachmentReference.unknownScanDecision');
}

function assertSupportMessage(message, errors) {
  if (!keys(errors, message, SUPPORT_MESSAGE_KEYS, SUPPORT_MESSAGE_KEYS, 'support.message')) return;
  exactArray(errors, message.requiredFields, ['messageId', 'ticketId', 'clientMessageRef', 'authorType', 'bodyContentRef', 'bodyHash', 'redactionVersion', 'createdAt', 'messageVersion', 'lastAuditId'], 'support.message.requiredFields');
  exactArray(errors, message.authorTypes, ['LEARNER', 'SUPPORT_AGENT', 'SYSTEM'], 'support.message.authorTypes');
  exactArray(errors, message.clientWritableFields, ['clientMessageRef', 'bodyContentRef', 'attachmentRefs', 'expectedVersion', 'idempotencyKey'], 'support.message.clientWritableFields');
  exact(errors, message.bodyContentRefUses, 'CONTENT_REFERENCE_POLICY', 'support.message.bodyContentRefUses');
  exact(errors, message.rawFreeTextInEventLogOrOrdinaryAudit, 'PROHIBITED', 'support.message raw free text');
  exact(errors, message.messageOrder, 'SERVER_CREATED_AT_PLUS_MESSAGE_VERSION', 'support.message.messageOrder');
  exact(errors, message.unknownAuthorDecision, 'DENY', 'support.message unknown author');
}

function assertAssignment(assignment, errors) {
  if (!keys(errors, assignment, ASSIGNMENT_KEYS, ASSIGNMENT_KEYS, 'support.assignment')) return;
  exactArray(errors, assignment.requiredFields, ['queueId', 'assigneeRef', 'assignmentVersion', 'assignedAt'], 'support.assignment.requiredFields');
  exact(errors, assignment.historyRequired, true, 'support.assignment.historyRequired');
  exactArray(errors, assignment.historyFields, ['assignmentVersion', 'fromQueueId', 'toQueueId', 'fromAssigneeRef', 'toAssigneeRef', 'reasonCode', 'changedAt', 'actorRef', 'auditId'], 'support.assignment.historyFields');
  exactArray(errors, assignment.clientMaySet, [], 'support.assignment.clientMaySet');
  exact(errors, assignment.unknownAssignmentDecision, 'DENY', 'support.assignment.unknownAssignmentDecision');
}

function assertSla(sla, errors) {
  if (!keys(errors, sla, SLA_KEYS, SLA_KEYS, 'support.sla')) return;
  exactArray(errors, sla.requiredFields, ['policyRef', 'policyVersion', 'dueAt', 'status', 'history'], 'support.sla.requiredFields');
  exactArray(errors, sla.statuses, ['ON_TRACK', 'AT_RISK', 'BREACHED', 'PAUSED', 'RESOLVED'], 'support.sla.statuses');
  exact(errors, sla.historyRequired, true, 'support.sla.historyRequired');
  exactArray(errors, sla.historyFields, ['policyRef', 'policyVersion', 'status', 'dueAt', 'pausedAt', 'resumedAt', 'reasonCode', 'auditId'], 'support.sla.historyFields');
  exact(errors, sla.publicPromise, 'PROHIBITED_UNTIL_OPERATIONS_AND_COMPLIANCE_APPROVAL', 'support.sla.publicPromise');
  exactArray(errors, sla.clientMaySet, [], 'support.sla.clientMaySet');
  exact(errors, sla.unknownStatusDecision, 'DENY', 'support.sla.unknownStatusDecision');
}

function assertResolution(resolution, errors) {
  if (!keys(errors, resolution, RESOLUTION_KEYS, RESOLUTION_KEYS, 'support.resolution')) return;
  exactArray(errors, resolution.requiredOn, ['RESOLVED', 'CLOSED'], 'support.resolution.requiredOn');
  exactArray(errors, resolution.requiredFields, ['resolutionCode', 'explanationContentRef', 'ownerResultRef', 'decidedAt', 'auditId'], 'support.resolution.requiredFields');
  exact(errors, resolution.ownerFactMutation, 'PROHIBITED', 'support.resolution.ownerFactMutation');
  exact(errors, resolution.closeRequiresOwnerReconciliation, true, 'support.resolution.closeRequiresOwnerReconciliation');
}

function assertRetention(retention, errors) {
  if (!keys(errors, retention, RETENTION_KEYS, RETENTION_KEYS, 'support.retention')) return;
  exactArray(errors, retention.requiredFields, ['retentionPolicyRef', 'retentionPolicyVersion', 'retentionUntil', 'legalHold', 'ownerReceiptRef'], 'support.retention.requiredFields');
  exactArray(errors, retention.legalHoldStates, ['CLEAR', 'HELD', 'UNKNOWN'], 'support.retention.legalHoldStates');
  exact(errors, retention.unknownLegalHoldDecision, 'DENY', 'support.retention.unknownLegalHoldDecision');
  exactArray(errors, retention.purgeRequires, ['retentionUntil_reached', 'legalHold=CLEAR', 'ownerReceiptRef'], 'support.retention.purgeRequires');
  exact(errors, retention.ttlIsNotRetentionPolicy, true, 'support.retention.ttlIsNotRetentionPolicy');
  exact(errors, retention.ownerReceiptRequired, true, 'support.retention.ownerReceiptRequired');
  exact(errors, retention.policyOwner, 'P1R-M1-017', 'support.retention.policyOwner');
}

function assertEvents(events, errors) {
  if (!keys(errors, events, EVENTS_KEYS, EVENTS_KEYS, 'events')) return;
  exact(errors, events.canonicalVersion, 'v2', 'events.canonicalVersion');
  exact(errors, events.historicalVersion, 'v1', 'events.historicalVersion');
  exact(errors, events.dualPublish, false, 'events.dualPublish');
  exactArray(errors, events.canonicalPlanned, ['notification.requested.v2', 'notification.retry_scheduled.v2', 'notification.recovery.completed.v2', 'sync.command_receipted.v2', 'sync.conflict_detected.v2', 'sync.recovered.v2', 'support.ticket.created.v2', 'support.ticket.resolved.v2'], 'events.canonicalPlanned');
  exactArray(errors, events.historicalOnly, ['notification.requested.v1', 'notification.retry_scheduled.v1', 'notification.recovery.completed.v1', 'sync.enqueued.v1', 'sync.conflict_detected.v1', 'sync.recovered.v1', 'support.ticket.created.v1', 'support.ticket.resolved.v1'], 'events.historicalOnly');
  exactArray(errors, events.governanceBindings, EXACT_EVENT_GOVERNANCE_BINDINGS, 'events.governanceBindings');
  exactArray(errors, events.sourceSubscriptionBindings, EXACT_SOURCE_SUBSCRIPTION_BINDINGS, 'events.sourceSubscriptionBindings');
  exact(errors, events.b26StaticProjection, EXACT_B26_STATIC_PROJECTION, 'events.b26StaticProjection');
  exact(errors, events.producerOwnerRequired, true, 'events.producerOwnerRequired');
  exact(errors, events.consumerBindingRequired, true, 'events.consumerBindingRequired');
  exact(errors, events.topicAndPartitionRequired, true, 'events.topicAndPartitionRequired');
  exact(errors, events.promotionStatus, 'D2_V2_EVENT_GOVERNANCE_TARGET_NOT_RUNTIME_VERIFIED', 'events.promotionStatus');
  exact(errors, events.unboundEventDecision, 'DENY', 'events.unboundEventDecision');
  if (keys(errors, events.payloadPolicy, PAYLOAD_POLICY_KEYS, PAYLOAD_POLICY_KEYS, 'events.payloadPolicy')) {
    exactArray(errors, events.payloadPolicy.requiredEnvelopeFields, ['eventId', 'eventName', 'traceId', 'requestId', 'schemaVersion', 'aggregateType', 'aggregateId', 'dedupeKey'], 'events.payloadPolicy.requiredEnvelopeFields');
    exactArray(errors, events.payloadPolicy.forbiddenFields, ['password', 'token', 'rawAudio', 'paymentCredential', 'rawAttachmentBytes', 'unredactedFreeText', 'clientTenantId', 'clientSubjectId', 'clientRole'], 'events.payloadPolicy.forbiddenFields');
  }
}

function assertLegacy(legacy, errors) {
  if (!keys(errors, legacy, LEGACY_KEYS, LEGACY_KEYS, 'legacyCompatibility')) return;
  if (keys(errors, legacy.notification, LEGACY_NOTIFICATION_KEYS, LEGACY_NOTIFICATION_KEYS, 'legacy.notification')) {
    exact(errors, legacy.notification.B12, 'CANONICAL_V2_POLICY_FAMILY', 'legacy B12');
    exact(errors, legacy.notification.B11, 'HISTORICAL_ONLY', 'legacy B11');
    exact(errors, legacy.notification.dualPublish, false, 'legacy notification dualPublish');
  }
  if (keys(errors, legacy.support, LEGACY_SUPPORT_KEYS, LEGACY_SUPPORT_KEYS, 'legacy.support')) {
    exact(errors, legacy.support.B5, 'HISTORICAL_V1_ADAPTER_ONLY', 'legacy B5');
    exact(errors, legacy.support.B13, 'HISTORICAL_V1_ADAPTER_ONLY', 'legacy B13');
    exact(errors, legacy.support.dualPublish, false, 'legacy support dualPublish');
    exact(errors, legacy.support.adapterMappingRequired, true, 'legacy support adapter mapping');
    exact(errors, legacy.support.adapterMayCreateSecondFact, false, 'legacy support second fact');
  }
  if (keys(errors, legacy.sync, LEGACY_SYNC_KEYS, LEGACY_SYNC_KEYS, 'legacy.sync')) {
    exact(errors, legacy.sync.legacyBaseCursor, 'HISTORICAL_INPUT_ONLY', 'legacy sync base cursor');
    exact(errors, legacy.sync.legacyEntityVersion, 'HISTORICAL_INPUT_ONLY', 'legacy sync entity version');
    exact(errors, legacy.sync.legacyPayloadHashAlias, 'HISTORICAL_INPUT_ONLY', 'legacy sync payload hash');
    exactArray(errors, legacy.sync.canonicalFields, ['clientEventId', 'clientSeq', 'baseVersion', 'contentVersionId', 'payloadHash'], 'legacy sync canonical fields');
  }
}

function assertRuntimeBoundary(boundary, errors) {
  if (!keys(errors, boundary, RUNTIME_KEYS, RUNTIME_KEYS, 'runtimeBoundary')) return;
  exact(errors, boundary.contractOnly, true, 'runtimeBoundary.contractOnly');
  exact(errors, boundary.runtimeEvidence, 'NOT_RUNTIME_VERIFIED', 'runtimeBoundary.runtimeEvidence');
  exact(errors, boundary.d2Status, 'D2_CONTRACT_READY', 'runtimeBoundary.d2Status');
  for (const field of ['productionNotificationProviders', 'realSmsEmailPushTraffic', 'realKafkaBroker', 'realDatabaseSchemaAndMigrations', 'realOutboxAndConsumerDeduplication', 'realRetryDlqReplay', 'realSupportPepAndCrossTenantEvidence', 'realRetentionLegalHoldPurge', 'realBrowserDeviceE2E']) exact(errors, boundary[field], false, `runtimeBoundary.${field}`);
  list(errors, boundary.prohibitedRuntimeClaims, 'runtimeBoundary.prohibitedRuntimeClaims');
  list(errors, boundary.deferredTasks, 'runtimeBoundary.deferredTasks');
}

function validateNotificationOpenApi(policy, source, canonicalOpenApi, errors) {
  add(errors, isRecord(source), 'B12 canonical notification OpenAPI fragment is required');
  if (!isRecord(source)) return { routes: 0, schemas: 0 };
  assertNoRuntimePromotion(source, errors, 'B12');
  const extension = source['x-m1016-contract'];
  const extensionKeys = ['task', 'owner', 'canonicalOperations', 'historicalAdapters', 'maturity', 'runtimeStatus', 'clientAuthority'];
  if (keys(errors, extension, extensionKeys, extensionKeys, 'B12 x-m1016-contract')) {
    exact(errors, extension.task, 'P1R-M1-016', 'B12 extension.task');
    exact(errors, extension.owner, 'notification-service', 'B12 extension.owner');
    exactArray(errors, extension.canonicalOperations, CANONICAL_NOTIFICATION_OPERATIONS.map(([, , id]) => id), 'B12 extension.canonicalOperations');
    exactArray(errors, extension.historicalAdapters, ['consumeB12NotificationTrustedEvent', 'getB11NotificationPreference', 'updateB11NotificationPreference', 'listB11Messages', 'markB11MessageRead'], 'B12 extension.historicalAdapters');
    exact(errors, extension.maturity, 'D2_CONTRACT_READY', 'B12 extension.maturity');
    exact(errors, extension.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'B12 extension.runtimeStatus');
    exact(errors, extension.clientAuthority, 'NONE', 'B12 extension.clientAuthority');
  }
  let routes = 0;
  for (const [method, route, operationId] of CANONICAL_NOTIFICATION_OPERATIONS) {
    const operation = operationAt(source, method, route);
    add(errors, isRecord(operation), `B12 missing canonical operation ${operationId}`);
    if (!isRecord(operation)) continue;
    routes += 1;
    exact(errors, operation.operationId, operationId, `${operationId}.operationId`);
    exact(errors, operation['x-owner'], 'notification-service', `${operationId}.owner`);
    const contractKeys = ['task', 'canonical', 'maturity', 'runtimeStatus', 'clientAuthority'];
    if (keys(errors, operation['x-contract'], contractKeys, contractKeys, `${operationId}.x-contract`)) {
      exact(errors, operation['x-contract'].task, 'P1R-M1-016', `${operationId}.task`);
      exact(errors, operation['x-contract'].canonical, true, `${operationId}.canonical`);
      exact(errors, operation['x-contract'].maturity, 'D2_CONTRACT_READY', `${operationId}.maturity`);
      exact(errors, operation['x-contract'].runtimeStatus, 'NOT_RUNTIME_VERIFIED', `${operationId}.runtimeStatus`);
    }
    const authKeys = ['defaultDecision', 'requiredPermission', 'pep', 'allowedActors', 'trustedFacts', 'clientAuthority'];
    if (keys(errors, operation['x-authorization'], authKeys, authKeys, `${operationId}.x-authorization`)) {
      exact(errors, operation['x-authorization'].defaultDecision, 'DENY', `${operationId}.defaultDecision`);
      exact(errors, operation['x-permission'], CANONICAL_NOTIFICATION_PERMISSIONS[operationId], `${operationId}.permission`);
      exact(errors, operation['x-authorization'].requiredPermission, CANONICAL_NOTIFICATION_PERMISSIONS[operationId], `${operationId}.authorization.permission`);
      exact(errors, operation['x-authorization'].pep, 'notification-service-local', `${operationId}.authorization.pep`);
      exactArray(errors, operation['x-authorization'].allowedActors, route.startsWith('/internal/') ? ['WORKLOAD'] : ['SELF'], `${operationId}.authorization.allowedActors`);
      const expectedTrustedFacts = route.startsWith('/internal/')
          ? ['workloadIdentity', 'sourceService', 'notificationId', 'workflowTaskId', 'policyVersion']
          : ['subject', 'tenant', 'resourceOwner', 'roles', 'permissions', ...(operationId.includes('Preferences') || operationId === 'updateM1016NotificationPreference' || operationId === 'listM1016NotificationMessages' ? ['phase', 'consent'] : []), 'policyVersion'];
      exactArray(errors, operation['x-authorization'].trustedFacts, expectedTrustedFacts, `${operationId}.authorization.trustedFacts`);
    }
    assertClientAuthorityMetadata(operation, operationId, errors, 'B12');
    add(errors, Array.isArray(operation.security) && operation.security.length === 1, `${operationId} must have exactly one security requirement`);
    if (route.startsWith('/internal/')) add(errors, Object.hasOwn(operation.security?.[0] ?? {}, 'B8WorkloadIdentity'), `${operationId} must use workload identity`);
    else add(errors, Object.hasOwn(operation.security?.[0] ?? {}, 'bearerAuth'), `${operationId} must use bearerAuth`);
    if (method !== 'GET') {
      exact(errors, operation['x-idempotency']?.required, true, `${operationId}.idempotency.required`);
      exact(errors, operation['x-idempotency']?.keyHeader, 'Idempotency-Key', `${operationId}.idempotency.keyHeader`);
      add(errors, isRecord(operation.responses?.['401']) && isRecord(operation.responses?.['403']), `${operationId} must expose explicit 401/403`);
      if (['updateM1016NotificationPreference', 'retryM1016NotificationDelivery', 'recoverM1016NotificationDelivery'].includes(operationId)) {
        add(errors, isRecord(operation.responses?.['409']), `${operationId} must expose explicit 409`);
      }
    }
    const requestSchemas = {
      updateM1016NotificationPreference: 'M1016NotificationPreferenceCommand',
      retryM1016NotificationDelivery: 'M1016NotificationRetryCommand',
      recoverM1016NotificationDelivery: 'M1016NotificationRecoveryCommand',
    };
    if (requestSchemas[operationId]) {
      const expectedRef = { $ref: `#/components/schemas/${requestSchemas[operationId]}` };
      exact(errors, operation.requestBody?.content?.['application/json']?.schema, expectedRef, `${operationId}.requestBody.schema`);
    }
    if (route === '/api/v1/notifications/preferences/{notificationType}/{channel}') {
      const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
      const notificationType = parameters.find((parameter) => parameter?.name === 'notificationType');
      const channel = parameters.find((parameter) => parameter?.name === 'channel');
      const notificationTypeSchema = resolveRef(source, notificationType?.schema);
      const channelSchema = resolveRef(source, channel?.schema);
      const allowedTypes = [...policy.notification.categories, ...policy.notification.smsPolicy.allowlistPurposes];
      exactArray(errors, notificationTypeSchema?.enum, allowedTypes, `${operationId}.notificationType.enum`);
      exactArray(errors, channelSchema?.enum, policy.notification.channels, `${operationId}.channel.enum`);
      const policyKeys = ['pathParameter', 'bodyField', 'pathBodyRelation', 'typeCategoryPairs', 'sms'];
      if (keys(errors, operation['x-notification-policy'], policyKeys, policyKeys, `${operationId}.x-notification-policy`)) {
        const expectedPairs = [
          ...policy.notification.categories.map((category) => ({ type: category, category })),
          { type: 'ACCOUNT_VERIFICATION', category: 'ACCOUNT' },
          { type: 'SECURITY_ALERT', category: 'SECURITY' },
          { type: 'PHONE_BINDING_CHANGE', category: 'ACCOUNT' },
          { type: 'CRITICAL_ACCOUNT_PAYMENT', category: 'PAYMENT' },
        ];
        exact(errors, operation['x-notification-policy'].pathParameter, 'notificationType', `${operationId}.notificationPolicy.pathParameter`);
        exact(errors, operation['x-notification-policy'].bodyField, 'category', `${operationId}.notificationPolicy.bodyField`);
        exact(errors, operation['x-notification-policy'].pathBodyRelation, 'EXACT_ALLOWLISTED_TYPE_CATEGORY_PAIR', `${operationId}.notificationPolicy.relation`);
        exactArray(errors, operation['x-notification-policy'].typeCategoryPairs, expectedPairs, `${operationId}.notificationPolicy.typeCategoryPairs`);
        if (keys(errors, operation['x-notification-policy'].sms, ['allowedCategories', 'allowedTypes', 'unknownPurposeDecision', 'marketingDecision'], ['allowedCategories', 'allowedTypes', 'unknownPurposeDecision', 'marketingDecision'], `${operationId}.notificationPolicy.sms`)) {
          exactArray(errors, operation['x-notification-policy'].sms.allowedCategories, policy.notification.smsPolicy.allowlistCategories, `${operationId}.notificationPolicy.sms.allowedCategories`);
          exactArray(errors, operation['x-notification-policy'].sms.allowedTypes, policy.notification.smsPolicy.allowlistPurposes, `${operationId}.notificationPolicy.sms.allowedTypes`);
          exact(errors, operation['x-notification-policy'].sms.unknownPurposeDecision, 'DENY', `${operationId}.notificationPolicy.sms.unknownPurposeDecision`);
          exact(errors, operation['x-notification-policy'].sms.marketingDecision, 'DENY', `${operationId}.notificationPolicy.sms.marketingDecision`);
        }
      }
    }
    exact(errors, operation['x-pagination']?.mode ?? (method === 'GET' ? 'cursor' : undefined), method === 'GET' ? 'cursor' : undefined, `${operationId}.pagination`);
    checkOpenApiPayloadSchemas(operation, errors, `B12.${operationId}`, source, canonicalOpenApi);
  }
  const canonicalOperationIds = new Set(CANONICAL_NOTIFICATION_OPERATIONS.map(([, , operationId]) => operationId));
  for (const [route, pathItem] of Object.entries(source.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP_METHODS.has(method) || !isRecord(operation) || typeof operation.operationId !== 'string') continue;
      if (operation.operationId.startsWith('M1016')) add(errors, canonicalOperationIds.has(operation.operationId), `B12 unexpected canonical operation ${operation.operationId} at ${method.toUpperCase()} ${route}`);
    }
  }
  let schemas = 0;
  const schemaRequired = {
    M1016NotificationDndWindow: ['startLocalTime', 'endLocalTime', 'timezone'],
    M1016NotificationPreference: policy.notification.preference.requiredFields,
    M1016NotificationPreferenceCommand: ['category', 'enabled', 'locale', 'consentVersion', 'dndWindow', 'frequencyPolicy', 'expectedVersion'],
    M1016NotificationMessage: policy.notification.message.requiredFields,
    M1016NotificationReadReceipt: ['messageId', 'readAt', 'version'],
    M1016NotificationReadAllReceipt: ['updatedCount', 'readAt', 'version'],
    M1016NotificationRetryCommand: ['notificationId', 'deliveryVersion', 'expectedVersion', 'reasonCode'],
    M1016NotificationRetryResult: ['notificationId', 'deliveryVersion', 'state', 'attempt', 'maxAttempts', 'nextAttemptAt', 'updatedAt'],
    M1016NotificationRecoveryCommand: ['notificationId', 'deliveryVersion', 'expectedVersion', 'action', 'reasonCode'],
    M1016NotificationRecoveryResult: ['notificationId', 'deliveryVersion', 'action', 'state', 'recoveryReceiptId', 'domainFactsUntouched', 'updatedAt'],
  };
  for (const name of CANONICAL_NOTIFICATION_SCHEMAS) {
    const schema = source.components?.schemas?.[name];
    add(errors, isRecord(schema), `B12 missing canonical schema ${name}`);
    if (!isRecord(schema)) continue;
    schemas += 1;
    exact(errors, schema.additionalProperties, false, `B12 ${name}.additionalProperties`);
    exactArray(errors, schema.required, schemaRequired[name], `B12 ${name}.required`);
    assertClosedSchemaGraph(source, schema, errors, `B12.${name}`);
    checkForbiddenPayload(schema, errors, `B12.schema.${name}`, source);
    assertExactRequestSchemaProperties(schema, name, errors, 'B12');
    if (['M1016NotificationPreferenceCommand', 'M1016NotificationRetryCommand', 'M1016NotificationRecoveryCommand'].includes(name)) {
      assertNoClientAuthorityFields(source, schema, errors, `B12.${name}`, notificationRequestAuthorityFields(policy, name));
    }
    if (['M1016NotificationPreference', 'M1016NotificationPreferenceCommand', 'M1016NotificationMessage'].includes(name)) {
      exactArray(errors, schemaProperty(schema, 'category')?.enum, policy.notification.categories, `B12 ${name}.category.enum`);
      exactArray(errors, schemaProperty(schema, 'locale')?.enum, policy.notification.allowedLocales, `B12 ${name}.locale.enum`);
    }
    if (['M1016NotificationPreference', 'M1016NotificationMessage'].includes(name)) {
      exactArray(errors, schemaProperty(schema, 'channel')?.enum, policy.notification.channels, `B12 ${name}.channel.enum`);
    }
    if (['M1016NotificationPreferenceCommand'].includes(name)) {
      for (const field of policy.authority.serverDerivedFields) add(errors, !Object.hasOwn(schema.properties ?? {}, field), `B12 ${name} must not accept server-derived field ${field}`);
      exactArray(errors, schema.required, ['category', 'enabled', 'locale', 'consentVersion', 'dndWindow', 'frequencyPolicy', 'expectedVersion'], `B12 ${name}.required`);
    }
  }
  const canonicalNotificationSchemas = new Set(CANONICAL_NOTIFICATION_SCHEMAS);
  for (const name of Object.keys(source.components?.schemas ?? {})) {
    if (name.startsWith('M1016Notification')) add(errors, canonicalNotificationSchemas.has(name), `B12 unexpected canonical schema ${name}`);
  }
  if (canonicalOpenApi && canonicalOpenApi !== source) {
    for (const [, route, operationId] of CANONICAL_NOTIFICATION_OPERATIONS) {
      add(errors, isRecord(operationAt(canonicalOpenApi, methodFor(CANONICAL_NOTIFICATION_OPERATIONS, operationId), route)), `merged OpenAPI missing ${operationId}`);
    }
    for (const name of CANONICAL_NOTIFICATION_SCHEMAS) add(errors, isRecord(canonicalOpenApi.components?.schemas?.[name]), `merged OpenAPI missing ${name}`);
  }
  return { routes, schemas };
}

function validateSyncOpenApi(policy, source, canonicalOpenApi, errors) {
  add(errors, isRecord(source), 'B11 sync OpenAPI fragment is required');
  if (!isRecord(source)) return { routes: 0, schemas: 0 };
  assertNoRuntimePromotion(source, errors, 'B11');
  const extensionKeys = ['task', 'owner', 'canonicalOperations', 'historicalAdapters', 'maturity', 'runtimeStatus', 'clientAuthority'];
  if (keys(errors, source['x-m1016-contract'], extensionKeys, extensionKeys, 'B11 x-m1016-contract')) {
    exact(errors, source['x-m1016-contract'].task, 'P1R-M1-016', 'B11 extension.task');
    exact(errors, source['x-m1016-contract'].owner, 'learning-service', 'B11 extension.owner');
    exactArray(errors, source['x-m1016-contract'].canonicalOperations, SYNC_OPERATIONS.map(([, , operationId]) => operationId), 'B11 extension.canonicalOperations');
    exactArray(errors, source['x-m1016-contract'].historicalAdapters, SYNC_HISTORICAL_ADAPTERS, 'B11 extension.historicalAdapters');
    exact(errors, source['x-m1016-contract'].maturity, 'D2_CONTRACT_READY', 'B11 extension.maturity');
    exact(errors, source['x-m1016-contract'].runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'B11 extension.runtimeStatus');
    exact(errors, source['x-m1016-contract'].clientAuthority, 'NONE', 'B11 extension.clientAuthority');
  }
  let routes = 0;
  for (const [method, route, operationId] of SYNC_OPERATIONS) {
    const operation = operationAt(source, method, route);
    const responseSchema = operationId === 'listM1016LearningSyncReceipts'
      ? 'M1016SyncReceipt'
      : operationId === 'getM1016LearningSyncCursor'
        ? 'M1016SyncCursor'
        : operationId === 'listM1016LearningSyncConflicts'
          ? 'M1016SyncConflict'
          : 'M1016SyncRecoveryResult';
    const requestSchema = operationId === 'recoverM1016LearningSyncConflict' ? 'M1016SyncRecoveryRequest' : undefined;
    validateCanonicalOperation(operation, method, route, operationId, 'learning-service', errors, 'B11', {
      document: source,
      referenceDocument: canonicalOpenApi,
      requiredPermission: SYNC_PERMISSIONS[operationId],
      pep: 'learning-service-local',
      allowedActors: ['SELF'],
      trustedFacts: operationId === 'recoverM1016LearningSyncConflict'
        ? ['subject', 'tenant', 'resourceOwner', 'roles', 'permissions', 'policyVersion', 'conflictId']
        : ['subject', 'tenant', 'resourceOwner', 'roles', 'permissions', 'policyVersion'],
      requestSchema,
      responseSchema,
      requireConflict: method !== 'GET',
    });
    if (isRecord(operation)) routes += 1;
    if (['listM1016LearningSyncReceipts', 'listM1016LearningSyncConflicts'].includes(operationId)) {
      exact(errors, operation?.['x-pagination']?.mode, 'cursor', `B11.${operationId}.pagination`);
    }
  }
  const schemaRequirements = {
    M1016SyncProtocolContext: policy.sync.requiredFields,
    M1016SyncReceipt: ['receiptId', 'context', 'state', 'serverVersion', 'acceptedAt', 'replayed'],
    M1016SyncCursor: ['cursor', 'version', 'issuedAt'],
    M1016SyncConflict: policy.sync.conflict.requiredFields,
    M1016SyncRecoveryRequest: ['expectedVersion', 'action'],
    M1016SyncRecoveryResult: ['conflictId', 'action', 'state', 'serverVersion', 'recoveryReceiptId', 'domainFactsUntouched', 'recoveredAt'],
  };
  let schemas = 0;
  for (const [name, required] of Object.entries(schemaRequirements)) {
      const schema = validateClosedSchema(source, name, errors, 'B11', {
        required,
        referenceDocument: canonicalOpenApi,
      forbiddenFields: name.endsWith('ProtocolContext') ? policy.sync.clientForbiddenFields : [],
    });
    if (schema) {
      schemas += 1;
      assertClosedSchemaGraph(source, schema, errors, `B11.${name}`);
      assertExactRequestSchemaProperties(schema, name, errors, 'B11');
      if (name === 'M1016SyncProtocolContext') {
        for (const field of policy.sync.requiredFields) add(errors, Object.hasOwn(schema.properties ?? {}, field), `B11.${name} missing required property ${field}`);
      }
      if (name === 'M1016SyncReceipt') exactArray(errors, schemaProperty(schema, 'state')?.enum, policy.sync.outcomes, `B11.${name}.state.enum`);
      if (name === 'M1016SyncConflict') {
        exactArray(errors, schemaProperty(schema, 'reasonCode')?.enum, policy.sync.conflict.reasonCodes, `B11.${name}.reasonCode.enum`);
        exactArray(errors, schemaProperty(schema, 'allowedResolution')?.enum, policy.sync.conflict.allowedResolutions, `B11.${name}.allowedResolution.enum`);
      }
      if (['M1016SyncProtocolContext', 'M1016SyncRecoveryRequest'].includes(name)) {
        assertNoClientAuthorityFields(source, schema, errors, `B11.${name}`, syncRequestAuthorityFields(policy));
      }
    }
    const merged = validateClosedSchema(canonicalOpenApi, name, errors, 'merged OpenAPI', { required });
    if (merged) {
      assertClosedSchemaGraph(canonicalOpenApi, merged, errors, `merged.${name}`);
      assertExactRequestSchemaProperties(merged, name, errors, 'merged');
      if (['M1016SyncProtocolContext', 'M1016SyncRecoveryRequest'].includes(name)) {
        assertNoClientAuthorityFields(canonicalOpenApi, merged, errors, `merged.${name}`, syncRequestAuthorityFields(policy));
      }
    }
  }
  const canonicalSyncOperationIds = new Set(SYNC_OPERATIONS.map(([, , operationId]) => operationId));
  for (const [route, pathItem] of Object.entries(source.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP_METHODS.has(method) || !isRecord(operation) || typeof operation.operationId !== 'string') continue;
      if (operation.operationId.startsWith('M1016')) add(errors, canonicalSyncOperationIds.has(operation.operationId), `B11 unexpected canonical operation ${operation.operationId} at ${method.toUpperCase()} ${route}`);
    }
  }
  const canonicalSyncSchemas = new Set(Object.keys(schemaRequirements));
  for (const name of Object.keys(source.components?.schemas ?? {})) {
    if (name.startsWith('M1016Sync')) add(errors, canonicalSyncSchemas.has(name), `B11 unexpected canonical schema ${name}`);
  }
  return { routes, schemas };
}

function validateSupportOperations(policy, source, canonicalOpenApi, label, operations, errors) {
  add(errors, isRecord(source), `${label} support OpenAPI fragment is required`);
  if (!isRecord(source)) return 0;
  let routes = 0;
  for (const [method, route, operationId] of operations) {
    const operation = operationAt(source, method, route);
    validateCanonicalOperation(operation, method, route, operationId, 'admin-ops-service', errors, label, {
      document: source,
      referenceDocument: canonicalOpenApi,
      dataOwner: 'admin-ops-service.support',
      requiredPermission: SUPPORT_PERMISSIONS[operationId],
      pep: 'admin-ops-service-local',
      allowedActors: label === 'B13' ? ['SUPPORT_AGENT', 'SUPPORT_MANAGER'] : ['SELF'],
      trustedFacts: label === 'B13'
        ? (operationId === 'submitM1016SupportTicketCommand'
          ? ['subject', 'tenant', 'roles', 'permissions', 'policyVersion', 'dualApproval']
          : ['subject', 'tenant', 'roles', 'permissions', 'policyVersion'])
        : operationId === 'createM1016SupportTicket'
          ? ['subject', 'tenant', 'roles', 'permissions', 'policyVersion']
          : ['subject', 'tenant', 'resourceOwner', 'roles', 'permissions', 'policyVersion'],
      requestSchema: operationId.includes('Message') ? 'M1016SupportMessageCreateRequest'
        : operationId.includes('createM1016SupportTicket') ? 'M1016SupportTicketCreateRequest'
          : operationId.includes('submitM1016SupportTicketCommand') ? 'M1016SupportAdminCommandRequest' : undefined,
      responseSchema: operationId.includes('Message') ? 'M1016SupportMessage'
        : operationId.includes('Command') ? 'M1016SupportCommandResult' : 'M1016SupportTicket',
      requireConflict: method !== 'GET',
    });
    if (isRecord(operation)) routes += 1;
    if (operationId === 'listM1016LearnerSupportTickets' || operationId === 'listM1016AdminSupportTickets') {
      exact(errors, operation?.['x-pagination']?.mode, 'cursor', `${label}.${operationId}.pagination`);
    }
    if (operationId === 'submitM1016SupportTicketCommand') {
      exact(errors, operation?.['x-command-policy']?.defaultDecision, 'DENY', `${label}.${operationId}.command default decision`);
    }
  }
  return routes;
}

function stateValuesFromSchema(schema) {
  const state = schema?.properties?.state;
  if (state?.const !== undefined) return [state.const];
  return Array.isArray(state?.enum) ? state.enum : [];
}

function branchNestedSchema(document, branch, parentField) {
  const nested = branch?.properties?.[parentField];
  return resolveRef(document, nested) ?? nested;
}

function branchRequiresNestedFields(document, branch, parentField, requiredFields) {
  const nested = branchNestedSchema(document, branch, parentField);
  const required = Array.isArray(nested?.required) ? nested.required : [];
  return requiredFields.every((field) => required.includes(field));
}

function branchNestedFieldIsNonNull(document, branch, parentField, field) {
  const nested = branchNestedSchema(document, branch, parentField)?.properties?.[field];
  if (!isRecord(nested)) return false;
  if (nested.nullable === true) return false;
  if (Array.isArray(nested.type) && nested.type.includes('null')) return false;
  return nested.type === 'string' && ((nested.minLength ?? 0) >= 1 || nested.format === 'date-time');
}

function assertSupportStateConditionals(document, schema, errors, label) {
  const branches = [
    ...(Array.isArray(schema?.oneOf) ? schema.oneOf : []),
    ...(Array.isArray(schema?.anyOf) ? schema.anyOf : []),
  ];
  const stateBranches = branches.filter((branch) => stateValuesFromSchema(branch).length > 0);
  exact(errors, schema?.anyOf, undefined, `${label}.anyOf`);
  exact(errors, stateBranches.map((branch) => stateValuesFromSchema(branch)), [
    ['OPEN'],
    ['ASSIGNED', 'WAITING_USER', 'WAITING_INTERNAL', 'REOPENED'],
    ['RESOLVED', 'CLOSED'],
  ], `${label}.state branches`);
  const conditionalBranches = [
    ...stateBranches.map((branch) => ({ when: stateValuesFromSchema(branch), then: branch })),
    ...(Array.isArray(schema?.allOf) ? schema.allOf.filter((entry) => isRecord(entry?.if) && isRecord(entry?.then)).map((entry) => ({
      when: stateValuesFromSchema(entry.if), then: entry.then,
    })) : []),
  ];
  const assignedStates = ['ASSIGNED', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED', 'REOPENED'];
  const assigned = conditionalBranches.filter(({ when }) => when.some((state) => assignedStates.includes(state)));
  const open = conditionalBranches.filter(({ when }) => when.includes('OPEN'));
  add(errors, assigned.length > 0 && assigned.every(({ then }) => branchRequiresNestedFields(document, then, 'assignment', ['assigneeRef', 'assignedAt'])
    && branchNestedFieldIsNonNull(document, then, 'assignment', 'assigneeRef')
    && branchNestedFieldIsNonNull(document, then, 'assignment', 'assignedAt')), `${label} must machine-enforce non-null assignment in every assigned-state branch`);
  add(errors, open.length > 0, `${label} must machine-model OPEN assignment state`);
  const resolved = conditionalBranches.filter(({ when }) => when.some((state) => ['RESOLVED', 'CLOSED'].includes(state)));
  add(errors, resolved.some(({ then }) => Array.isArray(then?.required) && then.required.includes('resolution')), `${label} must require resolution for RESOLVED/CLOSED`);
}

function validateSupportSchemas(policy, document, canonicalOpenApi, errors) {
  add(errors, isRecord(document), 'M1-016 support schema source is required');
  const schemaRequirements = {
    M1016SupportRestrictedContentRef: policy.support.contentReference.requiredFields,
    M1016SupportAttachmentRef: policy.support.attachmentReference.requiredFields,
    M1016SupportAssignmentHistory: ['assignmentVersion', 'fromQueueId', 'toQueueId', 'fromAssigneeRef', 'toAssigneeRef', 'reasonCode', 'changedAt', 'actorRef', 'auditId'],
    M1016SupportAssignment: [...policy.support.assignment.requiredFields, 'history'],
    M1016SupportSlaHistory: ['policyRef', 'policyVersion', 'dueAt', 'status', 'pausedAt', 'resumedAt', 'reasonCode', 'auditId'],
    M1016SupportSla: [...policy.support.sla.requiredFields],
    M1016SupportResolution: policy.support.resolution.requiredFields,
    M1016SupportRetention: policy.support.retention.requiredFields,
    M1016SupportTicket: policy.support.ticket.requiredFields,
    M1016SupportTicketCreateRequest: ['categoryCode', 'resourceRef', 'descriptionContentRef', 'idempotencyKey'],
    M1016SupportMessage: policy.support.message.requiredFields,
    M1016SupportMessageCreateRequest: ['clientMessageRef', 'bodyContentRef', 'expectedVersion', 'idempotencyKey'],
    M1016SupportAssignCommand: ['commandType', 'queueId', 'assigneeRef', 'reasonCode'],
    M1016SupportTransitionCommand: ['commandType', 'toState', 'reasonCode'],
    M1016SupportResolveCommand: ['commandType', 'resolution'],
    M1016SupportCommandResult: ['commandId', 'ticketId', 'commandType', 'state', 'accepted', 'receiptId', 'auditId'],
  };
  const policyForbidden = new Set(FORBIDDEN_CLIENT_FIELDS);
  for (const name of SUPPORT_SCHEMA_NAMES) {
    const schema = schemaAt(document, name);
    add(errors, isRecord(schema), `support schema source missing ${name}`);
    if (!isRecord(schema)) continue;
    if (schemaRequirements[name]) exactArray(errors, schema.required, schemaRequirements[name], `support.${name}.required`);
    if (name === 'M1016SupportAdminCommandRequest') {
      exact(errors, schema['x-command-one-of'], true, `${name}.x-command-one-of`);
      exactArray(errors, schema.properties?.command?.oneOf?.map((entry) => entry?.$ref), [
        '#/components/schemas/M1016SupportAssignCommand',
        '#/components/schemas/M1016SupportTransitionCommand',
        '#/components/schemas/M1016SupportResolveCommand',
      ], `${name}.oneOf`);
    }
    if (name.endsWith('Request') || name === 'M1016SupportAdminCommandRequest') {
      const properties = isRecord(schema.properties) ? Object.keys(schema.properties) : [];
      for (const field of properties) add(errors, !policyForbidden.has(field), `support.${name} must not expose client authority field ${field}`);
      if (Array.isArray(schema['x-forbidden-fields'])) {
        const expectedForbidden = {
          M1016SupportTicketCreateRequest: ['tenantId', 'requesterSubjectId', 'priority', 'state', 'stateVersion', 'assignment', 'sla', 'retention', 'subject', 'role'],
          M1016SupportMessageCreateRequest: ['authorType', 'tenantId', 'requesterSubjectId', 'role', 'state', 'priority', 'assignment', 'sla', 'retention'],
          M1016SupportAdminCommandRequest: ['tenantId', 'requesterSubjectId', 'priority', 'assignment', 'sla', 'role', 'subject'],
        }[name];
        if (expectedForbidden) exactArray(errors, schema['x-forbidden-fields'], expectedForbidden, `support.${name}.x-forbidden-fields`);
      }
    }
    if (['M1016SupportRestrictedContentRef', 'M1016SupportAttachmentRef', 'M1016SupportUsableContentRef', 'M1016SupportUsableAttachmentRef'].includes(name)) {
      const forbidden = name.includes('Attachment') ? policy.support.attachmentReference.forbiddenFields : ['rawText', 'rawBytes', 'url', 'signedUrl', 'objectKey', 'credential', 'token', 'unredactedFreeText'];
      if (name === 'M1016SupportRestrictedContentRef' || name === 'M1016SupportAttachmentRef') exactArray(errors, schema['x-forbidden-fields'], forbidden, `${name}.x-forbidden-fields`);
      if (name === 'M1016SupportRestrictedContentRef') {
        exact(errors, schema.properties?.sha256?.pattern, policy.support.contentReference.sha256Pattern, `${name}.sha256.pattern`);
        exactArray(errors, schema.properties?.scanStatus?.enum, policy.support.contentReference.scanStatus, `${name}.scanStatus.enum`);
      }
      if (name === 'M1016SupportAttachmentRef') exactArray(errors, schema.properties?.scanStatus?.enum, policy.support.attachmentReference.scanStatus, `${name}.scanStatus.enum`);
      if (name === 'M1016SupportUsableContentRef') {
        exactArray(errors, schema.allOf?.map((entry) => entry?.$ref ?? entry?.properties?.scanStatus?.enum?.join('|')), ['#/components/schemas/M1016SupportRestrictedContentRef', 'CLEAN'], `${name}.allOf`);
      }
      if (name === 'M1016SupportUsableAttachmentRef') {
        exactArray(errors, schema.allOf?.map((entry) => entry?.$ref ?? entry?.properties?.scanStatus?.enum?.join('|')), ['#/components/schemas/M1016SupportAttachmentRef', 'CLEAN'], `${name}.allOf`);
      }
    }
    if (name === 'M1016SupportAssignment') {
      exact(errors, schema['x-state-invariant'], 'OPEN may have null assigneeRef/assignedAt; ASSIGNED, WAITING_INTERNAL, RESOLVED, CLOSED and REOPENED require both values after assignment', `${name}.x-state-invariant`);
      exact(errors, schema.properties?.assigneeRef?.nullable, true, `${name}.assigneeRef nullable`);
      exact(errors, schema.properties?.assignedAt?.nullable, true, `${name}.assignedAt nullable`);
    }
    if (name === 'M1016SupportTicket') {
      exactArray(errors, schema.properties?.categoryCode?.enum, policy.support.categories, `${name}.categoryCode.enum`);
      exactArray(errors, schema.properties?.state?.enum, policy.support.states, `${name}.state.enum`);
      exact(errors, schema['x-state-invariant'], 'RESOLVED or CLOSED requires resolution; OPEN, ASSIGNED, WAITING_USER, WAITING_INTERNAL and REOPENED must not expose a resolution fact', `${name}.x-state-invariant`);
      assertSupportStateConditionals(document, schema, errors, name);
    }
    if (name === 'M1016SupportSla') exactArray(errors, schema.properties?.status?.enum, policy.support.sla.statuses, `${name}.status.enum`);
    if (name === 'M1016SupportRetention') exactArray(errors, schema.properties?.legalHold?.enum, policy.support.retention.legalHoldStates, `${name}.legalHold.enum`);
    if (name === 'M1016SupportMessage') exactArray(errors, schema.properties?.authorType?.enum, policy.support.message.authorTypes, `${name}.authorType.enum`);
    assertClosedSchemaGraph(document, schema, errors, `support.${name}`);
    assertExactRequestSchemaProperties(schema, name, errors, 'support');
    if (name.endsWith('Request') || name.endsWith('Command')) {
      assertNoClientAuthorityFields(document, schema, errors, `support.${name}`, supportRequestAuthorityFields(name));
    }
  }
  for (const name of SUPPORT_SCHEMA_NAMES) {
    const schema = validateClosedSchema(canonicalOpenApi, name, errors, 'merged OpenAPI', { required: schemaRequirements[name] });
    if (schema) {
      assertClosedSchemaGraph(canonicalOpenApi, schema, errors, `merged.${name}`);
      assertExactRequestSchemaProperties(schema, name, errors, 'merged');
      if (name.endsWith('Request') || name.endsWith('Command')) {
        assertNoClientAuthorityFields(canonicalOpenApi, schema, errors, `merged.${name}`, supportRequestAuthorityFields(name));
      }
    }
  }
  return schemaRequirements;
}

function validateSupportOpenApi(policy, b5, b13, canonicalOpenApi, errors) {
  let routes = 0;
  add(errors, isRecord(b5), 'B5 support OpenAPI fragment is required');
  if (isRecord(b5)) {
    const extensionKeys = ['task', 'owner', 'canonicalOperations', 'historicalOperations', 'maturity', 'runtimeStatus', 'clientAuthority'];
    if (keys(errors, b5['x-m1016-contract'], extensionKeys, extensionKeys, 'B5 x-m1016-contract')) {
      exact(errors, b5['x-m1016-contract'].task, 'P1R-M1-016', 'B5 extension.task');
      exact(errors, b5['x-m1016-contract'].owner, 'admin-ops-service.support', 'B5 extension.owner');
      exactArray(errors, b5['x-m1016-contract'].canonicalOperations, LEARNER_SUPPORT_OPERATIONS.map(([, , operationId]) => operationId), 'B5 extension.canonicalOperations');
      exact(errors, b5['x-m1016-contract'].maturity, 'D2_CONTRACT_READY', 'B5 extension.maturity');
      exact(errors, b5['x-m1016-contract'].runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'B5 extension.runtimeStatus');
      exact(errors, b5['x-m1016-contract'].clientAuthority, 'NONE', 'B5 extension.clientAuthority');
    }
    routes += validateSupportOperations(policy, b5, canonicalOpenApi, 'B5', LEARNER_SUPPORT_OPERATIONS, errors);
  }
  add(errors, isRecord(b13), 'B13 support OpenAPI fragment is required');
  if (isRecord(b13)) {
    const extensionKeys = ['task', 'owner', 'canonicalOperations', 'historicalOperations', 'maturity', 'runtimeStatus', 'clientAuthority'];
    if (keys(errors, b13['x-m1016-contract'], extensionKeys, extensionKeys, 'B13 x-m1016-contract')) {
      exact(errors, b13['x-m1016-contract'].task, 'P1R-M1-016', 'B13 extension.task');
      exact(errors, b13['x-m1016-contract'].owner, 'admin-ops-service.support', 'B13 extension.owner');
      exactArray(errors, b13['x-m1016-contract'].canonicalOperations, ADMIN_SUPPORT_OPERATIONS.map(([, , operationId]) => operationId), 'B13 extension.canonicalOperations');
      exactArray(errors, b13['x-m1016-contract'].historicalOperations, ['createB13SupportTicket'], 'B13 extension.historicalOperations');
      exact(errors, b13['x-m1016-contract'].maturity, 'D2_CONTRACT_READY', 'B13 extension.maturity');
      exact(errors, b13['x-m1016-contract'].runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'B13 extension.runtimeStatus');
      exact(errors, b13['x-m1016-contract'].clientAuthority, 'NONE', 'B13 extension.clientAuthority');
    }
    routes += validateSupportOperations(policy, b13, canonicalOpenApi, 'B13', ADMIN_SUPPORT_OPERATIONS, errors);
  }
  const schemaRequirements = validateSupportSchemas(policy, b13, canonicalOpenApi, errors);
  return { routes, schemas: SUPPORT_SCHEMA_NAMES.filter((name) => isRecord(schemaAt(canonicalOpenApi, name))).length, schemaRequirements };
}

function validateB13HistoricalCreateAdapter(fragment, canonicalOpenApi, errors) {
  const operation = operationAt(fragment, 'POST', '/api/v1/admin/ops/tickets');
  add(errors, isRecord(operation), 'B13 historical create adapter is required');
  if (!isRecord(operation)) return;
  exact(errors, operation.operationId, 'createB13SupportTicket', 'B13 historical create operationId');
  exact(errors, operation.deprecated, true, 'B13 historical create adapter deprecated');
  exact(errors, operation['x-owner'], 'admin-ops-service', 'B13 historical create owner');
  exact(errors, operation['x-data-owner'], 'admin-ops-service.support', 'B13 historical create data owner');
  exact(errors, operation['x-permission'], 'support.ticket.create.self', 'B13 historical create permission');
  exact(errors, operation['x-canonical-replacement'], {
    operationId: 'createM1016SupportTicket',
    method: 'POST',
    path: '/api/v1/support/tickets',
  }, 'B13 historical create canonical replacement');
  exact(errors, operation['x-contract'], {
    task: 'P1R-M1-016',
    canonical: false,
    adapterMode: 'HISTORICAL_REQUEST_TO_CANONICAL_SUPPORT_OWNER',
    maturity: 'D2_CONTRACT_READY',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    clientAuthority: 'NONE',
  }, 'B13 historical create contract');
  exact(errors, operation['x-authorization'], {
    defaultDecision: 'DENY',
    requiredPermission: 'support.ticket.create.self',
    pep: 'admin-ops-service-local',
    allowedActors: ['SELF'],
    trustedFacts: ['subject', 'tenant', 'roles', 'permissions', 'policyVersion'],
    clientAuthority: 'NONE',
  }, 'B13 historical create authorization');
  exact(errors, operation.security, [{ bearerAuth: [] }], 'B13 historical create security');
  exact(errors, operation.requestBody?.content?.['application/json']?.schema, { $ref: '#/components/schemas/M1016SupportTicketCreateRequest' }, 'B13 historical create request schema');
  add(errors, containsExactRef(operation.requestBody, '#/components/schemas/M1016SupportTicketCreateRequest'), 'B13 historical create must accept canonical support request schema');
  const schema = resolveRefFromDocuments(
    fragment,
    operation.requestBody?.content?.['application/json']?.schema,
    canonicalOpenApi,
  );
  add(errors, isRecord(schema), 'B13 historical create request schema must resolve');
  if (isRecord(schema)) {
    checkForbiddenPayload(schema, errors, 'B13.historicalCreate.request', fragment, false, new Set(), canonicalOpenApi);
    assertNoClientAuthorityFields(fragment, schema, errors, 'B13.historicalCreate.request', supportRequestAuthorityFields('M1016SupportTicketCreateRequest'));
  }
}

function methodFor(routes, operationId) {
  return routes.find(([, , id]) => id === operationId)?.[0] ?? 'GET';
}

function validateHistoricalOpenApi(fragment, label, errors, canonicalOpenApi) {
  add(errors, isRecord(fragment), `${label} fragment is required`);
  if (!isRecord(fragment)) return;
  add(errors, !Object.hasOwn(fragment, 'asyncapi'), `${label} fragment must not define AsyncAPI`);
  assertNoRuntimePromotion(fragment, errors, label);
  if (label === 'B11') {
    for (const [route, pathItem] of Object.entries(isRecord(fragment.paths) ? fragment.paths : {})) {
      for (const [method, operation] of Object.entries(isRecord(pathItem) ? pathItem : {})) {
        if (!HTTP_METHODS.has(method) || !isRecord(operation)) continue;
        add(errors, !CANONICAL_NOTIFICATION_OPERATIONS.some(([, , operationId]) => operation.operationId === operationId), `B11 must not duplicate canonical notification operation ${operation.operationId ?? '<missing>'}`);
      }
    }
    for (const name of Object.keys(fragment.components?.schemas ?? {})) add(errors, !name.startsWith('M1016Notification'), `B11 must not define canonical notification schema ${name}`);
  }
  if (label === 'B13') validateB13HistoricalCreateAdapter(fragment, canonicalOpenApi, errors);
  for (const [route, pathItem] of Object.entries(fragment.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP_METHODS.has(method) || !isRecord(operation)) continue;
      const isCanonicalM1016 = String(operation.operationId ?? '').includes('M1016');
      const isSupportLegacy = /(?:support|admin\/ops\/tickets)/i.test(route) && !isCanonicalM1016;
      if (isSupportLegacy && ['post', 'put', 'patch', 'delete'].includes(method)) {
        add(errors, operation.deprecated === true || operation['x-migration'], `${label} legacy write ${method.toUpperCase()} ${route} must be adapter-only/deprecated`);
      }
    }
  }
}

function validateEventProjection(policy, eventFragment, catalog, b26, errors) {
  add(errors, isRecord(eventFragment), 'M1-016 v2 event fragment is required');
  add(errors, isRecord(catalog), 'merged event catalog is required');
  if (!isRecord(eventFragment) || !isRecord(catalog)) return { events: 0, operations: 0, receives: 0 };
  assertNoRuntimePromotion(eventFragment, errors, 'M1-016 event fragment');
  assertNoRuntimePromotion(catalog, errors, 'event catalog');
  add(errors, !Object.hasOwn(eventFragment, 'asyncapi'), 'M1-016 event fragment must not own AsyncAPI');
  if (keys(errors, eventFragment, ['version', 'events', 'payloadSchemas'], ['version', 'events', 'payloadSchemas'], 'M1-016 event fragment')) {
    exact(errors, eventFragment.version, '2.0.0', 'M1-016 event fragment.version');
  }
  const fragmentEventKeys = [
    'eventName', 'domain', 'version', 'schema', 'aggregateType', 'aggregateIdField',
    'x-envelope-required', 'payloadSchema', 'compatibility',
  ];
  const catalogEventKeys = [
    ...fragmentEventKeys, 'status', 'x-p1r-governance',
  ];
  const catalogEvents = Array.isArray(catalog?.events) ? catalog.events : [];
  const catalogEventNames = catalogEvents.map((event) => event?.eventName);
  add(errors, catalogEventNames.every(nonEmpty), 'catalog eventName values must all be non-empty strings');
  add(errors, new Set(catalogEventNames).size === catalogEventNames.length, 'catalog eventName values must be globally unique');
  const planned = Array.isArray(policy?.events?.canonicalPlanned) ? policy.events.canonicalPlanned : [];
  for (const eventName of planned) {
    const fragmentMatches = eventByName(eventFragment, eventName);
    const catalogMatches = eventByName(catalog, eventName);
    add(errors, fragmentMatches.length === 1, `M1-016 fragment must define ${eventName} exactly once`);
    add(errors, catalogMatches.length === 1, `catalog must define ${eventName} exactly once`);
    if (fragmentMatches.length === 1) {
      const fragmentEvent = fragmentMatches[0];
      if (keys(errors, fragmentEvent, fragmentEventKeys, fragmentEventKeys, `${eventName}.fragment`)) {
        add(errors, !Object.hasOwn(fragmentEvent, 'status'), `${eventName}.fragment must not own status`);
        add(errors, !Object.hasOwn(fragmentEvent, 'x-p1r-governance'), `${eventName}.fragment must not own governance`);
        add(errors, !Object.hasOwn(fragmentEvent, 'bindings'), `${eventName}.fragment must not own Kafka bindings`);
      }
    }
    const event = catalogMatches[0];
    if (!event) continue;
    if (keys(errors, event, catalogEventKeys, catalogEventKeys, `${eventName}.catalog`)) {
      exact(errors, event.status, 'CANONICAL_D2', `${eventName}.status`);
    }
    const fragmentEvent = fragmentMatches[0];
    if (fragmentEvent) {
      for (const field of ['domain', 'version', 'schema', 'aggregateType', 'aggregateIdField', 'x-envelope-required', 'payloadSchema', 'compatibility']) {
        exact(errors, fragmentEvent[field], event[field], `${eventName}.fragment/catalog.${field}`);
      }
      const fragmentPayload = resolveRef(eventFragment, fragmentEvent.payloadSchema);
      add(errors, isRecord(fragmentPayload) && fragmentPayload.additionalProperties === false, `${eventName} fragment payload must be closed`);
      checkForbiddenPayload(fragmentPayload, errors, `fragment.${eventName}`, eventFragment);
      assertClosedSchemaGraph(eventFragment, fragmentPayload, errors, `fragment.${eventName}.payload`);
    }
    exact(errors, event.status, 'CANONICAL_D2', `${eventName}.status`);
    const payload = resolveRef(catalog, event.payloadSchema);
    add(errors, isRecord(payload) && payload.additionalProperties === false, `${eventName} catalog payload must be closed`);
    checkForbiddenPayload(payload, errors, `catalog.${eventName}`, catalog);
    assertClosedSchemaGraph(catalog, payload, errors, `catalog.${eventName}.payload`);
    const expectedPayloadFields = M1016_EVENT_PAYLOAD_REQUIRED_FIELDS[eventName];
    if (expectedPayloadFields) {
      exact(errors, payload?.$id, `platform.events.${eventName}.payload`, `${eventName} payload.$id`);
      exact(errors, payload?.type, 'object', `${eventName} payload.type`);
      exactArray(errors, payload?.required, expectedPayloadFields, `${eventName} payload.required`);
      exactArray(errors, Object.keys(payload?.properties ?? {}), expectedPayloadFields, `${eventName} payload.properties`);
      assertEventPayloadFieldTypes(payload, eventName, errors);
      const fragmentPayload = fragmentEvent ? resolveRef(eventFragment, fragmentEvent.payloadSchema) : undefined;
      exact(errors, fragmentPayload, payload, `${eventName} fragment/catalog.payload`);
    }
    const channels = Object.entries(catalog.asyncapi?.channels ?? {}).filter(([, channel]) => Object.values(channel?.messages ?? {}).some((message) => (message?.['x-event-name'] ?? message?.name) === eventName));
    add(errors, channels.length === 1, `${eventName} must project to exactly one AsyncAPI channel`);
    if (channels.length !== 1) continue;
    const [channelName, channel] = channels[0];
    if (keys(errors, channel, ['address', 'bindings', 'messages'], ['address', 'bindings', 'messages'], `${eventName} AsyncAPI channel`)) {
      exact(errors, channel.bindings?.kafka?.topic, channel.address, `${eventName} Kafka channel topic`);
      exact(errors, channel.bindings?.kafka?.bindingVersion, '0.5.0', `${eventName} Kafka channel binding`);
    }
    const messageEntries = Object.entries(channel.messages ?? {}).filter(([, message]) => (message?.['x-event-name'] ?? message?.name) === eventName);
    add(errors, messageEntries.length === 1, `${eventName} must define exactly one AsyncAPI message`);
    const [messageName, message] = messageEntries[0] ?? [];
    const messageRef = messageName ? `#/asyncapi/channels/${channelName}/messages/${messageName}` : undefined;
    if (message) {
      exact(errors, message.payload, event.payloadSchema, `${eventName} AsyncAPI message payload`);
      exact(errors, message.bindings?.kafka?.bindingVersion, '0.5.0', `${eventName} Kafka message binding`);
    }
    exact(errors, channel.bindings?.kafka?.bindingVersion, '0.5.0', `${eventName} Kafka channel binding`);
    const operations = Object.entries(catalog.asyncapi?.operations ?? {}).filter(([, operation]) => operation?.channel?.$ref === `#/asyncapi/channels/${channelName}`);
    const sends = operations.filter(([, operation]) => operation.action === 'send');
    const receives = operations.filter(([, operation]) => operation.action === 'receive');
    add(errors, sends.length === 1, `${eventName} must have exactly one send operation`);
    add(errors, receives.length >= 1, `${eventName} must have at least one receive operation`);
    const operationStem = String(eventName).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const groups = receives.map(([, operation]) => operation['x-consumer-group'] ?? operation.consumerGroup ?? operation.bindings?.kafka?.groupId?.enum?.[0]).filter(Boolean);
    add(errors, new Set(groups).size === groups.length, `${eventName} consumer groups must be unique`);
    for (const [operationId, operation] of operations) {
      exact(errors, operation.bindings?.kafka?.bindingVersion, '0.5.0', `${eventName} Kafka operation binding`);
      if (messageRef) exact(errors, operation.messages, [{ $ref: messageRef }], `${eventName}.${operationId}.messages`);
      if (operation.action === 'send') {
        add(errors, keys(errors, operation, ['action', 'channel', 'messages', 'bindings', 'x-producer-service', 'x-data-owner'], ['action', 'channel', 'messages', 'bindings', 'x-producer-service', 'x-data-owner'], `${eventName}.${operationId}`), `${eventName}.${operationId} send shape`);
        exact(errors, operationId, `publish_${operationStem}`, `${eventName} deterministic publish operationId`);
      } else if (operation.action === 'receive') {
        add(errors, keys(errors, operation, ['action', 'channel', 'messages', 'bindings', 'x-consumer-service'], ['action', 'channel', 'messages', 'bindings', 'x-consumer-service'], `${eventName}.${operationId}`), `${eventName}.${operationId} receive shape`);
        const group = operation['x-consumer-group'] ?? operation.consumerGroup ?? operation.bindings?.kafka?.groupId?.enum?.[0];
        if (group) {
          exact(errors, operationId, `subscribe_${operationStem}_${String(group).replace(/[^A-Za-z0-9]+/g, '_')}`, `${eventName} deterministic receive operationId`);
        }
      }
    }
    const governance = event['x-p1r-governance'];
    add(errors, isRecord(governance), `${eventName}.x-p1r-governance is required`);
    let route;
    if (isRecord(b26)) {
      const routes = Array.isArray(b26.eventRouting) ? b26.eventRouting.filter((route) => route?.eventName === eventName) : [];
      add(errors, routes.length === 1, `${eventName} must have exactly one B26 eventRouting entry`);
      if (routes.length === 1) {
        [route] = routes;
        exact(errors, route.partitionKey, 'aggregateId', `${eventName} B26 partition key`);
        exact(errors, route.topic, channel.address, `${eventName} B26 topic`);
        exactSet(errors, route.consumerGroups, groups, `${eventName} B26 consumer groups`);
      }
    }
    if (isRecord(governance)) {
      const governanceKeys = ['status', 'runtimeStatus', 'scope', 'producer', 'consumers', 'transport', 'schema', 'correlation', 'traceability'];
      const producerKeys = ['service', 'dataOwner', 'outboxRequired', 'publishOperationId'];
      const consumerKeys = ['service', 'consumerGroup', 'subscriptionOperationId'];
      const transportKeys = ['protocol', 'topic', 'partitionKey', 'aggregateIdSource', 'delivery', 'bindingVersion', 'channelId'];
      const schemaKeys = ['schemaVersion', 'payloadRef', 'compatibility'];
      if (keys(errors, governance, governanceKeys, governanceKeys, `${eventName}.governance`)) {
        exact(errors, governance.status, 'CANONICAL_D2', `${eventName}.governance.status`);
        exact(errors, governance.runtimeStatus, 'NOT_RUNTIME_VERIFIED', `${eventName}.governance.runtimeStatus`);
        exact(errors, governance.scope, 'CROSS_SERVICE_INTEGRATION_FACT', `${eventName}.governance.scope`);
        if (keys(errors, governance.producer, producerKeys, producerKeys, `${eventName}.governance.producer`)) {
          exact(errors, governance.producer.outboxRequired, true, `${eventName}.governance.producer.outboxRequired`);
          exact(errors, governance.producer.publishOperationId, `publish_${operationStem}`, `${eventName}.governance.producer.publishOperationId`);
          if (sends.length === 1) {
            exact(errors, sends[0][0], governance.producer.publishOperationId, `${eventName}.producer operation binding`);
            exact(errors, sends[0][1]['x-producer-service'], governance.producer.service, `${eventName}.producer service binding`);
            exact(errors, sends[0][1]['x-data-owner'], governance.producer.dataOwner, `${eventName}.producer data owner binding`);
          }
        }
        if (keys(errors, governance.transport, transportKeys, transportKeys, `${eventName}.governance.transport`)) {
          exact(errors, governance.transport.protocol, 'kafka', `${eventName}.governance.transport.protocol`);
          exact(errors, governance.transport.topic, channel.address, `${eventName}.governance.transport.topic`);
          exact(errors, governance.transport.partitionKey, 'aggregateId', `${eventName}.governance.transport.partitionKey`);
          exact(errors, governance.transport.aggregateIdSource, `payload.${event.aggregateIdField}`, `${eventName}.governance.transport.aggregateIdSource`);
          exact(errors, governance.transport.delivery, 'at-least-once', `${eventName}.governance.transport.delivery`);
          exact(errors, governance.transport.bindingVersion, '0.5.0', `${eventName}.governance.transport.bindingVersion`);
          exact(errors, governance.transport.channelId, channelName, `${eventName}.governance.transport.channelId`);
        }
        if (keys(errors, governance.schema, schemaKeys, schemaKeys, `${eventName}.governance.schema`)) {
          exact(errors, governance.schema.schemaVersion, event.schema, `${eventName}.governance.schema.schemaVersion`);
          exact(errors, governance.schema.payloadRef, event.payloadSchema?.$ref, `${eventName}.governance.schema.payloadRef`);
          exact(errors, governance.schema.compatibility, event.compatibility?.strategy, `${eventName}.governance.schema.compatibility`);
        }
        exactArray(errors, governance.correlation, ['eventId', 'aggregateId', 'requestId', 'traceId', 'dedupeKey'], `${eventName}.governance.correlation`);
        const integrationTrace = eventName.startsWith('notification.')
          ? 'INT-P1-013'
          : eventName.startsWith('sync.')
            ? 'INT-P1-014'
            : 'INT-P1-012';
        exactArray(errors, governance.traceability, ['ARCH-EVT-001', integrationTrace], `${eventName}.governance.traceability`);
        const governedGroups = Array.isArray(governance.consumers) ? governance.consumers.map((consumer) => consumer?.consumerGroup) : [];
        exactSet(errors, governedGroups, groups, `${eventName}.governance consumer groups`);
        if (Array.isArray(governance.consumers)) {
          for (const consumer of governance.consumers) {
            if (!keys(errors, consumer, consumerKeys, consumerKeys, `${eventName}.governance.consumer`)) continue;
            const group = consumer.consumerGroup;
            exact(errors, consumer.subscriptionOperationId, `subscribe_${operationStem}_${String(group).replace(/[^A-Za-z0-9]+/g, '_')}`, `${eventName}.governance.consumer operationId`);
            const operation = receives.find(([, candidate]) => (candidate['x-consumer-group'] ?? candidate.consumerGroup ?? candidate.bindings?.kafka?.groupId?.enum?.[0]) === group);
            add(errors, Boolean(operation), `${eventName}.governance consumer ${group} must have an AsyncAPI receive operation`);
            if (operation) {
              exact(errors, operation[0], consumer.subscriptionOperationId, `${eventName}.consumer operation binding`);
              exact(errors, operation[1]['x-consumer-service'], consumer.service, `${eventName}.consumer service binding`);
            }
          }
        }
      }
    }
    if (route && isRecord(b26)) {
      const topic = Array.isArray(b26.topics) ? b26.topics.find((entry) => entry?.name === route.topic) : undefined;
      add(errors, isRecord(topic), `${eventName} B26 topic declaration is required`);
      if (isRecord(topic) && isRecord(governance)) {
        exact(errors, governance.producer?.service, topic.ownerService, `${eventName} producer owner/topic owner`);
        exact(errors, governance.producer?.dataOwner, topic.ownerService, `${eventName} data owner/topic owner`);
        const topicGroups = Array.isArray(topic.consumerGroups) ? topic.consumerGroups : [];
        for (const consumer of (Array.isArray(governance.consumers) ? governance.consumers : [])) {
          const topicGroup = topicGroups.find((entry) => entry?.name === consumer?.consumerGroup);
          add(errors, isRecord(topicGroup), `${eventName} B26 topic consumer group ${consumer?.consumerGroup ?? '<missing>'} is required`);
          if (topicGroup) exact(errors, consumer.service, topicGroup.service, `${eventName} consumer/topic service`);
        }
      }
    }
  }
  validatePolicyEventBindings(policy, catalog, b26, errors);
  const historical = new Set(policy.events.historicalOnly);
  for (const event of catalog.events ?? []) {
    if (historical.has(event?.eventName)) exact(errors, event.status, 'HISTORICAL_CANDIDATE', `historical ${event.eventName}.status`);
  }
  exact(errors, catalog.asyncapi?.['x-runtime-status'], 'NOT_RUNTIME_VERIFIED', 'catalog AsyncAPI runtime status');
  return {
    events: planned.length,
    operations: Object.keys(catalog.asyncapi?.operations ?? {}).length,
    receives: Object.values(catalog.asyncapi?.operations ?? {}).filter((operation) => operation.action === 'receive').length,
  };
}

function eventByName(document, name) {
  return (Array.isArray(document?.events) ? document.events : []).filter((event) => event?.eventName === name);
}

function validatePolicyEventBindings(policy, catalog, b26, errors) {
  const eventsPolicy = policy?.events;
  const governanceBindings = Array.isArray(eventsPolicy?.governanceBindings) ? eventsPolicy.governanceBindings : [];
  const sourceBindings = Array.isArray(eventsPolicy?.sourceSubscriptionBindings) ? eventsPolicy.sourceSubscriptionBindings : [];
  const canonicalEvents = Array.isArray(eventsPolicy?.canonicalPlanned) ? eventsPolicy.canonicalPlanned : [];
  const consumerKeys = ['service', 'consumerGroup'];

  for (const eventName of canonicalEvents) {
    const bindingMatches = governanceBindings.filter((binding) => binding?.eventName === eventName);
    add(errors, bindingMatches.length === 1, `${eventName} policy governance binding must exist exactly once`);
    const binding = bindingMatches[0];
    const event = eventByName(catalog, eventName)[0];
    const governance = event?.['x-p1r-governance'];
    if (!isRecord(binding) || !isRecord(governance)) continue;
    exact(errors, governance.producer?.service, binding.producer, `${eventName} catalog producer/policy binding`);
    exact(errors, governance.producer?.dataOwner, binding.dataOwner, `${eventName} catalog data owner/policy binding`);
    exact(errors, governance.transport?.topic, binding.topic, `${eventName} catalog topic/policy binding`);
    exact(errors, governance.transport?.partitionKey, binding.partitionKey, `${eventName} catalog partition/policy binding`);
    exact(errors, governance.transport?.aggregateIdSource, binding.aggregateIdSource, `${eventName} catalog aggregate source/policy binding`);
    const actualConsumers = Array.isArray(governance.consumers) ? governance.consumers : [];
    const expectedConsumers = Array.isArray(binding.consumers) ? binding.consumers : [];
    exactSet(errors, actualConsumers.map((consumer) => `${consumer?.service}:${consumer?.consumerGroup}`), expectedConsumers.map((consumer) => `${consumer?.service}:${consumer?.consumerGroup}`), `${eventName} catalog consumers/policy binding`);
    for (const [index, expectedConsumer] of expectedConsumers.entries()) {
      if (!keys(errors, expectedConsumer, consumerKeys, consumerKeys, `${eventName}.policy consumers[${index}]`)) continue;
      const actual = actualConsumers.find((consumer) => consumer?.consumerGroup === expectedConsumer.consumerGroup);
      add(errors, isRecord(actual), `${eventName} catalog consumer ${expectedConsumer.consumerGroup} is required by policy binding`);
      if (actual) exact(errors, actual.service, expectedConsumer.service, `${eventName} catalog consumer service/policy binding`);
    }
    const routes = Array.isArray(b26?.eventRouting) ? b26.eventRouting.filter((route) => route?.eventName === eventName) : [];
    if (routes.length === 1) {
      exact(errors, routes[0].topic, binding.topic, `${eventName} B26 topic/policy binding`);
      exact(errors, routes[0].partitionKey, binding.partitionKey, `${eventName} B26 partition/policy binding`);
      exactSet(errors, routes[0].consumerGroups, expectedConsumers.map((consumer) => consumer.consumerGroup), `${eventName} B26 groups/policy binding`);
    }
  }

  for (const [index, binding] of sourceBindings.entries()) {
    if (!keys(errors, binding, ['sourceEvent', 'topic', 'consumerGroup'], ['sourceEvent', 'topic', 'consumerGroup'], `events.sourceSubscriptionBindings[${index}]`)) continue;
    const sourceEvent = eventByName(catalog, binding.sourceEvent);
    add(errors, sourceEvent.length === 1, `${binding.sourceEvent} source subscription must resolve to one catalog event`);
    add(errors, isRecord(sourceEvent[0]), `${binding.sourceEvent} source subscription catalog event is required`);
    if (!isRecord(sourceEvent[0])) continue;
    exact(errors, sourceEvent[0].status, 'CANONICAL_D2', `${binding.sourceEvent} source subscription status`);
    const governance = sourceEvent[0]?.['x-p1r-governance'];
    add(errors, isRecord(governance), `${binding.sourceEvent} source subscription governance is required`);
    if (!isRecord(governance)) continue;
    exact(errors, governance.transport?.topic, binding.topic, `${binding.sourceEvent} source topic/policy binding`);
    const consumer = (Array.isArray(governance.consumers) ? governance.consumers : []).find((entry) => entry?.consumerGroup === binding.consumerGroup);
    add(errors, isRecord(consumer), `${binding.sourceEvent} source subscription consumer group must be governed`);
    if (consumer) exact(errors, consumer.service, 'notification-service', `${binding.sourceEvent} source subscription service`);
    const topicEntries = Array.isArray(b26?.topics) ? b26.topics.filter((topic) => topic?.name === binding.topic) : [];
    add(errors, topicEntries.length === 1, `${binding.sourceEvent} source subscription topic must be declared exactly once in B26`);
    const topic = topicEntries[0];
    const topicConsumer = topic && Array.isArray(topic.consumerGroups)
      ? topic.consumerGroups.find((entry) => entry?.name === binding.consumerGroup)
      : undefined;
    add(errors, isRecord(topicConsumer), `${binding.sourceEvent} source subscription B26 consumer group is required`);
    if (topicConsumer) exact(errors, topicConsumer.service, 'notification-service', `${binding.sourceEvent} source subscription B26 service`);
    const acl = topic && Array.isArray(topic.acl)
      ? topic.acl.find((entry) => entry?.principal === binding.consumerGroup && entry?.operation === 'READ')
      : undefined;
    add(errors, isRecord(acl) && acl.effect === 'ALLOW', `${binding.sourceEvent} source subscription B26 READ ACL is required`);
  }
}

function validateB26(policy, b26, errors) {
  add(errors, isRecord(b26), 'B26 event runtime policy is required');
  if (!isRecord(b26)) return;
  exact(errors, b26.mode, 'static-only', 'B26.mode');
  exact(errors, b26.runtimeStatus, 'pending', 'B26.runtimeStatus');
  exact(errors, b26.defaultDecision, 'NO-GO', 'B26.defaultDecision');
  exact(errors, b26.execution?.staticValidatorCannotPromoteRuntime, true, 'B26 static promotion boundary');
  exact(errors, b26.runtimeGate?.externalEvidenceRequired, true, 'B26 external evidence requirement');
  exact(errors, b26.broker?.aclWildcardAllowed, false, 'B26 ACL wildcard');
  exact(errors, b26.broker?.aclMode, 'deny-by-default-explicit-workload-principal', 'B26 ACL mode');
  exact(errors, b26.outbox?.sameTransactionAsAggregate, true, 'B26 Outbox atomicity');
  exact(errors, b26.outbox?.eventImmutableAfterCommit, true, 'B26 immutable Outbox');
  exact(errors, b26.consumerReliability?.deduplication?.effectAndDeduplicationMustBeAtomic, true, 'B26 consumer atomic dedupe');
  exact(errors, b26.consumerReliability?.deduplication?.offsetCommitAfterEffect, true, 'B26 offset-after-effect');
  exact(errors, b26.consumerReliability?.retry?.maxAttempts, 5, 'B26 retry max attempts');
  exact(errors, b26.consumerReliability?.retry?.exhaustedAction, 'route-to-dlq', 'B26 exhausted retry action');
  exactArray(errors, b26.sourceRefs, EXACT_B26_SOURCE_REFS, 'B26 sourceRefs');
  for (const [topicName, expected] of Object.entries(EXACT_B26_M1016_TOPIC_ACCESS)) {
    const matches = Array.isArray(b26.topics) ? b26.topics.filter((topic) => topic?.name === topicName) : [];
    add(errors, matches.length === 1, `B26 ${topicName} must be declared exactly once`);
    if (matches.length !== 1) continue;
    const [topic] = matches;
    exact(errors, topic.ownerService, expected.ownerService, `B26 ${topicName} owner`);
    exact(errors, topic.producerPrincipal, expected.producerPrincipal, `B26 ${topicName} producer principal`);
    exact(errors, topic.consumerGroups, expected.consumerGroups, `B26 ${topicName} consumerGroups`);
    exact(errors, topic.acl, expected.acl, `B26 ${topicName} ACL`);
  }
  const adminOpsTopics = Array.isArray(b26.topics) ? b26.topics.filter((topic) => topic?.name === EXACT_B26_ADMIN_OPS_TOPIC.name) : [];
  add(errors, adminOpsTopics.length === 1, 'B26 admin-ops topic must be declared exactly once');
  if (adminOpsTopics.length === 1) exact(errors, adminOpsTopics[0], EXACT_B26_ADMIN_OPS_TOPIC, 'B26 admin-ops topic projection');
  exact(errors, policy?.events?.b26StaticProjection, EXACT_B26_STATIC_PROJECTION, 'events.b26StaticProjection source projection');
  assertNoRuntimePromotion(b26, errors, 'b26');
}

function validateGateway(gateway, errors) {
  add(errors, isRecord(gateway), 'merged Gateway boundary projection is required');
  if (!isRecord(gateway)) return;
  const boundary = gateway['x-p1r-gateway-boundary'] ?? gateway;
  add(errors, isRecord(boundary), 'Gateway boundary must be an object');
  if (!isRecord(boundary)) return;
  exact(errors, boundary.d2Boundary?.runtimeCompletionClaimed, false, 'Gateway runtime completion claim');
  exact(errors, boundary.internalOperationPolicy?.externalExposure, 'DENY', 'Gateway internal external exposure');
  exact(errors, boundary.internalOperationPolicy?.requiredCallerIdentity, 'VALIDATED_WORKLOAD_IDENTITY', 'Gateway internal caller identity');
  for (const route of (Array.isArray(boundary.routeRules) ? boundary.routeRules : [])) {
    if (!isRecord(route)) continue;
    const pathValue = route.match?.path ?? route.path ?? '';
    const owner = route.upstreamOwner;
    if (/^\/api\/v1\/(notifications|support|admin\/ops)/.test(pathValue)) add(errors, owner !== 'Gateway', `Gateway route ${pathValue} must have a domain owner`);
    if (/^\/api\/v1\/support/.test(pathValue)) exact(errors, owner, 'admin-ops-service', `Gateway support owner ${pathValue}`);
    if (/^\/api\/v1\/notifications/.test(pathValue)) exact(errors, owner, 'notification-service', `Gateway notification owner ${pathValue}`);
  }
  assertNoRuntimePromotion(boundary, errors, 'gateway');
}

export function validateNotificationSyncSupportContractData(input = {}) {
  const errors = [];
  if (!isRecord(input.policy)) {
    errors.push('policy must be an object');
    return { result: 'FAIL', runtimeStatus: 'NOT_RUNTIME_VERIFIED', errors, summary: { taskId: 'P1R-M1-016' } };
  }
  let canonical;
  let notificationCounts = { routes: 0, schemas: 0 };
  let syncCounts = { routes: 0, schemas: 0 };
  let supportCounts = { routes: 0, schemas: 0 };
  let eventCounts = { events: 0, operations: 0, receives: 0 };
  let digest;
  try {
    digest = policyDigest(input.policy);
  } catch (error) {
    errors.push(`M1-016 policy digest failed (fail closed): ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    assertPolicySections(input.policy, errors);
    canonical = input.canonicalOpenApi ?? input.openApi;
    add(errors, isRecord(canonical), 'merged canonical OpenAPI is required');
    const b12 = input.b12OpenApi ?? input.canonicalNotificationOpenApi;
    const sourceDocuments = [
      ['merged OpenAPI', canonical],
      ['B12 OpenAPI', b12],
      ['B11 OpenAPI', input.b11OpenApi ?? input.fragments?.b11],
      ['B5 OpenAPI', input.b5OpenApi ?? input.fragments?.b5],
      ['B13 OpenAPI', input.b13OpenApi ?? input.fragments?.b13],
      ['Gateway boundary', input.gatewayBoundary],
      ['M1-016 event fragment', input.eventFragment],
      ['event catalog', input.eventCatalog ?? input.catalog],
    ];
    for (const [label, document] of sourceDocuments) {
      if (isRecord(document)) assertAllRefsResolve(document, document, errors, label, new Set(), canonical);
    }
    notificationCounts = validateNotificationOpenApi(input.policy, b12, canonical, errors);
    syncCounts = validateSyncOpenApi(input.policy, input.b11OpenApi ?? input.fragments?.b11, canonical, errors);
    supportCounts = validateSupportOpenApi(input.policy, input.b5OpenApi ?? input.fragments?.b5, input.b13OpenApi ?? input.fragments?.b13, canonical, errors);
    validateHistoricalOpenApi(input.b11OpenApi ?? input.fragments?.b11, 'B11', errors, canonical);
    validateHistoricalOpenApi(input.b5OpenApi ?? input.fragments?.b5, 'B5', errors, canonical);
    validateHistoricalOpenApi(input.b13OpenApi ?? input.fragments?.b13, 'B13', errors, canonical);
    eventCounts = validateEventProjection(input.policy, input.eventFragment, input.eventCatalog ?? input.catalog, input.b26Runtime, errors);
    validateB26(input.policy, input.b26Runtime, errors);
    validateGateway(input.gatewayBoundary, errors);
    validateGateway(canonical, errors);
    exact(
      errors,
      canonical?.['x-p1r-gateway-boundary'],
      input.gatewayBoundary?.['x-p1r-gateway-boundary'],
      'merged Gateway boundary projection',
    );
  } catch (error) {
    errors.push(`M1-016 validation exception (fail closed): ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    policyDigest: digest,
    errors,
    summary: {
      taskId: input.policy.task,
      maturity: input.policy.maturity,
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      canonicalNotificationRoutes: notificationCounts.routes,
      canonicalNotificationSchemas: notificationCounts.schemas,
      canonicalSyncRoutes: syncCounts.routes,
      canonicalSyncSchemas: syncCounts.schemas,
      canonicalSupportRoutes: supportCounts.routes,
      canonicalSupportSchemas: supportCounts.schemas,
      canonicalEvents: eventCounts.events,
      asyncApiOperations: eventCounts.operations,
      asyncApiReceives: eventCounts.receives,
      b26: 'STATIC_ONLY_PENDING_NO_GO',
    },
  };
}

function safeSourcePath(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) return undefined;
  const resolved = path.resolve(root, relative);
  const rel = path.relative(root, resolved);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? resolved : undefined;
}

function readJsonSource(root, relative, label, errors) {
  const absolute = safeSourcePath(root, relative);
  if (!absolute || !existsSync(absolute)) {
    errors.push(`${label} source is missing or escapes repository: ${relative ?? '<missing>'}`);
    return undefined;
  }
  try { return JSON.parse(readFileSync(absolute, 'utf8')); } catch (error) {
    errors.push(`${label} JSON read failed: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

export function readNotificationSyncSupportContractInputs({ root = DEFAULT_ROOT, policyPath = DEFAULT_POLICY_PATH } = {}) {
  const readErrors = [];
  const policy = readJsonSource(root, policyPath, 'M1-016 policy', readErrors);
  const sources = policy?.canonicalSources ?? {};
  const source = (name, fallback) => sources[name] ?? fallback;
  const canonicalOpenApi = readJsonSource(root, DEFAULT_CANONICAL_OPENAPI, 'merged OpenAPI', readErrors);
  const eventCatalog = readJsonSource(root, source('eventCatalog', DEFAULT_EVENT_CATALOG), 'event catalog', readErrors);
  const b26Runtime = readJsonSource(root, DEFAULT_B26_RUNTIME, 'B26 runtime boundary', readErrors);
  const b12OpenApi = readJsonSource(root, source('canonicalNotificationOpenApiFamily', 'packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json'), 'B12 OpenAPI', readErrors);
  const b11OpenApi = readJsonSource(root, source('historicalNotificationOpenApi', 'packages/contracts/fragments/b11/b11-media-notification-offline.openapi.json'), 'B11 OpenAPI', readErrors);
  const b5OpenApi = readJsonSource(root, source('historicalLearnerSupportOpenApi', 'packages/contracts/fragments/b5-commerce-admin.openapi.json'), 'B5 OpenAPI', readErrors);
  const b13OpenApi = readJsonSource(root, source('historicalAdminSupportOpenApi', 'packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json'), 'B13 OpenAPI', readErrors);
  const gatewayBoundary = readJsonSource(root, source('gatewayBoundary', 'packages/contracts/fragments/p1r-gateway-boundary.openapi.json'), 'Gateway boundary', readErrors);
  const eventFragmentPath = source('canonicalEventFragment', 'packages/contracts/events/v1/fragments/m1-016-notification-sync-support-v2.events.json');
  const eventFragment = readJsonSource(root, eventFragmentPath, 'M1-016 v2 event fragment', readErrors);
  return { policy, canonicalOpenApi, eventCatalog, b26Runtime, gatewayBoundary, b12OpenApi, b11OpenApi, b5OpenApi, b13OpenApi, eventFragment, readErrors };
}

export function validateNotificationSyncSupportContractFiles(options = {}) {
  const input = readNotificationSyncSupportContractInputs(options);
  const report = validateNotificationSyncSupportContractData(input);
  const errors = [...input.readErrors, ...report.errors];
  return { ...report, result: errors.length === 0 ? 'PASS' : 'FAIL', errors };
}

export const validateNotificationSyncSupportContract = validateNotificationSyncSupportContractFiles;

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') { options.json = true; continue; }
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    if (arg === '--policy') {
      const value = argv[++index];
      if (!value) return { error: '--policy requires a path' };
      options.policyPath = value;
      continue;
    }
    return { error: `unknown argument: ${arg}` };
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const options = parseCli(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/audit/p1r-notification-sync-support-contract-check.mjs [--json] [--policy <path>]');
    process.exit(0);
  }
  if (options.error) {
    console.log(JSON.stringify({ result: 'FAIL', runtimeStatus: 'NOT_RUNTIME_VERIFIED', errors: [options.error] }, null, 2));
    process.exit(1);
  }
  const report = validateNotificationSyncSupportContractFiles(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`P1R M1-016 notification/sync/support contract ${report.result} (runtimeStatus=${report.runtimeStatus}).`);
    for (const error of report.errors) console.error(`- ${error}`);
  }
  process.exit(report.result === 'PASS' ? 0 : 1);
}
