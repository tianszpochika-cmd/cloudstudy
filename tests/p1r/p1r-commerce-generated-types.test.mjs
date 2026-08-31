import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const tscPath = require.resolve('typescript/bin/tsc');
const generatedOpenApiPath = path.join(root, 'packages/contracts/generated/openapi.ts');
const generatedEventsPath = path.join(root, 'packages/contracts/generated/events.ts');
const generatedClientPath = path.join(root, 'packages/api-client/src/generated/index.ts');

const CANONICAL_OPERATION_IDS = [
  'getB13PublicCommerceCatalog',
  'getB13CommerceReadiness',
  'listB13CommerceSkus',
  'listB13MyEntitlements',
  'listB13CommerceOrders',
  'createB13CommerceOrder',
  'prepareB13PaymentIntent',
  'requestB13OrderRefund',
  'redeemB13ActivationCode',
  'consumeB13PaymentProviderCallback',
  'replayB13CommerceReconciliation',
  'resolveM1015CommerceEntitlementSnapshot',
  'revokeM1015CommerceEntitlement',
];

const CANONICAL_EVENT_PAYLOADS = [
  'M1015CommerceOrderCreated',
  'M1015CommercePaymentRequested',
  'M1015CommercePaymentCallbackReceived',
  'M1015CommercePaymentVerified',
  'M1015CommerceEntitlementActivated',
  'M1015CommerceEntitlementRevoked',
  'M1015CommerceRefundSettled',
  'M1015CommerceReconciliationDiscrepancyRecorded',
  'M1015CommerceReconciliationRecoveryReceipted',
];

function generatedText() {
  return [generatedOpenApiPath, generatedEventsPath, generatedClientPath]
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n');
}

function hasCurrentM1015GeneratedProjection() {
  const text = generatedText();
  const requiredOpenApiTypes = [
    'M1015OrderCreateRequest',
    'M1015PaymentIntentRequest',
    'M1015ProviderCallbackRequest',
    'M1015ActivationRedeemRequest',
    'M1015RefundRequest',
    'M1015ReconciliationReplayRequest',
    'M1015EntitlementSnapshotResolveRequest',
    'M1015EntitlementRevokeRequest',
    'M1015EntitlementSnapshot',
    'M1015PaymentReadiness',
    'M1015ProviderCallbackReceipt',
  ];
  return [...CANONICAL_OPERATION_IDS, ...CANONICAL_EVENT_PAYLOADS, ...requiredOpenApiTypes]
    .every((name) => text.includes(name));
}

function compileFixture(source) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p1r-commerce-generated-types-'));
  try {
    const fixturePath = path.join(temporaryRoot, 'fixture.ts');
    const tsconfigPath = path.join(temporaryRoot, 'tsconfig.json');
    fs.writeFileSync(fixturePath, source, 'utf8');
    fs.writeFileSync(tsconfigPath, `${JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        baseUrl: root,
        paths: {
          '@englishflow/contracts': ['packages/contracts/generated/index.ts'],
          '@englishflow/api-client': ['packages/api-client/src/index.ts'],
        },
      },
      files: [fixturePath],
    }, null, 2)}\n`, 'utf8');
    return spawnSync(process.execPath, [tscPath, '--pretty', 'false', '--project', tsconfigPath], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

test('M1-015 generated types are current evidence for all canonical commerce routes and events', () => {
  assert.equal(
    hasCurrentM1015GeneratedProjection(),
    true,
    'M1015 OpenAPI/event changes must be regenerated before generated types can count as acceptance evidence',
  );
});

test('M1-015 generated types preserve canonical write authority, closed callback input, and event secrecy', (t) => {
  if (!hasCurrentM1015GeneratedProjection()) {
    t.skip('generated M1015 projection is stale; the preceding fail-closed evidence test identifies the missing regeneration');
    return;
  }

  const result = compileFixture(`
import type {
  M1015ActivationRedeemRequest,
  M1015CommercePaymentCallbackReceived,
  M1015CommerceReconciliationRecoveryReceipted,
  M1015Entitlement,
  M1015EntitlementRevokeRequest,
  M1015EntitlementSnapshot,
  M1015EntitlementSnapshotResolveRequest,
  M1015OrderCreateRequest,
  M1015PaymentIntentRequest,
  M1015PaymentReadiness,
  M1015ProviderCallbackReceipt,
  M1015ProviderCallbackRequest,
  M1015ReconciliationRecoveryReceipt,
  M1015ReconciliationReplayRequest,
  M1015Refund,
  M1015RefundRequest,
} from '@englishflow/contracts';
import type { GeneratedApiOperationRegistry } from '@englishflow/api-client';

type Assert<T extends true> = T;
type RequiredKey<T, K extends keyof T> = {} extends Pick<T, K> ? false : true;
type Registry = GeneratedApiOperationRegistry;
type CanonicalOperationId =
  | 'getB13PublicCommerceCatalog'
  | 'getB13CommerceReadiness'
  | 'listB13CommerceSkus'
  | 'listB13MyEntitlements'
  | 'listB13CommerceOrders'
  | 'createB13CommerceOrder'
  | 'prepareB13PaymentIntent'
  | 'requestB13OrderRefund'
  | 'redeemB13ActivationCode'
  | 'consumeB13PaymentProviderCallback'
  | 'replayB13CommerceReconciliation'
  | 'resolveM1015CommerceEntitlementSnapshot'
  | 'revokeM1015CommerceEntitlement';
type AllOperationsPresent = Assert<CanonicalOperationId extends keyof Registry ? true : false>;
type AllResponsesPresent = Assert<{
  [K in CanonicalOperationId]: Registry[K]['response'] extends never ? false : true
}[CanonicalOperationId] extends true ? true : false>;
type PublicReadHasNoBody = Assert<Registry['getB13PublicCommerceCatalog']['request'] extends never ? true : false>;
type WriteBodiesRequired = Assert<
  Registry['createB13CommerceOrder']['requestBodyRequired'] extends true
    ? Registry['prepareB13PaymentIntent']['requestBodyRequired'] extends true
      ? Registry['requestB13OrderRefund']['requestBodyRequired'] extends true
        ? Registry['redeemB13ActivationCode']['requestBodyRequired'] extends true
          ? Registry['consumeB13PaymentProviderCallback']['requestBodyRequired'] extends true
            ? Registry['replayB13CommerceReconciliation']['requestBodyRequired'] extends true
              ? Registry['resolveM1015CommerceEntitlementSnapshot']['requestBodyRequired'] extends true
                ? Registry['revokeM1015CommerceEntitlement']['requestBodyRequired'] extends true
                  ? true
                  : false
                : false
              : false
            : false
          : false
        : false
      : false
    : false
>;
type OrderRequestMatchesRegistry = Assert<
  Registry['createB13CommerceOrder']['request'] extends M1015OrderCreateRequest
    ? M1015OrderCreateRequest extends Registry['createB13CommerceOrder']['request'] ? true : false
    : false
>;
type CallbackRequestMatchesRegistry = Assert<
  Registry['consumeB13PaymentProviderCallback']['request'] extends M1015ProviderCallbackRequest
    ? M1015ProviderCallbackRequest extends Registry['consumeB13PaymentProviderCallback']['request'] ? true : false
    : false
>;

const orderCreate = {
  skuId: 'sku-pro-1',
  expectedPriceSnapshotId: 'price-snapshot-1',
  sourcePlatform: 'WEB',
} satisfies M1015OrderCreateRequest;
const forbiddenOrderPrice = {
  skuId: 'sku-pro-1',
  expectedPriceSnapshotId: 'price-snapshot-1',
  sourcePlatform: 'WEB',
  // @ts-expect-error priceSnapshotId is server-derived; only its expected precondition is writable.
  priceSnapshotId: 'forged-price',
} satisfies M1015OrderCreateRequest;

const paymentIntent = {
  provider: 'SANDBOX_HMAC',
  expectedOrderStateVersion: 1,
} satisfies M1015PaymentIntentRequest;
const forbiddenPaymentEnvironment = {
  provider: 'SANDBOX_HMAC',
  expectedOrderStateVersion: 1,
  // @ts-expect-error environment is server-selected and cannot be client input.
  environment: 'PRODUCTION',
} satisfies M1015PaymentIntentRequest;

const callbackBody = {
  providerEventId: 'provider-event-1',
  transactionId: 'signed-transaction-1',
  orderId: 'order-1',
  paymentAttemptId: 'attempt-1',
  amountMinor: 9900,
  currency: 'CNY',
  result: 'PAID',
  occurredAt: '2026-08-31T00:00:00Z',
} satisfies M1015ProviderCallbackRequest;
const forbiddenCallbackProvider = {
  providerEventId: 'provider-event-1',
  transactionId: 'signed-transaction-1',
  orderId: 'order-1',
  paymentAttemptId: 'attempt-1',
  amountMinor: 9900,
  currency: 'CNY',
  result: 'PAID',
  occurredAt: '2026-08-31T00:00:00Z',
  // @ts-expect-error provider is path-bound, never callback-body authority.
  provider: 'SANDBOX_HMAC',
} satisfies M1015ProviderCallbackRequest;
const forbiddenCallbackNonce = {
  providerEventId: 'provider-event-1',
  transactionId: 'signed-transaction-1',
  orderId: 'order-1',
  paymentAttemptId: 'attempt-1',
  amountMinor: 9900,
  currency: 'CNY',
  result: 'PAID',
  occurredAt: '2026-08-31T00:00:00Z',
  // @ts-expect-error nonce is header-bound and cannot be smuggled through the body.
  nonce: 'replay-nonce',
} satisfies M1015ProviderCallbackRequest;

const activation = {
  activationCode: 'activation-code-1',
} satisfies M1015ActivationRedeemRequest;
const forbiddenActivationHash = {
  activationCode: 'activation-code-1',
  // @ts-expect-error activationCodeHash is never client input or a public write field.
  activationCodeHash: 'raw-or-derived-secret',
} satisfies M1015ActivationRedeemRequest;

const refund = {
  reasonCode: 'USER_REQUEST',
  expectedStateVersion: 2,
} satisfies M1015RefundRequest;
const forbiddenRefundMode = {
  reasonCode: 'USER_REQUEST',
  expectedStateVersion: 2,
  // @ts-expect-error refund mode is fixed server policy, not a client decision.
  refundMode: 'PARTIAL',
} satisfies M1015RefundRequest;

const reconciliation = {
  reconciliationCaseRef: 'case-1',
  batchRef: 'batch-1',
  windowStart: '2026-08-30T00:00:00Z',
  windowEnd: '2026-08-31T00:00:00Z',
  expectedStateVersion: 1,
  expectedOrderState: 'PAID',
  expectedPaymentAttemptState: 'VERIFIED',
  expectedEntitlementVersion: 3,
  sourceFactDigests: ['a'.repeat(64)],
  remediationPlanDigest: 'b'.repeat(64),
  approvalRefs: ['approval-a', 'approval-b'],
  policyVersion: 'commerce-policy.v1',
  recoveryMode: 'CONTROLLED_RECOVERY',
  recoveryReasonCode: 'RECEIPT_REPAIR',
} satisfies M1015ReconciliationReplayRequest;
// JSON Schema still owns SHA-256 patterns and uniqueItems semantics; the contract checker enforces them.
const forbiddenReconciliationAutoWrite = {
  reconciliationCaseRef: 'case-1',
  batchRef: 'batch-1',
  windowStart: '2026-08-30T00:00:00Z',
  windowEnd: '2026-08-31T00:00:00Z',
  expectedStateVersion: 1,
  expectedOrderState: 'PAID',
  expectedPaymentAttemptState: 'VERIFIED',
  expectedEntitlementVersion: 3,
  sourceFactDigests: ['a'.repeat(64)],
  remediationPlanDigest: 'b'.repeat(64),
  approvalRefs: ['approval-a', 'approval-b'],
  policyVersion: 'commerce-policy.v1',
  recoveryMode: 'REPLAY_ONLY',
  recoveryReasonCode: 'RECEIPT_REPAIR',
  // @ts-expect-error clients cannot add automatic reconciliation write authority.
  automaticWrite: true,
} satisfies M1015ReconciliationReplayRequest;

const resolveSnapshot = {
  minimumPolicyVersion: 'commerce-policy.v1',
  expectedInvalidationVersion: 2,
} satisfies M1015EntitlementSnapshotResolveRequest;
const forbiddenResolveConsumer = {
  minimumPolicyVersion: 'commerce-policy.v1',
  expectedInvalidationVersion: 2,
  // @ts-expect-error consumer identity is workload-auth derived, not body authority.
  consumerService: 'learning-service',
} satisfies M1015EntitlementSnapshotResolveRequest;
const revoke = {
  reasonCode: 'MANUAL_REVOKE',
  expectedStateVersion: 3,
  sourceFactRef: 'fact-1',
  approvalRef: 'approval-1',
} satisfies M1015EntitlementRevokeRequest;

type SnapshotHasRequiredVersionedFacts = Assert<
  RequiredKey<M1015EntitlementSnapshot, 'entitlementCode'> extends true
    ? RequiredKey<M1015EntitlementSnapshot, 'entitlementVersion'> extends true
      ? RequiredKey<M1015EntitlementSnapshot, 'policyVersion'> extends true
        ? RequiredKey<M1015EntitlementSnapshot, 'tombstone'> extends true
          ? RequiredKey<M1015EntitlementSnapshot, 'invalidation'> extends true ? true : false
          : false
        : false
      : false
    : false
>;
type SnapshotHasRequiredPepFacts = Assert<
  RequiredKey<M1015EntitlementSnapshot, 'scopeCode'> extends true
    ? RequiredKey<M1015EntitlementSnapshot, 'startsAt'> extends true ? true : false
    : false
>;
type SnapshotSourceVersionIsNumeric = Assert<M1015EntitlementSnapshot['sourceVersion'] extends number ? true : false>;
type EntitlementRejectsManualSource = Assert<'CONTROLLED_MANUAL' extends M1015Entitlement['sourceType'] ? false : true>;
type RecoveryReceiptKeepsTwoApprovalRefs = Assert<RequiredKey<M1015ReconciliationRecoveryReceipt, 'approvalRefs'>>;
const snapshot = {
  snapshotRef: 'snapshot-1',
  entitlementId: 'entitlement-1',
  entitlementVersion: 4,
  entitlementCode: 'course-pro',
  scopeCode: 'scope:course-pro',
  state: 'ACTIVE',
  sourceType: 'VERIFIED_PAYMENT',
  sourceRef: 'payment-1',
  sourceVersion: 2,
  policyVersion: 'commerce-policy.v1',
  effectiveAt: '2026-08-31T00:00:00Z',
  startsAt: '2026-08-31T00:00:00Z',
  expiresAt: null,
  gracePolicy: {
    mode: 'NONE',
    maxSeconds: 0,
    eligibleState: 'ACTIVE',
    denyOn: ['REFUND', 'REVOKE', 'EXPIRE', 'SECURITY', 'UNKNOWN'],
  },
  tombstone: { present: false, version: 0, effectiveAt: null },
  invalidation: { required: true, version: 2, receiptRef: 'invalidation-ref:1', reasonCode: 'POLICY_UPDATE' },
  pepDecisionAuthority: 'CONSUMER_LOCAL_PEP',
} satisfies M1015EntitlementSnapshot;

const graceWithoutBoundary = {
  ...snapshot,
  state: 'GRACE',
  gracePolicy: {
    mode: 'BOUNDED_ACTIVE_ONLY',
    maxSeconds: 30,
    eligibleState: 'ACTIVE',
    denyOn: ['REFUND', 'REVOKE', 'EXPIRE', 'SECURITY', 'UNKNOWN'],
  },
// @ts-expect-error GRACE requires server-derived graceUntil and graceReason facts.
} satisfies M1015EntitlementSnapshot;
const revokedWithoutTombstone = {
  ...snapshot,
  state: 'REVOKED',
  tombstone: { present: false, version: 0, effectiveAt: null },
// @ts-expect-error terminal REVOKED facts require a present versioned tombstone.
} satisfies M1015EntitlementSnapshot;

const rejectedReceipt = {
  callbackReceiptRef: 'callback-receipt:1',
  provider: 'SANDBOX_HMAC',
  environment: 'SANDBOX',
  providerEventId: 'provider-event-1',
  transactionRef: 'transaction-ref:1',
  orderId: 'order-1',
  paymentAttemptId: 'attempt-1',
  amountMinor: 9900,
  currency: 'CNY',
  result: 'REJECTED',
  occurredAt: '2026-08-31T00:00:00Z',
  receivedAt: '2026-08-31T00:00:01Z',
  replayed: false,
  entitlementActivated: false,
  verificationRef: 'verification-ref:1',
  sanitized: true,
} satisfies M1015ProviderCallbackReceipt;
const forgedRejectedActivation = {
  ...rejectedReceipt,
  entitlementActivated: true,
// @ts-expect-error a rejected callback receipt can never claim entitlement activation.
} satisfies M1015ProviderCallbackReceipt;

const settledWithoutReceipts = {
  refundId: 'refund-1',
  orderId: 'order-1',
  refundMode: 'FULL_ONLY',
  state: 'SETTLED',
  reasonCode: 'USER_REQUEST',
  expectedStateVersion: 1,
  stateVersion: 2,
  approvalState: 'APPROVED',
  approvalRef: 'approval-ref:1',
  auditRef: 'audit-ref:1',
  receiptRef: 'refund-receipt:1',
  createdAt: '2026-08-31T00:00:00Z',
  updatedAt: '2026-08-31T00:00:01Z',
  postRecoveryRerunRequired: true,
// @ts-expect-error SETTLED requires settlement and entitlement-revocation receipts.
} satisfies M1015Refund;

type ReadinessRejectsProduction = Assert<M1015PaymentReadiness['productionPaymentEnabled'] extends false ? true : false>;
type ReadinessRejectsRenewal = Assert<M1015PaymentReadiness['autoRenewalEnabled'] extends false ? true : false>;
type ReadinessCannotClaimEnabled = Assert<M1015PaymentReadiness['enabled'] extends false ? true : false>;
type RefundIsFullOnly = Assert<'FULL_ONLY' extends M1015Refund['refundMode'] ? true : false>;

const callbackEvent = {
  callbackReceiptRef: 'callback-receipt-1',
  orderId: 'order-1',
  paymentAttemptId: 'attempt-1',
  provider: 'SANDBOX_HMAC',
  environment: 'SANDBOX',
  providerEventId: 'provider-event-1',
  transactionRef: 'transaction-ref-1',
  state: 'VERIFIED',
  verificationRef: 'verification-1',
  tupleDigest: 'a'.repeat(64),
} satisfies M1015CommercePaymentCallbackReceived;
const leakedCallbackEvent = {
  callbackReceiptRef: 'callback-receipt-1',
  orderId: 'order-1',
  paymentAttemptId: 'attempt-1',
  provider: 'SANDBOX_HMAC',
  environment: 'SANDBOX',
  providerEventId: 'provider-event-1',
  transactionRef: 'transaction-ref-1',
  state: 'VERIFIED',
  verificationRef: 'verification-1',
  tupleDigest: 'a'.repeat(64),
  // @ts-expect-error raw transaction IDs are prohibited from event payloads.
  transactionId: 'signed-transaction-1',
} satisfies M1015CommercePaymentCallbackReceived;
const recoveryEvent = {
  reconciliationCaseRef: 'case-1',
  reconciliationVersion: 2,
  batchRef: 'batch-1',
  closureReceiptRef: 'closure-1',
  state: 'CLOSED',
  postRerunStatus: 'MATCHED_AFTER_RECOVERY',
  ownerReceiptRefs: ['owner-receipt-1'],
  approvalRefs: ['approval-ref:1', 'approval-ref:2'],
  closedAt: '2026-08-31T00:00:00Z',
  auditRef: 'audit-1',
  domainFactsUntouched: true,
} satisfies M1015CommerceReconciliationRecoveryReceipted;

void orderCreate;
void forbiddenOrderPrice;
void paymentIntent;
void forbiddenPaymentEnvironment;
void callbackBody;
void forbiddenCallbackProvider;
void forbiddenCallbackNonce;
void activation;
void forbiddenActivationHash;
void refund;
void forbiddenRefundMode;
void reconciliation;
void forbiddenReconciliationAutoWrite;
void resolveSnapshot;
void forbiddenResolveConsumer;
void revoke;
void snapshot;
void graceWithoutBoundary;
void revokedWithoutTombstone;
void rejectedReceipt;
void forgedRejectedActivation;
void settledWithoutReceipts;
void callbackEvent;
void leakedCallbackEvent;
void recoveryEvent;
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
