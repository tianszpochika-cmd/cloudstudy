import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  EXPECTED_CANONICAL_EVENT_NAMES,
  EXPECTED_CANONICAL_ROUTE_OPERATION_IDS,
  FROZEN_POLICY_SHA256,
  M1016_SIGNED_NOTIFICATION_CONSUMER_ALLOWANCE,
  policyDigest,
  readCommerceContract,
  validateCommerceCallbackCandidate,
  validateCommerceContract,
  validateCommerceContractData,
} from '../../scripts/audit/p1r-commerce-contract-check.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDir, '../..');
const baselineInputs = readCommerceContract({ root });
const policy = baselineInputs.policy;

function cloneInputs() {
  return structuredClone(baselineInputs);
}

function clonePolicy() {
  return structuredClone(policy);
}

function assertPolicyMutationFails(mutate) {
  const localPolicy = clonePolicy();
  mutate(localPolicy);
  const report = validateCommerceContractData({ ...cloneInputs(), policy: localPolicy });
  assert.equal(report.result, 'FAIL', report.errors.join('\n'));
  assert(report.errors.length > 0, 'a mutated policy must produce a fail-closed diagnostic');
}

function assertProjectionMutationFails(mutate) {
  const inputs = cloneInputs();
  mutate(inputs);
  const report = validateCommerceContractData(inputs);
  assert.equal(report.result, 'FAIL', report.errors.join('\n'));
}

function callbackCandidate() {
  return {
    path: { provider: 'SANDBOX_HMAC' },
    headers: {
      'X-Provider-Signature': 'hmac-proof-ref-1',
      'X-Provider-Environment': 'SANDBOX',
      'X-Provider-Nonce': 'nonce_1234567890123456',
      'X-Provider-Key-Id': 'sandbox-key-1',
    },
    body: {
      providerEventId: 'provider-event-123456',
      transactionId: 'provider-transaction-123456',
      orderId: 'order-123456',
      paymentAttemptId: 'attempt-123456',
      amountMinor: 9900,
      currency: 'CNY',
      result: 'PAID',
      occurredAt: '2026-08-31T00:00:00.000Z',
    },
    serverTenantId: 'tenant-server-1',
    tupleDigest: 'tuple-digest:callback-123456',
  };
}

const expectedOrder = {
  orderId: 'order-123456',
  paymentAttemptId: 'attempt-123456',
  provider: 'SANDBOX_HMAC',
  amountMinor: 9900,
  currency: 'CNY',
  result: 'PAID',
};

test('M1-015 frozen D2 commerce policy, B13 projection, event catalog, and static gates pass', () => {
  const direct = validateCommerceContractData(baselineInputs);
  const repository = validateCommerceContract({ root });
  assert.equal(direct.result, 'PASS', direct.errors.join('\n'));
  assert.equal(repository.result, 'PASS', repository.errors.join('\n'));
  assert.equal(direct.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(direct.policyDigest, FROZEN_POLICY_SHA256);
  assert.equal(policyDigest(policy), FROZEN_POLICY_SHA256);
  assert.equal(direct.counts.canonicalRoutes, 13);
  assert.equal(direct.counts.coveredCanonicalRoutes, 13);
  assert.equal(direct.counts.canonicalEvents, 9);
  assert.equal(direct.counts.coveredCanonicalEvents, 9);
  assert.equal(direct.b26BindingStatus, 'BOUND_STATIC');
  assert.deepEqual(policy.canonicalRoutes.operationIds, EXPECTED_CANONICAL_ROUTE_OPERATION_IDS);
  assert.deepEqual(policy.canonicalEventExpectations.map((event) => event.eventName), EXPECTED_CANONICAL_EVENT_NAMES);
});

test('M1-015 checker CLI emits a JSON D2 PASS rather than runtime evidence', () => {
  const result = spawnSync(process.execPath, ['scripts/audit/p1r-commerce-contract-check.mjs', '--json'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.result, 'PASS');
  assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(report.policyDigest, FROZEN_POLICY_SHA256);
  assert.equal(report.b26BindingStatus, 'BOUND_STATIC');
});

test('M1-016 signed commerce notification additions retain the M1-015 consumers', () => {
  assert.deepEqual(
    M1016_SIGNED_NOTIFICATION_CONSUMER_ALLOWANCE.bindings['commerce.entitlement.activated.v2'],
    { service: 'notification-service', consumerGroup: 'cg.notification-from-commerce.v1' },
  );
  assert.deepEqual(
    M1016_SIGNED_NOTIFICATION_CONSUMER_ALLOWANCE.bindings['commerce.refund.settled.v2'],
    { service: 'notification-service', consumerGroup: 'cg.notification-from-commerce.v1' },
  );
  for (const eventName of ['commerce.entitlement.activated.v2', 'commerce.refund.settled.v2']) {
    const event = baselineInputs.eventCatalog.events.find((candidate) => candidate.eventName === eventName);
    const consumers = event['x-p1r-governance'].consumers.map(({ service, consumerGroup }) => ({ service, consumerGroup }));
    assert.deepEqual(consumers.slice(0, 2), [
      { service: 'content-service', consumerGroup: 'cg.content-from-commerce.v1' },
      { service: 'learning-service', consumerGroup: 'cg.learning-from-commerce.v1' },
    ]);
    assert.deepEqual(consumers.at(-1), { service: 'audit-service', consumerGroup: 'cg.audit-from-commerce.v1' });
    assert.deepEqual(consumers[2], M1016_SIGNED_NOTIFICATION_CONSUMER_ALLOWANCE.bindings[eventName]);
  }
});

test('adversarial commerce policy mutations fail closed', async (t) => {
  const cases = [
    ['unknown root authority field', (local) => { local.clientCommerceAuthority = true; }],
    ['schema version promotion', (local) => { local.schemaVersion = 'p1r.commerce-contract.v2'; }],
    ['source baseline drift', (local) => { local.sourceBaseline = '0'.repeat(40); }],
    ['runtime claim promotion', (local) => { local.runtimeStatus = 'RUNTIME_VERIFIED'; }],
    ['unknown fields allowed', (local) => { local.collectionPolicy.unknownFieldDecision = 'ALLOW'; }],
    ['additional properties allowed', (local) => { local.collectionPolicy.additionalProperties = 'ALLOW'; }],
    ['production payments enabled', (local) => { local.paymentPolicy.productionPaymentEnabled = true; }],
    ['auto renewal enabled', (local) => { local.paymentPolicy.autoRenewalEnabled = true; }],
    ['SKU term vocabulary loses ONE_TIME', (local) => { local.objects.sku.termTypes = local.objects.sku.termTypes.filter((value) => value !== 'ONE_TIME'); }],
    ['SKU term vocabulary loses non-sellable PERPETUAL', (local) => { local.objects.sku.termTypes = local.objects.sku.termTypes.filter((value) => value !== 'PERPETUAL'); }],
    ['live provider injected', (local) => { local.paymentPolicy.liveProviders.push('LIVE_PROVIDER'); }],
    ['live provider environment selected', (local) => { local.paymentPolicy.providerEnvironment = 'PRODUCTION'; }],
    ['real credential allowed', (local) => { local.paymentPolicy.realCredentials = 'ALLOWED'; }],
    ['callback signing tuple loses transaction', (local) => { local.callbackPolicy.canonicalSigningTuple.splice(3, 1); }],
    ['callback signing tuple loses timestamp', (local) => { local.callbackPolicy.canonicalSigningTuple = local.callbackPolicy.canonicalSigningTuple.filter((field) => field !== 'occurredAt'); }],
    ['callback signing tuple loses nonce', (local) => { delete local.callbackPolicy.canonicalSigningTupleSources.nonce; }],
    ['callback signing tuple loses key id', (local) => { delete local.callbackPolicy.canonicalSigningTupleSources.keyId; }],
    ['callback tuple source changes from header to body', (local) => { local.callbackPolicy.canonicalSigningTupleSources.environment = 'body.environment'; }],
    ['callback allows duplicate sources', (local) => { local.callbackPolicy.singleSourceRequired = false; }],
    ['callback freshness becomes unbounded', (local) => { local.callbackPolicy.freshnessMaxAgeSeconds = 864000; }],
    ['callback future skew becomes unbounded', (local) => { local.callbackPolicy.futureSkewMaxSeconds = 864000; }],
    ['callback nonce reuse allowed', (local) => { local.callbackPolicy.nonceReuseDecision = 'ALLOW'; }],
    ['callback dedupe loses server tenant', (local) => { local.callbackPolicy.dedupeKeyFields = ['provider', 'providerEventId']; }],
    ['callback same event different digest accepted', (local) => { local.callbackPolicy.collisionDecision = 'ACCEPT'; }],
    ['callback provider binding removed', (local) => { local.callbackPolicy.orderBinding.mustMatchFields = local.callbackPolicy.orderBinding.mustMatchFields.filter((field) => field !== 'provider'); }],
    ['callback result binding removed', (local) => { local.callbackPolicy.orderBinding.mustMatchFields = local.callbackPolicy.orderBinding.mustMatchFields.filter((field) => field !== 'result'); }],
    ['callback revoked key accepted', (local) => { local.callbackPolicy.keyLifecycle.acceptedStatuses.push('REVOKED'); }],
    ['callback active key overlap allowed', (local) => { local.callbackPolicy.keyLifecycle.maximumActiveKeys = 2; }],
    ['callback rotation loses audit', (local) => { local.callbackPolicy.keyLifecycle.rotationAuditRequired = false; }],
    ['client tenant authority injected', (local) => { local.canonicalRouteExpectations[5].requestAuthority.clientAllowedFields.push('tenantId'); }],
    ['client principal authority injected', (local) => { local.canonicalRouteExpectations[5].requestAuthority.clientAllowedFields.push('principalId'); }],
    ['client role authority injected', (local) => { local.canonicalRouteExpectations[5].requestAuthority.clientAllowedFields.push('role'); }],
    ['client price authority injected', (local) => { local.canonicalRouteExpectations[5].requestAuthority.clientAllowedFields.push('amountMinor'); }],
    ['client entitlement authority injected', (local) => { local.canonicalRouteExpectations[5].requestAuthority.clientAllowedFields.push('entitlementState'); }],
    ['activation raw secret allowed in audit', (local) => { local.activationPolicy.eventAndAuditProhibitedFields = local.activationPolicy.eventAndAuditProhibitedFields.filter((field) => field !== 'activationCode'); }],
    ['activation digest leaks to audit', (local) => { local.activationPolicy.eventAndAuditProhibitedFields = local.activationPolicy.eventAndAuditProhibitedFields.filter((field) => field !== 'activationCodeDigest'); }],
    ['activation rate limit relaxed', (local) => { local.activationPolicy.maximumRedeemAttemptsPerPrincipalPerWindow = 6; }],
    ['activation same key different code accepted', (local) => { local.activationPolicy.sameKeyDifferentPayload = 'RETURN_ORIGINAL'; }],
    ['activation non-atomic claim', (local) => { local.activationPolicy.atomicClaimRequired = false; }],
    ['entitlement version removed', (local) => { local.entitlementPolicy.requiredVersionFields.pop(); }],
    ['entitlement cache ttl relaxed', (local) => { local.entitlementPolicy.cache.ttlSeconds = 300; }],
    ['entitlement cache invalidation removed', (local) => { local.entitlementPolicy.cache.monotonicInvalidationRequired = false; }],
    ['entitlement stale version allowed', (local) => { local.entitlementPolicy.cache.versionMismatchDecision = 'ALLOW'; }],
    ['refund grace enabled', (local) => { local.entitlementPolicy.grace.defaultGraceSeconds = 60; }],
    ['grace maximum becomes unbounded', (local) => { local.entitlementPolicy.grace.maximumGraceSeconds = 3600; }],
    ['grace loses required reason', (local) => { local.entitlementPolicy.grace.requiredFieldsWhenEnabled = ['graceUntil', 'policyVersion']; }],
    ['refund becomes partial', (local) => { local.refundPolicy.refundScope = 'PARTIAL_ALLOWED'; }],
    ['refund revokes before settlement', (local) => { local.refundPolicy.revokeOnlyAfter = 'REQUESTED'; }],
    ['refund settlement no audit', (local) => { local.refundPolicy.settlementRequires = local.refundPolicy.settlementRequires.filter((field) => field !== 'auditRef'); }],
    ['reconciliation directly writes domain facts', (local) => { local.reconciliationPolicy.manualHoldDirectDomainWrite = 'ALLOW'; }],
    ['reconciliation loses dual approval', (local) => { local.reconciliationPolicy.twoDistinctApprovalsRequired = false; }],
    ['reconciliation permits same principal approvals', (local) => { local.reconciliationPolicy.approvalResolution.approverPrincipalsMustBeDistinct = false; }],
    ['reconciliation accepts stale approval', (local) => { local.reconciliationPolicy.approvalResolution.staleApprovalDecision = 'ALLOW'; }],
    ['reconciliation loses preconditions', (local) => { local.reconciliationPolicy.preconditionsRequired = false; }],
    ['reconciliation loses idempotency binding', (local) => { local.reconciliationPolicy.idempotency = 'REQUEST_ID_ONLY'; }],
    ['reconciliation loses audit', (local) => { local.reconciliationPolicy.auditRequired = false; }],
    ['reconciliation accepts matched without recovery', (local) => { local.reconciliationPolicy.requiredPostRerunStatus = 'MATCHED'; }],
    ['event PII deny list relaxed', (local) => { local.sensitiveDataPolicy.eventPayloadDenyList = local.sensitiveDataPolicy.eventPayloadDenyList.filter((field) => field !== 'transactionId'); }],
    ['D2 boundary permits production traffic', (local) => { local.runtimeBoundary.realProviderTraffic = 'ALLOWED'; }],
    ['historical B13 event becomes canonical', (local) => { local.historicalCandidates.b13CommerceV1.canonical = true; }],
    ['phase one partial refund prohibition removed', (local) => { local.phase1Prohibitions = local.phase1Prohibitions.filter((item) => item !== 'PARTIAL_REFUND'); }],
  ];
  assert(cases.length >= 50, `expected at least 50 policy mutations, received ${cases.length}`);
  for (const [name, mutate] of cases) {
    await t.test(name, () => assertPolicyMutationFails(mutate));
  }
});

test('adversarial OpenAPI, event fragment, catalog, and global-gate mutations fail closed', async (t) => {
  const cases = [
    ['canonical route removed', (inputs) => { delete inputs.openApi.paths['/api/v1/commerce/orders'].post; }],
    ['callback becomes public', (inputs) => { inputs.openApi.paths['/internal/v1/commerce/providers/{provider}/callbacks'].post.security = []; }],
    ['M1015 OpenAPI uses unsupported const', (inputs) => { inputs.openApi.components.schemas.M1015ProviderReadiness.properties.provider.const = 'SANDBOX_HMAC'; }],
    ['M1015 OpenAPI uses unsupported conditional', (inputs) => { inputs.openApi.components.schemas.M1015Sku.if = { properties: { billingPeriod: { enum: ['PERPETUAL'] } } }; }],
    ['operation runtime proof injected', (inputs) => { inputs.openApi.paths['/internal/v1/commerce/providers/{provider}/callbacks'].post.xRuntimeProof = 'PASS'; }],
    ['callback signature header optional', (inputs) => { inputs.openApi.components.parameters.M1015ProviderSignature.required = false; }],
    ['callback provider duplicated into body', (inputs) => { inputs.openApi.components.schemas.M1015ProviderCallbackRequest.properties.provider = { type: 'string' }; inputs.openApi.components.schemas.M1015ProviderCallbackRequest.required.push('provider'); }],
    ['callback nonce duplicated into body', (inputs) => { inputs.openApi.components.schemas.M1015ProviderCallbackRequest.properties.nonce = { type: 'string' }; inputs.openApi.components.schemas.M1015ProviderCallbackRequest.required.push('nonce'); }],
    ['callback key id duplicated into body', (inputs) => { inputs.openApi.components.schemas.M1015ProviderCallbackRequest.properties.keyId = { type: 'string' }; inputs.openApi.components.schemas.M1015ProviderCallbackRequest.required.push('keyId'); }],
    ['callback tuple source omitted', (inputs) => { delete inputs.openApi.paths['/internal/v1/commerce/providers/{provider}/callbacks'].post['x-callback-binding'].tupleSources.keyId; }],
    ['callback tuple source moved to body', (inputs) => { inputs.openApi.paths['/internal/v1/commerce/providers/{provider}/callbacks'].post['x-callback-binding'].tupleSources.environment = 'body.environment'; }],
    ['callback dedupe accepts different digest', (inputs) => { inputs.openApi.components.schemas.M1015ProviderCallbackRequest['x-callback-protection'].sameEventDifferentDigest = 'ACCEPT'; }],
    ['callback transactionId loses transient redaction', (inputs) => { inputs.openApi.components.schemas.M1015ProviderCallbackRequest['x-sensitive-transient-fields'] = []; }],
    ['callback allows revoked HMAC key', (inputs) => { inputs.openApi.paths['/internal/v1/commerce/providers/{provider}/callbacks'].post['x-callback-binding'].keyLifecycle.acceptedStatuses.push('REVOKED'); }],
    ['non-paid callback can claim entitlement activation', (inputs) => {
      const branch = inputs.openApi.components.schemas.M1015ProviderCallbackReceipt.oneOf.find((entry) => entry.properties.result.enum.includes('REFUNDED'));
      branch.properties.entitlementActivated.enum = [true];
    }],
    ['order accepts client price snapshot', (inputs) => { inputs.openApi.components.schemas.M1015OrderCreateRequest.properties.priceSnapshotId = { type: 'string' }; inputs.openApi.components.schemas.M1015OrderCreateRequest.required.push('priceSnapshotId'); }],
    ['payment accepts client environment', (inputs) => { inputs.openApi.components.schemas.M1015PaymentIntentRequest.properties.environment = { type: 'string' }; inputs.openApi.components.schemas.M1015PaymentIntentRequest.required.push('environment'); }],
    ['activation accepts raw hash', (inputs) => { inputs.openApi.components.schemas.M1015ActivationRedeemRequest.properties.activationCodeHash = { type: 'string' }; inputs.openApi.components.schemas.M1015ActivationRedeemRequest.required.push('activationCodeHash'); }],
    ['refund accepts refund mode', (inputs) => { inputs.openApi.components.schemas.M1015RefundRequest.properties.refundMode = { type: 'string' }; inputs.openApi.components.schemas.M1015RefundRequest.required.push('refundMode'); }],
    ['reconciliation approvals collapse to one', (inputs) => { inputs.openApi.components.schemas.M1015ReconciliationReplayRequest.properties.approvalRefs.minItems = 1; }],
    ['reconciliation source digests lose uniqueness', (inputs) => { inputs.openApi.components.schemas.M1015ReconciliationReplayRequest.properties.sourceFactDigests.uniqueItems = false; }],
    ['reconciliation precondition becomes optional', (inputs) => { inputs.openApi.components.schemas.M1015ReconciliationReplayRequest.required = inputs.openApi.components.schemas.M1015ReconciliationReplayRequest.required.filter((field) => field !== 'expectedStateVersion'); }],
    ['reconciliation permits same principal approvals', (inputs) => { inputs.openApi.components.schemas.M1015ReconciliationReplayRequest['x-approval-resolution'].approverPrincipalsMustBeDistinct = false; }],
    ['reconciliation recovery receipt collapses approvals', (inputs) => { inputs.openApi.components.schemas.M1015ReconciliationRecoveryReceipt.properties.approvalRefs.minItems = 1; }],
    ['revoke trusted source fact is client-forbidden', (inputs) => { inputs.openApi.components.schemas.M1015EntitlementRevokeRequest['x-forbidden-client-fields'].push('sourceFactRef'); }],
    ['settled refund loses entitlement revocation receipt', (inputs) => {
      const branch = inputs.openApi.components.schemas.M1015Refund.oneOf.find((entry) => entry.properties.state.enum.includes('SETTLED'));
      branch.required = branch.required.filter((field) => field !== 'entitlementRevocationReceiptRef');
    }],
    ['snapshot loses invalidation', (inputs) => { inputs.openApi.components.schemas.M1015EntitlementSnapshot.required = inputs.openApi.components.schemas.M1015EntitlementSnapshot.required.filter((field) => field !== 'invalidation'); }],
    ['snapshot loses scopeCode', (inputs) => { inputs.openApi.components.schemas.M1015EntitlementSnapshot.required = inputs.openApi.components.schemas.M1015EntitlementSnapshot.required.filter((field) => field !== 'scopeCode'); }],
    ['snapshot loses startsAt', (inputs) => { inputs.openApi.components.schemas.M1015EntitlementSnapshot.required = inputs.openApi.components.schemas.M1015EntitlementSnapshot.required.filter((field) => field !== 'startsAt'); }],
    ['snapshot sourceVersion drifts to string', (inputs) => { inputs.openApi.components.schemas.M1015EntitlementSnapshot.properties.sourceVersion = { type: 'string' }; }],
    ['entitlement opens manual activation', (inputs) => { inputs.openApi.components.schemas.M1015Entitlement.properties.sourceType.enum.push('CONTROLLED_MANUAL'); }],
    ['grace deny set becomes partial', (inputs) => { inputs.openApi.components.schemas.M1015GracePolicy.properties.denyOn.minItems = 1; }],
    ['GRACE loses graceUntil', (inputs) => {
      const branch = inputs.openApi.components.schemas.M1015EntitlementSnapshot.oneOf.find((entry) => entry.properties.state.enum.includes('GRACE'));
      branch.required = branch.required.filter((field) => field !== 'graceUntil');
    }],
    ['terminal entitlement accepts absent tombstone', (inputs) => {
      const branch = inputs.openApi.components.schemas.M1015Entitlement.oneOf.find((entry) => entry.properties.state.enum.includes('REVOKED'));
      branch.properties.tombstone.properties.present.enum = [false];
    }],
    ['readiness claims runtime enabled', (inputs) => { inputs.openApi.components.schemas.M1015PaymentReadiness.properties.enabled.enum = [true]; }],
    ['readiness provider allow-list opens a live provider', (inputs) => { inputs.openApi.components.schemas.M1015PaymentReadiness.properties.providerAllowList.items.enum = ['WECHAT_PAY']; }],
    ['readiness provider allow-list may be empty', (inputs) => { inputs.openApi.components.schemas.M1015PaymentReadiness.properties.providerAllowList.minItems = 0; }],
    ['readiness claims production payment enabled', (inputs) => { inputs.openApi.components.schemas.M1015PaymentReadiness.properties.productionPaymentEnabled.enum = [true]; }],
    ['readiness claims auto renewal enabled', (inputs) => { inputs.openApi.components.schemas.M1015PaymentReadiness.properties.autoRenewalEnabled.enum = [true]; }],
    ['readiness loses sandbox-only boundary', (inputs) => { inputs.openApi.components.schemas.M1015PaymentReadiness.properties.sandboxOnly.enum = [false]; }],
    ['provider readiness claims runtime ready', (inputs) => { inputs.openApi.components.schemas.M1015ProviderReadiness.properties.reasonCode.enum = ['RUNTIME_READY']; }],
    ['snapshot POST wrongly requires idempotency', (inputs) => { inputs.openApi.paths['/internal/v1/commerce/entitlements/{entitlementId}/snapshot'].post['x-idempotency'].required = true; }],
    ['snapshot POST loses its explicit non-mutating exception', (inputs) => { delete inputs.openApi.paths['/internal/v1/commerce/entitlements/{entitlementId}/snapshot'].post['x-p1r-idempotency-exception']; }],
    ['callback event leaks raw transaction id', (inputs) => { inputs.eventFragment.payloadSchemas.M1015CommercePaymentCallbackReceived.properties.transactionId = { type: 'string' }; inputs.eventFragment.payloadSchemas.M1015CommercePaymentCallbackReceived.required.push('transactionId'); }],
    ['event payload adds an unmanaged optional field', (inputs) => { inputs.eventFragment.payloadSchemas.M1015CommerceOrderCreated.properties.clientTenantHint = { type: 'string' }; }],
    ['event activation source enum drifts', (inputs) => { inputs.eventFragment.payloadSchemas.M1015CommerceEntitlementActivated.properties.sourceType.enum = ['ACTIVATION_REDEMPTION']; }],
    ['event sourceVersion drifts to string', (inputs) => { inputs.eventFragment.payloadSchemas.M1015CommerceEntitlementActivated.properties.sourceVersion = { type: 'string' }; }],
    ['event runtime attestation injected', (inputs) => { inputs.eventFragment.attestation = 'PASS'; }],
    ['recovery event loses CLOSED const', (inputs) => { inputs.eventFragment.payloadSchemas.M1015CommerceReconciliationRecoveryReceipted.properties.state.const = 'RECOVERED'; }],
    ['catalog consumer matrix drift', (inputs) => {
      const event = inputs.eventCatalog.events.find((candidate) => candidate.eventName === 'commerce.entitlement.revoked.v2');
      if (event) event['x-p1r-governance'].consumers.pop();
      else inputs.eventCatalog.events.push({ eventName: 'unexpected-commerce-catalog-entry' });
    }],
    ['M1-016 commerce consumer owner drift', (inputs) => {
      const event = inputs.eventCatalog.events.find((candidate) => candidate.eventName === 'commerce.entitlement.activated.v2');
      event['x-p1r-governance'].consumers.find((consumer) => consumer.consumerGroup === 'cg.notification-from-commerce.v1').service = 'workflow-service';
    }],
    ['M1-016 commerce additive consumer deletes an original consumer', (inputs) => {
      const event = inputs.eventCatalog.events.find((candidate) => candidate.eventName === 'commerce.refund.settled.v2');
      event['x-p1r-governance'].consumers = event['x-p1r-governance'].consumers.filter((consumer) => consumer.service !== 'learning-service');
    }],
    ['M1-016 commerce consumer is added to an unapproved event', (inputs) => {
      const event = inputs.eventCatalog.events.find((candidate) => candidate.eventName === 'commerce.order.created.v2');
      event['x-p1r-governance'].consumers.splice(1, 0, {
        service: 'notification-service',
        consumerGroup: 'cg.notification-from-commerce.v1',
      });
    }],
    ['M1-016 commerce topic drift remains denied', (inputs) => {
      const event = inputs.eventCatalog.events.find((candidate) => candidate.eventName === 'commerce.entitlement.activated.v2');
      event['x-p1r-governance'].transport.topic = 'platform.forged.v1';
    }],
    ['M1-016 commerce runtime promotion remains denied', (inputs) => {
      const event = inputs.eventCatalog.events.find((candidate) => candidate.eventName === 'commerce.refund.settled.v2');
      event['x-p1r-governance'].runtimeStatus = 'RUNTIME_VERIFIED';
    }],
    ['catalog topic drift', (inputs) => {
      const event = inputs.eventCatalog.events.find((candidate) => candidate.eventName === 'commerce.order.created.v2');
      if (event) event['x-p1r-governance'].transport.topic = 'platform.commerce.v2';
      else inputs.eventCatalog.events.push({ eventName: 'unexpected-commerce-catalog-entry' });
    }],
    ['catalog event runtime certification injected', (inputs) => {
      const event = inputs.eventCatalog.events.find((candidate) => candidate.eventName === 'commerce.order.created.v2');
      event.certified = true;
    }],
    ['B20 opens live provider', (inputs) => { inputs.b20Runtime.commerce.featureGate.liveProviderEnabled = true; }],
    ['B21 permits release by default', (inputs) => { inputs.b21Runtime.tasks[0].defaultDecision = 'GO'; }],
    ['B26 runtime promotion', (inputs) => { inputs.b26Runtime.defaultDecision = 'GO'; }],
    ['B26 unknown runtime attestation', (inputs) => { inputs.b26Runtime.commerceAttestation = 'PASS'; }],
    ['B26 partial commerce binding', (inputs) => { inputs.b26Runtime.eventRouting = inputs.b26Runtime.eventRouting.filter((route) => route.eventName !== 'commerce.refund.settled.v2'); }],
    ['M1-016 commerce B26 consumer deletes an original group', (inputs) => {
      const route = inputs.b26Runtime.eventRouting.find((entry) => entry.eventName === 'commerce.entitlement.activated.v2');
      route.consumerGroups = route.consumerGroups.filter((consumerGroup) => consumerGroup !== 'cg.learning-from-commerce.v1');
    }],
    ['M1-016 commerce B26 consumer cannot drift to another group', (inputs) => {
      const route = inputs.b26Runtime.eventRouting.find((entry) => entry.eventName === 'commerce.refund.settled.v2');
      route.consumerGroups[2] = 'cg.notification-forged.v1';
    }],
    ['M1-016 commerce B26 topic drift remains denied', (inputs) => {
      const route = inputs.b26Runtime.eventRouting.find((entry) => entry.eventName === 'commerce.refund.settled.v2');
      route.topic = 'platform.forged.v1';
    }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => assertProjectionMutationFails(mutate));
  }
});

test('B26 explicitly permits an unbound PLANNED commerce projection without claiming runtime PASS', () => {
  const inputs = cloneInputs();
  inputs.b26Runtime.eventRouting = inputs.b26Runtime.eventRouting.filter(
    (route) => !EXPECTED_CANONICAL_EVENT_NAMES.includes(route.eventName),
  );
  const report = validateCommerceContractData(inputs);
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.equal(report.b26BindingStatus, 'PLANNED');
  assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
});

test('callback adversarial candidates deny signature, replay, collision, freshness, and order-binding attacks', async (t) => {
  const nowEpochMs = Date.parse('2026-08-31T00:01:00.000Z');
  const passing = validateCommerceCallbackCandidate({
    candidate: callbackCandidate(), expectedOrder, signatureVerified: true, nonceSeen: false,
    keyStatus: 'ACTIVE', activeKeyCount: 1, nowEpochMs, policy,
  });
  assert.equal(passing.result, 'PASS', passing.errors.join('\n'));
  assert.equal(passing.decision, 'VERIFY_AND_RECORD_RECEIPT');
  const cases = [
    ['signature missing', (candidate) => { delete candidate.headers['X-Provider-Signature']; }, {}],
    ['signature not server-verified', () => {}, { signatureVerified: false }],
    ['nonce missing', (candidate) => { delete candidate.headers['X-Provider-Nonce']; }, {}],
    ['key id missing', (candidate) => { delete candidate.headers['X-Provider-Key-Id']; }, {}],
    ['body provider injection', (candidate) => { candidate.body.provider = 'SANDBOX_HMAC'; }, {}],
    ['stale timestamp', (candidate) => { candidate.body.occurredAt = '2026-08-30T23:00:00.000Z'; }, {}],
    ['nonce replay', () => {}, { nonceSeen: true }],
    ['order mismatch', (candidate) => { candidate.body.orderId = 'order-other'; }, {}],
    ['attempt mismatch', (candidate) => { candidate.body.paymentAttemptId = 'attempt-other'; }, {}],
    ['provider mismatch', (candidate) => { candidate.path.provider = 'OTHER_PROVIDER'; }, {}],
    ['amount mismatch', (candidate) => { candidate.body.amountMinor = 1; }, {}],
    ['currency mismatch', (candidate) => { candidate.body.currency = 'USD'; }, {}],
    ['refunded result cannot confirm a paid attempt', (candidate) => { candidate.body.result = 'REFUNDED'; }, {}],
    ['rejected result cannot confirm a paid attempt', (candidate) => { candidate.body.result = 'REJECTED'; }, {}],
    ['unknown result is denied', (candidate) => { candidate.body.result = 'UNKNOWN'; }, {}],
    ['unknown key is denied', () => {}, { keyStatus: 'UNKNOWN' }],
    ['revoked key is denied', () => {}, { keyStatus: 'REVOKED' }],
    ['expired key is denied', () => {}, { keyStatus: 'EXPIRED' }],
    ['overlapping active keys are denied', () => {}, { activeKeyCount: 2 }],
    ['same event different digest collision', (candidate) => { candidate.tupleDigest = 'tuple-digest:other'; }, {
      existingReceipt: {
        tenantId: 'tenant-server-1', provider: 'SANDBOX_HMAC', providerEventId: 'provider-event-123456', tupleDigest: 'tuple-digest:callback-123456',
      },
    }],
  ];
  for (const [name, mutate, options] of cases) {
    await t.test(name, () => {
      const candidate = callbackCandidate();
      mutate(candidate);
      const report = validateCommerceCallbackCandidate({
        candidate, expectedOrder, signatureVerified: true, nonceSeen: false,
        keyStatus: 'ACTIVE', activeKeyCount: 1, nowEpochMs, policy, ...options,
      });
      assert.equal(report.result, 'FAIL', report.errors.join('\n'));
      assert.equal(report.decision, 'DENY');
    });
  }
  const duplicate = validateCommerceCallbackCandidate({
    candidate: callbackCandidate(), expectedOrder, signatureVerified: true, nonceSeen: false,
    keyStatus: 'ACTIVE', activeKeyCount: 1, nowEpochMs, policy,
    existingReceipt: {
      tenantId: 'tenant-server-1', provider: 'SANDBOX_HMAC', providerEventId: 'provider-event-123456', tupleDigest: 'tuple-digest:callback-123456',
    },
  });
  assert.equal(duplicate.result, 'PASS', duplicate.errors.join('\n'));
  assert.equal(duplicate.decision, 'DEDUPE_NO_NEW_PAYMENT_OR_ENTITLEMENT');
});
