import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = path.resolve(moduleDir, '../..');
export const DEFAULT_POLICY_PATH = path.join(DEFAULT_ROOT, 'config/p1r-commerce-contract.v1.json');

const ROOT_KEYS = [
  '$schema',
  'schemaVersion',
  'task',
  'phase',
  'sourceBaseline',
  'startCommit',
  'maturity',
  'runtimeStatus',
  'collectionPolicy',
  'canonicalSources',
  'compatibilityPromotion',
  'canonicalRoutes',
  'runtimeBoundary',
  'owners',
  'authority',
  'stateMachines',
  'objects',
  'paymentPolicy',
  'activationPolicy',
  'callbackPolicy',
  'entitlementPolicy',
  'refundPolicy',
  'reconciliationPolicy',
  'sensitiveDataPolicy',
  'canonicalRouteExpectations',
  'canonicalEventExpectations',
  'historicalCandidates',
  'scopeExclusions',
  'handoff',
  'phase1Prohibitions',
];

const EXPECTED_COLLECTION_POLICY = {
  unknownFieldDecision: 'DENY',
  unknownEnumDecision: 'DENY',
  additionalProperties: 'DENY',
  clientAuthorityExpansion: 'PROHIBITED',
};

// The route policy may be stored in a different physical order.  The public
// canonicalRoutes.operationIds order below is the governance order; individual
// expectations are matched by operationId so a harmless JSON-array reorder
// never turns into an accidental path comparison.
export const EXPECTED_CANONICAL_ROUTES = [
  {
    operationId: 'getB13PublicCommerceCatalog', method: 'GET', path: '/api/v1/public/commerce/catalog',
    requestSchema: 'NONE', responseSchema: 'M1015PublicCatalog', security: 'NONE_PUBLIC_READ',
    requiredPermission: 'commerce.catalog.read.public', historicalOperationId: 'getB13PublicCommerceCatalog',
  },
  {
    operationId: 'getB13CommerceReadiness', method: 'GET', path: '/api/v1/commerce/readiness',
    requestSchema: 'NONE', responseSchema: 'M1015PaymentReadiness', security: 'bearerAuth',
    requiredPermission: 'commerce.readiness.read.self', historicalOperationId: 'getB13CommerceReadiness',
  },
  {
    operationId: 'listB13CommerceSkus', method: 'GET', path: '/api/v1/commerce/skus',
    requestSchema: 'NONE', responseSchema: 'M1015Sku[]', security: 'bearerAuth',
    requiredPermission: 'commerce.sku.read.self', historicalOperationId: 'listB13CommerceSkus',
  },
  {
    operationId: 'listB13MyEntitlements', method: 'GET', path: '/api/v1/commerce/entitlements/me',
    requestSchema: 'NONE', responseSchema: 'M1015Entitlement[]', security: 'bearerAuth',
    requiredPermission: 'commerce.entitlement.read.self', historicalOperationId: 'listB13MyEntitlements',
  },
  {
    operationId: 'listB13CommerceOrders', method: 'GET', path: '/api/v1/commerce/orders',
    requestSchema: 'NONE', responseSchema: 'M1015Order[]', security: 'bearerAuth',
    requiredPermission: 'commerce.order.read.self', historicalOperationId: 'listB13CommerceOrders',
  },
  {
    operationId: 'createB13CommerceOrder', method: 'POST', path: '/api/v1/commerce/orders',
    requestSchema: 'M1015OrderCreateRequest', responseSchema: 'M1015Order', security: 'bearerAuth',
    requiredPermission: 'commerce.order.write.self', historicalOperationId: 'createB13CommerceOrder',
  },
  {
    operationId: 'prepareB13PaymentIntent', method: 'POST', path: '/api/v1/commerce/orders/{orderId}/payment-intents',
    requestSchema: 'M1015PaymentIntentRequest', responseSchema: 'M1015PaymentIntentResult', security: 'bearerAuth',
    requiredPermission: 'commerce.payment-attempt.write.self', historicalOperationId: 'prepareB13PaymentIntent',
  },
  {
    operationId: 'requestB13OrderRefund', method: 'POST', path: '/api/v1/commerce/orders/{orderId}/refunds',
    requestSchema: 'M1015RefundRequest', responseSchema: 'M1015Refund', security: 'bearerAuth',
    requiredPermission: 'commerce.refund.request.self', historicalOperationId: 'requestB13OrderRefund',
  },
  {
    operationId: 'redeemB13ActivationCode', method: 'POST', path: '/api/v1/commerce/activation-codes/redeem',
    requestSchema: 'M1015ActivationRedeemRequest', responseSchema: 'M1015Entitlement', security: 'bearerAuth',
    requiredPermission: 'commerce.activation.redeem.self', historicalOperationId: 'redeemB13ActivationCode',
  },
  {
    operationId: 'consumeB13PaymentProviderCallback', method: 'POST', path: '/internal/v1/commerce/providers/{provider}/callbacks',
    requestSchema: 'M1015ProviderCallbackRequest', responseSchema: 'M1015ProviderCallbackReceipt', security: 'B8WorkloadIdentity',
    requiredPermission: 'commerce.payment-callback.write.workload', historicalOperationId: 'consumeB13PaymentProviderCallback',
  },
  {
    operationId: 'replayB13CommerceReconciliation', method: 'POST', path: '/internal/v1/commerce/reconciliation/replay',
    requestSchema: 'M1015ReconciliationReplayRequest', responseSchema: 'M1015ReconciliationRecoveryReceipt', security: 'B8WorkloadIdentity',
    requiredPermission: 'commerce.reconciliation.replay.finance', historicalOperationId: 'replayB13CommerceReconciliation',
  },
  {
    operationId: 'resolveM1015CommerceEntitlementSnapshot', method: 'POST', path: '/internal/v1/commerce/entitlements/{entitlementId}/snapshot',
    requestSchema: 'M1015EntitlementSnapshotResolveRequest', responseSchema: 'M1015EntitlementSnapshot', security: 'B8WorkloadIdentity',
    requiredPermission: 'commerce.entitlement.snapshot.read.workload', historicalOperationId: 'NONE',
  },
  {
    operationId: 'revokeM1015CommerceEntitlement', method: 'POST', path: '/internal/v1/commerce/entitlements/{entitlementId}/revoke',
    requestSchema: 'M1015EntitlementRevokeRequest', responseSchema: 'M1015EntitlementRevokeReceipt', security: 'B8WorkloadIdentity',
    requiredPermission: 'commerce.entitlement.revoke.finance', historicalOperationId: 'NONE',
  },
];

export const EXPECTED_CANONICAL_ROUTE_OPERATION_IDS = EXPECTED_CANONICAL_ROUTES.map((route) => route.operationId);
const EXPECTED_ROUTE_BY_OPERATION_ID = new Map(EXPECTED_CANONICAL_ROUTES.map((route) => [route.operationId, route]));

export const EXPECTED_CANONICAL_EVENT_NAMES = [
  'commerce.order.created.v2',
  'commerce.payment.requested.v2',
  'commerce.payment.callback_received.v2',
  'commerce.payment.verified.v2',
  'commerce.entitlement.activated.v2',
  'commerce.entitlement.revoked.v2',
  'commerce.refund.settled.v2',
  'commerce.reconciliation.discrepancy_recorded.v2',
  'commerce.reconciliation.recovery_receipted.v2',
];

export const HISTORICAL_COMMERCE_EVENT_NAMES = [
  'commerce.order.created.v1',
  'commerce.payment.requested.v1',
  'commerce.payment.callback_received.v1',
  'commerce.payment.verified.v1',
  'commerce.entitlement.activated.v1',
  'commerce.entitlement.revoked.v1',
  'commerce.refund.completed.v1',
  'commerce.order.reconciled.v1',
  'finance.reconciliation.discrepancy.v1',
];

const REQUIRED_B5_B13_HISTORICAL_EVENT_NAMES = [
  'commerce.order.created.v1',
  'commerce.payment.requested.v1',
  'commerce.payment.callback_received.v1',
  'commerce.payment.verified.v1',
  'commerce.entitlement.activated.v1',
  'commerce.refund.completed.v1',
  'commerce.order.reconciled.v1',
  'finance.reconciliation.discrepancy.v1',
];

const EXPECTED_EVENT_CONSUMERS = {
  'commerce.order.created.v2': [
    { service: 'workflow-service', consumerGroup: 'cg.workflow-from-commerce.v1' },
    { service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' },
  ],
  'commerce.payment.requested.v2': [
    { service: 'workflow-service', consumerGroup: 'cg.workflow-from-commerce.v1' },
    { service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' },
  ],
  'commerce.payment.callback_received.v2': [
    { service: 'workflow-service', consumerGroup: 'cg.workflow-from-commerce.v1' },
    { service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' },
  ],
  'commerce.payment.verified.v2': [
    { service: 'workflow-service', consumerGroup: 'cg.workflow-from-commerce.v1' },
    { service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' },
  ],
  'commerce.entitlement.activated.v2': [
    { service: 'content-service', consumerGroup: 'cg.content-from-commerce.v1' },
    { service: 'learning-service', consumerGroup: 'cg.learning-from-commerce.v1' },
    { service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' },
  ],
  'commerce.entitlement.revoked.v2': [
    { service: 'content-service', consumerGroup: 'cg.content-from-commerce.v1' },
    { service: 'learning-service', consumerGroup: 'cg.learning-from-commerce.v1' },
    { service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' },
  ],
  'commerce.refund.settled.v2': [
    { service: 'content-service', consumerGroup: 'cg.content-from-commerce.v1' },
    { service: 'learning-service', consumerGroup: 'cg.learning-from-commerce.v1' },
    { service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' },
  ],
  'commerce.reconciliation.discrepancy_recorded.v2': [
    { service: 'workflow-service', consumerGroup: 'cg.workflow-from-commerce.v1' },
    { service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' },
  ],
  'commerce.reconciliation.recovery_receipted.v2': [
    { service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' },
  ],
};

// M1-015's policy remains frozen at its original consumer matrix.  M1-016
// signed one additive notification subscription for these two current-source
// commerce events.  Keep the promotion identity and policy digest beside the
// allow-list so a future consumer cannot be accepted merely because the
// current catalog happened to contain it.
export const M1016_SIGNED_NOTIFICATION_CONSUMER_ALLOWANCE = Object.freeze({
  promotionId: 'P1R-M1-016',
  sourceContractBaseline: '878f9ebc0591844467ac79facf4f00296058137f',
  policyDigest: 'f5beb694bb91ecde227d1405c56f7fdc73d71169d2bbe7b5c32378c3235f8ea7',
  bindings: Object.freeze({
    'commerce.entitlement.activated.v2': Object.freeze({
      service: 'notification-service',
      consumerGroup: 'cg.notification-from-commerce.v1',
    }),
    'commerce.refund.settled.v2': Object.freeze({
      service: 'notification-service',
      consumerGroup: 'cg.notification-from-commerce.v1',
    }),
  }),
});

function currentSourceEventConsumers(eventName) {
  const frozenConsumers = EXPECTED_EVENT_CONSUMERS[eventName];
  const additive = M1016_SIGNED_NOTIFICATION_CONSUMER_ALLOWANCE.bindings[eventName];
  if (!additive) return frozenConsumers;

  // The signed M1-016 projection inserts notification before the terminal
  // audit consumer.  Returning a fresh array prevents callers from mutating
  // the frozen M1-015 matrix while preserving every original consumer.
  return [
    ...frozenConsumers.slice(0, -1),
    additive,
    ...frozenConsumers.slice(-1),
  ];
}

const EXPECTED_PHASE1_PROHIBITIONS = [
  'PRODUCTION_PAYMENT',
  'AUTO_RENEWAL',
  'LIVE_PROVIDER_CREDENTIAL',
  'LIVE_PROVIDER_ROUTE',
  'LIVE_PROVIDER_TRAFFIC',
  'CLIENT_AUTHORITATIVE_PRICE_PAYMENT_OR_ENTITLEMENT',
  'CLIENT_OR_GATEWAY_ENTITLEMENT_CACHE_AS_FACT',
  'ACTIVATION_SECRET_OR_DIGEST_IN_EVENT_OR_AUDIT',
  'RAW_CALLBACK_OR_SIGNATURE_IN_EVENT_OR_AUDIT',
  'PARTIAL_REFUND',
  'PRE_SETTLEMENT_REFUND_REVOKE',
  'HOUSEHOLD_COMMANDS',
  'COUPON_APPLICATION',
  'ACCOUNT_MERGE',
  'SELLABLE_LIFETIME_SKU',
];

export const CONTRACT_SOURCE_BASELINE = '5d0bb3a0651d9205a942eca9d8e1c56b538ed73f';
export const TASK_START_COMMIT = '798e68c217ee4fbc12720a05c402486d35563fdb';

// Update this literal only in the same reviewed change as the policy. It
// intentionally makes every addition, removal, or semantic alteration fail
// closed, including unknown nested fields which JSON Schema alone cannot bind.
export const FROZEN_POLICY_SHA256 = '388d3fc0c508428412fa669a298c9c73da3ba725e6208b6bd69e82f1e3bd62d8';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('non-finite number is not valid contract JSON');
  }
  return value;
}

export function policyDigest(policy) {
  return createHash('sha256').update(JSON.stringify(canonicalize(policy))).digest('hex');
}

function sameJson(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function sameStringSet(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every((value) => typeof value === 'string')
    && right.every((value) => typeof value === 'string')
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.every((value) => right.includes(value));
}

function findSuccessResponseSchema(operation, expectedSchema) {
  const schemaName = contractSchemaReferenceName(expectedSchema);
  if (!schemaName) return null;
  for (const [status, response] of Object.entries(operation?.responses ?? {})) {
    if (!/^2\d\d$/.test(status) || !isPlainObject(response)) continue;
    const schema = response.content?.['application/json']?.schema;
    if (schemaContainsReference(schema, `#/components/schemas/${schemaName}`)) return schema;
  }
  return null;
}

function addError(errors, condition, message) {
  if (!condition) errors.push(message);
}

function assertKnownKeys(errors, value, allowed, label) {
  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  if (unknown.length > 0) errors.push(`${label} contains unknown field(s): ${unknown.join(', ')}`);
  if (missing.length > 0) errors.push(`${label} is missing required field(s): ${missing.join(', ')}`);
  return unknown.length === 0 && missing.length === 0;
}

function assertAllowedKeys(errors, value, allowed, label) {
  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) errors.push(`${label} contains unknown field(s): ${unknown.join(', ')}`);
  return unknown.length === 0;
}

function assertExactObject(errors, value, expected, label) {
  if (!assertKnownKeys(errors, value, Object.keys(expected), label)) return;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!sameJson(value[key], expectedValue)) errors.push(`${label}.${key} must equal its frozen value`);
  }
}

function isNonEmptyString(value, maximum = 256) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum;
}

function isSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function schemaNameFromRef(reference) {
  if (typeof reference !== 'string') return null;
  const match = reference.match(/^#\/(?:components\/schemas|payloadSchemas)\/([A-Za-z][A-Za-z0-9_]*)$/);
  return match?.[1] ?? null;
}

function singletonEnumIs(schema, expected) {
  return isPlainObject(schema) && sameJson(schema.enum, [expected]);
}

function oneOfBranchForEnum(schema, field, values) {
  return schema?.oneOf?.find((branch) => sameJson(branch?.properties?.[field]?.enum, values));
}

function contractSchemaReferenceName(value) {
  return typeof value === 'string' ? value.replace(/\[\]$/, '') : null;
}

function securityRequirementFor(value) {
  if (value === 'NONE' || value === 'PUBLIC' || value === 'NONE_PUBLIC_READ') return [];
  if (typeof value !== 'string' || !value) return null;
  return [{ [value]: [] }];
}

function schemaContainsReference(value, expectedReference) {
  if (Array.isArray(value)) return value.some((entry) => schemaContainsReference(entry, expectedReference));
  if (!isPlainObject(value)) return false;
  if (value.$ref === expectedReference) return true;
  return Object.values(value).some((entry) => schemaContainsReference(entry, expectedReference));
}

function schemaForbiddenFieldPaths(value, forbidden, pathName = '') {
  const matches = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => matches.push(...schemaForbiddenFieldPaths(entry, forbidden, `${pathName}[${index}]`)));
    return matches;
  }
  if (!isPlainObject(value)) return matches;
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = pathName ? `${pathName}.${key}` : key;
    if (forbidden.has(key)) matches.push(nextPath);
    matches.push(...schemaForbiddenFieldPaths(entry, forbidden, nextPath));
  }
  return matches;
}

const FORBIDDEN_OAS30_SCHEMA_KEYWORDS = new Set([
  'const', 'if', 'then', 'else', 'contains', 'prefixItems', 'dependentRequired', 'unevaluatedProperties',
]);

function keywordPaths(value, forbidden, pathName = '$', matches = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => keywordPaths(entry, forbidden, `${pathName}[${index}]`, matches));
    return matches;
  }
  if (!isPlainObject(value)) return matches;
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = `${pathName}.${key}`;
    if (forbidden.has(key)) matches.push(nextPath);
    keywordPaths(entry, forbidden, nextPath, matches);
  }
  return matches;
}

function scanRuntimeProofFields(value, errors, location = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanRuntimeProofFields(entry, errors, `${location}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = `${location}.${key}`;
    const normalized = key.replace(/[^a-z0-9]/giu, '').toLowerCase();
    if (/(?:runtimeproof|runtimeverified|runtimeattestation|attestation|certified|deployed|operationalstatus|currentstatus|verificationstate)$/u.test(normalized)
      || normalized === 'live') {
      errors.push(`${nextPath} is an unknown runtime proof or attestation field`);
    }
    if (key === 'runtimeStatus') {
      addError(errors, entry === 'NOT_RUNTIME_VERIFIED' || entry === 'pending',
        `${nextPath} must remain NOT_RUNTIME_VERIFIED or pending`);
    }
    if (key === 'runtimeEvidence') {
      addError(errors, entry === 'NOT_RUNTIME_VERIFIED' || entry === null,
        `${nextPath} must remain NOT_RUNTIME_VERIFIED or null`);
    }
    if (key === 'currentRuntimeResult') {
      addError(errors, entry === 'NOT_RUNTIME_VERIFIED', `${nextPath} must remain NOT_RUNTIME_VERIFIED`);
    }
    scanRuntimeProofFields(entry, errors, nextPath);
  }
}

function operationFor(openApi, route) {
  return openApi?.paths?.[route.path]?.[route.method?.toLowerCase()];
}

function allOperationIds(openApi) {
  const ids = new Set();
  for (const pathItem of Object.values(openApi?.paths ?? {})) {
    if (!isPlainObject(pathItem)) continue;
    for (const operation of Object.values(pathItem)) {
      if (isPlainObject(operation) && typeof operation.operationId === 'string') ids.add(operation.operationId);
    }
  }
  return ids;
}

function idempotencyParameterIsRequired(openApi, operation) {
  const parameters = operation?.parameters ?? [];
  if (!Array.isArray(parameters)) return false;
  return parameters.some((parameter) => {
    if (!isPlainObject(parameter)) return false;
    if (parameter.name === 'Idempotency-Key') return parameter.in === 'header' && parameter.required === true;
    const parameterName = typeof parameter.$ref === 'string'
      ? parameter.$ref.replace('#/components/parameters/', '') : null;
    const resolved = parameterName ? openApi?.components?.parameters?.[parameterName] : null;
    return resolved?.name === 'Idempotency-Key' && resolved?.in === 'header' && resolved?.required === true;
  });
}

function resolveParameter(openApi, parameter) {
  if (!isPlainObject(parameter)) return null;
  if (typeof parameter.$ref !== 'string') return parameter;
  const name = parameter.$ref.replace('#/components/parameters/', '');
  return openApi?.components?.parameters?.[name] ?? null;
}

function requiredParameter(openApi, operation, name, location) {
  return (operation?.parameters ?? []).some((parameter) => {
    const resolved = resolveParameter(openApi, parameter);
    return resolved?.name === name && resolved?.in === location && resolved?.required === true;
  });
}

function resolveRequestSchema(openApi, operation) {
  const schema = operation?.requestBody?.content?.['application/json']?.schema;
  const name = schemaNameFromRef(schema?.$ref);
  return name ? openApi?.components?.schemas?.[name] : null;
}

function assertClosedSchema(errors, schema, label, requiredFields = null) {
  addError(errors, isPlainObject(schema), `${label} must resolve to an object schema`);
  if (!isPlainObject(schema)) return;
  addError(errors, schema.additionalProperties === false, `${label} must reject unknown fields`);
  if (Array.isArray(requiredFields)) {
    addError(errors, sameJson(schema.required, requiredFields), `${label}.required must equal frozen policy fields`);
    assertKnownKeys(errors, schema.properties, requiredFields, `${label}.properties`);
  }
}

function assertCorePolicy(errors, policy) {
  if (!assertKnownKeys(errors, policy, ROOT_KEYS, 'policy')) return;
  addError(errors, policy.$schema === 'p1r.commerce-contract.v1', 'policy.$schema must remain p1r.commerce-contract.v1');
  addError(errors, policy.schemaVersion === 'p1r.commerce-contract.v1', 'policy.schemaVersion must remain p1r.commerce-contract.v1');
  addError(errors, policy.task === 'P1R-M1-015', 'policy.task must remain P1R-M1-015');
  addError(errors, policy.phase === 'P1', 'policy.phase must remain P1');
  addError(errors, policy.sourceBaseline === CONTRACT_SOURCE_BASELINE,
    'policy.sourceBaseline must remain the frozen pre-M1-015 contract baseline');
  addError(errors, policy.startCommit === TASK_START_COMMIT,
    'policy.startCommit must remain the task-start traceability commit');
  addError(errors, policy.maturity === 'D2_CONTRACT_READY', 'policy.maturity must remain D2_CONTRACT_READY');
  addError(errors, policy.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'policy.runtimeStatus must remain NOT_RUNTIME_VERIFIED');
  assertExactObject(errors, policy.collectionPolicy, EXPECTED_COLLECTION_POLICY, 'policy.collectionPolicy');
}

function assertCanonicalRoutePolicy(errors, policy) {
  const routes = policy?.canonicalRouteExpectations;
  if (!Array.isArray(routes)) {
    errors.push('canonicalRouteExpectations must be an array');
    return { canonicalRoutes: 0, coveredCanonicalRoutes: 0 };
  }
  addError(errors, routes.length === EXPECTED_CANONICAL_ROUTES.length,
    'canonicalRouteExpectations must contain exactly thirteen M1015 routes');
  const ids = new Set(routes.map((route) => route?.id));
  const operationIds = new Set(routes.map((route) => route?.operationId));
  addError(errors, ids.size === routes.length, 'canonicalRouteExpectations must not contain duplicate ids');
  addError(errors, operationIds.size === routes.length, 'canonicalRouteExpectations must not contain duplicate operationIds');
  addError(errors, sameStringSet([...operationIds], EXPECTED_CANONICAL_ROUTE_OPERATION_IDS),
    'canonicalRouteExpectations must use the exact thirteen approved operationIds');

  for (const [index, route] of routes.entries()) {
    if (!isPlainObject(route)) {
      errors.push(`canonical route at index ${index} must be an object`);
      continue;
    }
    const expected = EXPECTED_ROUTE_BY_OPERATION_ID.get(route.operationId);
    const id = route.id ?? `canonicalRouteExpectations[${index}]`;
    const allowed = [
      'id', 'method', 'path', 'operationId', 'historicalOperationId', 'owner', 'security',
      'requiredPermission', 'idempotency', 'requestAuthority', 'requestSchema', 'responseSchema',
      'status', 'runtimeStatus',
    ];
    assertKnownKeys(errors, route, allowed, `canonicalRouteExpectations[${index}]`);
    if (!expected) {
      errors.push(`${id}.operationId is not an approved M1-015 canonical operation`);
    } else {
      for (const key of ['method', 'path', 'requestSchema', 'responseSchema', 'security', 'requiredPermission', 'historicalOperationId']) {
        addError(errors, route[key] === expected[key], `${id}.${key} must match the frozen B13 M1015 projection`);
      }
      const expectedId = `M1015-${expected.operationId}`;
      addError(errors, isNonEmptyString(route.id), `${expectedId}.id must be explicit`);
    }
    addError(errors, route.owner === 'commerce-service', `${id}.owner must be commerce-service`);
    addError(errors, ['NONE_PUBLIC_READ', 'bearerAuth', 'B8WorkloadIdentity'].includes(route.security),
      `${id}.security must be a frozen public, bearer, or workload boundary`);
    addError(errors, route.requiredPermission === 'NONE' || isNonEmptyString(route.requiredPermission), `${id}.requiredPermission must be explicit`);
    addError(errors, ['REQUIRED', 'NOT_REQUIRED'].includes(route.idempotency), `${id}.idempotency must be explicit`);
    const requestAuthority = route.requestAuthority;
    if (!isPlainObject(requestAuthority)) {
      errors.push(`${id}.requestAuthority must be a closed policy object`);
    } else {
      const authorityKeys = ['clientAllowedFields', 'trustedWorkloadSuppliedFields', 'serverDerivedFields', 'forbiddenFields'];
      const unknown = Object.keys(requestAuthority).filter((key) => !authorityKeys.includes(key));
      if (unknown.length > 0) errors.push(`${id}.requestAuthority contains unknown field(s): ${unknown.join(', ')}`);
      for (const key of ['serverDerivedFields', 'forbiddenFields']) {
        addError(errors, Array.isArray(requestAuthority[key]) && requestAuthority[key].length > 0,
          `${id}.requestAuthority.${key} must be a non-empty array`);
      }
      for (const key of ['clientAllowedFields', 'trustedWorkloadSuppliedFields']) {
        if (Object.hasOwn(requestAuthority, key)) {
          addError(errors, Array.isArray(requestAuthority[key]), `${id}.requestAuthority.${key} must be an array`);
        }
      }
      const clientFields = requestAuthority.clientAllowedFields ?? [];
      const workloadFields = requestAuthority.trustedWorkloadSuppliedFields ?? [];
      const serverFields = requestAuthority.serverDerivedFields ?? [];
      const forbiddenFields = requestAuthority.forbiddenFields ?? [];
      const protectedFields = new Set([...serverFields, ...forbiddenFields]);
      addError(errors, clientFields.every((field) => !protectedFields.has(field)),
        `${id}.requestAuthority may not allow a server-derived or forbidden client field`);
      addError(errors, workloadFields.every((field) => !forbiddenFields.includes(field)),
        `${id}.requestAuthority may not allow a forbidden workload field`);
      if (route.security === 'B8WorkloadIdentity' && route.operationId !== 'consumeB13PaymentProviderCallback') {
        addError(errors, workloadFields.length > 0, `${id} workload route must declare trusted workload fields`);
      }
      for (const field of ['tenantId', 'principalId', 'subjectId', 'ownerId', 'role', 'permission', 'amountMinor', 'currency', 'priceSnapshotId', 'entitlementState']) {
        addError(errors, !clientFields.includes(field), `${id}.requestAuthority must not grant client authority over ${field}`);
      }
    }
    addError(errors, route.status === 'EXPECTED_CANONICAL_D2', `${id}.status must remain EXPECTED_CANONICAL_D2`);
    addError(errors, route.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${id}.runtimeStatus must remain NOT_RUNTIME_VERIFIED`);
    addError(errors, route.requestSchema === 'NONE' || isNonEmptyString(route.requestSchema), `${id}.requestSchema must be NONE or a schema name`);
    addError(errors, isNonEmptyString(route.responseSchema), `${id}.responseSchema must be a schema name`);
  }

  const canonicalRoutes = policy?.canonicalRoutes;
  assertKnownKeys(errors, canonicalRoutes,
    ['count', 'operationIds', 'detailSource', 'unknownOperationDecision', 'additionalProperties'], 'canonicalRoutes');
  addError(errors, canonicalRoutes?.count === EXPECTED_CANONICAL_ROUTES.length,
    'canonicalRoutes.count must remain thirteen');
  addError(errors, sameJson(canonicalRoutes?.operationIds, EXPECTED_CANONICAL_ROUTE_OPERATION_IDS),
    'canonicalRoutes.operationIds must equal the frozen ordered operation ids');
  addError(errors, canonicalRoutes?.detailSource === 'canonicalRouteExpectations',
    'canonicalRoutes.detailSource must remain canonicalRouteExpectations');
  addError(errors, canonicalRoutes?.unknownOperationDecision === 'DENY',
    'canonicalRoutes.unknownOperationDecision must remain DENY');
  addError(errors, canonicalRoutes?.additionalProperties === 'DENY',
    'canonicalRoutes.additionalProperties must remain DENY');
  return { canonicalRoutes: routes.length, coveredCanonicalRoutes: 0 };
}

function assertCanonicalEventPolicy(errors, policy) {
  const events = policy?.canonicalEventExpectations;
  if (!Array.isArray(events)) {
    errors.push('canonicalEventExpectations must be an array');
    return { canonicalEvents: 0, coveredCanonicalEvents: 0 };
  }
  addError(errors, events.length === EXPECTED_CANONICAL_EVENT_NAMES.length,
    'canonicalEventExpectations must contain exactly nine M1015 v2 events');
  const names = new Set(events.map((event) => event?.eventName));
  addError(errors, names.size === events.length, 'canonicalEventExpectations must not contain duplicate event names');
  for (const [index, expectedName] of EXPECTED_CANONICAL_EVENT_NAMES.entries()) {
    const event = events[index];
    if (!isPlainObject(event)) {
      errors.push(`canonical event at index ${index} must be an object`);
      continue;
    }
    const allowed = [
      'eventName', 'aggregateType', 'aggregateIdField', 'producer', 'consumers', 'topic',
      'requiredPayloadFields', 'requiredFieldValues', 'prohibitedPayloadFields', 'status', 'runtimeStatus', 'partitionKey', 'dedupeKey',
    ];
    assertAllowedKeys(errors, event, allowed, `canonicalEventExpectations[${index}]`);
    for (const requiredKey of allowed.filter((key) => key !== 'requiredFieldValues')) {
      addError(errors, Object.hasOwn(event, requiredKey), `canonicalEventExpectations[${index}] is missing required field ${requiredKey}`);
    }
    addError(errors, event.eventName === expectedName, `canonical event ${index} must be ${expectedName}`);
    addError(errors, isNonEmptyString(event.aggregateType), `${expectedName}.aggregateType must be explicit`);
    addError(errors, isNonEmptyString(event.aggregateIdField), `${expectedName}.aggregateIdField must be explicit`);
    addError(errors, event.producer === 'commerce-service', `${expectedName}.producer must be commerce-service`);
    addError(errors, sameJson(event.consumers, EXPECTED_EVENT_CONSUMERS[expectedName]),
      `${expectedName}.consumers must equal the frozen audit/workflow/content/learning matrix`);
    addError(errors, event.topic === 'platform.commerce.v1', `${expectedName}.topic must remain platform.commerce.v1`);
    addError(errors, Array.isArray(event.requiredPayloadFields) && event.requiredPayloadFields.length > 0,
      `${expectedName}.requiredPayloadFields must be non-empty`);
    if (expectedName === 'commerce.reconciliation.recovery_receipted.v2') {
      assertExactObject(errors, event.requiredFieldValues, {
        state: 'CLOSED',
        postRerunStatus: 'MATCHED_AFTER_RECOVERY',
      }, `${expectedName}.requiredFieldValues`);
    } else {
      addError(errors, event.requiredFieldValues === undefined, `${expectedName} may not introduce extra required field constants`);
    }
    addError(errors, Array.isArray(event.prohibitedPayloadFields) && event.prohibitedPayloadFields.length > 0,
      `${expectedName}.prohibitedPayloadFields must be non-empty`);
    addError(errors, event.status === 'CANONICAL_D2', `${expectedName}.status must remain CANONICAL_D2`);
    addError(errors, event.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${expectedName}.runtimeStatus must remain NOT_RUNTIME_VERIFIED`);
    addError(errors, event.partitionKey === 'aggregateId', `${expectedName}.partitionKey must remain aggregateId`);
    addError(errors, isNonEmptyString(event.dedupeKey), `${expectedName}.dedupeKey must be explicit`);
  }
  return { canonicalEvents: events.length, coveredCanonicalEvents: 0 };
}

function assertNoRuntimePromotion(errors, policy) {
  const boundary = policy?.runtimeBoundary;
  if (!isPlainObject(boundary)) {
    errors.push('runtimeBoundary must be an object');
    return;
  }
  assertKnownKeys(errors, boundary, [
    'contractOnly', 'runtimeEvidence', 'productionPaymentEnabled', 'autoRenewalEnabled', 'liveProviders',
    'realCredentialUse', 'realProviderRoute', 'realProviderTraffic', 'deferredTasks', 'prohibitedRuntimeClaims',
  ], 'runtimeBoundary');
  addError(errors, boundary.contractOnly === true, 'runtimeBoundary.contractOnly must remain true');
  addError(errors, boundary.runtimeEvidence === 'NOT_RUNTIME_VERIFIED',
    'runtimeBoundary.runtimeEvidence must remain NOT_RUNTIME_VERIFIED');
  addError(errors, boundary.productionPaymentEnabled === false, 'runtimeBoundary.productionPaymentEnabled must remain false');
  addError(errors, boundary.autoRenewalEnabled === false, 'runtimeBoundary.autoRenewalEnabled must remain false');
  addError(errors, Array.isArray(boundary.liveProviders) && boundary.liveProviders.length === 0,
    'runtimeBoundary.liveProviders must remain empty');
  for (const field of ['realCredentialUse', 'realProviderRoute', 'realProviderTraffic']) {
    addError(errors, boundary[field] === 'PROHIBITED', `runtimeBoundary.${field} must remain PROHIBITED`);
  }
  addError(errors, Array.isArray(boundary.deferredTasks) && boundary.deferredTasks.length > 0,
    'runtimeBoundary must retain explicit deferred implementation tasks');
  for (const claim of [
    'D2_COMMERCE_CONTRACT_IS_RUNTIME_EVIDENCE',
    'SANDBOX_HMAC_IS_REAL_PAYMENT_PROVIDER_VERIFIED',
    'B5_OR_B13_V1_IS_CANONICAL_RUNTIME',
    'PRODUCTION_PAYMENT_ENABLED',
    'CLIENT_SUCCESS_PAGE_GRANTS_ENTITLEMENT',
    'REFUND_OR_RECONCILIATION_IS_RUNTIME_VERIFIED',
  ]) {
    addError(errors, boundary.prohibitedRuntimeClaims?.includes(claim),
      `runtimeBoundary must prohibit runtime claim ${claim}`);
  }
}

function assertHistoricalPolicy(errors, policy) {
  const candidates = policy?.historicalCandidates;
  if (!isPlainObject(candidates)) {
    errors.push('historicalCandidates must be an object');
    return;
  }
  const names = new Set();
  for (const [id, candidate] of Object.entries(candidates)) {
    if (!isPlainObject(candidate)) {
      errors.push(`historicalCandidates.${id} must be an object`);
      continue;
    }
    for (const eventName of candidate.eventNames ?? []) names.add(eventName);
    addError(errors, candidate.canonical === false, 'historical candidate must remain non-canonical');
    addError(errors, candidate.runtimeAuthority === false, 'historical candidate must not gain runtime authority');
    addError(errors, typeof candidate.classification === 'string'
      && (/HISTORICAL_STATIC(?:_INPUT)?_ONLY$/.test(candidate.classification) || /LEGACY_SEMANTICS_INPUT_ONLY$/.test(candidate.classification)),
    'historical candidate classification must remain static/historical input only');
  }
  for (const eventName of REQUIRED_B5_B13_HISTORICAL_EVENT_NAMES) {
    addError(errors, names.has(eventName), `${eventName} must remain listed as a historical candidate`);
  }
  addError(errors, candidates.b20CommerceEvidence?.maySatisfyM1015RuntimeEvidence === false,
    'B20 historical evidence must not satisfy M1-015 runtime evidence');
}

const EXPECTED_COMMERCE_OBJECTS = [
  'sku', 'priceSnapshot', 'activation', 'order', 'paymentAttempt', 'callbackReceipt',
  'entitlementLedger', 'entitlementSnapshot', 'refund', 'reconciliation',
];

function transitionFor(machine, from, to) {
  return machine?.transitions?.find((transition) => transition?.from === from && transition?.to === to);
}

function transitionRequires(machine, from, to, requiredFields) {
  const transition = transitionFor(machine, from, to);
  return Array.isArray(transition?.requires) && requiredFields.every((field) => transition.requires.includes(field));
}

function assertObjectAndStateMachineProjection(errors, policy) {
  const objects = policy?.objects;
  const machines = policy?.stateMachines;
  assertKnownKeys(errors, objects, EXPECTED_COMMERCE_OBJECTS, 'objects');
  assertKnownKeys(errors, machines, EXPECTED_COMMERCE_OBJECTS, 'stateMachines');
  if (isPlainObject(objects)) {
    for (const objectName of EXPECTED_COMMERCE_OBJECTS) {
      const object = objects[objectName];
      if (!isPlainObject(object)) continue;
      const allowed = [
        'requiredFields', 'termTypes', 'sellableLifetime', 'currencyFormat', 'amountMinorMustBeNonNegative',
        'refundScopes', 'entryTypes', 'clientMaySet', 'serverDerivedFields', 'additionalProperties',
      ];
      const unknown = Object.keys(object).filter((key) => !allowed.includes(key));
      if (unknown.length > 0) errors.push(`objects.${objectName} contains unknown field(s): ${unknown.join(', ')}`);
      addError(errors, Array.isArray(object.requiredFields) && object.requiredFields.length > 0
        && new Set(object.requiredFields).size === object.requiredFields.length,
      `objects.${objectName}.requiredFields must be a non-empty unique array`);
      addError(errors, Array.isArray(object.clientMaySet), `objects.${objectName}.clientMaySet must be an array`);
      addError(errors, object.additionalProperties === 'DENY', `objects.${objectName} must deny additional properties`);
      const client = object.clientMaySet ?? [];
      const server = object.serverDerivedFields ?? [];
      addError(errors, client.every((field) => !server.includes(field)),
        `objects.${objectName} may not expose a server-derived field to clients`);
      for (const field of ['tenantId', 'principalId', 'subjectId', 'ownerId', 'role', 'permission', 'amountMinor', 'currency', 'priceSnapshotId', 'entitlementState', 'state', 'auditRef']) {
        addError(errors, !client.includes(field), `objects.${objectName}.clientMaySet must not include ${field}`);
      }
    }
    addError(errors, sameJson(objects.sku?.termTypes, ['FREE', 'ONE_TIME', 'MONTH', 'QUARTER', 'YEAR', 'PERPETUAL']),
      'SKU termTypes must retain the complete M1-015 vocabulary');
    addError(errors, objects.sku?.sellableLifetime === false, 'SKU lifetime sale must remain disabled');
    addError(errors, !objects.sku?.termTypes?.includes('LIFETIME'), 'SKU termTypes must not include legacy LIFETIME');
    addError(errors, objects.priceSnapshot?.currencyFormat === 'ISO_4217_ALPHA_3', 'priceSnapshot currency must use ISO-4217 alpha-3');
    addError(errors, objects.priceSnapshot?.amountMinorMustBeNonNegative === true, 'priceSnapshot amountMinor must be non-negative');
    addError(errors, sameJson(objects.refund?.refundScopes, ['FULL_ONLY']), 'refund object must expose FULL_ONLY only');
    addError(errors, objects.activation?.clientMaySet?.every((field) => field === 'activationCode') === true,
      'activation object must only accept an activation code from the client');
  }

  if (!isPlainObject(machines)) return;
  for (const objectName of EXPECTED_COMMERCE_OBJECTS) {
    const machine = machines[objectName];
    if (!isPlainObject(machine)) continue;
    assertKnownKeys(errors, machine, [
      'owner', 'states', 'initialStates', 'terminalStates', 'transitions', 'versionField', 'idempotency', 'writeModel', 'directClientWrite',
    ], `stateMachines.${objectName}`);
    addError(errors, machine.owner === 'commerce-service', `stateMachines.${objectName}.owner must be commerce-service`);
    addError(errors, Array.isArray(machine.states) && machine.states.length > 0 && new Set(machine.states).size === machine.states.length,
      `stateMachines.${objectName}.states must be a non-empty unique array`);
    addError(errors, Array.isArray(machine.initialStates) && machine.initialStates.length > 0
      && machine.initialStates.every((state) => machine.states?.includes(state)),
    `stateMachines.${objectName}.initialStates must be known states`);
    addError(errors, Array.isArray(machine.terminalStates) && machine.terminalStates.length > 0
      && machine.terminalStates.every((state) => machine.states?.includes(state)),
    `stateMachines.${objectName}.terminalStates must be known states`);
    addError(errors, isNonEmptyString(machine.versionField), `stateMachines.${objectName}.versionField must be explicit`);
    addError(errors, isNonEmptyString(machine.idempotency), `stateMachines.${objectName}.idempotency must be explicit`);
    addError(errors, isNonEmptyString(machine.writeModel), `stateMachines.${objectName}.writeModel must be explicit`);
    addError(errors, machine.directClientWrite === 'DENY', `stateMachines.${objectName}.directClientWrite must remain DENY`);
    if (!Array.isArray(machine.transitions) || machine.transitions.length === 0) {
      errors.push(`stateMachines.${objectName}.transitions must be non-empty`);
      continue;
    }
    for (const [index, transition] of machine.transitions.entries()) {
      assertKnownKeys(errors, transition, ['from', 'to', 'actor', 'requires'], `stateMachines.${objectName}.transitions[${index}]`);
      addError(errors, machine.states.includes(transition?.from) && machine.states.includes(transition?.to),
        `stateMachines.${objectName}.transitions[${index}] must stay within known states`);
      addError(errors, ['commerce-service', 'workflow-service'].includes(transition?.actor),
        `stateMachines.${objectName}.transitions[${index}].actor must be a service owner`);
      addError(errors, Array.isArray(transition?.requires) && transition.requires.length > 0,
        `stateMachines.${objectName}.transitions[${index}].requires must be non-empty`);
    }
  }

  addError(errors, transitionRequires(machines.callbackReceipt, 'RECEIVED', 'VERIFIED', [
    'validHmac', 'freshTimestamp', 'uniqueNonce', 'orderBinding', 'tupleDigest',
  ]), 'callback verification must require HMAC, timestamp, nonce, binding, and tuple digest');
  addError(errors, transitionRequires(machines.callbackReceipt, 'RECEIVED', 'COLLISION', [
    'sameProviderEventIdentityDifferentTupleDigest', 'reconciliationManualHold',
  ]), 'callback digest collision must create a reconciliation manual hold');
  addError(errors, transitionRequires(machines.order, 'PAID', 'REFUND_PENDING', ['refundId', 'fullRefundOnly']),
    'order may enter refund pending only through a full-refund request');
  addError(errors, transitionRequires(machines.refund, 'PROVIDER_PENDING', 'SETTLED', [
    'verifiedProviderRefundSettlement', 'fullAmountMatchesOrder', 'entitlementRevocationLedgerRef', 'auditRef',
  ]), 'refund settlement must require verified full settlement, revoke ledger, and audit');
  addError(errors, transitionRequires(machines.entitlementSnapshot, 'PENDING', 'ACTIVE', [
    'verifiedPaymentOrRedeemedActivationLedger', 'entitlementVersion', 'sourceVersion', 'policyVersion',
  ]), 'entitlement activation must retain versioned verified-source requirements');
  addError(errors, transitionRequires(machines.entitlementSnapshot, 'ACTIVE', 'REVOKED', [
    'verifiedRefundOrRevocationOrSecurityFact', 'entitlementVersion', 'tombstone',
  ]), 'entitlement revocation must be a versioned source fact');
  addError(errors, transitionRequires(machines.reconciliation, 'POST_RERUN_PENDING', 'MATCHED_AFTER_RECOVERY', [
    'postRerunMatched', 'postRerunStatus=MATCHED_AFTER_RECOVERY',
  ]), 'reconciliation closure requires a matched-after-recovery rerun');
  addError(errors, transitionRequires(machines.reconciliation, 'MATCHED_AFTER_RECOVERY', 'CLOSED', [
    'closureReceipt', 'postRerunStatus=MATCHED_AFTER_RECOVERY', 'auditRef',
  ]), 'reconciliation must retain closure receipt and audit after recovery');
}

function assertScopeAndProhibitions(errors, policy) {
  const scope = policy?.scopeExclusions;
  assertKnownKeys(errors, scope, [
    'household', 'coupon', 'accountMerge', 'sellableLifetimeSku', 'iOSProductionPurchaseRestore', 'additionalProperties',
  ], 'scopeExclusions');
  const clientFlagByScope = {
    household: 'clientMayCreateOrMutate',
    coupon: 'clientMayApply',
    accountMerge: 'clientMayMerge',
    sellableLifetimeSku: 'clientMayPurchase',
    iOSProductionPurchaseRestore: 'clientMayTreatRestoreAsEntitlementGrant',
  };
  for (const [name, clientFlag] of Object.entries(clientFlagByScope)) {
    const entry = scope?.[name];
    assertKnownKeys(errors, entry, ['enabled', 'reason', clientFlag], `scopeExclusions.${name}`);
    addError(errors, entry?.enabled === false, `scopeExclusions.${name}.enabled must remain false`);
    addError(errors, entry?.[clientFlag] === false, `scopeExclusions.${name}.${clientFlag} must remain false`);
    addError(errors, isNonEmptyString(entry?.reason), `scopeExclusions.${name}.reason must remain explicit`);
  }
  addError(errors, scope?.additionalProperties === 'DENY', 'scopeExclusions.additionalProperties must remain DENY');
  addError(errors, sameJson(policy?.phase1Prohibitions, EXPECTED_PHASE1_PROHIBITIONS),
    'phase1Prohibitions must equal the frozen commercial safety exclusions');
}

function assertPolicySections(errors, policy) {
  assertNoRuntimePromotion(errors, policy);
  assertHistoricalPolicy(errors, policy);

  const authority = policy?.authority;
  assertKnownKeys(errors, authority, [
    'phase1Population', 'principalAndTenant', 'gatewayIsNotDomainWriter', 'commerceServicePepRequired',
    'contentServicePepRequired', 'learningServicePepRequired', 'clientMayProduceKafkaFacts', 'clientMaySet',
    'serverDerivedFields', 'opaqueServerIssuedReferenceFields', 'forbiddenClientAuthorityFields',
  ], 'authority');
  if (isPlainObject(authority)) {
    addError(errors, authority.phase1Population === 'ADULT_18_PLUS_ONLY', 'authority.phase1Population must remain ADULT_18_PLUS_ONLY');
    addError(errors, authority.principalAndTenant === 'SERVER_DERIVED_FROM_VERIFIED_TOKEN',
      'authority.principalAndTenant must remain server-derived');
    addError(errors, authority.gatewayIsNotDomainWriter === true, 'authority.gatewayIsNotDomainWriter must remain true');
    for (const field of ['commerceServicePepRequired', 'contentServicePepRequired', 'learningServicePepRequired']) {
      addError(errors, authority[field] === true, `authority.${field} must remain true`);
    }
    addError(errors, authority.clientMayProduceKafkaFacts === false, 'authority.clientMayProduceKafkaFacts must remain false');
    addError(errors, Array.isArray(authority.clientMaySet) && authority.clientMaySet.length === 0,
      'authority.clientMaySet must remain empty');
    const forbidden = authority.forbiddenClientAuthorityFields ?? [];
    for (const field of ['tenantId', 'principalId', 'ownerId', 'role', 'permission', 'priceSnapshotId', 'amountMinor', 'currency', 'entitlementState']) {
      addError(errors, forbidden.includes(field), `authority must forbid client ${field}`);
    }
  }

  const payment = policy?.paymentPolicy;
  assertKnownKeys(errors, payment, [
    'productionPaymentEnabled', 'autoRenewalEnabled', 'activeProviders', 'liveProviders', 'providerEnvironment',
    'providerAllowListOnly', 'realCredentials', 'realRoutes', 'realTraffic', 'clientMaySelectEnvironment',
    'clientMaySetPaymentResult', 'clientMayGrantEntitlement', 'productionEnablement',
    'requiredFutureProductionEvidence', 'additionalProperties',
  ], 'paymentPolicy');
  if (isPlainObject(payment)) {
    addError(errors, payment.productionPaymentEnabled === false, 'paymentPolicy.productionPaymentEnabled must remain false');
    addError(errors, payment.autoRenewalEnabled === false, 'paymentPolicy.autoRenewalEnabled must remain false');
    addError(errors, sameJson(payment.activeProviders, ['SANDBOX_HMAC']), 'paymentPolicy.activeProviders must remain SANDBOX_HMAC only');
    addError(errors, Array.isArray(payment.liveProviders) && payment.liveProviders.length === 0, 'paymentPolicy.liveProviders must remain empty');
    addError(errors, payment.providerEnvironment === 'SANDBOX', 'paymentPolicy.providerEnvironment must remain SANDBOX');
    addError(errors, payment.providerAllowListOnly === true, 'paymentPolicy.providerAllowListOnly must remain true');
    for (const field of ['realCredentials', 'realRoutes', 'realTraffic']) {
      addError(errors, payment[field] === 'PROHIBITED', `paymentPolicy.${field} must remain PROHIBITED`);
    }
    for (const field of ['clientMaySelectEnvironment', 'clientMaySetPaymentResult', 'clientMayGrantEntitlement']) {
      addError(errors, payment[field] === false, `paymentPolicy.${field} must remain false`);
    }
    addError(errors, payment.additionalProperties === 'DENY', 'paymentPolicy.additionalProperties must remain DENY');
  }

  const activation = policy?.activationPolicy;
  assertKnownKeys(errors, activation, [
    'owner', 'digestAlgorithm', 'storage', 'opaqueRedemptionRefRequired', 'oneRedemptionOnly', 'atomicClaimRequired',
    'clientCodeAcceptedOnlyAt', 'maximumRedeemAttemptsPerPrincipalPerWindow', 'redeemAttemptWindowSeconds',
    'cooldownAfterLimitSeconds', 'sameKeySamePayload', 'sameKeyDifferentPayload', 'eventAndAuditProhibitedFields',
    'allowedEventAndAuditReferenceFields', 'supportMayResetCode', 'additionalProperties',
  ], 'activationPolicy');
  if (isPlainObject(activation)) {
    addError(errors, activation.owner === 'commerce-service', 'activationPolicy.owner must be commerce-service');
    addError(errors, activation.digestAlgorithm === 'SHA-256', 'activationPolicy.digestAlgorithm must remain SHA-256');
    addError(errors, activation.storage === 'DIGEST_ONLY_OWNER_PROTECTED_STORE', 'activation code storage must remain digest-only');
    for (const field of ['opaqueRedemptionRefRequired', 'oneRedemptionOnly', 'atomicClaimRequired']) {
      addError(errors, activation[field] === true, `activationPolicy.${field} must remain true`);
    }
    addError(errors, activation.clientCodeAcceptedOnlyAt === 'REDEEM_ROUTE', 'activation code may be accepted only at the redeem route');
    addError(errors, activation.maximumRedeemAttemptsPerPrincipalPerWindow === 5, 'activation rate-limit maximum must remain five');
    addError(errors, activation.redeemAttemptWindowSeconds === 900, 'activation rate-limit window must remain 900 seconds');
    addError(errors, activation.cooldownAfterLimitSeconds === 900, 'activation cooldown must remain 900 seconds');
    addError(errors, activation.sameKeySamePayload === 'RETURN_ORIGINAL_REDEMPTION_RESULT', 'activation same key/same payload must replay original result');
    addError(errors, activation.sameKeyDifferentPayload === 'DENY_CONFLICT', 'activation same key/different payload must deny');
    addError(errors, activation.supportMayResetCode === false, 'support may not reset an activation code');
    for (const field of ['activationCode', 'rawActivationCode', 'activationCodeDigest', 'activationCodeHash', 'activationCodeHashPrefix', 'activationCodePrefix', 'redemptionSecret']) {
      addError(errors, activation.eventAndAuditProhibitedFields?.includes(field), `activation secret field ${field} must remain prohibited`);
    }
    addError(errors, activation.additionalProperties === 'DENY', 'activationPolicy.additionalProperties must remain DENY');
  }

  const callback = policy?.callbackPolicy;
  assertKnownKeys(errors, callback, [
    'owner', 'internalRouteOnly', 'signatureAlgorithm', 'allowedProvider', 'allowedEnvironment', 'canonicalSigningTuple',
    'signingTupleOrderImmutable', 'canonicalSigningTupleSources', 'singleSourceRequired', 'forbiddenCallbackBodyFields',
    'freshnessMaxAgeSeconds', 'futureSkewMaxSeconds', 'nonceRetentionSeconds', 'nonceReuseDecision', 'dedupeKeyFields',
    'dedupeTenantSource', 'tupleDigestAlgorithm', 'duplicateDecision', 'collisionDefinition',
    'collisionDecision', 'orderBinding', 'keyLifecycle', 'forbiddenCallbackFieldsInEventsAndAudit', 'additionalProperties',
  ], 'callbackPolicy');
  if (isPlainObject(callback)) {
    addError(errors, callback.owner === 'commerce-service', 'callbackPolicy.owner must be commerce-service');
    addError(errors, callback.internalRouteOnly === true, 'provider callback must remain internal-only');
    addError(errors, callback.signatureAlgorithm === 'HMAC-SHA256', 'callback signature must remain HMAC-SHA256 sandbox-only');
    addError(errors, callback.allowedProvider === 'SANDBOX_HMAC', 'callback provider must remain SANDBOX_HMAC');
    addError(errors, callback.allowedEnvironment === 'SANDBOX', 'callback environment must remain SANDBOX');
    addError(errors, sameJson(callback.canonicalSigningTuple, [
      'provider', 'environment', 'providerEventId', 'transactionId', 'orderId', 'paymentAttemptId',
      'amountMinor', 'currency', 'result', 'occurredAt', 'nonce', 'keyId',
    ]), 'callback canonical signing tuple must remain complete and ordered');
    addError(errors, callback.signingTupleOrderImmutable === true, 'callback signing tuple order must remain immutable');
    assertExactObject(errors, callback.canonicalSigningTupleSources, {
      provider: 'path.provider',
      environment: 'header.X-Provider-Environment',
      providerEventId: 'body.providerEventId',
      transactionId: 'body.transactionId',
      orderId: 'body.orderId',
      paymentAttemptId: 'body.paymentAttemptId',
      amountMinor: 'body.amountMinor',
      currency: 'body.currency',
      result: 'body.result',
      occurredAt: 'body.occurredAt',
      nonce: 'header.X-Provider-Nonce',
      keyId: 'header.X-Provider-Key-Id',
    }, 'callbackPolicy.canonicalSigningTupleSources');
    addError(errors, callback.singleSourceRequired === true, 'callback tuple values must each have exactly one source');
    addError(errors, sameJson(callback.forbiddenCallbackBodyFields, ['provider', 'environment', 'nonce', 'keyId']),
      'callback body must forbid duplicate provider/environment/nonce/key-id sources');
    addError(errors, callback.freshnessMaxAgeSeconds === 300, 'callback freshness window must remain 300 seconds');
    addError(errors, callback.futureSkewMaxSeconds === 30, 'callback future skew must remain 30 seconds');
    addError(errors, callback.nonceRetentionSeconds === 86400, 'callback nonce retention must remain 86400 seconds');
    addError(errors, callback.nonceReuseDecision === 'DENY', 'callback nonce reuse must remain DENY');
    addError(errors, sameJson(callback.dedupeKeyFields, ['tenantId', 'provider', 'providerEventId']),
      'callback dedupe tuple must remain server tenant/provider/provider-event');
    addError(errors, callback.dedupeTenantSource === 'SERVER_DERIVED_AUTHENTICATED_TENANT',
      'callback tenant dedupe identity must remain server-derived');
    addError(errors, callback.tupleDigestAlgorithm === 'SHA-256', 'callback tuple digest must remain SHA-256');
    addError(errors, callback.duplicateDecision === 'DEDUPE_NO_NEW_PAYMENT_OR_ENTITLEMENT', 'callback duplicate must never create a new effect');
    addError(errors, callback.collisionDecision === 'DENY_AND_CREATE_RECONCILIATION_MANUAL_HOLD', 'callback collision must deny and create manual hold');
    assertExactObject(errors, callback.orderBinding, {
      required: true,
      mustMatchFields: ['orderId', 'paymentAttemptId', 'provider', 'amountMinor', 'currency', 'result'],
      mismatchDecision: 'DENY',
    }, 'callbackPolicy.orderBinding');
    assertExactObject(errors, callback.keyLifecycle, {
      keyType: 'HMAC_SHARED_SECRET_REFERENCE',
      keyIdSource: 'header.X-Provider-Key-Id',
      rotationMode: 'ATOMIC_SINGLE_ACTIVE',
      acceptedStatuses: ['ACTIVE'],
      maximumActiveKeys: 1,
      unknownKeyDecision: 'DENY',
      revokedKeyDecision: 'DENY',
      expiredKeyDecision: 'DENY',
      overlapDecision: 'DENY',
      rotationAuditRequired: true,
      rotationReceiptRequired: true,
      keyMaterialInContractLogEvent: 'PROHIBITED',
    }, 'callbackPolicy.keyLifecycle');
    for (const field of ['rawBody', 'rawHeaders', 'signature', 'hmac', 'sharedSecret', 'credential', 'providerToken', 'transactionId', 'providerTransactionRef', 'nonce', 'keyMaterial']) {
      addError(errors, callback.forbiddenCallbackFieldsInEventsAndAudit?.includes(field), `callback sensitive field ${field} must remain prohibited`);
    }
    addError(errors, callback.additionalProperties === 'DENY', 'callbackPolicy.additionalProperties must remain DENY');
  }

  const entitlement = policy?.entitlementPolicy;
  assertKnownKeys(errors, entitlement, [
    'commerceOwner', 'contentPepOwner', 'learningPepOwner', 'clientOrGatewayMayCacheAsFact', 'requiredVersionFields',
    'snapshotReadRequiredBeforeRendering', 'cache', 'grace', 'activationSources', 'forbiddenActivationSources',
    'additionalProperties',
  ], 'entitlementPolicy');
  if (isPlainObject(entitlement)) {
    addError(errors, entitlement.commerceOwner === 'commerce-service', 'commerce must remain the entitlement owner');
    addError(errors, entitlement.contentPepOwner === 'content-service', 'content service must own its entitlement PEP');
    addError(errors, entitlement.learningPepOwner === 'learning-service', 'learning service must own its entitlement PEP');
    addError(errors, entitlement.clientOrGatewayMayCacheAsFact === false, 'client or gateway cache must not become entitlement fact');
    addError(errors, sameJson(entitlement.requiredVersionFields, ['entitlementVersion', 'sourceVersion', 'policyVersion']),
      'entitlement versions must remain entitlement/source/policy');
    addError(errors, entitlement.snapshotReadRequiredBeforeRendering === true, 'entitlement snapshot must be server-read before rendering');
    const cache = entitlement.cache;
    addError(errors, cache?.mode === 'LOCAL_PEP_SAFE_SHORT_CACHE_ONLY', 'entitlement cache must remain local PEP safe short cache only');
    addError(errors, cache?.ttlSeconds === 30, 'entitlement cache TTL must remain 30 seconds');
    for (const field of ['monotonicInvalidationRequired', 'tombstoneRequired']) {
      addError(errors, cache?.[field] === true, `entitlement cache ${field} must remain true`);
    }
    for (const field of ['cacheMissDecision', 'expiredDecision', 'unknownDecision', 'versionMismatchDecision', 'revocationUncertainDecision', 'pdpUnavailableDecision']) {
      addError(errors, cache?.[field] === 'DENY', `entitlement cache ${field} must remain DENY`);
    }
    const grace = entitlement.grace;
    addError(errors, grace?.defaultGraceSeconds === 0, 'default entitlement grace must remain zero');
    addError(errors, grace?.requiresExplicitServerPolicy === true, 'grace must require explicit server policy');
    addError(errors, grace?.allowedMode === 'BOUNDED_ACTIVE_ONLY' && grace?.eligibleState === 'ACTIVE'
      && grace?.maximumGraceSeconds === 300,
    'grace must remain bounded to verified ACTIVE facts for at most 300 seconds');
    addError(errors, sameJson(grace?.requiredFieldsWhenEnabled, ['graceUntil', 'graceReason', 'policyVersion']),
      'enabled grace must require graceUntil/graceReason/policyVersion');
    for (const reason of ['REFUND', 'REVOKE', 'EXPIRE', 'SECURITY', 'UNKNOWN']) {
      addError(errors, grace?.neverGraceReasons?.includes(reason), `grace must never apply to ${reason}`);
    }
    addError(errors, sameJson(entitlement.activationSources, ['VERIFIED_PAYMENT', 'REDEEMED_ACTIVATION']),
      'entitlement activation sources must remain verified payment or redeemed activation');
    for (const source of ['CLIENT_SUCCESS_PAGE', 'UNVERIFIED_CALLBACK', 'GATEWAY_CACHE', 'CLIENT_CACHE', 'SUPPORT_DIRECT_WRITE']) {
      addError(errors, entitlement.forbiddenActivationSources?.includes(source), `entitlement activation source ${source} must remain forbidden`);
    }
    addError(errors, entitlement.additionalProperties === 'DENY', 'entitlementPolicy.additionalProperties must remain DENY');
  }

  const refund = policy?.refundPolicy;
  assertKnownKeys(errors, refund, [
    'owner', 'refundScope', 'partialRefundAllowed', 'financeAuthorizationRequired', 'secondaryConfirmationRequired',
    'supportMaySettleOrRevoke', 'revokeOnlyAfter', 'preSettlementEntitlementRevocation', 'settlementRequires',
    'successEvent', 'additionalProperties',
  ], 'refundPolicy');
  if (isPlainObject(refund)) {
    addError(errors, refund.owner === 'commerce-service', 'refundPolicy.owner must be commerce-service');
    addError(errors, refund.refundScope === 'FULL_ONLY' && refund.partialRefundAllowed === false, 'refunds must remain FULL_ONLY');
    addError(errors, refund.financeAuthorizationRequired === true && refund.secondaryConfirmationRequired === true,
      'refunds must retain finance authorization and secondary confirmation');
    addError(errors, refund.supportMaySettleOrRevoke === false, 'support must not settle refunds or revoke entitlements');
    addError(errors, refund.revokeOnlyAfter === 'SETTLED' && refund.preSettlementEntitlementRevocation === 'DENY',
      'entitlement revocation must occur only after settled refund');
    for (const field of ['verifiedProviderRefundSettlement', 'fullAmountMatchesOrder', 'immutableRefundFact', 'entitlementRevocationLedgerRef', 'auditRef']) {
      addError(errors, refund.settlementRequires?.includes(field), `refund settlement must require ${field}`);
    }
    addError(errors, refund.successEvent === 'commerce.refund.settled.v2', 'refund success event must remain commerce.refund.settled.v2');
    addError(errors, refund.additionalProperties === 'DENY', 'refundPolicy.additionalProperties must remain DENY');
  }

  const reconciliation = policy?.reconciliationPolicy;
  assertKnownKeys(errors, reconciliation, [
    'owner', 'workflowCoordinator', 'mismatchMustCreateManualHold', 'manualHoldDirectDomainWrite',
    'twoDistinctApprovalsRequired', 'approvalBindingFields', 'approvalResolution', 'preconditionsRequired', 'idempotency', 'auditRequired',
    'closureReceiptRequired', 'closureReceiptFields', 'requiredPostRerunStatus', 'ticketOrDlqCloseIsNotReconciliation',
    'discrepancyEvent', 'recoveryReceiptEvent', 'additionalProperties',
  ], 'reconciliationPolicy');
  if (isPlainObject(reconciliation)) {
    addError(errors, reconciliation.owner === 'commerce-service' && reconciliation.workflowCoordinator === 'workflow-service',
      'reconciliation must remain commerce-owned and workflow-coordinated');
    for (const field of ['mismatchMustCreateManualHold', 'twoDistinctApprovalsRequired', 'auditRequired', 'closureReceiptRequired', 'ticketOrDlqCloseIsNotReconciliation']) {
      addError(errors, reconciliation[field] === true, `reconciliationPolicy.${field} must remain true`);
    }
    addError(errors, reconciliation.manualHoldDirectDomainWrite === 'DENY', 'manual reconciliation hold must not directly write domain facts');
    const approvalBindings = [
      'reconciliationId', 'reconciliationVersion', 'remediationPlanDigest',
      'preconditionDigest', 'sourceFactDigest', 'policyVersion',
    ];
    addError(errors, sameJson(reconciliation.approvalBindingFields, approvalBindings),
      'reconciliation approvals must bind the exact case/version/digest/policy facts');
    assertExactObject(errors, reconciliation.approvalResolution, {
      source: 'SERVER_RESOLVED_IAM_APPROVAL_RECEIPTS',
      requiredCount: 2,
      approverPrincipalsMustBeDistinct: true,
      requiredPermission: 'commerce.reconciliation.approve.finance',
      requiredApprovalStatus: 'ACTIVE',
      bindingFields: approvalBindings,
      unknownRefDecision: 'DENY',
      samePrincipalDecision: 'DENY',
      staleApprovalDecision: 'DENY',
      revokedApprovalDecision: 'DENY',
      mismatchedBindingDecision: 'DENY',
      principalIdsInContractOrEvent: 'PROHIBITED',
      resolutionAuditRequired: true,
    }, 'reconciliationPolicy.approvalResolution');
    addError(errors, reconciliation.closureReceiptFields?.includes('approvalRefs'),
      'reconciliation closure receipt must retain both immutable approval refs');
    addError(errors, reconciliation.idempotency === 'SOURCE_FACT_SET_AND_REMEDIATION_PLAN_DIGEST_UNIQUE',
      'reconciliation idempotency must bind source facts and remediation plan');
    addError(errors, reconciliation.requiredPostRerunStatus === 'MATCHED_AFTER_RECOVERY',
      'reconciliation must require MATCHED_AFTER_RECOVERY post-rerun');
    addError(errors, reconciliation.discrepancyEvent === 'commerce.reconciliation.discrepancy_recorded.v2',
      'reconciliation discrepancy event must remain v2');
    addError(errors, reconciliation.recoveryReceiptEvent === 'commerce.reconciliation.recovery_receipted.v2',
      'reconciliation recovery receipt event must remain v2');
    addError(errors, reconciliation.additionalProperties === 'DENY', 'reconciliationPolicy.additionalProperties must remain DENY');
  }

  const sensitive = policy?.sensitiveDataPolicy;
  assertKnownKeys(errors, sensitive, ['eventPayloadAllowList', 'eventPayloadDenyList', 'auditPayloadDenyList', 'redactionRequired', 'additionalProperties'], 'sensitiveDataPolicy');
  if (isPlainObject(sensitive)) {
    for (const field of ['activationCode', 'activationCodeDigest', 'rawCallback', 'signature', 'hmac', 'credential', 'providerToken', 'nonce', 'keyMaterial']) {
      addError(errors, sensitive.eventPayloadDenyList?.includes(field), `sensitive event deny list must include ${field}`);
    }
    addError(errors, sensitive.redactionRequired === true, 'sensitiveDataPolicy.redactionRequired must remain true');
    addError(errors, sensitive.additionalProperties === 'DENY', 'sensitiveDataPolicy.additionalProperties must remain DENY');
  }

  assertObjectAndStateMachineProjection(errors, policy);
  assertScopeAndProhibitions(errors, policy);
}

function assertCanonicalRouteProjection(errors, policy, openApi) {
  const routes = policy?.canonicalRouteExpectations;
  if (!Array.isArray(routes) || !isPlainObject(openApi)) {
    return { canonicalRoutes: Array.isArray(routes) ? routes.length : 0, coveredCanonicalRoutes: 0 };
  }
  const routeByOperationId = new Map(routes.filter(isPlainObject).map((route) => [route.operationId, route]));
  const m1015OpenApiSubgraph = {
    parameters: Object.fromEntries(Object.entries(openApi?.components?.parameters ?? {})
      .filter(([name]) => name.startsWith('M1015'))),
    schemas: Object.fromEntries(Object.entries(openApi?.components?.schemas ?? {})
      .filter(([name]) => name.startsWith('M1015'))),
    operations: EXPECTED_CANONICAL_ROUTES.map((route) => operationFor(openApi, route)),
  };
  const unsupportedKeywords = keywordPaths(m1015OpenApiSubgraph, FORBIDDEN_OAS30_SCHEMA_KEYWORDS);
  addError(errors, unsupportedKeywords.length === 0,
    `M1015 OpenAPI 3.0.3 subgraph contains unsupported schema keyword(s): ${unsupportedKeywords.join(', ')}`);
  const observedCanonical = [];
  for (const [pathName, pathItem] of Object.entries(openApi.paths ?? {})) {
    if (!isPlainObject(pathItem)) continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isPlainObject(operation) || !isPlainObject(operation['x-contract'])) continue;
      if (operation['x-contract'].task === 'P1R-M1-015' && operation['x-contract'].canonical === true) {
        observedCanonical.push(operation.operationId);
      }
    }
  }
  addError(errors, sameStringSet(observedCanonical, EXPECTED_CANONICAL_ROUTE_OPERATION_IDS),
    'B13 M1015 OpenAPI must expose exactly the thirteen approved canonical operationIds');

  let coveredCanonicalRoutes = 0;
  for (const expected of EXPECTED_CANONICAL_ROUTES) {
    const route = routeByOperationId.get(expected.operationId);
    if (!isPlainObject(route)) {
      errors.push(`policy is missing canonical route ${expected.operationId}`);
      continue;
    }
    const operation = operationFor(openApi, expected);
    if (!isPlainObject(operation)) {
      errors.push(`${expected.operationId} canonical path/method is missing from B13 M1015 OpenAPI`);
      continue;
    }
    coveredCanonicalRoutes += 1;
    addError(errors, operation.operationId === expected.operationId, `${expected.operationId} operationId must match canonical policy`);
    addError(errors, operation['x-owner'] === 'commerce-service', `${expected.operationId} x-owner must be commerce-service`);
    addError(errors, operation['x-contract']?.task === 'P1R-M1-015', `${expected.operationId} x-contract.task must be P1R-M1-015`);
    addError(errors, operation['x-contract']?.canonical === true, `${expected.operationId} must be marked canonical`);
    addError(errors, operation['x-contract']?.maturity === 'D2_CONTRACT_READY', `${expected.operationId} must remain D2_CONTRACT_READY`);
    addError(errors, operation['x-contract']?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${expected.operationId} must remain NOT_RUNTIME_VERIFIED`);
    addError(errors, operation['x-contract']?.clientAuthority === 'NONE', `${expected.operationId} x-contract must deny client authority`);
    addError(errors, sameJson(operation.security, securityRequirementFor(expected.security)), `${expected.operationId} security must equal frozen policy`);
    addError(errors, operation['x-authorization']?.defaultDecision === 'DENY', `${expected.operationId} must default DENY`);
    addError(errors, operation['x-authorization']?.requiredPermission === expected.requiredPermission,
      `${expected.operationId} required permission must equal frozen policy`);
    addError(errors, operation['x-authorization']?.clientAuthority === 'NONE',
      `${expected.operationId} authorization must reject client authority`);
    addError(errors, Array.isArray(operation['x-authorization']?.trustedFacts)
      && operation['x-authorization'].trustedFacts.length > 0,
    `${expected.operationId} must declare explicit trusted server/workload facts`);

    if (route.idempotency === 'REQUIRED') {
      addError(errors, idempotencyParameterIsRequired(openApi, operation), `${expected.operationId} must require Idempotency-Key`);
      addError(errors, operation['x-idempotency']?.required === true, `${expected.operationId} x-idempotency.required must be true`);
      addError(errors, operation['x-idempotency']?.sameKeyDifferentDigest === 'CONFLICT_409',
        `${expected.operationId} must reject same-key/different-digest reuse`);
    } else if (expected.operationId === 'resolveM1015CommerceEntitlementSnapshot') {
      // This is the sole POST read exception.  It carries version/invalidation preconditions,
      // but must never manufacture a durable idempotency claim or a client key requirement.
      addError(errors, !idempotencyParameterIsRequired(openApi, operation),
        `${expected.operationId} must not require Idempotency-Key for its non-mutating snapshot read`);
      assertKnownKeys(errors, operation['x-idempotency'], ['required', 'strategy', 'keyHeader', 'replayBehavior'],
        `${expected.operationId}.x-idempotency`);
      addError(errors, operation['x-idempotency']?.required === false,
        `${expected.operationId} must explicitly declare x-idempotency.required=false`);
      addError(errors, operation['x-idempotency']?.strategy === 'versioned-entitlement-snapshot-read',
        `${expected.operationId} must retain the versioned snapshot-read idempotency exception`);
      addError(errors, operation['x-idempotency']?.keyHeader === 'Idempotency-Key',
        `${expected.operationId} must retain the explicit idempotency-key vocabulary`);
      addError(errors, operation['x-idempotency']?.replayBehavior === 'resolve the current versioned entitlement snapshot without creating a durable domain mutation',
        `${expected.operationId} must state that the exception creates no durable mutation`);
      assertKnownKeys(errors, operation['x-p1r-idempotency-exception'], ['rule', 'reason', 'owner', 'safeBehavior'],
        `${expected.operationId}.x-p1r-idempotency-exception`);
      addError(errors, operation['x-p1r-idempotency-exception']?.rule === 'writeIdempotency'
        && operation['x-p1r-idempotency-exception']?.owner === 'commerce-service'
        && isNonEmptyString(operation['x-p1r-idempotency-exception']?.reason)
        && isNonEmptyString(operation['x-p1r-idempotency-exception']?.safeBehavior),
      `${expected.operationId} must retain its explicit commerce-owned safe POST-read exception`);
    } else {
      addError(errors, operation['x-idempotency'] === undefined && operation['x-p1r-idempotency-exception'] === undefined,
        `${expected.operationId} must not claim unnecessary idempotency`);
    }

    if (expected.requestSchema !== 'NONE') {
      const requestSchema = operation.requestBody?.content?.['application/json']?.schema;
      addError(errors, schemaContainsReference(requestSchema, `#/components/schemas/${expected.requestSchema}`),
        `${expected.operationId} request must reference ${expected.requestSchema}`);
      const resolved = resolveRequestSchema(openApi, operation);
      assertClosedSchema(errors, resolved, `${expected.requestSchema}`);
      addError(errors, resolved?.['x-contract']?.task === 'P1R-M1-015'
        && resolved?.['x-contract']?.clientAuthority === 'NONE',
      `${expected.requestSchema} must be a D2 server-authoritative M1-015 request shape`);
      const forbidden = route.requestAuthority?.forbiddenFields ?? [];
      addError(errors, forbidden.every((field) => resolved?.['x-forbidden-client-fields']?.includes(field)
        || !Object.hasOwn(resolved?.properties ?? {}, field)),
      `${expected.operationId} request must not expose policy-forbidden client fields`);
      if (expected.operationId !== 'consumeB13PaymentProviderCallback') {
        const callerSupplied = [
          ...(route.requestAuthority?.clientAllowedFields ?? []),
          ...(route.requestAuthority?.trustedWorkloadSuppliedFields ?? []),
        ];
        addError(errors, sameStringSet(Object.keys(resolved?.properties ?? {}), callerSupplied),
          `${expected.operationId} request properties must exactly equal its policy-authorized input fields`);
        addError(errors, (route.requestAuthority?.serverDerivedFields ?? []).every((field) => !Object.hasOwn(resolved?.properties ?? {}, field)),
          `${expected.operationId} request must not expose server-derived fields`);
      }
    } else {
      addError(errors, operation.requestBody === undefined, `${expected.operationId} must not expose a request body`);
    }
    addError(errors, findSuccessResponseSchema(operation, expected.responseSchema) !== null,
      `${expected.operationId} success response must reference ${expected.responseSchema}`);
  }

  const requestSchemaFor = (operationId) => resolveRequestSchema(
    openApi,
    operationFor(openApi, EXPECTED_ROUTE_BY_OPERATION_ID.get(operationId)),
  );
  const orderCreate = requestSchemaFor('createB13CommerceOrder');
  addError(errors, Object.hasOwn(orderCreate?.properties ?? {}, 'expectedPriceSnapshotId')
    && !Object.hasOwn(orderCreate?.properties ?? {}, 'priceSnapshotId')
    && orderCreate?.required?.includes('expectedPriceSnapshotId'),
  'order creation must accept expectedPriceSnapshotId only as a required precondition, never a client price snapshot fact');
  const paymentIntent = requestSchemaFor('prepareB13PaymentIntent');
  addError(errors, !Object.hasOwn(paymentIntent?.properties ?? {}, 'environment'),
    'payment-intent request must not let the client select an environment');
  const activation = requestSchemaFor('redeemB13ActivationCode');
  addError(errors, sameStringSet(Object.keys(activation?.properties ?? {}), ['activationCode'])
    && sameJson(activation?.required, ['activationCode']),
  'activation redemption request must accept activationCode only');
  const refund = requestSchemaFor('requestB13OrderRefund');
  addError(errors, !Object.hasOwn(refund?.properties ?? {}, 'refundMode'),
    'refund request must not accept a client-selected refundMode');
  const resolveSnapshot = requestSchemaFor('resolveM1015CommerceEntitlementSnapshot');
  const entitlementSnapshot = openApi?.components?.schemas?.M1015EntitlementSnapshot;
  addError(errors, !Object.hasOwn(resolveSnapshot?.properties ?? {}, 'consumerService'),
    'entitlement resolution must not accept consumerService');
  addError(errors, ['entitlementCode', 'entitlementVersion', 'policyVersion', 'tombstone', 'invalidation']
    .every((field) => entitlementSnapshot?.required?.includes(field)),
  'entitlement snapshot must pin entitlementCode/version/policy/tombstone/invalidation');
  const reconciliationReplay = requestSchemaFor('replayB13CommerceReconciliation');
  const approvalRefs = reconciliationReplay?.properties?.approvalRefs;
  const sourceFactDigests = reconciliationReplay?.properties?.sourceFactDigests;
  addError(errors, approvalRefs?.type === 'array' && approvalRefs?.minItems === 2 && approvalRefs?.maxItems === 2
    && approvalRefs?.uniqueItems === true,
  'reconciliation approvalRefs must be exactly two unique approvals');
  addError(errors, sourceFactDigests?.type === 'array' && sourceFactDigests?.minItems >= 1
    && sourceFactDigests?.uniqueItems === true && typeof sourceFactDigests?.items?.pattern === 'string'
    && /\{64\}/.test(sourceFactDigests.items.pattern),
  'reconciliation sourceFactDigests must be a non-empty unique SHA-256 collection');
  addError(errors, sameStringSet(reconciliationReplay?.required, Object.keys(reconciliationReplay?.properties ?? {})),
    'all reconciliation replay precondition fields must be required');

  const schemas = openApi?.components?.schemas ?? {};
  const readiness = schemas.M1015PaymentReadiness;
  const providerReadiness = schemas.M1015ProviderReadiness;
  addError(errors, singletonEnumIs(readiness?.properties?.enabled, false)
    && singletonEnumIs(readiness?.properties?.reasonCode, 'CONTRACT_ONLY_NOT_RUNTIME_VERIFIED')
    && readiness?.properties?.providerAllowList?.minItems === 1
    && readiness?.properties?.providerAllowList?.maxItems === 1
    && singletonEnumIs(readiness?.properties?.providerAllowList?.items, 'SANDBOX_HMAC')
    && readiness?.properties?.providers?.minItems === 1
    && readiness?.properties?.providers?.maxItems === 1
    && singletonEnumIs(readiness?.properties?.productionPaymentEnabled, false)
    && singletonEnumIs(readiness?.properties?.autoRenewalEnabled, false)
    && singletonEnumIs(readiness?.properties?.sandboxOnly, true),
  'commerce readiness must remain disabled/static-only with exactly one sandbox candidate');
  addError(errors, singletonEnumIs(providerReadiness?.properties?.provider, 'SANDBOX_HMAC')
    && singletonEnumIs(providerReadiness?.properties?.environment, 'SANDBOX')
    && singletonEnumIs(providerReadiness?.properties?.enabled, false)
    && singletonEnumIs(providerReadiness?.properties?.sandbox, true)
    && singletonEnumIs(providerReadiness?.properties?.productionPaymentEnabled, false)
    && singletonEnumIs(providerReadiness?.properties?.autoRenewalEnabled, false)
    && singletonEnumIs(providerReadiness?.properties?.reasonCode, 'CONTRACT_ONLY_NOT_RUNTIME_VERIFIED'),
  'provider readiness must not promote the compiled SANDBOX_HMAC candidate to runtime availability');

  const gracePolicy = schemas.M1015GracePolicy;
  const graceDenyOn = gracePolicy?.properties?.denyOn;
  const noGraceBranch = oneOfBranchForEnum(gracePolicy, 'mode', ['NONE']);
  const boundedGraceBranch = oneOfBranchForEnum(gracePolicy, 'mode', ['BOUNDED_ACTIVE_ONLY']);
  addError(errors, singletonEnumIs(gracePolicy?.properties?.eligibleState, 'ACTIVE')
    && graceDenyOn?.minItems === 5 && graceDenyOn?.maxItems === 5 && graceDenyOn?.uniqueItems === true
    && sameStringSet(graceDenyOn?.items?.enum, ['REFUND', 'REVOKE', 'EXPIRE', 'SECURITY', 'UNKNOWN'])
    && singletonEnumIs(noGraceBranch?.properties?.maxSeconds, 0)
    && boundedGraceBranch?.properties?.maxSeconds?.minimum === 1
    && boundedGraceBranch?.properties?.maxSeconds?.maximum === 300,
  'M1015GracePolicy must freeze NONE=0, bounded ACTIVE=1..300, and the exact five deny reasons');

  const tombstone = schemas.M1015EntitlementTombstone;
  const absentTombstone = oneOfBranchForEnum(tombstone, 'present', [false]);
  const presentTombstone = oneOfBranchForEnum(tombstone, 'present', [true]);
  addError(errors, singletonEnumIs(absentTombstone?.properties?.version, 0)
    && singletonEnumIs(absentTombstone?.properties?.effectiveAt, null)
    && presentTombstone?.properties?.version?.minimum === 1
    && presentTombstone?.properties?.effectiveAt?.format === 'date-time',
  'entitlement tombstone must couple absent=false/version=0/null and present=true/version>=1/effectiveAt');
  addError(errors, singletonEnumIs(schemas.M1015EntitlementInvalidation?.properties?.required, true),
    'entitlement invalidation must remain an immutable required fact');

  for (const [schemaName, entitlementSchema] of [
    ['M1015Entitlement', schemas.M1015Entitlement],
    ['M1015EntitlementSnapshot', schemas.M1015EntitlementSnapshot],
  ]) {
    addError(errors, ['entitlementId', 'entitlementCode', 'scopeCode', 'entitlementVersion', 'sourceVersion',
      'policyVersion', 'state', 'gracePolicy', 'tombstone', 'invalidation']
      .every((field) => entitlementSchema?.required?.includes(field)),
    `${schemaName} must expose the complete versioned scope/PEP projection`);
    addError(errors, sameJson(entitlementSchema?.properties?.sourceType?.enum, policy?.entitlementPolicy?.activationSources)
      && entitlementSchema?.properties?.sourceVersion?.type === 'integer'
      && entitlementSchema?.properties?.sourceVersion?.minimum === 1,
    `${schemaName} source type/version must exactly match the frozen activation/version policy`);
    const activeBranch = oneOfBranchForEnum(entitlementSchema, 'state', ['PENDING', 'ACTIVE']);
    const graceBranch = oneOfBranchForEnum(entitlementSchema, 'state', ['GRACE']);
    const terminalBranch = oneOfBranchForEnum(entitlementSchema, 'state', ['EXPIRED', 'REVOKED']);
    addError(errors, singletonEnumIs(activeBranch?.properties?.tombstone?.properties?.present, false)
      && singletonEnumIs(graceBranch?.properties?.tombstone?.properties?.present, false)
      && singletonEnumIs(terminalBranch?.properties?.tombstone?.properties?.present, true),
    `${schemaName} states must couple active/grace to no tombstone and terminal states to a present tombstone`);
    addError(errors, graceBranch?.required?.includes('graceUntil')
      && graceBranch?.required?.includes('graceReason')
      && singletonEnumIs(graceBranch?.properties?.gracePolicy?.properties?.mode, 'BOUNDED_ACTIVE_ONLY')
      && graceBranch?.properties?.gracePolicy?.properties?.maxSeconds?.minimum === 1,
    `${schemaName} GRACE must require bounded graceUntil/graceReason facts`);
    addError(errors, Array.isArray(activeBranch?.not?.anyOf) && Array.isArray(terminalBranch?.not?.anyOf),
      `${schemaName} non-GRACE states must reject graceUntil/graceReason`);
  }
  addError(errors, schemas.M1015EntitlementSnapshot?.required?.includes('startsAt'),
    'entitlement snapshot must include startsAt for temporal PEP decisions');

  const paymentIntentResult = schemas.M1015PaymentIntentResult;
  addError(errors, sameJson(paymentIntentResult?.properties?.state?.enum, policy?.stateMachines?.paymentAttempt?.states)
    && sameJson(paymentIntentResult?.['x-state-projection'], {
      policyStateMachine: 'paymentAttempt', apiField: 'state', mapping: 'IDENTITY',
    }),
  'payment attempt response states must exactly project the canonical paymentAttempt state machine');
  const refundProjection = schemas.M1015Refund;
  const settledRefundBranch = oneOfBranchForEnum(refundProjection, 'state', ['SETTLED']);
  addError(errors, sameJson(refundProjection?.properties?.state?.enum, policy?.stateMachines?.refund?.states)
    && sameJson(refundProjection?.['x-state-projection'], {
      policyStateMachine: 'refund', apiField: 'state', mapping: 'IDENTITY',
    }),
  'refund response states must exactly project the canonical refund state machine');
  addError(errors, settledRefundBranch?.required?.includes('settlementReceiptRef')
    && settledRefundBranch?.required?.includes('entitlementRevocationReceiptRef')
    && singletonEnumIs(settledRefundBranch?.properties?.approvalState, 'APPROVED'),
  'SETTLED refund must require approved settlement and entitlement-revocation receipts');

  addError(errors, sameJson(reconciliationReplay?.['x-approval-resolution'], policy?.reconciliationPolicy?.approvalResolution),
    'reconciliation request must exactly project the server-resolved two-principal approval policy');
  const recoveryReceipt = schemas.M1015ReconciliationRecoveryReceipt;
  const recoveryApprovalRefs = recoveryReceipt?.properties?.approvalRefs;
  addError(errors, recoveryReceipt?.required?.includes('approvalRefs')
    && recoveryApprovalRefs?.minItems === 2 && recoveryApprovalRefs?.maxItems === 2
    && recoveryApprovalRefs?.uniqueItems === true
    && !Object.hasOwn(recoveryReceipt?.properties ?? {}, 'approvalRef'),
  'reconciliation recovery receipt must retain exactly two immutable approval refs');

  const revokeRequest = schemas.M1015EntitlementRevokeRequest;
  addError(errors, sameStringSet(revokeRequest?.['x-trusted-workload-supplied-fields'],
    ['reasonCode', 'expectedStateVersion', 'sourceFactRef', 'approvalRef'])
    && sameStringSet(revokeRequest?.['x-forbidden-external-client-fields'],
      ['reasonCode', 'expectedStateVersion', 'sourceFactRef', 'approvalRef'])
    && !revokeRequest?.['x-forbidden-client-fields']?.includes('sourceFactRef'),
  'entitlement revoke must distinguish trusted workload facts from external-client authority');
  const revokeReceipt = schemas.M1015EntitlementRevokeReceipt;
  const revokeTombstoneConstraint = revokeReceipt?.properties?.tombstone?.allOf?.[1];
  addError(errors, singletonEnumIs(revokeTombstoneConstraint?.properties?.present, true)
    && revokeTombstoneConstraint?.properties?.version?.minimum === 1
    && revokeTombstoneConstraint?.properties?.effectiveAt?.format === 'date-time',
  'entitlement revoke receipt must always carry a present versioned tombstone');

  const callback = operationFor(openApi, EXPECTED_ROUTE_BY_OPERATION_ID.get('consumeB13PaymentProviderCallback'));
  if (isPlainObject(callback)) {
    const binding = callback['x-callback-binding'];
    assertKnownKeys(errors, binding, [
      'providerAllowList', 'environment', 'signatureHeaders', 'binds', 'signatureCoverage',
      'tupleSources', 'keyLifecycle', 'productionPaymentEnabled', 'autoRenewalEnabled', 'rawPayloadPersistence', 'rawSignaturePersistence',
    ], 'consumeB13PaymentProviderCallback.x-callback-binding');
    addError(errors, sameJson(binding?.providerAllowList, ['SANDBOX_HMAC']), 'callback must allow SANDBOX_HMAC only');
    addError(errors, binding?.environment === 'SANDBOX', 'callback must remain sandbox-only');
    addError(errors, sameJson(binding?.signatureHeaders, [
      'X-Provider-Signature', 'X-Provider-Nonce', 'X-Provider-Key-Id', 'X-Provider-Environment',
    ]), 'callback must retain all signature, nonce, key-id, and environment headers');
    addError(errors, sameJson(binding?.binds, policy?.callbackPolicy?.canonicalSigningTuple),
      'callback binding tuple must cover provider/event/order/attempt/amount/currency/time/nonce/key-id');
    addError(errors, sameJson(binding?.tupleSources, policy?.callbackPolicy?.canonicalSigningTupleSources),
      'callback tupleSources must be a closed exact policy projection');
    addError(errors, binding?.signatureCoverage === 'canonical-request-body-and-named-headers',
      'callback signature coverage must remain canonical body plus named headers');
    addError(errors, sameJson(binding?.keyLifecycle, policy?.callbackPolicy?.keyLifecycle),
      'callback HMAC key lifecycle must exactly project the frozen server-side rotation policy');
    addError(errors, binding?.productionPaymentEnabled === false && binding?.autoRenewalEnabled === false,
      'callback may not enable production payment or auto-renewal');
    addError(errors, binding?.rawPayloadPersistence === 'PROHIBITED' && binding?.rawSignaturePersistence === 'PROHIBITED',
      'callback raw payload and signature persistence must remain prohibited');
    addError(errors, requiredParameter(openApi, callback, 'provider', 'path'), 'callback provider must be required in the path');
    for (const header of ['X-Provider-Signature', 'X-Provider-Nonce', 'X-Provider-Key-Id', 'X-Provider-Environment']) {
      addError(errors, requiredParameter(openApi, callback, header, 'header'), `callback must require ${header}`);
    }
    const callbackRequest = resolveRequestSchema(openApi, callback);
    assertClosedSchema(errors, callbackRequest, 'M1015ProviderCallbackRequest', [
      'providerEventId', 'transactionId', 'orderId', 'paymentAttemptId', 'amountMinor', 'currency', 'result', 'occurredAt',
    ]);
    const tupleSources = binding?.tupleSources ?? {};
    const bodySources = Object.entries(tupleSources)
      .filter(([, source]) => typeof source === 'string' && source.startsWith('body.'))
      .map(([, source]) => source.slice('body.'.length));
    addError(errors, sameStringSet(Object.keys(callbackRequest?.properties ?? {}), bodySources),
      'callback body properties must exactly equal the body tupleSources and no header/path field');
    addError(errors, ['provider', 'environment', 'nonce', 'keyId'].every((field) => !Object.hasOwn(callbackRequest?.properties ?? {}, field)),
      'callback body must not duplicate provider/environment/nonce/key-id sources');
    addError(errors, sameJson(callbackRequest?.['x-sensitive-transient-fields'], ['transactionId']),
      'callback raw transactionId must remain transient-sensitive and excluded from logs/events/receipts');
    addError(errors, callbackRequest?.['x-callback-protection']?.freshness === 'bounded-occurredAt-window',
      'callback timestamp must have a bounded freshness window');
    const callbackEventPolicy = policy?.canonicalEventExpectations?.find(
      (event) => event?.eventName === 'commerce.payment.callback_received.v2',
    );
    addError(errors, callbackRequest?.['x-callback-protection']?.dedupe === callbackEventPolicy?.dedupeKey,
      'callback dedupe must bind server tenant/provider/provider-event identity');
    addError(errors, callbackRequest?.['x-callback-protection']?.sameEventDifferentDigest === 'CONFLICT_409',
      'same callback event with a different digest must fail closed');
    const receipt = openApi?.components?.schemas?.M1015ProviderCallbackReceipt;
    assertClosedSchema(errors, receipt, 'M1015ProviderCallbackReceipt');
    addError(errors, receipt?.required?.includes('transactionRef') === true, 'callback receipt must expose opaque transactionRef');
    const paidBranch = oneOfBranchForEnum(receipt, 'result', ['PAID']);
    const nonPaidBranch = oneOfBranchForEnum(receipt, 'result', ['REFUNDED', 'REJECTED']);
    addError(errors, isPlainObject(paidBranch) && isPlainObject(nonPaidBranch)
      && singletonEnumIs(nonPaidBranch?.properties?.entitlementActivated, false),
    'callback receipt must force REFUNDED/REJECTED entitlementActivated=false');
    for (const field of ['transactionId', 'providerTransactionRef', 'rawTransactionId', 'rawProviderTransactionId', 'nonce', 'keyId', 'signature', 'hmac', 'credential', 'payload']) {
      addError(errors, !Object.hasOwn(receipt?.properties ?? {}, field), `callback receipt must not expose ${field}`);
    }
  }
  return { canonicalRoutes: EXPECTED_CANONICAL_ROUTES.length, coveredCanonicalRoutes };
}

function assertCanonicalEventProjection(
  errors,
  policy,
  eventFragment,
  eventCatalog,
  reliabilityPolicy,
  b5HistoricalEvents,
  b13HistoricalEvents,
) {
  const expected = policy?.canonicalEventExpectations;
  if (!Array.isArray(expected) || !isPlainObject(eventFragment)) {
    return { canonicalEvents: Array.isArray(expected) ? expected.length : 0, coveredCanonicalEvents: 0, fragmentEvents: 0 };
  }
  assertKnownKeys(errors, eventFragment, ['version', 'events', 'payloadSchemas'], 'M1-015 event fragment');
  addError(errors, eventFragment.version === '2.0.0', 'M1-015 event fragment version must remain 2.0.0');
  const events = eventFragment.events;
  const schemas = eventFragment.payloadSchemas;
  if (!Array.isArray(events) || !isPlainObject(schemas)) {
    errors.push('M1-015 event fragment must contain events and payloadSchemas');
    return { canonicalEvents: expected.length, coveredCanonicalEvents: 0, fragmentEvents: Array.isArray(events) ? events.length : 0 };
  }
  addError(errors, events.length === EXPECTED_CANONICAL_EVENT_NAMES.length, 'M1-015 event fragment must contain exactly nine events');
  const names = events.map((event) => event?.eventName);
  addError(errors, sameStringSet(names, EXPECTED_CANONICAL_EVENT_NAMES), 'M1-015 event fragment must contain the exact nine approved v2 names');
  const catalogEvents = eventCatalog?.events;
  const catalogSchemas = eventCatalog?.payloadSchemas;
  addError(errors, Array.isArray(catalogEvents) && isPlainObject(catalogSchemas), 'event catalog must expose events and payloadSchemas');
  let coveredCanonicalEvents = 0;

  for (const expectedEvent of expected) {
    if (!isPlainObject(expectedEvent)) continue;
    const event = events.find((entry) => entry?.eventName === expectedEvent.eventName);
    if (!isPlainObject(event)) {
      errors.push(`M1-015 event fragment is missing ${expectedEvent.eventName}`);
      continue;
    }
    coveredCanonicalEvents += 1;
    assertKnownKeys(errors, event, [
      'eventName', 'domain', 'version', 'schema', 'aggregateType', 'aggregateIdField',
      'x-envelope-required', 'payloadSchema', 'compatibility',
    ], `event fragment ${expectedEvent.eventName}`);
    addError(errors, event.domain === 'commerce' && event.version === 2 && event.schema === 'commerce.event.v2',
      `${expectedEvent.eventName} must remain a commerce v2 event`);
    addError(errors, event.aggregateType === expectedEvent.aggregateType,
      `${expectedEvent.eventName} aggregateType must equal policy`);
    addError(errors, event.aggregateIdField === expectedEvent.aggregateIdField,
      `${expectedEvent.eventName} aggregateIdField must equal policy`);
    const schemaName = schemaNameFromRef(event.payloadSchema?.$ref);
    addError(errors, schemaName !== null, `${expectedEvent.eventName} payload schema reference must be closed`);
    const schema = schemaName ? schemas[schemaName] : null;
    assertClosedSchema(errors, schema, `${expectedEvent.eventName} payload`, expectedEvent.requiredPayloadFields);
    for (const [field, value] of Object.entries(expectedEvent.requiredFieldValues ?? {})) {
      addError(errors, schema?.properties?.[field]?.const === value,
        `${expectedEvent.eventName}.${field} must have frozen const ${value}`);
    }
    const prohibited = new Set([
      ...(expectedEvent.prohibitedPayloadFields ?? []),
      ...(policy?.sensitiveDataPolicy?.eventPayloadDenyList ?? []),
    ]);
    const matches = schemaForbiddenFieldPaths(schema, prohibited);
    addError(errors, matches.length === 0, `${expectedEvent.eventName} payload contains prohibited/PII field(s): ${matches.join(', ')}`);
    addError(errors, sameJson(event['x-envelope-required'], [
      'eventId', 'eventName', 'schema', 'version', 'occurredAt', 'aggregateType', 'aggregateId', 'actorId',
      'traceId', 'requestId', 'schemaVersion', 'dedupeKey', 'payload',
    ]), `${expectedEvent.eventName} must use the frozen event envelope`);

    const catalogEvent = catalogEvents?.find((entry) => entry?.eventName === expectedEvent.eventName);
    if (!isPlainObject(catalogEvent)) {
      errors.push(`event catalog is missing canonical ${expectedEvent.eventName}`);
      continue;
    }
    addError(errors, catalogEvent.status === 'CANONICAL_D2', `${expectedEvent.eventName} catalog status must be CANONICAL_D2`);
    for (const key of ['domain', 'version', 'schema', 'aggregateType', 'aggregateIdField', 'x-envelope-required', 'payloadSchema', 'compatibility']) {
      addError(errors, sameJson(catalogEvent[key], event[key]), `${expectedEvent.eventName} catalog ${key} must equal event fragment`);
    }
    addError(errors, sameJson(catalogSchemas?.[schemaName], schema), `${expectedEvent.eventName} catalog payload schema must equal event fragment`);
    const governance = catalogEvent['x-p1r-governance'];
    addError(errors, governance?.status === 'CANONICAL_D2' && governance?.runtimeStatus === 'NOT_RUNTIME_VERIFIED',
      `${expectedEvent.eventName} catalog governance must remain D2/not-runtime-verified`);
    addError(errors, governance?.producer?.service === 'commerce-service' && governance?.producer?.dataOwner === 'commerce-service'
      && governance?.producer?.outboxRequired === true,
    `${expectedEvent.eventName} catalog producer must remain commerce-service with outbox required`);
    addError(errors, sameJson(governance?.consumers?.map((consumer) => ({
      service: consumer.service,
      consumerGroup: consumer.consumerGroup,
    })), currentSourceEventConsumers(expectedEvent.eventName)),
    `${expectedEvent.eventName} catalog consumers must equal the frozen matrix`);
    addError(errors, governance?.transport?.protocol === 'kafka'
      && governance?.transport?.topic === 'platform.commerce.v1'
      && governance?.transport?.partitionKey === 'aggregateId'
      && governance?.transport?.aggregateIdSource === `payload.${expectedEvent.aggregateIdField}`
      && governance?.transport?.delivery === 'at-least-once',
    `${expectedEvent.eventName} catalog transport must remain commerce topic/aggregate ordering/at-least-once`);
    addError(errors, governance?.schema?.payloadRef === event.payloadSchema?.$ref
      && governance?.schema?.schemaVersion === event.schema,
    `${expectedEvent.eventName} catalog governance schema must equal event fragment`);
  }

  const reliabilityEvents = reliabilityPolicy?.catalog?.currentCanonicalEvents;
  addError(errors, Array.isArray(reliabilityEvents)
    && EXPECTED_CANONICAL_EVENT_NAMES.every((eventName) => reliabilityEvents.includes(eventName)),
  'reliability policy must list all nine M1-015 canonical v2 events');
  addError(errors, reliabilityPolicy?.ordering?.partitionKey === 'aggregateId',
    'reliability policy must retain aggregateId partitioning');
  addError(errors, reliabilityPolicy?.runtimeEvidenceBoundary?.currentRuntimeResult === 'NOT_RUNTIME_VERIFIED',
    'reliability policy must not promote runtime evidence');

  const callbackEvent = events.find((event) => event?.eventName === 'commerce.payment.callback_received.v2');
  const callbackSchema = schemas?.[schemaNameFromRef(callbackEvent?.payloadSchema?.$ref)];
  addError(errors, callbackSchema?.required?.includes('transactionRef') === true,
    'callback event must expose an opaque transactionRef');
  for (const field of ['transactionId', 'nonce', 'keyId', 'signature', 'hmac', 'rawBody', 'rawHeaders', 'keyMaterial', 'credential']) {
    addError(errors, !Object.hasOwn(callbackSchema?.properties ?? {}, field), `callback event must not publish ${field}`);
  }
  const activatedEvent = events.find((event) => event?.eventName === 'commerce.entitlement.activated.v2');
  const activatedSchema = schemas?.[schemaNameFromRef(activatedEvent?.payloadSchema?.$ref)];
  addError(errors, sameJson(activatedSchema?.properties?.sourceType?.enum, policy?.entitlementPolicy?.activationSources)
    && activatedSchema?.properties?.sourceVersion?.type === 'integer'
    && activatedSchema?.properties?.sourceVersion?.minimum === 1
    && ['scopeCode', 'startsAt'].every((field) => activatedSchema?.required?.includes(field)),
  'entitlement activated event must retain exact source, scope, startsAt, and monotonic sourceVersion facts');
  const revokedEvent = events.find((event) => event?.eventName === 'commerce.entitlement.revoked.v2');
  const revokedSchema = schemas?.[schemaNameFromRef(revokedEvent?.payloadSchema?.$ref)];
  addError(errors, revokedSchema?.required?.includes('scopeCode')
    && revokedSchema?.properties?.sourceVersion?.type === 'integer'
    && revokedSchema?.properties?.sourceVersion?.minimum === 1,
  'entitlement revoked event must retain scopeCode and monotonic sourceVersion for PEP invalidation');
  const recoveryEvent = events.find((event) => event?.eventName === 'commerce.reconciliation.recovery_receipted.v2');
  const recoverySchema = schemas?.[schemaNameFromRef(recoveryEvent?.payloadSchema?.$ref)];
  addError(errors, recoverySchema?.properties?.state?.const === 'CLOSED',
    'recovery receipt event state must be CLOSED');
  addError(errors, recoverySchema?.properties?.postRerunStatus?.const === 'MATCHED_AFTER_RECOVERY',
    'recovery receipt event must declare MATCHED_AFTER_RECOVERY');
  addError(errors, recoverySchema?.required?.includes('approvalRefs')
    && recoverySchema?.properties?.approvalRefs?.minItems === 2
    && recoverySchema?.properties?.approvalRefs?.maxItems === 2
    && recoverySchema?.properties?.approvalRefs?.uniqueItems === true
    && recoverySchema?.properties?.ownerReceiptRefs?.uniqueItems === true,
  'recovery receipt event must retain two unique approvals and unique owner receipts');

  for (const historical of [b5HistoricalEvents, b13HistoricalEvents]) {
    const historicalNames = historical?.events?.map((event) => event?.eventName) ?? [];
    addError(errors, historicalNames.every((eventName) => !EXPECTED_CANONICAL_EVENT_NAMES.includes(eventName)),
      'B5/B13 v1 event inputs must not become M1-015 canonical events');
  }
  for (const historicalName of HISTORICAL_COMMERCE_EVENT_NAMES) {
    const catalogEntry = catalogEvents?.find((event) => event?.eventName === historicalName);
    addError(errors, catalogEntry?.status === 'HISTORICAL_CANDIDATE', `${historicalName} must remain a historical catalog candidate`);
  }
  return { canonicalEvents: expected.length, coveredCanonicalEvents, fragmentEvents: events.length };
}

function assertGlobalGateBoundary(errors, b20Runtime, b21Runtime, b26Runtime) {
  addError(errors, b20Runtime?.runtimeDecision === 'BLOCKED', 'B20 must remain BLOCKED');
  addError(errors, b20Runtime?.commerce?.featureGate?.paymentsEnabledByDefault === false,
    'B20 payments must remain disabled by default');
  addError(errors, b20Runtime?.commerce?.featureGate?.liveProviderEnabled === false,
    'B20 live provider must remain disabled');
  addError(errors, Array.isArray(b20Runtime?.commerce?.featureGate?.liveProviders)
    && b20Runtime.commerce.featureGate.liveProviders.length === 0,
  'B20 live providers must remain empty');
  addError(errors, b21Runtime?.runtimeDecision === 'BLOCKED', 'B21 runtime decision must remain BLOCKED');
  addError(errors, b21Runtime?.tasks?.every((task) => task.defaultDecision === 'NO-GO') === true,
    'B21 task defaults must remain NO-GO');
  addError(errors, b21Runtime?.b20Prerequisite?.livePaymentMustRemainClosed === true,
    'B21 must keep live payment closed');
  addError(errors, b26Runtime?.mode === 'static-only', 'B26 must remain static-only');
  addError(errors, b26Runtime?.runtimeStatus === 'pending', 'B26 runtime status must remain pending');
  addError(errors, b26Runtime?.defaultDecision === 'NO-GO', 'B26 default decision must remain NO-GO');
  addError(errors, b26Runtime?.safety?.productionMutationAllowed === false
    && b26Runtime?.safety?.realCredentialsAllowed === false
    && b26Runtime?.safety?.paymentCredentialsAllowed === false,
  'B26 static input must keep production and credentials closed');
  const commerceRoutes = b26Runtime?.eventRouting?.filter((route) => EXPECTED_CANONICAL_EVENT_NAMES.includes(route?.eventName)) ?? [];
  if (commerceRoutes.length === 0) return 'PLANNED';
  addError(errors, commerceRoutes.length === EXPECTED_CANONICAL_EVENT_NAMES.length,
    'B26 must either be explicitly unbound/planned or route all nine commerce v2 events');
  for (const eventName of EXPECTED_CANONICAL_EVENT_NAMES) {
    const route = commerceRoutes.find((entry) => entry?.eventName === eventName);
    if (!isPlainObject(route)) {
      errors.push(`B26 event routing is missing ${eventName}`);
      continue;
    }
    addError(errors, route.topic === 'platform.commerce.v1' && route.partitionKey === 'aggregateId',
      `B26 ${eventName} must retain platform.commerce.v1 aggregateId routing`);
    addError(errors, sameJson(route.consumerGroups, currentSourceEventConsumers(eventName).map((consumer) => consumer.consumerGroup)),
      `B26 ${eventName} consumer groups must equal the frozen matrix`);
  }
  return 'BOUND_STATIC';
}

function validatePolicyOnly(policy) {
  const errors = [];
  if (!isPlainObject(policy)) {
    errors.push('policy must be a JSON object');
    return errors;
  }
  assertCorePolicy(errors, policy);
  assertPolicySections(errors, policy);
  assertCanonicalRoutePolicy(errors, policy);
  assertCanonicalEventPolicy(errors, policy);
  if (FROZEN_POLICY_SHA256 === '__P1R_M1_015_POLICY_DIGEST_PENDING__') {
    errors.push('P1R-M1-015 policy digest has not been frozen yet');
  } else if (policyDigest(policy) !== FROZEN_POLICY_SHA256) {
    errors.push('policy digest does not match the frozen P1R-M1-015 projection; additional, unknown, or altered semantics are denied');
  }
  return errors;
}

/**
 * Pure D2-only projection validator. It validates contract inputs and static
 * global gates; it performs no I/O, emits no domain fact, and never promotes
 * provider, entitlement, refund, reconciliation, or event runtime status.
 */
export function validateCommerceContractData({
  policy,
  openApi,
  eventFragment,
  eventCatalog,
  reliabilityPolicy,
  b5HistoricalEvents,
  b13HistoricalEvents,
  b20Runtime,
  b21Runtime,
  b26Runtime,
} = {}) {
  const errors = validatePolicyOnly(policy);
  scanRuntimeProofFields(policy, errors, '$.policy');
  scanRuntimeProofFields(openApi, errors, '$.openApi');
  scanRuntimeProofFields(eventFragment, errors, '$.eventFragment');
  scanRuntimeProofFields(eventCatalog, errors, '$.eventCatalog');
  scanRuntimeProofFields(b26Runtime, errors, '$.b26Runtime');
  let routeCounts = { canonicalRoutes: 0, coveredCanonicalRoutes: 0 };
  let eventCounts = { canonicalEvents: 0, coveredCanonicalEvents: 0, fragmentEvents: 0 };
  let b26BindingStatus = 'MISSING';
  if (isPlainObject(policy)) {
    routeCounts = assertCanonicalRouteProjection(errors, policy, openApi);
    eventCounts = assertCanonicalEventProjection(errors, policy, eventFragment, eventCatalog, reliabilityPolicy, b5HistoricalEvents, b13HistoricalEvents);
    b26BindingStatus = assertGlobalGateBoundary(errors, b20Runtime, b21Runtime, b26Runtime);
  }
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    task: 'P1R-M1-015',
    maturity: 'D2_CONTRACT_READY',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    policyDigest: isPlainObject(policy) ? policyDigest(policy) : null,
    frozenPolicyDigest: FROZEN_POLICY_SHA256,
    b26BindingStatus,
    counts: { ...routeCounts, ...eventCounts },
    errors,
  };
}

function callbackSourceValue(candidate, source) {
  if (typeof source !== 'string') return undefined;
  const [location, ...parts] = source.split('.');
  if (!['path', 'header', 'body'].includes(location) || parts.length === 0) return undefined;
  return candidate?.[location === 'header' ? 'headers' : location]?.[parts.join('.')];
}

/**
 * Pure adversarial callback-boundary validator.  It models only the frozen
 * D2 contract decisions; HMAC verification is represented by the separately
 * server-owned `signatureVerified` fact and this helper never treats a client
 * value as cryptographic proof or writes a receipt/entitlement.
 */
export function validateCommerceCallbackCandidate({
  candidate,
  expectedOrder,
  existingReceipt,
  signatureVerified = false,
  nonceSeen = false,
  keyStatus = 'UNKNOWN',
  activeKeyCount = 0,
  nowEpochMs = Date.now(),
  policy,
} = {}) {
  const errors = validatePolicyOnly(policy);
  const callbackPolicy = policy?.callbackPolicy;
  if (!isPlainObject(candidate)) {
    errors.push('callback candidate must be an object');
  } else {
    assertKnownKeys(errors, candidate, ['path', 'headers', 'body', 'serverTenantId', 'tupleDigest'], 'callback candidate');
    const sourceMap = callbackPolicy?.canonicalSigningTupleSources ?? {};
    const bodyFields = Object.entries(sourceMap)
      .filter(([, source]) => typeof source === 'string' && source.startsWith('body.'))
      .map(([, source]) => source.slice('body.'.length));
    const headerFields = Object.entries(sourceMap)
      .filter(([, source]) => typeof source === 'string' && source.startsWith('header.'))
      .map(([, source]) => source.slice('header.'.length));
    headerFields.unshift('X-Provider-Signature');
    const pathFields = Object.entries(sourceMap)
      .filter(([, source]) => typeof source === 'string' && source.startsWith('path.'))
      .map(([, source]) => source.slice('path.'.length));
    addError(errors, sameStringSet(Object.keys(candidate.body ?? {}), bodyFields),
      'callback body must contain exactly the body tupleSources');
    addError(errors, sameStringSet(Object.keys(candidate.headers ?? {}), headerFields),
      'callback headers must contain exactly signature and header tupleSources');
    addError(errors, sameStringSet(Object.keys(candidate.path ?? {}), pathFields),
      'callback path must contain exactly the path tupleSources');
    addError(errors, isNonEmptyString(candidate.serverTenantId), 'callback serverTenantId must be server-derived and non-empty');
    addError(errors, isNonEmptyString(candidate.tupleDigest), 'callback tupleDigest must be a server-issued opaque digest');
    for (const field of callbackPolicy?.canonicalSigningTuple ?? []) {
      const value = callbackSourceValue(candidate, sourceMap[field]);
      const valid = field === 'amountMinor'
        ? Number.isInteger(value) && value >= 0
        : isNonEmptyString(value);
      addError(errors, valid, `callback signed tuple field ${field} is missing or invalid`);
    }
    addError(errors, candidate.path?.provider === 'SANDBOX_HMAC', 'callback provider path must remain SANDBOX_HMAC');
    addError(errors, candidate.headers?.['X-Provider-Environment'] === 'SANDBOX', 'callback environment header must remain SANDBOX');
    addError(errors, isNonEmptyString(candidate.headers?.['X-Provider-Signature']), 'callback signature header is required');
    addError(errors, nonceSeen === false, 'callback nonce reuse must fail closed');
    addError(errors, signatureVerified === true, 'callback requires a server-verified HMAC signature');
    addError(errors, keyStatus === 'ACTIVE' && activeKeyCount === 1,
      'callback HMAC keyId must resolve to the single ACTIVE server-side key');
    const amount = candidate.body?.amountMinor;
    addError(errors, Number.isInteger(amount) && amount >= 0, 'callback amountMinor must be a non-negative integer');
    addError(errors, /^[A-Z]{3}$/.test(candidate.body?.currency ?? ''), 'callback currency must be ISO-4217 alpha-3');
    addError(errors, ['PAID', 'REFUNDED', 'REJECTED'].includes(candidate.body?.result),
      'callback result must be an approved closed enum');
    const occurredAt = Date.parse(candidate.body?.occurredAt ?? '');
    addError(errors, Number.isFinite(occurredAt)
      && nowEpochMs - occurredAt <= (callbackPolicy?.freshnessMaxAgeSeconds ?? 0) * 1000
      && occurredAt - nowEpochMs <= (callbackPolicy?.futureSkewMaxSeconds ?? 0) * 1000,
    'callback timestamp must be within the bounded past/future window');
    if (isPlainObject(expectedOrder)) {
      addError(errors, candidate.path?.provider === expectedOrder.provider,
        'callback provider must match the server payment-attempt binding');
      for (const field of ['orderId', 'paymentAttemptId', 'amountMinor', 'currency', 'result']) {
        addError(errors, candidate.body?.[field] === expectedOrder[field], `callback ${field} must match the server order/attempt binding`);
      }
    } else {
      errors.push('callback expectedOrder binding is required');
    }
    if (isPlainObject(existingReceipt)) {
      const sameDedupeIdentity = existingReceipt.tenantId === candidate.serverTenantId
        && existingReceipt.provider === candidate.path?.provider
        && existingReceipt.providerEventId === candidate.body?.providerEventId;
      if (sameDedupeIdentity && existingReceipt.tupleDigest !== candidate.tupleDigest) {
        errors.push('same server-tenant/provider/provider-event with different tuple digest is a collision and must be denied');
      }
    }
  }
  const duplicate = isPlainObject(candidate) && isPlainObject(existingReceipt)
    && existingReceipt.tenantId === candidate.serverTenantId
    && existingReceipt.provider === candidate.path?.provider
    && existingReceipt.providerEventId === candidate.body?.providerEventId
    && existingReceipt.tupleDigest === candidate.tupleDigest;
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    decision: errors.length > 0 ? 'DENY' : (duplicate ? 'DEDUPE_NO_NEW_PAYMENT_OR_ENTITLEMENT' : 'VERIFY_AND_RECORD_RECEIPT'),
    errors,
  };
}

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
}

function sourcePath(policy, candidates, label) {
  for (const candidate of candidates) {
    const value = policy?.canonicalSources?.[candidate];
    if (isNonEmptyString(value)) return value;
  }
  throw new Error(`policy.canonicalSources must name ${label}`);
}

export function readCommerceContract({ root = DEFAULT_ROOT, policyPath } = {}) {
  const resolvedPolicyPath = policyPath ?? path.join(root, 'config/p1r-commerce-contract.v1.json');
  if (!existsSync(resolvedPolicyPath)) throw new Error(`missing policy input: ${path.relative(root, resolvedPolicyPath)}`);
  const policy = JSON.parse(readFileSync(resolvedPolicyPath, 'utf8'));
  return {
    policy,
    openApi: readJson(root, sourcePath(policy, ['m1015CanonicalOpenApi'], 'M1-015 canonical B13 OpenAPI input')),
    eventFragment: readJson(root, sourcePath(policy, ['m1015CanonicalEventFragment'], 'M1-015 canonical event fragment')),
    eventCatalog: readJson(root, sourcePath(policy, ['eventCatalog'], 'event catalog')),
    reliabilityPolicy: readJson(root, sourcePath(policy, ['eventReliabilityPolicy'], 'event reliability policy')),
    b5HistoricalEvents: readJson(root, sourcePath(policy, ['b5HistoricalEvents'], 'B5 historical event input')),
    b13HistoricalEvents: readJson(root, sourcePath(policy, ['b13HistoricalEvents'], 'B13 historical event input')),
    b20Runtime: readJson(root, sourcePath(policy, ['b20HistoricalEvidence'], 'B20 historical gate')),
    b21Runtime: readJson(root, 'config/b21-release-gate-evidence.json'),
    b26Runtime: readJson(root, 'config/b26-event-runtime.json'),
  };
}

export function validateCommerceContract(options = {}) {
  return validateCommerceContractData(readCommerceContract(options));
}

function parseCliArguments(argv) {
  const options = { json: false };
  for (const argument of argv) {
    if (argument === '--json') options.json = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function runCli() {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write('Usage: node scripts/audit/p1r-commerce-contract-check.mjs [--json]\n');
      return;
    }
    const report = validateCommerceContract();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.result !== 'PASS') process.exitCode = 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      result: 'FAIL',
      task: 'P1R-M1-015',
      maturity: 'D2_CONTRACT_READY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      errors: [error instanceof Error ? error.message : String(error)],
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
