import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const DEFAULT_INPUT = path.join('packages', 'contracts', 'fragments', 'p1r-gateway-boundary.openapi.json');
const DEFAULT_CANONICAL = path.join('packages', 'contracts', 'openapi', 'v1', 'openapi.json');
const ROOT_EXTENSION = 'x-p1r-gateway-boundary';
const EXPECTED_PUBLIC_OPERATION_COUNT = 365;
const EXPECTED_INTERNAL_OPERATION_COUNT = 66;
// Plan wiring (2026-09-27): +3 internal reads (learner targets/pin,
// content placement-bank plan-items, learning plans current-view). The ensure
// op itself is public (same 365->394 drift line, no new failure).
// Ph2 placement bank (2026-09-27): +1 internal sealed-bank read
// (GET /internal/v1/content/placement-bank/sealed, owner content-service,
// consumer assessment-service, Gateway DENY). Route/execution counts unchanged.
// P4 demo loop (2026-09-26): 66 pre-existing rules + 7 owner-verified B3 skill
// reads (reading x3, grammar x2, writing x1, listening x1). The 56 baseline
// predates earlier rounds that added moderation/sync/deletion/export rules
// without rebasing; those owners still owe the M1-004 rebaseline.
// B3 interaction (2026-09-27): +1 reading/questions EXACT@850 (bound bank
// items become listable; route/execution counts move together, no new operation).
const EXPECTED_ROUTE_RULE_COUNT = 74;
// Execution targets are deliberately separate from the broad route-owner
// policy.  A route rule answers who is authoritative; an execution projection
// answers whether this exact, canonical public operation has a verified local
// controller target today.  The latter must never turn a coarse PREFIX rule
// into an arbitrary upstream proxy.
// P4 demo loop (2026-09-26): 210 pre-existing available + the same 7 skill
// reads moving unavailable -> available. Zero new operations (365 -> 393 public
// drift, iam-deletions frozen reason and M2-001 digest drift stay open).
// B3 interaction (2026-09-27): +1 available (reading/questions, bound bank
// items); plan and execution counts move together, no new operation.
// Plan wiring (2026-09-27): +1 available (learning plans:ensure inside the
// learning-domain rule; rules/plans counts unchanged).
// P1R-ADMIN-RISK (2026-09-28): +5 available (4 risk ops inside the existing
// admin-domain PREFIX rule + IAM locked-accounts inside iam-domain; rules/plans
// counts unchanged; target-plan digest line stays on its frozen drift).
const EXPECTED_EXECUTION_PLAN_COUNT = 74;
// R1-019: B25 POST /placement/start is no longer executed. 224 -> 223.
const EXPECTED_AVAILABLE_EXECUTION_OPERATION_COUNT = 223;
// This is a reviewed semantic binding for the finite M2-001 target table. It
// deliberately prevents a target from silently moving to a different, still
// valid controller method without a corresponding Gateway parity change.
export const FROZEN_EXECUTION_TARGET_PLAN_SHA256 = '4a8d20413d8b90792348c6ff8870464fb02c6bd547f279b4ac75610eb79b58cd';
const EXECUTION_POLICY_FIELDS = [
  'schemaVersion',
  'sourceOfTruth',
  'runtimeImplementationTask',
  'defaultExecutionStatus',
  'unknownRuleDecision',
  'unknownPathDecision',
  'unavailableOperationDecision',
  'legacyCoreApiFallback',
  'controllerEvidenceRequired',
  'configuredUriRequiredForUpstream',
  'runtimeStatus',
  'compatibilityPromotion',
];
const M2001_EXECUTION_TARGET_COMPATIBILITY_PROMOTION = Object.freeze({
  id: 'P1R-M2-001',
  sourceContractBaseline: '66246d5b4a68a988a9af4ece68a446640b123812',
  previousPromotion: 'P1R-M1-018',
  runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  scope: 'OPENAPI_GATEWAY_ROOT_AND_HEALTH_IDENTITY_ONLY',
  rootExtension: ROOT_EXTENSION,
});
const M2001_HEALTH_CONTRACT_PROMOTION = Object.freeze({
  taskId: 'P1R-M2-001',
  path: '/api/v1/health',
  method: 'GET',
  operationId: 'getHealth',
  canonicalSummary: '读取 API Gateway 健康状态',
  healthDataSchema: '#/components/schemas/HealthData',
  serviceConst: 'api-gateway',
  allowedCanonicalChanges: [
    'paths./api/v1/health.get.summary',
    'components.schemas.HealthData.properties.service.const',
  ],
  wireShapeExpansionAllowed: false,
});
const AUDIT_POLICY_FIELDS = [
  'required',
  'sink',
  'allowedFields',
  'boundedFields',
  'redactedFields',
  'clientAuthorityFactsPersisted',
  'durableRuntimeEvidenceRequired',
  'gatewayEnvelopeImplementationTask',
  'durableSinkImplementationTask',
  'durableEvidenceTask',
  'correlationGateTask',
];
const DIRECT_CONNECT_POLICY_FIELDS = [
  'externalTrafficGatewayOnly',
  'publicDomainServicePorts',
  'ingressNetworkPolicyRequired',
  'serviceCredentialsRequired',
  'gatewayInternalPathDenyIsSufficient',
  'runtimeProbeRequired',
  'failureDecision',
  'gatewayApplicationDenyTask',
  'networkPolicyImplementationTask',
  'runtimeEvidenceTask',
  'correlationGateTask',
  'stagingRevalidationTask',
];
const M2_RUNTIME_EVIDENCE_RESPONSIBILITY = Object.freeze({
  schemaVersion: '1.0.0',
  addendumId: 'M2-EVIDENCE-RESPONSIBILITY-2026-09-04',
  addendumPath: 'requirements/backlog/v2-phase1-rebaseline/execution/M2-EVIDENCE-RESPONSIBILITY-ADDENDUM-2026-09-04.md',
  effectiveDate: '2026-09-04',
  taskCountChanged: false,
  m2003DependsOn: ['P1R-M2-001', 'P1R-M2-002'],
  finalM2Standard: 'UNCHANGED',
  stagingRevalidationTask: 'P1R-M8-013',
  m2001AcceptanceBoundary: {
    requires: [
      'CANONICAL_ROUTE_CONTROLLER_PARITY',
      'REAL_GATEWAY_PROCESS',
      'REAL_IAM_JWKS',
      'REAL_REDIS_MULTI_PROCESS_RATE_LIMIT',
      'REAL_BROWSER_CORS_CSRF',
      'REAL_UPSTREAM_REWRITE',
      'AUTHORITY_HEADER_STRIPPING',
      'REQUEST_TRACE_PROPAGATION',
      'REDACTED_AUDIT_ENVELOPE',
      'APPLICATION_INTERNAL_PATH_DENY',
    ],
    doesNotClaim: [
      'DURABLE_AUDIT_SERVICE',
      'KUBERNETES_NETWORK_POLICY',
      'M2_END_TO_END_CORRELATION',
      'STAGING_NETWORK_REVALIDATION',
    ],
  },
  gapLifecycle: {
    allowedStatuses: ['OPEN', 'CLOSED'],
    closedRequires: ['evidenceManifestPath', 'evidenceCommit', 'reviewerDecision', 'closedAt'],
    requiredReviewerDecision: 'ACCEPT',
  },
});
const M2_RUNTIME_GAP_BASE_FIELDS = [
  'id',
  'status',
  'implementationOwnerTask',
  'evidenceOwnerTask',
  'finalGateTask',
  'description',
];
const M2_RUNTIME_GAP_CLOSURE_FIELDS = [
  'evidenceManifestPath',
  'evidenceCommit',
  'reviewerDecision',
  'closedAt',
];
const M2_RUNTIME_GAP_RESPONSIBILITY = Object.freeze({
  'M2-GW-CSRF': ['P1R-M2-001', 'P1R-M2-001', 'P1R-M2-010'],
  'M2-GW-PUBLIC-PATH': ['P1R-M2-001', 'P1R-M2-001', 'P1R-M2-010'],
  'M2-GW-RATE-LIMIT': ['P1R-M2-001', 'P1R-M2-001', 'P1R-M2-010'],
  'M2-GW-AUDIT': ['P1R-M2-006', 'P1R-M2-006', 'P1R-M2-010'],
  'M2-GW-DIRECT-CONNECT': ['P1R-M2-008', 'P1R-M2-008', 'P1R-M2-010'],
  'M2-GW-RUNTIME-EVIDENCE': ['P1R-M2-010', 'P1R-M2-010', 'P1R-M2-010'],
});
const EXECUTION_PLAN_FIELDS = ['ruleId', 'defaultStatus', 'defaultReason', 'projections'];
const EXECUTION_PROJECTION_FIELDS = [
  'projectionId',
  'status',
  'publicPathTemplate',
  'methods',
  'executionKind',
  'upstreamOwner',
  'targetUriConfig',
  'pathStrategy',
  'targetPathTemplate',
  'controllerEvidence',
];
const CONTROLLER_EVIDENCE_FIELDS = ['sourcePath', 'requestMapping'];
const EXECUTION_URI_CONFIG_BY_OWNER = {
  'api-gateway': 'GATEWAY_LOCAL_FORWARD',
  'iam-service': 'gateway.identity.iam-base-url',
  'learner-service': 'gateway.b14.service-base-urls.learner',
  'content-service': 'gateway.b14.service-base-urls.content',
  'learning-service': 'gateway.b14.service-base-urls.learning',
  'assessment-service': 'gateway.b14.service-base-urls.assessment',
  'media-service': 'gateway.b14.service-base-urls.media',
  'gamification-service': 'gateway.b14.service-base-urls.gamification',
  'social-service': 'gateway.b14.service-base-urls.social',
  'commerce-service': 'gateway.b14.service-base-urls.commerce',
  'notification-service': 'gateway.b12.notification-base-url',
  'analytics-service': 'gateway.b13.analytics-base-url',
  'admin-ops-service': 'gateway.b13.admin-ops-base-url',
  'workflow-service': 'gateway.workflow.workflow-base-url',
};
const EXPECTED_UNAVAILABLE_EXECUTION_REASONS = {
  'wechat-callback': 'commerce_provider_callback_signature_boundary_not_implemented',
  'alipay-callback': 'commerce_provider_callback_signature_boundary_not_implemented',
  'apple-notification': 'commerce_provider_callback_signature_boundary_not_implemented',
  'learning-content-snapshot': 'content_owner_controller_mapping_not_present',
  'speaking-recordings': 'canonical_media_owner_conflicts_with_current_learning_controller',
  'speaking-shadowing-completion': 'canonical_assessment_owner_conflicts_with_current_learning_controller',
  'iam-account-deletions': 'iam_owner_controller_mapping_not_present',
  'privacy-exports': 'learner_owner_plural_export_controller_mapping_not_present',
  'sync-domain': 'canonical_learning_owner_conflicts_with_current_notification_controller',
  'exam-domain': 'assessment_owner_controller_mapping_not_present',
  'grammar-domain': 'canonical_assessment_owner_conflicts_with_current_learning_or_content_controller',
  'listening-domain': 'canonical_assessment_owner_conflicts_with_current_learning_or_content_controller',
  'reading-domain': 'canonical_assessment_owner_conflicts_with_current_learning_or_content_controller',
  'writing-domain': 'canonical_assessment_owner_conflicts_with_current_learning_or_content_controller',
  'phonetics-domain': 'canonical_assessment_owner_conflicts_with_current_content_controller',
  'speaking-domain': 'canonical_assessment_owner_conflicts_with_current_learning_controller',
  'multimodal-domain': 'media_owner_controller_mapping_not_present',
  'messages-domain': 'canonical_notification_owner_method_mapping_not_present',
  'data-reliability-domain': 'workflow_owner_has_no_configured_gateway_target',
  'release-domain': 'workflow_owner_has_no_configured_gateway_target',
  'quality-domain': 'admin_ops_owner_controller_mapping_not_present',
};
const EXPECTED_M1015_INTERNAL_OPERATIONS = [
  {
    route: '/internal/v1/commerce/entitlements/{entitlementId}/snapshot',
    method: 'POST',
    operationId: 'resolveM1015CommerceEntitlementSnapshot',
    owner: 'commerce-service',
    security: [{ B8WorkloadIdentity: [] }],
    authorization: {
      defaultDecision: 'DENY',
      requiredPermission: 'commerce.entitlement.snapshot.read.workload',
      allowedActors: ['WORKLOAD'],
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/internal/v1/commerce/entitlements/{entitlementId}/revoke',
    method: 'POST',
    operationId: 'revokeM1015CommerceEntitlement',
    owner: 'commerce-service',
    security: [{ B8WorkloadIdentity: [] }],
    authorization: {
      defaultDecision: 'DENY',
      requiredPermission: 'commerce.entitlement.revoke.finance',
      allowedActors: ['WORKLOAD', 'FINANCE'],
      clientAuthority: 'NONE',
    },
  },
];
const EXPECTED_M1016_INTERNAL_OPERATIONS = [
  {
    route: '/internal/v1/notifications/retry',
    method: 'POST',
    operationId: 'retryM1016NotificationDelivery',
    owner: 'notification-service',
    permission: 'notification.delivery.retry.workload',
    security: [{ B8WorkloadIdentity: [] }],
    contract: {
      task: 'P1R-M1-016',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE; notification, attempt and delivery state are server-derived',
    },
    authorization: {
      defaultDecision: 'DENY',
      requiredPermission: 'notification.delivery.retry.workload',
      pep: 'notification-service-local',
      allowedActors: ['WORKLOAD'],
      trustedFacts: ['workloadIdentity', 'sourceService', 'notificationId', 'workflowTaskId', 'policyVersion'],
      clientAuthority: 'NONE for subject, tenant, owner, attempt, status or next run time',
    },
  },
  {
    route: '/internal/v1/notifications/recovery',
    method: 'POST',
    operationId: 'recoverM1016NotificationDelivery',
    owner: 'notification-service',
    permission: 'notification.delivery.recovery.workload',
    security: [{ B8WorkloadIdentity: [] }],
    contract: {
      task: 'P1R-M1-016',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE; task state, notification ownership and recovery result are server-derived',
    },
    authorization: {
      defaultDecision: 'DENY',
      requiredPermission: 'notification.delivery.recovery.workload',
      pep: 'notification-service-local',
      allowedActors: ['WORKLOAD'],
      trustedFacts: ['workloadIdentity', 'sourceService', 'notificationId', 'workflowTaskId', 'policyVersion'],
      clientAuthority: 'NONE for subject, tenant, owner, delivery state or recovery receipt',
    },
  },
];
const EXPECTED_M1017_PUBLIC_OPERATIONS = [
  {
    route: '/api/v1/analytics/telemetry',
    method: 'POST',
    operationId: 'ingestM1017AnalyticsTelemetry',
    owner: 'analytics-service',
    dataOwner: 'analytics-service',
    security: [{ bearerAuth: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      defaultDecision: 'DENY',
      requiredPermission: 'analytics.telemetry.ingest',
      pep: 'analytics-service-local',
      allowedActors: ['AUTHENTICATED_LEARNER'],
      trustedFacts: ['subject', 'tenant', 'consent', 'deletionStatus', 'policyVersion'],
      clientAuthority: 'NONE',
    },
    permission: 'analytics.telemetry.ingest',
  },
  {
    route: '/api/v1/privacy/exports',
    method: 'POST',
    operationId: 'createM1017PrivacyExport',
    owner: 'learner-service.privacy',
    security: [{ bearerAuth: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'privacy.export.self',
      defaultDecision: 'DENY',
      trustedFacts: ['verifiedPrincipal', 'serverDerivedTenant', 'reauthentication', 'consent', 'resourceOwner', 'policyVersion'],
      resourceOwner: 'server-derived authenticated subject',
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/api/v1/privacy/exports/{exportId}',
    method: 'GET',
    operationId: 'getM1017PrivacyExportStatus',
    owner: 'learner-service.privacy',
    security: [{ bearerAuth: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'privacy.export.self.read',
      defaultDecision: 'DENY',
      trustedFacts: ['verifiedPrincipal', 'serverDerivedTenant', 'resourceOwner', 'policyVersion'],
      resourceOwner: 'server-derived export subject',
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/api/v1/privacy/exports/{exportId}/download',
    method: 'POST',
    operationId: 'createM1017PrivacyExportDownloadGrant',
    owner: 'learner-service.privacy',
    security: [{ bearerAuth: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'privacy.export.self.download',
      defaultDecision: 'DENY',
      trustedFacts: ['verifiedPrincipal', 'serverDerivedTenant', 'reauthentication', 'resourceOwner', 'exportExpiry', 'policyVersion'],
      resourceOwner: 'server-derived export subject',
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/api/v1/privacy/exports/{exportId}/receipt',
    method: 'GET',
    operationId: 'getM1017PrivacyExportReceipt',
    owner: 'learner-service.privacy',
    security: [{ bearerAuth: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'privacy.export.self.receipt.read',
      defaultDecision: 'DENY',
      trustedFacts: ['verifiedPrincipal', 'serverDerivedTenant', 'resourceOwner', 'policyVersion'],
      resourceOwner: 'server-derived export subject',
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/api/v1/iam/account-deletions',
    method: 'POST',
    operationId: 'createM1017AccountDeletionRequest',
    owner: 'iam-service',
    security: [{ bearerAuth: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'iam.account.deletion.self',
      defaultDecision: 'DENY',
      trustedFacts: ['verifiedPrincipal', 'serverDerivedTenant', 'reauthentication', 'consent', 'resourceOwner', 'policyVersion'],
      resourceOwner: 'server-derived authenticated subject',
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/api/v1/iam/account-deletions/{deletionRequestId}',
    method: 'GET',
    operationId: 'getM1017AccountDeletionStatus',
    owner: 'iam-service',
    security: [{ bearerAuth: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'iam.account.deletion.self.read',
      defaultDecision: 'DENY',
      trustedFacts: ['verifiedPrincipal', 'serverDerivedTenant', 'resourceOwner', 'policyVersion'],
      resourceOwner: 'server-derived deletion request subject',
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/api/v1/iam/account-deletions/{deletionRequestId}/cancel',
    method: 'POST',
    operationId: 'cancelM1017AccountDeletionRequest',
    owner: 'iam-service',
    security: [{ bearerAuth: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'iam.account.deletion.self.cancel',
      defaultDecision: 'DENY',
      trustedFacts: ['verifiedPrincipal', 'serverDerivedTenant', 'reauthentication', 'resourceOwner', 'coolingOffWindow', 'policyVersion'],
      resourceOwner: 'server-derived deletion request subject',
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
];
const EXPECTED_M1017_INTERNAL_OPERATIONS = [
  {
    route: '/internal/v1/privacy/exports/{exportId}/owner-receipts',
    method: 'POST',
    operationId: 'recordM1017PrivacyExportOwnerReceipt',
    owner: 'learner-service.privacy',
    security: [{ B8ServiceIdentity: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'privacy.export.owner-receipt.write',
      defaultDecision: 'DENY',
      trustedFacts: ['trustedWorkloadIdentity', 'serverDerivedOwnerService', 'serverDerivedTenant', 'pathExportId', 'policyVersion'],
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/internal/v1/privacy/exports/{exportId}/recovery',
    method: 'POST',
    operationId: 'recoverM1017PrivacyExport',
    owner: 'learner-service.privacy',
    security: [{ B8ServiceIdentity: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'privacy.export.recovery.execute',
      defaultDecision: 'DENY',
      trustedFacts: ['trustedWorkloadIdentity', 'serverDerivedTenant', 'pathExportId', 'recoveryTask', 'policyVersion'],
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/internal/v1/iam/account-deletions/{deletionRequestId}/execute',
    method: 'POST',
    operationId: 'executeM1017AccountDeletion',
    owner: 'iam-service',
    security: [{ B8ServiceIdentity: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'iam.account.deletion.execute',
      defaultDecision: 'DENY',
      trustedFacts: ['trustedWorkloadIdentity', 'serverDerivedTenant', 'pathDeletionRequestId', 'dueCoolingOffWindow', 'legalHoldDecision', 'policyVersion'],
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/internal/v1/iam/account-deletions/{deletionRequestId}/owner-receipts',
    method: 'POST',
    operationId: 'recordM1017AccountDeletionOwnerReceipt',
    owner: 'iam-service',
    security: [{ B8ServiceIdentity: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'iam.account.deletion.owner-receipt.write',
      defaultDecision: 'DENY',
      trustedFacts: ['trustedWorkloadIdentity', 'serverDerivedOwnerService', 'serverDerivedTenant', 'pathDeletionRequestId', 'legalHoldDecision', 'policyVersion'],
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/internal/v1/iam/account-deletions/{deletionRequestId}/recovery',
    method: 'POST',
    operationId: 'recoverM1017AccountDeletion',
    owner: 'iam-service',
    security: [{ B8ServiceIdentity: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      requiredPermission: 'iam.account.deletion.recovery.execute',
      defaultDecision: 'DENY',
      trustedFacts: ['trustedWorkloadIdentity', 'serverDerivedTenant', 'pathDeletionRequestId', 'recoveryTask', 'legalHoldDecision', 'policyVersion'],
      serviceSidePepRequired: true,
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/internal/v1/audit/exports',
    method: 'POST',
    operationId: 'createM1017AuditExport',
    owner: 'audit-service',
    dataOwner: 'audit-service',
    permission: 'audit.export.create',
    security: [{ B8WorkloadIdentity: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      defaultDecision: 'DENY',
      requiredPermission: 'audit.export.create',
      pep: 'audit-service-local',
      allowedActors: ['ADMIN_OPS_SERVICE', 'WORKFLOW_SERVICE'],
      trustedFacts: ['workloadIdentity', 'subject', 'tenant', 'roles', 'permissions', 'policyVersion', 'resourceOwner'],
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/internal/v1/audit/exports/{exportId}',
    method: 'GET',
    operationId: 'getM1017AuditExport',
    owner: 'audit-service',
    dataOwner: 'audit-service',
    permission: 'audit.export.read',
    security: [{ B8WorkloadIdentity: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      defaultDecision: 'DENY',
      requiredPermission: 'audit.export.read',
      pep: 'audit-service-local',
      allowedActors: ['ADMIN_OPS_SERVICE', 'WORKFLOW_SERVICE'],
      trustedFacts: ['workloadIdentity', 'subject', 'tenant', 'roles', 'permissions', 'policyVersion', 'resourceOwner'],
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/internal/v1/audit/exports/{exportId}/download',
    method: 'POST',
    operationId: 'requestM1017AuditExportDownload',
    owner: 'audit-service',
    dataOwner: 'audit-service',
    permission: 'audit.export.download',
    security: [{ B8WorkloadIdentity: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      defaultDecision: 'DENY',
      requiredPermission: 'audit.export.download',
      pep: 'audit-service-local',
      allowedActors: ['ADMIN_OPS_SERVICE', 'WORKFLOW_SERVICE'],
      trustedFacts: ['workloadIdentity', 'subject', 'tenant', 'roles', 'permissions', 'policyVersion', 'resourceOwner'],
      clientAuthority: 'NONE',
    },
  },
  {
    route: '/internal/v1/audit/exports/{exportId}/recovery',
    method: 'POST',
    operationId: 'recoverM1017AuditExport',
    owner: 'audit-service',
    dataOwner: 'audit-service',
    permission: 'audit.export.recover',
    security: [{ B8WorkloadIdentity: [] }],
    contract: {
      task: 'P1R-M1-017',
      canonical: true,
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      clientAuthority: 'NONE',
    },
    authorization: {
      defaultDecision: 'DENY',
      requiredPermission: 'audit.export.recover',
      pep: 'audit-service-local',
      allowedActors: ['WORKFLOW_SERVICE'],
      trustedFacts: ['workloadIdentity', 'subject', 'tenant', 'roles', 'permissions', 'policyVersion', 'resourceOwner'],
      clientAuthority: 'NONE',
    },
  },
];
const EXPECTED_M1017_ROUTE_RULES = [
  {
    ruleId: 'analytics-telemetry',
    priority: 800,
    match: {
      type: 'EXACT',
      path: '/api/v1/analytics/telemetry',
      methods: ['POST'],
    },
    upstreamOwner: 'analytics-service',
    internalTargetClass: 'INTERNAL_V1',
    visibility: 'AUTHENTICATED',
    authClass: 'AUTHENTICATED_WRITE',
    compatibilityMode: 'NONE',
  },
  {
    ruleId: 'iam-account-deletions',
    priority: 800,
    match: {
      type: 'PREFIX',
      path: '/api/v1/iam/account-deletions',
      methods: ['GET', 'POST'],
    },
    upstreamOwner: 'iam-service',
    internalTargetClass: 'INTERNAL_V1',
    visibility: 'AUTHENTICATED',
    authClass: 'AUTHENTICATED_WRITE',
    compatibilityMode: 'NONE',
  },
  {
    ruleId: 'privacy-exports',
    priority: 800,
    match: {
      type: 'PREFIX',
      path: '/api/v1/privacy/exports',
      methods: ['GET', 'POST'],
    },
    upstreamOwner: 'learner-service',
    internalTargetClass: 'INTERNAL_V1',
    visibility: 'AUTHENTICATED',
    authClass: 'AUTHENTICATED_WRITE',
    compatibilityMode: 'NONE',
  },
];
const EXPECTED_CONTENT_TASK_RULE = {
  ruleId: 'admin-content-publish-tasks',
  priority: 800,
  match: {
    type: 'PREFIX',
    path: '/api/v1/admin/content-publish-tasks',
    methods: ['GET'],
  },
  upstreamOwner: 'content-service',
  internalTargetClass: 'INTERNAL_V1',
  visibility: 'AUTHENTICATED',
  authClass: 'HIGH_RISK_ADMIN',
  compatibilityMode: 'NONE',
};
const HTTP_METHODS = new Set(['get', 'put', 'post', 'patch', 'delete', 'head', 'options']);
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const REQUIRED_RULE_FIELDS = [
  'ruleId',
  'priority',
  'match',
  'upstreamOwner',
  'internalTargetClass',
  'visibility',
  'authClass',
  'compatibilityMode',
];
const REQUIRED_JWT_CLAIMS = ['iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti', 'token_type', 'scope'];
const REQUIRED_AUTH_CLASSES = [
  'PUBLIC_READ',
  'AUTH_REGISTER',
  'AUTH_LOGIN',
  'AUTH_REFRESH',
  'PASSWORD_RESET',
  'PROVIDER_CALLBACK',
  'AUTHENTICATED_READ',
  'AUTHENTICATED_WRITE',
  'HIGH_RISK_ADMIN',
];
const REQUIRED_ERROR_REFS = {
  401: '#/components/responses/ApiUnauthorized',
  403: '#/components/responses/ApiForbidden',
  429: '#/components/responses/ApiRateLimited',
  500: '#/components/responses/ApiInternalError',
  503: '#/components/responses/ApiServiceUnavailable',
  504: '#/components/responses/ApiGatewayTimeout',
};

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && expected.every((item) => actual.includes(item));
}

function hasAll(actual, expected) {
  return Array.isArray(actual) && expected.every((item) => actual.includes(item));
}

function operations(openApi, prefix) {
  if (!isRecord(openApi?.paths)) return [];
  const result = [];
  for (const [route, pathItem] of Object.entries(openApi.paths)) {
    if (!route.startsWith(`${prefix}/`)) continue;
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP_METHODS.has(method) || !isRecord(operation)) continue;
      result.push({ route, method: method.toUpperCase(), operation });
    }
  }
  return result;
}

function allOperations(openApi) {
  if (!isRecord(openApi?.paths)) return [];
  const result = [];
  for (const [route, pathItem] of Object.entries(openApi.paths)) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP_METHODS.has(method) || !isRecord(operation)) continue;
      result.push({ route, method: method.toUpperCase(), operation });
    }
  }
  return result;
}

function routeMatches(rule, route, method) {
  const match = rule?.match;
  if (!isRecord(match) || !Array.isArray(match.methods) || !match.methods.includes(method)) return false;
  if (match.type === 'EXACT') return route === match.path;
  if (match.type === 'PREFIX') return route === match.path || route.startsWith(`${match.path}/`);
  return false;
}

function highestRules(rules, route, method) {
  const matches = rules.filter((rule) => routeMatches(rule, route, method));
  if (matches.length === 0) return [];
  const priority = Math.max(...matches.map((rule) => rule.priority));
  return matches.filter((rule) => rule.priority === priority);
}

function hasOnlyKeys(value, allowedKeys) {
  return isRecord(value) && Object.keys(value).every((key) => allowedKeys.includes(key));
}

function hasExactKeys(value, requiredKeys) {
  return hasOnlyKeys(value, requiredKeys)
    && requiredKeys.every((key) => Object.hasOwn(value, key));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function executionTargetPlanDigest(policy) {
  return createHash('sha256').update(stableJson({
    executionTargetPolicy: policy?.executionTargetPolicy,
    routeExecutions: policy?.routeExecutions,
  })).digest('hex');
}

function uniqueStrings(values) {
  return Array.isArray(values) && values.every((value) => nonEmpty(value)) && new Set(values).size === values.length;
}

function templateParameters(template) {
  if (!nonEmpty(template)) return [];
  return [...template.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map((match) => match[1]);
}

function sameStringSet(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function sourcePathIsOwnedBy(owner, sourcePath) {
  return nonEmpty(sourcePath)
    && sourcePath.replace(/\\/g, '/').startsWith(`services/${owner}/`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function controllerAnnotationPaths(source, method) {
  const annotation = `@${method.slice(0, 1)}${method.slice(1).toLowerCase()}Mapping`;
  const paths = [];
  const pattern = new RegExp(
    `${escapeRegExp(annotation)}\\s*\\(\\s*(?:(?:path|value)\\s*=\\s*)?(?:\\{\\s*)?"([^"]+)"`,
    'g',
  );
  for (const match of source.matchAll(pattern)) {
    paths.push(match[1]);
  }
  if (new RegExp(`${escapeRegExp(annotation)}\\b(?!\\s*\\()`).test(source)
      || new RegExp(`${escapeRegExp(annotation)}\\s*\\(\\s*\\)`).test(source)) {
    paths.push('');
  }
  return paths;
}

function controllerPathTemplateMatches(actualPath, declaredPath) {
  const actualSegments = actualPath.split('/');
  const declaredSegments = declaredPath.split('/');
  return actualSegments.length === declaredSegments.length
    && actualSegments.every((segment, index) => {
      const declared = declaredSegments[index];
      return /^\{[A-Za-z][A-Za-z0-9]*\}$/.test(declared)
        ? segment.length > 0
        : segment === declared;
    });
}

function controllerDeclaresTargetMethod(source, requestMapping, targetPathTemplate, method) {
  const declaredPaths = [targetPathTemplate];
  if (targetPathTemplate === requestMapping) declaredPaths.push('');
  else if (targetPathTemplate.startsWith(`${requestMapping}/`)) {
    declaredPaths.push(targetPathTemplate.slice(requestMapping.length));
  }
  const handlerPaths = controllerAnnotationPaths(source, method);
  return declaredPaths.some((declaredPath) => handlerPaths.some((handlerPath) => controllerPathTemplateMatches(declaredPath, handlerPath)));
}

function executionProjectionMatches(projection, operation) {
  return projection?.status === 'AVAILABLE'
    && projection.publicPathTemplate === operation.route
    && Array.isArray(projection.methods)
    && projection.methods.includes(operation.method);
}

function checkExecutionTargetPolicy(policy, errors) {
  const executionPolicy = policy.executionTargetPolicy;
  add(errors, isRecord(executionPolicy), 'Gateway executionTargetPolicy is required');
  if (!isRecord(executionPolicy)) return;
  add(errors, hasExactKeys(executionPolicy, EXECUTION_POLICY_FIELDS), 'Gateway executionTargetPolicy must contain exactly the frozen fields');
  add(errors, executionPolicy.schemaVersion === '1.0.0', 'Gateway execution target policy schemaVersion must be 1.0.0');
  add(errors, executionPolicy.sourceOfTruth === 'routeExecutions', 'Gateway execution target policy source must be routeExecutions');
  add(errors, executionPolicy.runtimeImplementationTask === 'P1R-M2-001', 'Gateway execution target policy must remain owned by M2-001');
  add(errors, executionPolicy.defaultExecutionStatus === 'UNAVAILABLE', 'Gateway execution target policy must default to UNAVAILABLE');
  add(errors, executionPolicy.unknownRuleDecision === 'DENY' && executionPolicy.unknownPathDecision === 'DENY' && executionPolicy.unavailableOperationDecision === 'DENY', 'Gateway execution target policy must deny unknown or unavailable operations');
  add(errors, executionPolicy.legacyCoreApiFallback === 'FORBIDDEN', 'Gateway execution target policy must forbid core-api fallback');
  add(errors, executionPolicy.controllerEvidenceRequired === true && executionPolicy.configuredUriRequiredForUpstream === true, 'Gateway execution target policy must require controller evidence and configured upstream URI');
  add(errors, executionPolicy.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'Gateway execution target policy must not promote runtime verification');
  add(errors, stableJson(executionPolicy.compatibilityPromotion) === stableJson(M2001_EXECUTION_TARGET_COMPATIBILITY_PROMOTION), 'Gateway compatibility promotion must remain the frozen M2-001 root-and-health-identity-only allowance');
}

function checkControllerEvidence(projection, sourceRoot, errors) {
  const evidence = projection.controllerEvidence;
  add(errors, hasExactKeys(evidence, CONTROLLER_EVIDENCE_FIELDS), `Gateway execution controller evidence must contain exactly the frozen fields: ${projection.projectionId ?? '<unknown>'}`);
  add(errors, nonEmpty(evidence?.sourcePath) && nonEmpty(evidence?.requestMapping), `Gateway execution controller evidence is incomplete: ${projection.projectionId ?? '<unknown>'}`);
  if (!nonEmpty(evidence?.sourcePath) || !nonEmpty(evidence?.requestMapping)) return;
  add(errors, !path.isAbsolute(evidence.sourcePath) && !evidence.sourcePath.includes('..') && sourcePathIsOwnedBy(projection.upstreamOwner, evidence.sourcePath), `Gateway execution controller evidence has an invalid owner source path: ${projection.projectionId}`);
  const resolved = path.resolve(sourceRoot, evidence.sourcePath);
  const relative = path.relative(sourceRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    errors.push(`Gateway execution controller evidence escapes the repository: ${projection.projectionId}`);
    return;
  }
  try {
    const source = fs.readFileSync(resolved, 'utf8');
    add(errors, source.includes(`\"${evidence.requestMapping}\"`), `Gateway execution controller mapping is not present in source: ${projection.projectionId}`);
    add(
      errors,
      (Array.isArray(projection.methods) ? projection.methods : []).every((method) => controllerDeclaresTargetMethod(
        source,
        evidence.requestMapping,
        projection.targetPathTemplate,
        method,
      )),
      `Gateway execution target is not declared by the evidenced controller: ${projection.projectionId}`,
    );
  } catch (error) {
    errors.push(`Gateway execution controller evidence cannot be read: ${projection.projectionId} (${error instanceof Error ? error.message : String(error)})`);
  }
  add(
    errors,
    projection.targetPathTemplate === evidence.requestMapping
      || projection.targetPathTemplate?.startsWith(`${evidence.requestMapping}/`) === true,
    `Gateway execution target path must remain under its controller mapping: ${projection.projectionId}`,
  );
}

function checkRouteExecutions(policy, canonicalOpenApi, ownerById, sourceRoot, errors) {
  const plans = Array.isArray(policy.routeExecutions) ? policy.routeExecutions : [];
  const rules = Array.isArray(policy.routeRules) ? policy.routeRules : [];
  const rulesById = new Map(rules.filter(isRecord).map((rule) => [rule.ruleId, rule]));
  add(errors, Array.isArray(policy.routeExecutions) && plans.length === EXPECTED_EXECUTION_PLAN_COUNT, `Gateway route execution plan count must be ${EXPECTED_EXECUTION_PLAN_COUNT}`);
  const planByRuleId = new Map();
  const projectionIds = new Set();
  let declaredProjectionCount = 0;

  for (const plan of plans ?? []) {
    add(errors, hasExactKeys(plan, EXECUTION_PLAN_FIELDS), `Gateway route execution plan must contain exactly the frozen fields: ${plan?.ruleId ?? '<unknown>'}`);
    if (!isRecord(plan)) continue;
    add(errors, nonEmpty(plan.ruleId) && rulesById.has(plan.ruleId), `Gateway route execution plan references an unknown rule: ${plan.ruleId ?? '<unknown>'}`);
    if (!nonEmpty(plan.ruleId) || !rulesById.has(plan.ruleId)) continue;
    add(errors, !planByRuleId.has(plan.ruleId), `Gateway route execution plan is duplicated: ${plan.ruleId}`);
    planByRuleId.set(plan.ruleId, plan);
    add(errors, plan.defaultStatus === 'UNAVAILABLE' && nonEmpty(plan.defaultReason), `Gateway route execution plan must fail closed by default: ${plan.ruleId}`);
    add(errors, Array.isArray(plan.projections), `Gateway route execution projections are required: ${plan.ruleId}`);
    const expectedUnavailableReason = EXPECTED_UNAVAILABLE_EXECUTION_REASONS[plan.ruleId];
    const projections = Array.isArray(plan.projections) ? plan.projections : [];
    if (expectedUnavailableReason) {
      add(errors, projections.length === 0 && plan.defaultReason === expectedUnavailableReason, `Gateway unavailable execution rule is not frozen: ${plan.ruleId}`);
    } else {
      add(errors, projections.length > 0 && plan.defaultReason === 'no_exact_canonical_execution_target', `Gateway executable rule must retain only exact targets and an unavailable default: ${plan.ruleId}`);
    }

    const rule = rulesById.get(plan.ruleId);
    for (const projection of projections) {
      declaredProjectionCount += 1;
      add(errors, hasExactKeys(projection, EXECUTION_PROJECTION_FIELDS), `Gateway execution projection must contain exactly the frozen fields: ${projection?.projectionId ?? '<unknown>'}`);
      if (!isRecord(projection)) continue;
      add(errors, nonEmpty(projection.projectionId) && !projectionIds.has(projection.projectionId), `Gateway execution projection id is invalid or duplicated: ${projection.projectionId ?? '<unknown>'}`);
      if (nonEmpty(projection.projectionId)) projectionIds.add(projection.projectionId);
      add(errors, projection.status === 'AVAILABLE', `Gateway execution projection must be explicitly AVAILABLE: ${projection.projectionId ?? '<unknown>'}`);
      add(errors, nonEmpty(projection.publicPathTemplate) && !projection.publicPathTemplate.includes('*') && isRecord(canonicalOpenApi?.paths?.[projection.publicPathTemplate]), `Gateway execution projection must name one canonical exact public path: ${projection.projectionId ?? '<unknown>'}`);
      add(errors, uniqueStrings(projection.methods) && projection.methods.every((method) => method === method.toUpperCase() && HTTP_METHODS.has(method.toLowerCase())), `Gateway execution projection methods are invalid: ${projection.projectionId ?? '<unknown>'}`);
      const methods = Array.isArray(projection.methods) ? projection.methods : [];
      const matchedOperations = methods.map((method) => ({
        route: projection.publicPathTemplate,
        method,
        operation: canonicalOpenApi?.paths?.[projection.publicPathTemplate]?.[method.toLowerCase()],
      }));
      add(errors, matchedOperations.length > 0 && matchedOperations.every((item) => isRecord(item.operation)), `Gateway execution projection must only admit canonical public operations: ${projection.projectionId ?? '<unknown>'}`);
      for (const operation of matchedOperations) {
        const top = highestRules(rules, operation.route, operation.method);
        add(errors, top.length === 1 && top[0]?.ruleId === plan.ruleId, `Gateway execution projection crosses an owner rule boundary: ${projection.projectionId ?? '<unknown>'}`);
      }
      add(errors, projection.upstreamOwner === rule.upstreamOwner && ownerById.get(projection.upstreamOwner)?.publicRouteEligible === true && projection.upstreamOwner !== 'core-api', `Gateway execution projection upstream owner drifted: ${projection.projectionId ?? '<unknown>'}`);
      add(errors, nonEmpty(projection.targetPathTemplate) && projection.targetPathTemplate.startsWith('/') && !projection.targetPathTemplate.includes('*') && !projection.targetPathTemplate.includes('?') && !projection.targetPathTemplate.includes('#'), `Gateway execution target path is invalid: ${projection.projectionId ?? '<unknown>'}`);
      add(errors, sameStringSet(templateParameters(projection.publicPathTemplate), templateParameters(projection.targetPathTemplate)), `Gateway execution target path parameters drifted: ${projection.projectionId ?? '<unknown>'}`);
      const expectedUriConfig = EXECUTION_URI_CONFIG_BY_OWNER[projection.upstreamOwner];
      add(errors, projection.targetUriConfig === expectedUriConfig, `Gateway execution projection must use the configured owner URI: ${projection.projectionId ?? '<unknown>'}`);
      if (projection.executionKind === 'LOCAL') {
        add(errors, rule.upstreamOwner === 'api-gateway' && rule.internalTargetClass === 'GATEWAY_LOCAL' && projection.targetUriConfig === 'GATEWAY_LOCAL_FORWARD' && projection.pathStrategy === 'FORWARD_LOCAL', `Gateway local execution projection is invalid: ${projection.projectionId ?? '<unknown>'}`);
      } else {
        add(errors, projection.executionKind === 'UPSTREAM' && rule.upstreamOwner !== 'api-gateway' && rule.internalTargetClass === 'INTERNAL_V1', `Gateway upstream execution projection is invalid: ${projection.projectionId ?? '<unknown>'}`);
        add(errors, ['REWRITE_PATH', 'PRESERVE_PUBLIC_PATH'].includes(projection.pathStrategy), `Gateway upstream path strategy is invalid: ${projection.projectionId ?? '<unknown>'}`);
        if (projection.pathStrategy === 'REWRITE_PATH') add(errors, projection.targetPathTemplate.startsWith('/internal/v1/'), `Gateway rewritten target must use the internal prefix: ${projection.projectionId ?? '<unknown>'}`);
        if (projection.pathStrategy === 'PRESERVE_PUBLIC_PATH') add(errors, projection.targetPathTemplate === projection.publicPathTemplate, `Gateway preserved target path must equal the public canonical path: ${projection.projectionId ?? '<unknown>'}`);
      }
      checkControllerEvidence(projection, sourceRoot, errors);
    }
  }

  add(errors, planByRuleId.size === rulesById.size && [...rulesById.keys()].every((id) => planByRuleId.has(id)), 'Gateway execution plans must define every canonical route rule exactly once');
  const publicOperations = operations(canonicalOpenApi, policy.d2Boundary?.publicPrefix ?? '/api/v1');
  let availableOperationCount = 0;
  let unavailableOperationCount = 0;
  for (const operation of publicOperations) {
    const top = highestRules(rules, operation.route, operation.method);
    if (top.length !== 1) continue;
    const plan = planByRuleId.get(top[0].ruleId);
    const matches = (Array.isArray(plan?.projections) ? plan.projections : [])
      .filter((projection) => executionProjectionMatches(projection, operation));
    add(errors, matches.length <= 1, `Gateway execution target is ambiguous: ${operation.method} ${operation.route}`);
    if (matches.length === 1) availableOperationCount += 1;
    else {
      unavailableOperationCount += 1;
      add(errors, plan?.defaultStatus === 'UNAVAILABLE', `Gateway unavailable operation must not fall back upstream: ${operation.method} ${operation.route}`);
    }
  }
  add(errors, availableOperationCount === EXPECTED_AVAILABLE_EXECUTION_OPERATION_COUNT, `Gateway available execution operation count must be ${EXPECTED_AVAILABLE_EXECUTION_OPERATION_COUNT}, got ${availableOperationCount}`);
  return {
    planCount: planByRuleId.size,
    projectionCount: declaredProjectionCount,
    availableOperationCount,
    unavailableOperationCount,
  };
}

function checkDocumentRoot(document, errors) {
  add(errors, isRecord(document), 'Gateway policy fragment must be a JSON object');
  if (!isRecord(document)) return;
  add(errors, document.openapi === '3.1.0', 'Gateway policy fragment must declare OpenAPI 3.1.0');
  add(errors, isRecord(document.info) && nonEmpty(document.info.title) && nonEmpty(document.info.version), 'Gateway policy fragment must have title and version');
  add(errors, isRecord(document.paths) && Object.keys(document.paths).length === 0, 'Gateway policy fragment must not declare API paths');
  add(errors, isRecord(document[ROOT_EXTENSION]), `missing ${ROOT_EXTENSION}`);
  const allowedKeys = new Set(['openapi', 'info', 'paths', ROOT_EXTENSION]);
  add(errors, Object.keys(document).every((key) => allowedKeys.has(key)), 'Gateway policy fragment must keep x-p1r-gateway-boundary as its only business root extension');
}

function checkProjection(document, canonicalOpenApi, errors) {
  if (canonicalOpenApi === undefined) return false;
  add(errors, isRecord(canonicalOpenApi), 'canonical OpenAPI projection must be a JSON object');
  if (!isRecord(canonicalOpenApi)) return false;
  add(errors, isRecord(canonicalOpenApi[ROOT_EXTENSION]), `canonical OpenAPI must project ${ROOT_EXTENSION}`);
  if (!isRecord(canonicalOpenApi[ROOT_EXTENSION])) return false;
  add(errors, isDeepStrictEqual(canonicalOpenApi[ROOT_EXTENSION], document[ROOT_EXTENSION]), 'canonical Gateway policy projection must exactly equal the dedicated fragment source');
  return isDeepStrictEqual(canonicalOpenApi[ROOT_EXTENSION], document[ROOT_EXTENSION]);
}

function checkBoundary(policy, errors) {
  const source = policy.sourceOfTruth;
  add(errors, policy.schemaVersion === '1.1.0', 'Gateway policy schemaVersion must be 1.1.0');
  add(errors, source?.taskId === 'P1R-M1-004', 'Gateway policy source task must be P1R-M1-004');
  add(errors, source?.kind === 'D2_CONTRACT_ONLY', 'Gateway policy must remain D2_CONTRACT_ONLY');
  add(errors, source?.canonicalProjection === `#/${ROOT_EXTENSION}`, 'Gateway policy canonical projection pointer is invalid');
  add(errors, source?.runtimeImplementationTask === 'P1R-M2-001', 'Gateway runtime implementation must remain P1R-M2-001');
  const boundary = policy.d2Boundary;
  add(errors, boundary?.publicPrefix === '/api/v1' && boundary?.internalPrefix === '/internal/v1', 'Gateway public/internal prefixes are invalid');
  add(errors, boundary?.unknownPathDecision === 'DENY' && boundary?.unknownVersionDecision === 'DENY' && boundary?.equalPriorityDecision === 'DENY', 'Gateway route ambiguity and unknown paths must fail closed');
  add(errors, boundary?.runtimeCompletionClaimed === false, 'D2 policy must not claim runtime completion');
}

function checkServiceOwners(policy, errors) {
  const owners = policy.serviceOwners;
  add(errors, Array.isArray(owners) && owners.length >= 16, 'Gateway policy must declare the platform service owners');
  const ownerById = new Map();
  for (const owner of owners ?? []) {
    add(errors, isRecord(owner) && nonEmpty(owner.id), 'Gateway service owner id is required');
    if (!nonEmpty(owner?.id)) continue;
    add(errors, !ownerById.has(owner.id), `Gateway service owner is duplicated: ${owner.id}`);
    ownerById.set(owner.id, owner);
    add(errors, typeof owner.publicRouteEligible === 'boolean' && typeof owner.domainWritesAllowed === 'boolean', `Gateway service owner flags are invalid: ${owner.id}`);
  }
  for (const id of ['api-gateway', 'iam-service', 'learner-service', 'content-service', 'learning-service', 'assessment-service', 'media-service', 'gamification-service', 'social-service', 'commerce-service', 'notification-service', 'analytics-service', 'admin-ops-service', 'workflow-service', 'audit-service', 'core-api']) {
    add(errors, ownerById.has(id), `Gateway service owner is missing: ${id}`);
  }
  add(errors, ownerById.get('api-gateway')?.domainWritesAllowed === false, 'api-gateway must not own domain writes');
  add(errors, ownerById.get('core-api')?.compatibilityOnly === true && ownerById.get('core-api')?.publicRouteEligible === false && ownerById.get('core-api')?.domainWritesAllowed === false, 'core-api must remain compatibility-only and cannot own public domain writes');
  add(errors, ownerById.get('audit-service')?.publicRouteEligible === false && ownerById.get('audit-service')?.domainWritesAllowed === false, 'audit-service must not own public routes or domain writes');
  return ownerById;
}

function checkRouteRules(policy, canonicalOpenApi, ownerById, errors) {
  const rules = policy.routeRules;
  add(errors, Array.isArray(rules) && rules.length > 0, 'Gateway routeRules are required');
  add(errors, rules?.length === EXPECTED_ROUTE_RULE_COUNT, `Gateway routeRule count must be ${EXPECTED_ROUTE_RULE_COUNT}`);
  const ids = new Set();
  for (const rule of rules ?? []) {
    for (const field of REQUIRED_RULE_FIELDS) add(errors, Object.hasOwn(rule ?? {}, field), `Gateway route rule lacks ${field}`);
    if (!isRecord(rule)) continue;
    add(errors, nonEmpty(rule.ruleId), 'Gateway route ruleId is required');
    if (nonEmpty(rule.ruleId)) {
      add(errors, !ids.has(rule.ruleId), `Gateway route rule is duplicated: ${rule.ruleId}`);
      ids.add(rule.ruleId);
    }
    add(errors, Number.isInteger(rule.priority) && rule.priority >= 0, `Gateway route rule priority is invalid: ${rule.ruleId ?? '<unknown>'}`);
    const match = rule.match;
    add(errors, isRecord(match) && ['EXACT', 'PREFIX'].includes(match.type) && nonEmpty(match.path), `Gateway route match is invalid: ${rule.ruleId ?? '<unknown>'}`);
    add(errors, Array.isArray(match?.methods) && match.methods.length > 0 && match.methods.every((method) => typeof method === 'string' && method === method.toUpperCase() && HTTP_METHODS.has(method.toLowerCase())), `Gateway route methods are invalid: ${rule.ruleId ?? '<unknown>'}`);
    add(errors, match?.path?.startsWith(`${policy.d2Boundary?.publicPrefix}/`) === true, `Gateway route rule must use the public prefix: ${rule.ruleId ?? '<unknown>'}`);
    const owner = ownerById.get(rule.upstreamOwner);
    add(errors, owner !== undefined, `Gateway route rule has unknown upstream owner: ${rule.upstreamOwner ?? '<unknown>'}`);
    add(errors, owner?.publicRouteEligible === true, `Gateway route rule upstream owner is not public-route eligible: ${rule.upstreamOwner ?? '<unknown>'}`);
    add(errors, ['GATEWAY_LOCAL', 'INTERNAL_V1'].includes(rule.internalTargetClass), `Gateway public route cannot target an internal-only or direct service class: ${rule.ruleId ?? '<unknown>'}`);
    add(errors, ['ANONYMOUS_PUBLIC', 'SIGNED_EXTERNAL_CALLBACK', 'AUTHENTICATED'].includes(rule.visibility), `Gateway route visibility is invalid: ${rule.ruleId ?? '<unknown>'}`);
    add(errors, REQUIRED_AUTH_CLASSES.includes(rule.authClass), `Gateway route auth class is invalid: ${rule.ruleId ?? '<unknown>'}`);
    add(errors, rule.compatibilityMode === 'NONE', `Gateway public route must not grant a core-api compatibility write path: ${rule.ruleId ?? '<unknown>'}`);
    const mayWrite = (match?.methods ?? []).some((method) => UNSAFE_METHODS.has(method));
    add(errors, !(rule.upstreamOwner === 'core-api' && mayWrite), `core-api write route is forbidden: ${rule.ruleId ?? '<unknown>'}`);
  }
  add(
    errors,
    isDeepStrictEqual((rules ?? []).find((rule) => rule?.ruleId === EXPECTED_CONTENT_TASK_RULE.ruleId), EXPECTED_CONTENT_TASK_RULE),
    'content publish task reads must remain an authenticated high-risk admin route owned by content-service',
  );
  for (const expectedRule of EXPECTED_M1017_ROUTE_RULES) {
    add(
      errors,
      isDeepStrictEqual(
        (rules ?? []).find((rule) => rule?.ruleId === expectedRule.ruleId),
        expectedRule,
      ),
      `M1-017 Gateway route rule is missing or not exact: ${expectedRule.ruleId}`,
    );
  }

  const publicOperations = operations(canonicalOpenApi, policy.d2Boundary?.publicPrefix ?? '/api/v1');
  add(errors, publicOperations.length === EXPECTED_PUBLIC_OPERATION_COUNT, `public operation baseline drift: expected ${EXPECTED_PUBLIC_OPERATION_COUNT}, got ${publicOperations.length}`);
  let covered = 0;
  let conflicts = 0;
  let coverageErrors = 0;
  for (const item of publicOperations) {
    const top = highestRules(rules ?? [], item.route, item.method);
    if (top.length === 1) {
      covered += 1;
      if (top[0].upstreamOwner === 'core-api' && UNSAFE_METHODS.has(item.method)) errors.push(`core-api write route is forbidden: ${item.method} ${item.route}`);
      if (!['GATEWAY_LOCAL', 'INTERNAL_V1'].includes(top[0].internalTargetClass)) errors.push(`public route targets an internal-only class: ${item.method} ${item.route}`);
      continue;
    }
    coverageErrors += 1;
    if (top.length === 0) errors.push(`public route has no owner rule: ${item.method} ${item.route}`);
    else {
      conflicts += 1;
      errors.push(`public route has equal-priority owner conflict: ${item.method} ${item.route} -> ${top.map((rule) => rule.ruleId).join(', ')}`);
    }
  }
  return { publicOperations, covered, conflicts, coverageErrors, ruleCount: rules?.length ?? 0 };
}

function checkM1017OperationSet(actualOperations, expectedOperations, scope, errors) {
  const expectedKeys = new Set(expectedOperations.map((expected) => `${expected.method} ${expected.route}`));
  const m1017Operations = actualOperations.filter((item) => item.operation?.['x-contract']?.task === 'P1R-M1-017');
  const actualKeys = new Set(m1017Operations.map((item) => `${item.method} ${item.route}`));
  add(errors, m1017Operations.length === expectedOperations.length && actualKeys.size === expectedKeys.size && [...expectedKeys].every((key) => actualKeys.has(key)), `M1-017 ${scope} operation set must exactly contain ${expectedOperations.length} canonical operations`);
  for (const expected of expectedOperations) {
    const operation = actualOperations.find((item) => item.route === expected.route && item.method === expected.method);
    const operationDocument = operation?.operation;
    add(errors, operationDocument?.operationId === expected.operationId && operationDocument?.['x-owner'] === expected.owner && operationDocument?.['x-data-owner'] === expected.dataOwner && isDeepStrictEqual(operationDocument?.['x-contract'], expected.contract), `expected M1-017 ${scope} operation is missing or has an invalid identity/owner: ${expected.method} ${expected.route}`);
    add(errors, isDeepStrictEqual(operationDocument?.security, expected.security), `M1-017 ${scope} operation security is invalid: ${expected.operationId}`);
    add(errors, operationDocument?.['x-permission'] === expected.permission, `M1-017 ${scope} operation permission is invalid: ${expected.operationId}`);
    add(errors, isDeepStrictEqual(operationDocument?.['x-authorization'], expected.authorization), `M1-017 ${scope} operation authorization is invalid or not fail-closed: ${expected.operationId}`);
  }
  return { m1017Operations };
}

function checkInternalPolicy(policy, canonicalOpenApi, errors) {
  const internal = policy.internalOperationPolicy;
  add(errors, internal?.pathPrefix === '/internal/v1', 'internal operation policy pathPrefix must be /internal/v1');
  add(errors, internal?.externalExposure === 'DENY' && internal?.externalCors === 'DENY', 'all internal operations must deny public exposure and CORS');
  add(errors, internal?.requiredCallerIdentity === 'VALIDATED_WORKLOAD_IDENTITY', 'internal operations must require validated workload identity');
  add(errors, internal?.networkIsolationRequired === true && internal?.applicationDenyIsSufficient === false, 'internal operations require network isolation beyond application denial');
  add(errors, internal?.baselineOperationCount === EXPECTED_INTERNAL_OPERATION_COUNT, `internal operation baseline must be ${EXPECTED_INTERNAL_OPERATION_COUNT}`);
  const internalOperations = operations(canonicalOpenApi, internal?.pathPrefix ?? '/internal/v1');
  add(errors, internalOperations.length === EXPECTED_INTERNAL_OPERATION_COUNT, `internal operation baseline drift: expected ${EXPECTED_INTERNAL_OPERATION_COUNT}, got ${internalOperations.length}`);
  const publicOperations = operations(canonicalOpenApi, policy.d2Boundary?.publicPrefix ?? '/api/v1');
  const expectedM1015Keys = new Set(EXPECTED_M1015_INTERNAL_OPERATIONS.map((expected) => `${expected.method} ${expected.route}`));
  const expectedM1015OperationIds = new Set(EXPECTED_M1015_INTERNAL_OPERATIONS.map((expected) => expected.operationId));
  const m1015Operations = internalOperations.filter((item) => expectedM1015OperationIds.has(item.operation?.operationId));
  const actualM1015Keys = new Set(m1015Operations.map((item) => `${item.method} ${item.route}`));
  add(
    errors,
    m1015Operations.length === EXPECTED_M1015_INTERNAL_OPERATIONS.length
      && actualM1015Keys.size === expectedM1015Keys.size
      && [...expectedM1015Keys].every((key) => actualM1015Keys.has(key)),
    'M1-015 internal operation set must exactly contain the canonical snapshot and revoke operations',
  );
  for (const expected of EXPECTED_M1015_INTERNAL_OPERATIONS) {
    const operation = internalOperations.find((item) => item.route === expected.route && item.method === expected.method);
    add(
      errors,
      operation?.operation?.operationId === expected.operationId
        && operation?.operation?.['x-owner'] === expected.owner
        && operation?.operation?.['x-contract']?.task === 'P1R-M1-015'
        && operation?.operation?.['x-contract']?.canonical === true,
      `expected M1-015 internal operation is missing or has an invalid identity: ${expected.method} ${expected.route}`,
    );
    add(errors, isDeepStrictEqual(operation?.operation?.security, expected.security), `M1-015 internal operation must use B8WorkloadIdentity: ${expected.operationId}`);
    const authorization = operation?.operation?.['x-authorization'];
    add(
      errors,
      authorization?.defaultDecision === expected.authorization.defaultDecision
        && authorization?.requiredPermission === expected.authorization.requiredPermission
        && exactArray(authorization?.allowedActors, expected.authorization.allowedActors)
        && authorization?.clientAuthority === expected.authorization.clientAuthority,
      `M1-015 internal operation authorization is invalid or not fail-closed: ${expected.operationId}`,
    );
    add(errors, !publicOperations.some((item) => item.operation?.operationId === expected.operationId), `M1-015 internal operation must not be exposed under the public prefix: ${expected.operationId}`);
  }
  const expectedM1016Keys = new Set(EXPECTED_M1016_INTERNAL_OPERATIONS.map((expected) => `${expected.method} ${expected.route}`));
  const expectedM1016OperationIds = new Set(EXPECTED_M1016_INTERNAL_OPERATIONS.map((expected) => expected.operationId));
  const m1016Operations = internalOperations.filter((item) => expectedM1016OperationIds.has(item.operation?.operationId));
  const actualM1016Keys = new Set(m1016Operations.map((item) => `${item.method} ${item.route}`));
  add(
    errors,
    m1016Operations.length === EXPECTED_M1016_INTERNAL_OPERATIONS.length
      && actualM1016Keys.size === expectedM1016Keys.size
      && [...expectedM1016Keys].every((key) => actualM1016Keys.has(key)),
    'M1-016 internal operation set must exactly contain the notification retry and recovery projections',
  );
  for (const expected of EXPECTED_M1016_INTERNAL_OPERATIONS) {
    const operation = internalOperations.find((item) => item.route === expected.route && item.method === expected.method);
    add(
      errors,
      operation?.operation?.operationId === expected.operationId
        && operation?.operation?.['x-owner'] === expected.owner
        && operation?.operation?.['x-permission'] === expected.permission
        && isDeepStrictEqual(operation?.operation?.['x-contract'], expected.contract),
      `expected M1-016 internal operation is missing or has an invalid identity: ${expected.method} ${expected.route}`,
    );
    add(errors, isDeepStrictEqual(operation?.operation?.security, expected.security), `M1-016 internal operation must use B8WorkloadIdentity: ${expected.operationId}`);
    add(errors, isDeepStrictEqual(operation?.operation?.['x-authorization'], expected.authorization), `M1-016 internal operation authorization is invalid or not fail-closed: ${expected.operationId}`);
    add(errors, !publicOperations.some((item) => item.operation?.operationId === expected.operationId), `M1-016 internal operation must not be exposed under the public prefix: ${expected.operationId}`);
  }
  checkM1017OperationSet(publicOperations, EXPECTED_M1017_PUBLIC_OPERATIONS, 'public', errors);
  checkM1017OperationSet(internalOperations, EXPECTED_M1017_INTERNAL_OPERATIONS, 'internal', errors);
  for (const expected of EXPECTED_M1017_INTERNAL_OPERATIONS) {
    add(errors, !publicOperations.some((item) => item.operation?.operationId === expected.operationId), `M1-017 internal operation must not be exposed under the public prefix: ${expected.operationId}`);
    const publicEquivalentRoute = expected.route.replace(/^\/internal\/v1\//, '/api/v1/');
    add(errors, !publicOperations.some((item) => item.route === publicEquivalentRoute && item.method === expected.method), `M1-017 internal operation route must not be exposed publicly: ${expected.method} ${expected.route}`);
  }
  return { internalOperations, denied: internal?.externalExposure === 'DENY' ? internalOperations.length : 0 };
}

function checkOriginsCsrfAndNative(policy, errors) {
  const profiles = policy.originProfiles;
  add(errors, isRecord(profiles), 'originProfiles are required');
  for (const id of ['LEARNER_WEB', 'ADMIN_WEB', 'MOBILE_H5']) {
    const profile = profiles?.[id];
    add(errors, profile?.originMatch === 'EXACT_ALLOWLIST' && profile?.credentials === true && profile?.wildcardAllowed === false && profile?.businessSession === true, `${id} must be a credentialed exact-origin profile without wildcard`);
    add(errors, nonEmpty(profile?.originSource), `${id} must name its deployment origin source`);
  }
  const official = profiles?.OFFICIAL_SITE;
  add(errors, official?.originMatch === 'EXACT_ALLOWLIST' && official?.credentials === false && official?.wildcardAllowed === false && official?.businessSession === false, 'OFFICIAL_SITE must remain a non-credentialed exact-origin profile');
  add(errors, official?.acceptsBusinessToken === false && official?.setCookieAllowed === false && exactArray(official?.allowedAuthClasses, ['PUBLIC_READ']), 'OFFICIAL_SITE must only expose public reads without business tokens or cookies');
  const csrf = policy.csrf;
  add(errors, csrf?.appliesToTransport === 'WEB_COOKIE', 'CSRF policy must apply to WEB_COOKIE');
  add(errors, exactArray(csrf?.unsafeMethods, ['POST', 'PUT', 'PATCH', 'DELETE']), 'CSRF unsafe method set is invalid');
  add(errors, csrf?.origin?.required === true && csrf?.origin?.match === 'EXACT_PROFILE_ALLOWLIST', 'CSRF must require an exact allowed Origin');
  add(errors, csrf?.refererFallback?.allowedOnlyWhenOriginAbsent === true && csrf?.refererFallback?.match === 'EXACT_ORIGIN_FROM_ABSOLUTE_URI', 'CSRF Referer fallback must be exact and only when Origin is absent');
  add(errors, csrf?.missingOrUntrustedSourceDecision === 'DENY' && csrf?.failureStatus === 403 && csrf?.failureResponse === '#/components/responses/ApiForbidden', 'CSRF failures must deny with canonical 403');
  const cookie = csrf?.cookie;
  add(errors, cookie?.name === 'yuxuexing_refresh' && cookie?.httpOnly === true && cookie?.secure === true && cookie?.sameSite === 'None' && cookie?.partitioned === true && cookie?.path === '/api/v1/auth', 'Web refresh cookie security attributes are invalid');
  add(errors, csrf?.synchronizerToken === 'NOT_REQUIRED_WHILE_EXACT_SOURCE_POLICY_IS_ENFORCED', 'CSRF policy must not silently replace its exact-source defense');
  const native = policy.nativeTransport;
  add(errors, native?.selector === 'X-Auth-Transport=NATIVE_SECURE_STORAGE' && native?.trustedClientAndDeviceContextCrossCheck === true, 'native transport must be explicit and server-cross-checked');
  add(errors, native?.cookieRequestAllowed === false && native?.setCookieResponseAllowed === false && native?.csrf === 'NOT_APPLICABLE_WITHOUT_COOKIE_CREDENTIALS', 'native transport must not use cookies or browser CSRF');
  add(errors, hasAll(native?.refreshStorage, ['KEYCHAIN', 'KEYSTORE']) && hasAll(native?.prohibitedStorage, ['LOCAL_STORAGE', 'SESSION_STORAGE', 'UNIAPP_STORAGE', 'PLAINTEXT_FALLBACK']), 'native refresh storage policy is incomplete');
  const nativeOrigin = profiles?.NATIVE;
  add(errors, nativeOrigin?.originMatch === 'NOT_APPLICABLE' && nativeOrigin?.authTransport === 'NATIVE_SECURE_STORAGE' && nativeOrigin?.cookieAllowed === false && nativeOrigin?.setCookieAllowed === false, 'NATIVE origin profile must not use browser cookies');
}

function checkJwtAndRatePolicy(policy, errors) {
  const jwt = policy.jwtPrecheck;
  add(errors, jwt?.algorithm === 'RS256' && jwt?.jwksRequired === true && jwt?.issuerRequired === true && jwt?.audience === 'yuxuexing-api', 'JWT precheck must require IAM RS256/JWKS/issuer/audience validation');
  add(errors, exactArray(jwt?.timeClaims, ['exp', 'iat', 'nbf']) && jwt?.tokenType === 'access' && exactArray(jwt?.requiredClaims, REQUIRED_JWT_CLAIMS), 'JWT time/type/claim requirements are incomplete');
  add(errors, jwt?.scopeOrPermissionRequired === true && jwt?.bearerHeaderPresenceIsAuthentication === false && jwt?.clientAuthorityHeadersTrusted === false && jwt?.gatewayReplacesServicePep === false && jwt?.failureMode === 'FAIL_CLOSED_401', 'JWT precheck must fail closed and cannot replace service PEP');
  add(errors, hasAll(jwt?.requiredForAuthClasses, ['AUTHENTICATED_READ', 'AUTHENTICATED_WRITE', 'HIGH_RISK_ADMIN']), 'JWT precheck must cover all protected route classes');
  add(errors, hasAll(jwt?.strippedAuthorityHeaders, ['X-B5-Role', 'X-Role', 'X-Tenant-Id', 'X-Owner-Id', 'X-Subject', 'X-Permissions']), 'Gateway must strip client authority headers');
  const policies = policy.rateLimitPolicies;
  add(errors, isRecord(policies), 'rateLimitPolicies are required');
  for (const authClass of REQUIRED_AUTH_CLASSES) {
    const rate = policies?.[authClass];
    add(errors, rate?.backend === 'DISTRIBUTED_REDIS' && nonEmpty(rate?.key), `rate-limit policy is missing for ${authClass}`);
    add(errors, rate?.exceededStatus === 429 && rate?.retryAfterRequired === true && rate?.backendFailure === 'FAIL_CLOSED_503', `rate-limit policy must return Retry-After 429 and fail-closed 503 for ${authClass}`);
  }
  const bindings = policy.routeClassBindings;
  add(errors, bindings?.source === 'routeRules[].authClass' && bindings?.allClassesRequireNamedPolicy === true && bindings?.unknownClassDecision === 'DENY', 'route class bindings must be source-backed and fail closed');
  add(errors, bindings?.defaultReadClass === 'AUTHENTICATED_READ' && bindings?.defaultWriteClass === 'AUTHENTICATED_WRITE' && bindings?.adminPrefixClass === 'HIGH_RISK_ADMIN', 'route class default bindings are invalid');
}

function checkGatewayHealthContract(policy, canonicalOpenApi, errors) {
  const promotion = policy.healthContractPromotion;
  add(errors, isRecord(promotion), 'Gateway health contract promotion is required');
  add(
    errors,
    stableJson(promotion) === stableJson(M2001_HEALTH_CONTRACT_PROMOTION),
    'Gateway health contract promotion must remain the exact M2-001 two-node identity correction',
  );
  const operation = canonicalOpenApi?.paths?.[M2001_HEALTH_CONTRACT_PROMOTION.path]?.get;
  add(
    errors,
    isRecord(operation)
      && operation.operationId === M2001_HEALTH_CONTRACT_PROMOTION.operationId
      && operation.summary === M2001_HEALTH_CONTRACT_PROMOTION.canonicalSummary,
    'Gateway health operation must retain getHealth with the canonical API Gateway summary',
  );
  const service = canonicalOpenApi?.components?.schemas?.HealthData?.properties?.service;
  add(
    errors,
    isRecord(service) && service.type === 'string' && service.const === M2001_HEALTH_CONTRACT_PROMOTION.serviceConst,
    'HealthData.service must remain the exact api-gateway identity',
  );
}

function checkEnvelopeAuditAndRuntimeGaps(policy, errors) {
  const correlation = policy.correlation;
  add(errors, correlation?.requestId?.header === 'X-Request-Id' && correlation?.requestId?.sanitizeAndBound === true && correlation?.requestId?.generateWhenMissingOrInvalid === true, 'requestId must be bounded and generated when unsafe');
  add(errors, correlation?.traceId?.header === 'X-Trace-Id' && correlation?.traceId?.sanitizeAndBound === true && correlation?.traceId?.generateWhenMissingOrInvalid === true, 'traceId must be bounded and generated when unsafe');
  add(errors, correlation?.traceparent?.standard === 'W3C' && correlation?.traceparent?.clientValueTrustedAsSecurityContext === false && exactArray(correlation?.responseHeadersRequired, ['X-Request-Id', 'X-Trace-Id']), 'traceparent must not establish security context and response correlation headers are required');
  const idempotency = policy.idempotency;
  add(errors, idempotency?.header === 'Idempotency-Key' && idempotency?.persistentWritesRequired === true && idempotency?.governanceSource === '#/x-p1r-api-governance/idempotency', 'Gateway idempotency policy must preserve canonical write semantics');
  add(errors, idempotency?.safeException?.method === 'POST' && idempotency?.safeException?.path === '/api/v1/content/media/{mediaAssetId}/signed-access' && idempotency?.safeException?.createsPersistentDomainFact === false, 'Gateway idempotency safe exception is invalid');
  for (const [status, expected] of Object.entries(REQUIRED_ERROR_REFS)) add(errors, policy.errors?.[status] === expected, `Gateway error ${status} must use ${expected}`);
  add(errors, policy.errors?.rateLimitedRetryAfterRequired === true && policy.errors?.authenticationAndAuthorizationDistinct === true, 'Gateway 401/403 distinction and 429 Retry-After are required');
  const audit = policy.audit;
  add(errors, hasExactKeys(audit, AUDIT_POLICY_FIELDS), 'Gateway audit policy must contain exactly the frozen responsibility fields');
  add(errors, audit?.required === true && audit?.sink === 'audit-service' && audit?.boundedFields === true && audit?.clientAuthorityFactsPersisted === false && audit?.durableRuntimeEvidenceRequired === true, 'Gateway audit policy must be bounded, redacted and durably evidenced');
  add(errors, hasAll(audit?.allowedFields, ['routeId', 'method', 'status', 'requestId', 'traceId', 'subjectHash', 'tenantHash', 'decision', 'reasonCode']) && hasAll(audit?.redactedFields, ['Authorization', 'Cookie', 'Set-Cookie', 'accessToken', 'refreshToken', 'password', 'requestBody', 'queryString']), 'Gateway audit allow-list/redaction is incomplete');
  add(
    errors,
    audit?.gatewayEnvelopeImplementationTask === 'P1R-M2-001'
      && audit?.durableSinkImplementationTask === 'P1R-M2-006'
      && audit?.durableEvidenceTask === 'P1R-M2-006'
      && audit?.correlationGateTask === 'P1R-M2-010',
    'Gateway audit responsibility must keep envelope in M2-001, durable evidence in M2-006 and correlation in M2-010',
  );
  const direct = policy.directConnect;
  add(errors, hasExactKeys(direct, DIRECT_CONNECT_POLICY_FIELDS), 'Gateway direct-connect policy must contain exactly the frozen responsibility fields');
  add(errors, direct?.externalTrafficGatewayOnly === true && direct?.publicDomainServicePorts === false && direct?.ingressNetworkPolicyRequired === true && direct?.serviceCredentialsRequired === true && direct?.gatewayInternalPathDenyIsSufficient === false && direct?.runtimeProbeRequired === true && direct?.failureDecision === 'DENY', 'Gateway direct-connect policy must deny public service access and require runtime network proof');
  add(
    errors,
    direct?.gatewayApplicationDenyTask === 'P1R-M2-001'
      && direct?.networkPolicyImplementationTask === 'P1R-M2-008'
      && direct?.runtimeEvidenceTask === 'P1R-M2-008'
      && direct?.correlationGateTask === 'P1R-M2-010'
      && direct?.stagingRevalidationTask === 'P1R-M8-013',
    'Gateway direct-connect responsibility must keep application deny in M2-001, NetworkPolicy evidence in M2-008, correlation in M2-010 and staging revalidation in M8-013',
  );
  const responsibility = policy.runtimeEvidenceResponsibility;
  add(errors, isRecord(responsibility), 'Gateway runtime Evidence responsibility addendum binding is required');
  add(
    errors,
    stableJson(responsibility) === stableJson(M2_RUNTIME_EVIDENCE_RESPONSIBILITY),
    'Gateway runtime Evidence responsibility must preserve the dated addendum, M2-003 dependency and unchanged final standard',
  );
  const gaps = policy.m2RuntimeGaps;
  const requiredGaps = Object.keys(M2_RUNTIME_GAP_RESPONSIBILITY);
  add(errors, Array.isArray(gaps) && gaps.length === requiredGaps.length, 'M2 Gateway runtime gaps are incomplete');
  const ids = new Set();
  for (const gap of Array.isArray(gaps) ? gaps : []) {
    add(errors, nonEmpty(gap?.id) && !ids.has(gap.id), `M2 Gateway runtime gap is invalid or duplicated: ${gap?.id ?? '<unknown>'}`);
    if (nonEmpty(gap?.id)) ids.add(gap.id);
    const expected = M2_RUNTIME_GAP_RESPONSIBILITY[gap?.id];
    add(errors, expected !== undefined, `M2 Gateway runtime gap is unknown: ${gap?.id ?? '<unknown>'}`);
    add(
      errors,
      expected !== undefined
        && gap?.implementationOwnerTask === expected[0]
        && gap?.evidenceOwnerTask === expected[1]
        && gap?.finalGateTask === expected[2],
      `M2 Gateway runtime gap responsibility drifted: ${gap?.id ?? '<unknown>'}`,
    );
    add(errors, nonEmpty(gap?.description), `M2 Gateway runtime gap description is required: ${gap?.id ?? '<unknown>'}`);
    add(errors, responsibility?.gapLifecycle?.allowedStatuses?.includes(gap?.status), `M2 Gateway runtime gap status is invalid: ${gap?.id ?? '<unknown>'}`);
    const expectedFields = gap?.status === 'CLOSED'
      ? [...M2_RUNTIME_GAP_BASE_FIELDS, ...M2_RUNTIME_GAP_CLOSURE_FIELDS]
      : M2_RUNTIME_GAP_BASE_FIELDS;
    add(errors, hasExactKeys(gap, expectedFields), `M2 Gateway runtime gap fields do not match lifecycle state: ${gap?.id ?? '<unknown>'}`);
    if (gap?.status === 'CLOSED') {
      add(
        errors,
        gap.evidenceManifestPath === `evidence/p1r/m2/${gap.evidenceOwnerTask}/manifest.json`,
        `M2 Gateway runtime gap closure manifest must belong to its evidence owner: ${gap?.id ?? '<unknown>'}`,
      );
      add(errors, /^[0-9a-f]{40}$/.test(gap.evidenceCommit ?? ''), `M2 Gateway runtime gap closure requires a full evidence commit SHA: ${gap?.id ?? '<unknown>'}`);
      add(errors, gap.reviewerDecision === responsibility?.gapLifecycle?.requiredReviewerDecision, `M2 Gateway runtime gap closure requires independent ACCEPT: ${gap?.id ?? '<unknown>'}`);
      add(errors, nonEmpty(gap.closedAt) && Number.isFinite(Date.parse(gap.closedAt)), `M2 Gateway runtime gap closure requires a valid timestamp: ${gap?.id ?? '<unknown>'}`);
    }
  }
  for (const id of requiredGaps) add(errors, ids.has(id), `M2 Gateway runtime gap is missing: ${id}`);
}

export function validateGatewayContractData({ document, canonicalOpenApi, root = process.cwd() } = {}) {
  const errors = [];
  checkDocumentRoot(document, errors);
  if (!isRecord(document) || !isRecord(document[ROOT_EXTENSION])) return { result: 'FAIL', errors, summary: {} };
  const projectionMatches = checkProjection(document, canonicalOpenApi, errors);
  const policy = document[ROOT_EXTENSION];
  checkBoundary(policy, errors);
  for (const item of allOperations(canonicalOpenApi)) {
    const publicPrefix = policy.d2Boundary?.publicPrefix ?? '/api/v1';
    const internalPrefix = policy.d2Boundary?.internalPrefix ?? '/internal/v1';
    const governed = item.route.startsWith(`${publicPrefix}/`) || item.route.startsWith(`${internalPrefix}/`);
    add(errors, governed, `canonical operation uses an ungoverned API prefix: ${item.method} ${item.route}`);
  }
  const owners = checkServiceOwners(policy, errors);
  const routeSummary = checkRouteRules(policy, canonicalOpenApi, owners, errors);
  checkExecutionTargetPolicy(policy, errors);
  const executionSummary = checkRouteExecutions(policy, canonicalOpenApi, owners, root, errors);
  const executionTargetDigest = executionTargetPlanDigest(policy);
  add(
    errors,
    FROZEN_EXECUTION_TARGET_PLAN_SHA256 !== 'PENDING_M2_001_EXECUTION_TARGET_PLAN_SHA256'
      && executionTargetDigest === FROZEN_EXECUTION_TARGET_PLAN_SHA256,
    'Gateway execution target plan digest drifted from the frozen M2-001 source binding',
  );
  const internalSummary = checkInternalPolicy(policy, canonicalOpenApi, errors);
  checkOriginsCsrfAndNative(policy, errors);
  checkJwtAndRatePolicy(policy, errors);
  checkGatewayHealthContract(policy, canonicalOpenApi, errors);
  checkEnvelopeAuditAndRuntimeGaps(policy, errors);
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
    summary: {
      routeRuleCount: routeSummary.ruleCount,
      publicOperationCount: routeSummary.publicOperations.length,
      coveredPublicOperationCount: routeSummary.covered,
      publicCoverageErrorCount: routeSummary.coverageErrors,
      executionPlanCount: executionSummary.planCount,
      executionProjectionCount: executionSummary.projectionCount,
      availableExecutionOperationCount: executionSummary.availableOperationCount,
      unavailableExecutionOperationCount: executionSummary.unavailableOperationCount,
      executionTargetPlanDigest: executionTargetDigest,
      internalOperationCount: internalSummary.internalOperations.length,
      externalDeniedInternalOperationCount: internalSummary.denied,
      canonicalProjectionMatches: projectionMatches,
    },
  };
}

export function validateGatewayContract({ root = process.cwd(), input, canonicalInput } = {}) {
  const inputPath = path.resolve(root, input ?? DEFAULT_INPUT);
  const canonicalPath = path.resolve(root, canonicalInput ?? DEFAULT_CANONICAL);
  try {
    const document = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const canonicalOpenApi = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
    return {
      input: path.relative(root, inputPath),
      canonicalInput: path.relative(root, canonicalPath),
      ...validateGatewayContractData({ document, canonicalOpenApi, root }),
    };
  } catch (error) {
    return {
      input: path.relative(root, inputPath),
      canonicalInput: path.relative(root, canonicalPath),
      result: 'FAIL',
      errors: [error instanceof Error ? error.message : String(error)],
      summary: {},
    };
  }
}

function cliInput(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--input' || value === '--canonical') {
      const next = argv[++index];
      if (!next || next.startsWith('--')) return { error: `${value} requires a JSON document path` };
      parsed[value.slice(2)] = next;
    } else if (value?.startsWith('--input=')) parsed.input = value.slice('--input='.length);
    else if (value?.startsWith('--canonical=')) parsed.canonical = value.slice('--canonical='.length);
    else if (value === '--help' || value === '-h') return { help: true };
    else return { error: `unknown argument: ${value}` };
  }
  return parsed;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const parsed = cliInput(process.argv.slice(2));
  if (parsed.help) {
    console.log('Usage: node scripts/audit/p1r-gateway-contract-check.mjs [--input <fragment.json>] [--canonical <openapi.json>]');
    process.exit(0);
  }
  if (parsed.error) {
    console.error(JSON.stringify({ result: 'FAIL', errors: [parsed.error], summary: {} }, null, 2));
    process.exit(1);
  }
  const report = validateGatewayContract({ input: parsed.input, canonicalInput: parsed.canonical });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === 'PASS' ? 0 : 1);
}
