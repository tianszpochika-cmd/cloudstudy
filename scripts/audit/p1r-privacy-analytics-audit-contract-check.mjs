import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePrivacyLifecycleContractFiles } from './p1r-privacy-lifecycle-contract-check.mjs';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = path.resolve(moduleDir, '../..');
export const POLICY_PATH = 'config/p1r-privacy-analytics-audit-contract.v1.json';

// This value is filled only after the complete M1-017 source projection has
// passed review. A pending value is a hard failure, never an opt-out.
export const FROZEN_POLICY_SHA256 = '05c0eafc6577fdfd64b3313a4746eb380bfad554f2f61ca32e47b55c2ee41e53';

const INPUT_PATHS = Object.freeze({
  policy: POLICY_PATH,
  privacyPolicy: 'config/p1r-privacy-lifecycle-contract.v1.json',
  analyticsPolicy: 'config/p1r-analytics-ingress.v1.json',
  auditPolicy: 'config/p1r-m1-017-audit-export.v1.json',
  privacyOpenApi: 'packages/contracts/fragments/m1-017-privacy-lifecycle.openapi.json',
  analyticsOpenApi: 'packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json',
  auditOpenApi: 'packages/contracts/fragments/m1-017-audit-export.openapi.json',
  legacyPrivacyOpenApi: 'packages/contracts/fragments/b1/b1-onboarding-privacy.openapi.json',
  gatewayOpenApi: 'packages/contracts/fragments/p1r-gateway-boundary.openapi.json',
  canonicalOpenApi: 'packages/contracts/openapi/v1/openapi.json',
  eventFragment: 'packages/contracts/events/v1/fragments/m1-017-privacy-deletion-v2.events.json',
  eventCatalog: 'packages/contracts/events/v1/catalog.json',
  b26: 'config/b26-event-runtime.json',
});

const EXPECTED_POLICY_KEYS = Object.freeze([
  '$schema', 'schemaVersion', 'task', 'phase', 'startCommit', 'sourceBaseline', 'maturity', 'runtimeStatus',
  'collectionPolicy', 'sourcePolicies', 'canonicalSources', 'compatibilityPromotion', 'canonicalOperations',
  'canonicalEvents', 'telemetryBoundary', 'gapBindings', 'runtimeBoundary',
]);

const EXPECTED_PROMOTION_KEYS = Object.freeze([
  'id', 'sourceContractBaseline', 'previousPromotion', 'previousPromotionContract', 'immutableGovernanceBaseline',
  'runtimeStatus', 'scope', 'promotionMode', 'allowsHistoricalV1Promotion', 'allowsDualPublish',
  'approvedSourceFiles', 'requiredCompatibilityChecks', 'b26StaticPolicy',
]);

const EXPECTED_EVENTS = Object.freeze({
  'privacy.export.requested.v2': Object.freeze({
    producer: 'learner-service', dataOwner: 'learner-service', topic: 'platform.learner.v1', aggregateIdSource: 'payload.exportId',
    consumers: Object.freeze([
      Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-learner.v1' }),
      Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-learner.v1' }),
    ]),
  }),
  'privacy.export.completed.v2': Object.freeze({
    producer: 'learner-service', dataOwner: 'learner-service', topic: 'platform.learner.v1', aggregateIdSource: 'payload.exportId',
    consumers: Object.freeze([
      Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-learner.v1' }),
      Object.freeze({ service: 'notification-service', consumerGroup: 'cg.notification-from-learner.v1' }),
    ]),
  }),
  'account.deletion.requested.v2': Object.freeze({
    producer: 'iam-service', dataOwner: 'iam-service', topic: 'platform.iam.v1', aggregateIdSource: 'payload.deletionRequestId',
    consumers: Object.freeze([
      Object.freeze({ service: 'analytics-service', consumerGroup: 'cg.analytics-from-iam.v1' }),
      Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-iam.v1' }),
      Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-iam.v1' }),
    ]),
  }),
  'account.deletion.cancelled.v2': Object.freeze({
    producer: 'iam-service', dataOwner: 'iam-service', topic: 'platform.iam.v1', aggregateIdSource: 'payload.deletionRequestId',
    consumers: Object.freeze([
      Object.freeze({ service: 'analytics-service', consumerGroup: 'cg.analytics-from-iam.v1' }),
      Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-iam.v1' }),
      Object.freeze({ service: 'workflow-service', consumerGroup: 'cg.workflow-from-iam.v1' }),
    ]),
  }),
  'account.deletion.completed.v2': Object.freeze({
    producer: 'iam-service', dataOwner: 'iam-service', topic: 'platform.iam.v1', aggregateIdSource: 'payload.deletionRequestId',
    consumers: Object.freeze([
      Object.freeze({ service: 'analytics-service', consumerGroup: 'cg.analytics-from-iam.v1' }),
      Object.freeze({ service: 'audit-service', consumerGroup: 'cg.audit-from-iam.v1' }),
      Object.freeze({ service: 'notification-service', consumerGroup: 'cg.notification-from-iam.v1' }),
    ]),
  }),
});

const FORBIDDEN_EVENT_FIELDS = Object.freeze([
  'tenantId', 'subjectId', 'principalId', 'ownerId', 'downloadUrl', 'downloadUri', 'token', 'accessToken',
  'refreshToken', 'password', 'rawExport', 'rawBody', 'rawText', 'freeText', 'rawAudio', 'paymentCredential',
  'ownerReceiptPayload',
]);
const EXPECTED_AUDIT_FORBIDDEN_PROPERTIES = Object.freeze([
  'password', 'accessToken', 'refreshToken', 'paymentCredential', 'rawAudio', 'rawText', 'rawBody',
  'description', 'body', 'freeText', 'downloadUrl', 'token', 'secret',
]);
const EXPECTED_AUDIT_PATHS = Object.freeze({
  '/internal/v1/audit/exports': Object.freeze({ method: 'post', operationId: 'createM1017AuditExport' }),
  '/internal/v1/audit/exports/{exportId}': Object.freeze({ method: 'get', operationId: 'getM1017AuditExport' }),
  '/internal/v1/audit/exports/{exportId}/download': Object.freeze({ method: 'post', operationId: 'requestM1017AuditExportDownload' }),
  '/internal/v1/audit/exports/{exportId}/recovery': Object.freeze({ method: 'post', operationId: 'recoverM1017AuditExport' }),
});
const EXPECTED_AUDIT_REQUEST_FIELDS = Object.freeze({
  M1017AuditExportCreateRequest: Object.freeze(['windowStart', 'windowEnd', 'scope', 'eventFamilies', 'format', 'approvalRef']),
  M1017AuditExportDownloadRequest: Object.freeze(['expectedStateVersion']),
  M1017AuditExportRecoveryRequest: Object.freeze(['action', 'expectedStateVersion', 'reasonCode']),
});
const EXPECTED_AUDIT_ROOT = Object.freeze({
  task: 'P1R-M1-017',
  owner: 'audit-service',
  dataOwner: 'audit-service',
  externalBoundaryOwner: 'admin-ops-service',
  externalExposure: 'DENY',
  maturity: 'D2_CONTRACT_READY',
  runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  clientAuthority: 'NONE',
  immutableAudit: true,
  workflowRole: 'RETRY_AND_RECOVERY_RECEIPTS_ONLY',
  canonicalOperations: Object.freeze([
    'createM1017AuditExport',
    'getM1017AuditExport',
    'requestM1017AuditExportDownload',
    'recoverM1017AuditExport',
  ]),
});
const EXPECTED_ANALYTICS_ROOT = Object.freeze({
  task: 'P1R-M1-017',
  owner: 'analytics-service',
  dataOwner: 'analytics-service',
  canonicalOperations: Object.freeze(['ingestM1017AnalyticsTelemetry']),
  historicalOperations: Object.freeze([]),
  maturity: 'D2_CONTRACT_READY',
  runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  clientAuthority: 'NONE',
  transport: 'HTTP_TELEMETRY_ONLY',
  kafkaEventEmission: false,
  domainFactsWrite: false,
  consentSource: 'server-derived',
  deletionSource: 'iam-service-server-derived',
  deletionAllowedStatus: Object.freeze(['ACTIVE']),
  deletionSuppressedStatuses: Object.freeze(['PENDING_COOLING_OFF', 'EXECUTING', 'RECOVERY_REQUIRED', 'ANONYMIZED']),
  deletionCancelledEffect: 'SUPPRESS',
  retentionPolicyRef: 'ANALYTICS-RETENTION-V1',
});
const AUDIT_SCHEMA_FORBIDDEN_FIELDS = Object.freeze([
  ...new Set([
    ...EXPECTED_AUDIT_FORBIDDEN_PROPERTIES,
    'tenantId', 'subjectId', 'principalId', 'ownerId', 'ownerService', 'rawExport', 'rawPayload',
    'rawDescription', 'rawContent', 'rawTranscript', 'audioBytes', 'recordingBytes', 'paymentToken',
    'cardNumber', 'cvv', 'cvc', 'signedUrl', 'uploadUrl',
  ]),
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function policyDigest(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function same(actual, expected) {
  return stableJson(actual) === stableJson(expected);
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function exactKeys(errors, value, expected, label) {
  add(errors, isRecord(value), `${label} must be an object`);
  if (!isRecord(value)) return;
  add(errors, same(Object.keys(value).sort(), [...expected].sort()), `${label} keys drifted`);
}

function readJson(root, relativePath, errors) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8'));
  } catch (error) {
    errors.push(`${relativePath} cannot be read as JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function operations(document) {
  const result = [];
  for (const [route, pathItem] of Object.entries(document?.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!['delete', 'get', 'patch', 'post', 'put'].includes(method)) continue;
      result.push({ route, method, operation });
    }
  }
  return result;
}

function canonicalM1017Operations(document) {
  return operations(document).filter(({ operation }) => operation?.['x-contract']?.task === 'P1R-M1-017'
    && operation?.['x-contract']?.canonical === true);
}

function validateSourceProjection(errors, canonical, source, label) {
  for (const { route, method, operation } of canonicalM1017Operations(source)) {
    add(errors, same(canonical?.paths?.[route]?.[method], operation), `${label} ${method.toUpperCase()} ${route} is not projected exactly`);
  }
  for (const [componentKind, definitions] of Object.entries(source?.components ?? {})) {
    for (const [name, definition] of Object.entries(definitions ?? {})) {
      add(errors, same(canonical?.components?.[componentKind]?.[name], definition),
        `${label} component ${componentKind}.${name} is not projected exactly`);
    }
  }
}

function schemaPropertyNames(schema, names = new Set()) {
  if (!isRecord(schema)) return names;
  for (const name of Object.keys(schema.properties ?? {})) names.add(name);
  if (isRecord(schema.items)) schemaPropertyNames(schema.items, names);
  for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
    for (const child of schema[keyword] ?? []) schemaPropertyNames(child, names);
  }
  if (isRecord(schema.not)) schemaPropertyNames(schema.not, names);
  return names;
}

function validatePolicy(errors, policy) {
  exactKeys(errors, policy, EXPECTED_POLICY_KEYS, 'M1-017 integration policy');
  add(errors, policy?.$schema === 'p1r.privacy-analytics-audit-contract.v1', 'M1-017 policy $schema drifted');
  add(errors, policy?.schemaVersion === policy?.$schema, 'M1-017 policy schemaVersion drifted');
  add(errors, policy?.task === 'P1R-M1-017' && policy?.phase === 'P1', 'M1-017 task or phase drifted');
  add(errors, policy?.startCommit === '6245ca42ef254ecc4a45e86e57a5c65922c69c22', 'M1-017 start commit drifted');
  add(errors, policy?.sourceBaseline === 'b1d79a09e266179988270e1832a1309a1cb4af4d', 'M1-017 source baseline drifted');
  add(errors, policy?.maturity === 'D2_CONTRACT_READY', 'M1-017 maturity drifted');
  add(errors, policy?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'M1-017 runtime status must remain NOT_RUNTIME_VERIFIED');
  add(errors, policy?.collectionPolicy?.unknownFieldDecision === 'DENY', 'unknown policy fields must deny');
  add(errors, policy?.collectionPolicy?.clientAuthorityExpansion === 'PROHIBITED', 'client authority expansion must be prohibited');

  const promotion = policy?.compatibilityPromotion;
  exactKeys(errors, promotion, EXPECTED_PROMOTION_KEYS, 'M1-017 compatibility promotion');
  add(errors, promotion?.id === 'P1R-M1-017', 'M1-017 promotion id drifted');
  add(errors, promotion?.sourceContractBaseline === policy?.sourceBaseline, 'M1-017 promotion baseline drifted');
  add(errors, promotion?.previousPromotion === 'P1R-M1-016', 'M1-017 previous promotion drifted');
  add(errors, promotion?.previousPromotionContract === 'config/p1r-notification-sync-support-contract.v1.json', 'M1-017 previous promotion contract drifted');
  add(errors, promotion?.immutableGovernanceBaseline === '868c2177f62b6d2cf613bed702686dddcfe6943f', 'M1-017 immutable governance baseline drifted');
  add(errors, promotion?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'M1-017 promotion cannot claim runtime verification');
  add(errors, promotion?.promotionMode === 'FUTURE_M1017_V2_ONLY', 'M1-017 promotion mode drifted');
  add(errors, promotion?.allowsHistoricalV1Promotion === false, 'M1-017 historical v1 promotion must be false');
  add(errors, promotion?.allowsDualPublish === false, 'M1-017 dual publish must be false');
  add(errors, promotion?.b26StaticPolicy?.classification === 'STATIC_GOVERNANCE_ONLY'
    && promotion?.b26StaticPolicy?.runtimeEvidence === 'NOT_RUNTIME_VERIFIED'
    && promotion?.b26StaticPolicy?.allowsRuntimePromotion === false,
  'M1-017 B26 boundary must remain static-only');
  add(errors, same(policy?.canonicalEvents, Object.keys(EXPECTED_EVENTS)), 'M1-017 canonical event set drifted');
  add(errors, same(policy?.telemetryBoundary?.kafkaEventNames, []), 'UI telemetry must not be promoted to Kafka');
  add(errors, policy?.telemetryBoundary?.domainFactWrite === false && policy?.telemetryBoundary?.failureEffect === 'NON_BLOCKING', 'telemetry isolation drifted');
  add(errors, policy?.runtimeBoundary?.contractOnly === true && policy?.runtimeBoundary?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'M1-017 runtime boundary drifted');
}

function validateAnalytics(errors, policy, document) {
  add(errors, policy?.task === 'P1R-M1-017' && policy?.owner === 'analytics-service' && policy?.dataOwner === 'analytics-service', 'analytics owner policy drifted');
  add(errors, policy?.route === '/api/v1/analytics/telemetry' && policy?.operationId === 'ingestM1017AnalyticsTelemetry', 'analytics route policy drifted');
  add(errors, policy?.runtimeStatus === 'NOT_RUNTIME_VERIFIED' && policy?.clientAuthority === 'NONE', 'analytics authority/runtime boundary drifted');
  add(errors, policy?.transport?.mode === 'HTTP_TELEMETRY_ONLY' && policy?.transport?.kafkaTopic === null
    && policy?.transport?.publishesDomainFacts === false && policy?.transport?.writesDomainFacts === false,
  'analytics must remain HTTP telemetry only');
  add(errors, same(policy?.deletion?.allowedStatus, ['ACTIVE']), 'analytics deletion allow state drifted');
  add(errors, same(policy?.deletion?.suppressedStatuses, ['PENDING_COOLING_OFF', 'EXECUTING', 'RECOVERY_REQUIRED', 'ANONYMIZED']), 'analytics deletion suppression states drifted');
  add(errors, policy?.deletion?.cancelledEffect === 'SUPPRESS', 'cancelled deletion must remain suppressed until IAM resolves ACTIVE and consent is rechecked');
  add(errors, policy?.consent?.missingEffect === 'SUPPRESS' && policy?.consent?.revokedEffect === 'SUPPRESS' && policy?.consent?.unknownEffect === 'SUPPRESS', 'analytics consent must fail closed');
  add(errors, same(document?.['x-m1017-contract'], EXPECTED_ANALYTICS_ROOT), 'analytics source root governance drifted');
  const operation = document?.paths?.['/api/v1/analytics/telemetry']?.post;
  add(errors, operation?.operationId === policy?.operationId, 'analytics canonical operation missing');
  add(errors, same(operation?.security, [{ bearerAuth: [] }]), 'analytics ingress must require bearerAuth');
  add(errors, operation?.['x-telemetry']?.kafkaTopic === null && operation?.['x-telemetry']?.publishesDomainFacts === false
    && operation?.['x-telemetry']?.writesDomainFacts === false, 'analytics operation was promoted to a domain event/write');
  const analyticsForbidden = new Set([
    ...(policy?.redaction?.forbiddenFieldNames ?? []),
    'tenantId', 'subjectId', 'principalId', 'ownerId', 'ownerService',
  ]);
  for (const [schemaName, schema] of Object.entries(document?.components?.schemas ?? {})) {
    if (!schemaName.startsWith('M1017')) continue;
    const fields = schemaPropertyNames(schema);
    for (const field of analyticsForbidden) add(errors, !fields.has(field), `${schemaName} exposes forbidden analytics field ${field}`);
  }
}

function validateAudit(errors, policy, document) {
  add(errors, policy?.taskId === 'P1R-M1-017' && policy?.ownership?.dataOwner === 'audit-service', 'audit export owner policy drifted');
  add(errors, policy?.runtimeStatus === 'NOT_RUNTIME_VERIFIED' && policy?.ownership?.publicRouteEligible === false, 'audit export runtime/public boundary drifted');
  add(errors, policy?.export?.download?.oneTime === true && policy?.export?.download?.permanentUrl === false
    && policy?.export?.download?.credentialInResponse === false, 'audit download grant boundary drifted');
  add(errors, policy?.redaction?.required === true && policy?.redaction?.outputOnlyDigestsAndReferences === true
    && policy?.redaction?.rawIdentityStored === false && policy?.redaction?.sourcePayloadInAudit === false,
  'audit redaction boundary drifted');
  add(errors, same(policy?.redaction?.forbiddenPropertyNames, EXPECTED_AUDIT_FORBIDDEN_PROPERTIES), 'audit forbidden property allowlist drifted');
  add(errors, policy?.audit?.appendOnly === true && policy?.audit?.immutable === true && policy?.audit?.hashChained === true, 'audit append-only policy drifted');
  add(errors, policy?.reliability?.maxAttemptsIncludingInitial === 5 && policy?.reliability?.domainFactsUntouched === true, 'audit recovery policy drifted');
  add(errors, same(document?.['x-m1017-audit-export'], EXPECTED_AUDIT_ROOT), 'audit source root governance drifted');

  const expectedRoutes = Object.keys(EXPECTED_AUDIT_PATHS).sort();
  add(errors, same(Object.keys(document?.paths ?? {}).sort(), expectedRoutes), 'audit-service source path set must remain exact and internal-only');
  const sourceOperations = operations(document);
  add(errors, sourceOperations.length === expectedRoutes.length, 'audit-service source operation set must remain exact');
  for (const [route, expected] of Object.entries(EXPECTED_AUDIT_PATHS)) {
    const pathItem = document?.paths?.[route];
    const operationMethods = Object.keys(pathItem ?? {}).filter((method) => ['delete', 'get', 'patch', 'post', 'put'].includes(method));
    add(errors, same(operationMethods, [expected.method]), `audit-service source method set drifted: ${route}`);
    add(errors, pathItem?.[expected.method]?.operationId === expected.operationId, `audit-service source operation drifted: ${expected.method.toUpperCase()} ${route}`);
  }

  for (const [schemaName, expectedFields] of Object.entries(EXPECTED_AUDIT_REQUEST_FIELDS)) {
    const schema = document?.components?.schemas?.[schemaName];
    add(errors, isRecord(schema) && schema.additionalProperties === false, `${schemaName} must remain a closed request schema`);
    add(errors, same(Object.keys(schema?.properties ?? {}).sort(), [...expectedFields].sort()), `${schemaName} request fields drifted`);
    add(errors, same([...(schema?.required ?? [])].sort(), [...expectedFields].sort()), `${schemaName} required fields drifted`);
  }
  for (const [schemaName, schema] of Object.entries(document?.components?.schemas ?? {})) {
    const fields = schemaPropertyNames(schema);
    for (const field of AUDIT_SCHEMA_FORBIDDEN_FIELDS) add(errors, !fields.has(field), `${schemaName} exposes forbidden audit field ${field}`);
  }
}

function validateOpenApi(errors, inputs) {
  const canonical = inputs.canonicalOpenApi;
  validateSourceProjection(errors, canonical, inputs.privacyOpenApi, 'privacy source');
  validateSourceProjection(errors, canonical, inputs.analyticsOpenApi, 'analytics source');
  validateSourceProjection(errors, canonical, inputs.auditOpenApi, 'audit source');
  add(errors, same(canonical?.paths?.['/api/v1/privacy/export']?.post, inputs.legacyPrivacyOpenApi?.paths?.['/api/v1/privacy/export']?.post), 'legacy B1 privacy adapter is not projected exactly');
  add(errors, canonical?.paths?.['/api/v1/privacy/export']?.post?.deprecated === true
    && canonical?.paths?.['/api/v1/privacy/export']?.post?.['x-contract']?.canonical === false,
  'legacy B1 privacy route must remain deprecated and non-canonical');
  add(errors, same(canonical?.['x-p1r-gateway-boundary'], inputs.gatewayOpenApi?.['x-p1r-gateway-boundary']), 'Gateway boundary projection drifted');

  for (const { route, method } of operations(canonical)) {
    const allowedPrefix = route.startsWith('/api/v1/') || route.startsWith('/internal/v1/');
    add(errors, allowedPrefix, `canonical OpenAPI operation uses an ungoverned path prefix: ${method.toUpperCase()} ${route}`);
  }

  const expectedOperations = Object.values(inputs.policy?.canonicalOperations ?? {}).flat();
  const found = canonicalM1017Operations(canonical).map(({ operation }) => operation.operationId).sort();
  add(errors, same(found, [...expectedOperations].sort()), 'canonical M1-017 operation set drifted');
  for (const { route, method, operation } of canonicalM1017Operations(canonical)) {
    add(errors, operation?.['x-contract']?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${method.toUpperCase()} ${route} promoted runtime status`);
    add(errors, operation?.['x-contract']?.clientAuthority === 'NONE', `${method.toUpperCase()} ${route} client authority drifted`);
    add(errors, operation?.['x-authorization']?.defaultDecision === 'DENY', `${method.toUpperCase()} ${route} must default deny`);
  }
}

function validateEvents(errors, inputs) {
  const fragmentEvents = new Map((inputs.eventFragment?.events ?? []).map((event) => [event.eventName, event]));
  const catalogEvents = new Map((inputs.eventCatalog?.events ?? []).map((event) => [event.eventName, event]));
  add(errors, fragmentEvents.size === Object.keys(EXPECTED_EVENTS).length, 'M1-017 event fragment set drifted');
  add(errors, (inputs.eventCatalog?.events ?? []).every((event, index, all) => all.findIndex((candidate) => candidate.eventName === event.eventName) === index), 'event catalog contains duplicate event names');

  for (const [eventName, expected] of Object.entries(EXPECTED_EVENTS)) {
    const fragment = fragmentEvents.get(eventName);
    const event = catalogEvents.get(eventName);
    add(errors, isRecord(fragment), `missing M1-017 event fragment ${eventName}`);
    add(errors, isRecord(event), `missing canonical event ${eventName}`);
    if (!isRecord(fragment) || !isRecord(event)) continue;
    for (const field of ['eventName', 'domain', 'version', 'schema', 'aggregateType', 'aggregateIdField', 'payloadSchema', 'compatibility']) {
      add(errors, same(event[field], fragment[field]), `${eventName}.${field} is not projected from the canonical fragment`);
    }
    const governance = event['x-p1r-governance'];
    add(errors, event.status === 'CANONICAL_D2' && governance?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${eventName} D2 status drifted`);
    add(errors, governance?.scope === 'CROSS_SERVICE_INTEGRATION_FACT', `${eventName} scope drifted`);
    add(errors, governance?.producer?.service === expected.producer && governance?.producer?.dataOwner === expected.dataOwner
      && governance?.producer?.outboxRequired === true, `${eventName} producer/owner drifted`);
    add(errors, governance?.transport?.protocol === 'kafka' && governance?.transport?.topic === expected.topic
      && governance?.transport?.partitionKey === 'aggregateId' && governance?.transport?.aggregateIdSource === expected.aggregateIdSource
      && governance?.transport?.delivery === 'at-least-once', `${eventName} transport drifted`);
    const consumers = (governance?.consumers ?? []).map(({ service, consumerGroup }) => ({ service, consumerGroup }));
    add(errors, same(consumers, expected.consumers), `${eventName} consumer groups drifted`);
    const payloadName = fragment.payloadSchema?.$ref?.split('/').pop();
    add(errors, same(inputs.eventCatalog?.payloadSchemas?.[payloadName], inputs.eventFragment?.payloadSchemas?.[payloadName]), `${eventName} payload projection drifted`);
    const fields = schemaPropertyNames(inputs.eventCatalog?.payloadSchemas?.[payloadName]);
    for (const field of FORBIDDEN_EVENT_FIELDS) add(errors, !fields.has(field), `${eventName} exposes forbidden payload field ${field}`);

    const channelId = eventName.replaceAll('.', '_');
    const channel = inputs.eventCatalog?.asyncapi?.channels?.[channelId];
    add(errors, channel?.address === expected.topic, `${eventName} AsyncAPI topic drifted`);
    add(errors, isRecord(inputs.eventCatalog?.asyncapi?.operations?.[`publish_${channelId}`]), `${eventName} publish operation missing`);
    for (const { consumerGroup } of expected.consumers) {
      add(errors, isRecord(inputs.eventCatalog?.asyncapi?.operations?.[`subscribe_${channelId}_${consumerGroup.replaceAll('.', '_').replaceAll('-', '_')}`]), `${eventName} ${consumerGroup} subscribe operation missing`);
    }

    const routes = (inputs.b26?.eventRouting ?? []).filter((route) => route.eventName === eventName);
    add(errors, routes.length === 1, `${eventName} must have one B26 route`);
    add(errors, routes[0]?.topic === expected.topic, `${eventName} B26 topic drifted`);
  }

  const telemetryNames = new Set(Object.keys(inputs.analyticsPolicy?.allowlistedEvents ?? {}));
  for (const eventName of telemetryNames) add(errors, !catalogEvents.has(eventName), `UI telemetry ${eventName} must not enter the Kafka catalog`);
  add(errors, inputs.b26?.runtimeStatus !== 'RUNTIME_VERIFIED' && inputs.b26?.runtimeStatus !== 'PASS', 'B26 cannot claim runtime verification');
  add(errors, inputs.b26?.sourceRefs?.includes(INPUT_PATHS.eventFragment) === true, 'B26 sourceRefs must bind the M1-017 event fragment');
}

export function readM1017Inputs({ root = DEFAULT_ROOT } = {}) {
  const errors = [];
  const inputs = { root, errors };
  for (const [key, relativePath] of Object.entries(INPUT_PATHS)) inputs[key] = readJson(root, relativePath, errors);
  return inputs;
}

export function validatePrivacyAnalyticsAuditContractData(inputs) {
  const errors = [...(inputs?.errors ?? [])];
  const policy = inputs?.policy;
  validatePolicy(errors, policy);
  const digest = isRecord(policy) ? policyDigest(policy) : null;
  add(errors, digest === FROZEN_POLICY_SHA256, 'M1-017 integration policy semantic digest drifted');

  const privacyReport = validatePrivacyLifecycleContractFiles({ root: inputs?.root ?? DEFAULT_ROOT });
  errors.push(...privacyReport.errors.map((error) => `privacy lifecycle: ${error}`));
  validateAnalytics(errors, inputs?.analyticsPolicy, inputs?.analyticsOpenApi);
  validateAudit(errors, inputs?.auditPolicy, inputs?.auditOpenApi);
  validateOpenApi(errors, inputs);
  validateEvents(errors, inputs);

  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    task: 'P1R-M1-017',
    maturity: policy?.maturity ?? null,
    runtimeStatus: policy?.runtimeStatus ?? null,
    policyDigest: digest,
    summary: {
      canonicalOperations: Object.values(policy?.canonicalOperations ?? {}).flat().length,
      canonicalEvents: Object.keys(EXPECTED_EVENTS).length,
      uiTelemetryKafkaEvents: policy?.telemetryBoundary?.kafkaEventNames?.length ?? null,
      coolingOffHours: inputs?.privacyPolicy?.deletion?.coolingOffHours ?? null,
      b26RuntimeStatus: inputs?.b26?.runtimeStatus ?? null,
    },
    errors,
  };
}

export function validatePrivacyAnalyticsAuditContractFiles({ root = DEFAULT_ROOT } = {}) {
  return validatePrivacyAnalyticsAuditContractData(readM1017Inputs({ root }));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  const report = validatePrivacyAnalyticsAuditContractFiles();
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else if (report.result === 'PASS') console.log(`P1R M1-017 privacy/analytics/audit contract PASS (${report.summary.canonicalOperations} operations, ${report.summary.canonicalEvents} events, runtimeStatus=${report.runtimeStatus}).`);
  else console.error(`P1R M1-017 privacy/analytics/audit contract FAIL:\n${report.errors.map((error) => `- ${error}`).join('\n')}`);
  if (report.result !== 'PASS') process.exitCode = 1;
}
