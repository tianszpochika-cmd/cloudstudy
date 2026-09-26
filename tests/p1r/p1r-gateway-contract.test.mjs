import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  FROZEN_EXECUTION_TARGET_PLAN_SHA256,
  executionTargetPlanDigest,
  validateGatewayContract,
  validateGatewayContractData,
} from '../../scripts/audit/p1r-gateway-contract-check.mjs';
import {
  buildM2001OpenApiExpectedProjection,
  compareContracts,
  compareM2001OpenApiDescriptors,
  M2001_APPROVED_ADDITIVE_NODES,
  M2001_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS,
  M2001_SOURCE_CONTRACT_BASELINE_REF,
} from '../../scripts/contracts/compatibility-diff.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const extension = 'x-p1r-gateway-boundary';
const fragment = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'contracts', 'fragments', 'p1r-gateway-boundary.openapi.json'), 'utf8'));
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json'), 'utf8'));
const m2001SourceCanonical = JSON.parse(execFileSync(
  'git',
  ['show', `${M2001_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`],
  { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
));
const m2001Allowance = fragment[extension].executionTargetPolicy.compatibilityPromotion;

function fixture() {
  return {
    document: structuredClone(fragment),
    canonicalOpenApi: structuredClone(canonical),
  };
}

function rule(document, ruleId) {
  const found = document[extension].routeRules.find((candidate) => candidate.ruleId === ruleId);
  assert.ok(found, `missing fixture route rule ${ruleId}`);
  return found;
}

function executionPlan(document, ruleId) {
  const found = document[extension].routeExecutions.find((candidate) => candidate.ruleId === ruleId);
  assert.ok(found, `missing fixture execution plan ${ruleId}`);
  return found;
}

function executionProjection(document, projectionId) {
  const found = document[extension].routeExecutions
    .flatMap((plan) => plan.projections)
    .find((candidate) => candidate.projectionId === projectionId);
  assert.ok(found, `missing fixture execution projection ${projectionId}`);
  return found;
}

function m1017Operation(canonicalOpenApi, route, method) {
  const operation = canonicalOpenApi.paths?.[route]?.[method.toLowerCase()];
  assert.ok(operation, `missing canonical M1-017 operation ${method} ${route}`);
  return operation;
}

function assertMutationFails(mutate, expected, { syncProjection = true } = {}) {
  const { document, canonicalOpenApi } = fixture();
  mutate(document, canonicalOpenApi);
  if (syncProjection) canonicalOpenApi[extension] = structuredClone(document[extension]);
  const report = validateGatewayContractData({ document, canonicalOpenApi });
  assert.equal(report.result, 'FAIL', report.errors.join('\n'));
  assert(report.errors.some((error) => expected.test(error)), `missing ${expected}; got ${report.errors.join('\n')}`);
}

function m2001CompatibilityChanges(mutate) {
  const current = structuredClone(canonical);
  mutate(current);
  return compareContracts('openapi', m2001SourceCanonical, current, { allowance: m2001Allowance });
}

test('Gateway contract audit passes the dedicated fragment and exact canonical projection', () => {
  const report = validateGatewayContract({ root });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.summary, {
    routeRuleCount: 56,
    publicOperationCount: 365,
    coveredPublicOperationCount: 365,
    publicCoverageErrorCount: 0,
    executionPlanCount: 56,
    executionProjectionCount: 153,
    availableExecutionOperationCount: 170,
    unavailableExecutionOperationCount: 195,
    executionTargetPlanDigest: FROZEN_EXECUTION_TARGET_PLAN_SHA256,
    internalOperationCount: 62,
    externalDeniedInternalOperationCount: 62,
    canonicalProjectionMatches: true,
  });
});

test('Gateway execution targets cannot drift to a different upstream owner or controller path', () => {
  assertMutationFails((document) => {
    executionProjection(document, 'commerce-domain.skus').upstreamOwner = 'content-service';
  }, /execution projection upstream owner drifted/);
  assertMutationFails((document) => {
    executionProjection(document, 'commerce-domain.skus').targetPathTemplate = '/internal/v1/commerce/not-a-controller-route';
  }, /execution target is not declared by the evidenced controller/);
  assertMutationFails((document) => {
    executionProjection(document, 'commerce-domain.skus').targetPathTemplate = '/internal/v1/commerce/readiness';
  }, /execution target plan digest drifted/);
});

test('M2-001 health identity is Gateway-owned and the compatibility projection permits exactly two scalar corrections plus the root plus reviewed additive nodes', () => {
  assert.equal(m2001Allowance.scope, 'OPENAPI_GATEWAY_ROOT_AND_HEALTH_IDENTITY_ONLY');
  assert.equal(canonical.paths['/api/v1/health'].get.operationId, 'getHealth');
  assert.equal(canonical.paths['/api/v1/health'].get.summary, '读取 API Gateway 健康状态');
  assert.equal(canonical.components.schemas.HealthData.properties.service.const, 'api-gateway');
  const projection = buildM2001OpenApiExpectedProjection(m2001SourceCanonical, canonical, m2001Allowance);
  assert.deepEqual(projection, canonical);
  assert.deepEqual(
    compareM2001OpenApiDescriptors(m2001SourceCanonical, canonical).map((change) => [change.location, change.reason]),
    [...M2001_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS],
  );
});

test('M2-001 approved additive nodes are exactly the reviewed post-baseline additions', () => {
  assert.deepEqual(
    M2001_APPROVED_ADDITIVE_NODES.map((entry) => [entry.segments.join('/'), entry.append ?? null, entry.reason]),
    [
      ['x-b8-authentication/accessToken/eligibilityClaims', null, 'P1-LIVE-001 access-token eligibility claims documented'],
      ['x-b8-authentication/accessToken/authorizationClaims', ['adult_gate', 'consent_state'], 'P1-LIVE-001 eligibility claims listed in the claim inventory'],
      ['x-b8-authentication/accessToken/identityClaims', null, 'P1-LIVE-006 access-token identity claims documented'],
      ['x-b8-authentication/accessToken/authorizationClaims', ['phase', 'account_status'], 'P1-LIVE-006 identity claims listed in the claim inventory'],
      ['paths//api/v1/grammar/points/get/x-owner', null, 'B3 grammar points read owner-bound to content-service'],
      ['paths//api/v1/grammar/points/get/x-permission', null, 'B3 grammar points read permission-bound to content.read'],
      ['paths//api/v1/grammar/points/get/security', null, 'B3 grammar points read operation declares verified bearer authentication'],
      ['paths//api/v1/grammar/points/get/x-contract', null, 'B3 grammar points read publishes its contract-first owner and closed legacy eligibility state'],
      ['paths//api/v1/grammar/points/get/x-authorization', null, 'B3 grammar points read declares its fail-closed content-service PEP facts'],
    ],
  );
});

test('M2-001 health identity and promotion metadata fail closed on mutation', () => {
  assertMutationFails((document, canonicalOpenApi) => {
    canonicalOpenApi.paths['/api/v1/health'].get.summary = '读取 Core API 健康状态';
  }, /Gateway health operation must retain getHealth with the canonical API Gateway summary/);
  assertMutationFails((document, canonicalOpenApi) => {
    canonicalOpenApi.components.schemas.HealthData.properties.service.const = 'core-api';
  }, /HealthData\.service must remain the exact api-gateway identity/);
  assertMutationFails((document) => {
    document[extension].healthContractPromotion.allowedCanonicalChanges.push('paths./api/v1/health.get.responses');
  }, /Gateway health contract promotion must remain the exact M2-001 two-node identity correction/);
});

test('M2-001 compatibility promotion rejects every third-node health or wire-shape change', () => {
  const mutations = [
    (document) => { document.paths['/api/v1/health'].get.operationId = 'getCoreHealth'; },
    (document) => { document.paths['/api/v1/health'].get.responses['200'].description = 'mutated health response'; },
    (document) => { document.components.schemas.HealthData.properties.injected = { type: 'string' }; },
    (document) => { document.paths['/api/v1/health/details'] = structuredClone(document.paths['/api/v1/health']); },
  ];
  for (const mutate of mutations) {
    const changes = m2001CompatibilityChanges(mutate);
    assert.ok(changes.length > 0, 'unapproved third-node health or wire-shape mutation unexpectedly passed');
  }
});

test('Gateway execution plan digest binds the reviewed finite target table', () => {
  const policy = fragment[extension];
  assert.equal(executionTargetPlanDigest(policy), FROZEN_EXECUTION_TARGET_PLAN_SHA256);
  assert.equal(FROZEN_EXECUTION_TARGET_PLAN_SHA256.length, 64);
});

test('Gateway execution targets cannot broaden a rule into a wildcard public proxy', () => {
  assertMutationFails((document) => {
    executionProjection(document, 'learning-domain.plan-current').publicPathTemplate = '/api/v1/learning/*';
  }, /execution projection must name one canonical exact public path/);
});

test('Gateway executable rules cannot lose their finite targets', () => {
  assertMutationFails((document) => {
    executionPlan(document, 'learning-domain').projections = [];
  }, /executable rule must retain only exact targets/);
});

test('Gateway execution plan shape cannot bypass validation', () => {
  assertMutationFails((document) => {
    document[extension].routeExecutions = {};
  }, /route execution plan count must be 56/);
});

test('Gateway unavailable rules cannot be promoted to an upstream projection', () => {
  assertMutationFails((document) => {
    executionPlan(document, 'grammar-domain').projections = [
      structuredClone(executionProjection(document, 'assessment-domain.placement-start')),
    ];
  }, /unavailable execution rule is not frozen/);
});

test('D2 policy cannot claim the M2 runtime is complete', () => {
  assertMutationFails((document) => {
    document[extension].d2Boundary.runtimeCompletionClaimed = true;
  }, /must not claim runtime completion/);
});

test('canonical projection cannot diverge from the dedicated Gateway source', () => {
  assertMutationFails((document, canonicalOpenApi) => {
    canonicalOpenApi[extension].schemaVersion = 'drifted';
  }, /canonical Gateway policy projection must exactly equal/, { syncProjection: false });
});

test('every current public operation must retain one owner rule', () => {
  assertMutationFails((document) => {
    rule(document, 'content-domain').match.methods = ['POST'];
  }, /public route has no owner rule/);
});

test('content publish task reads cannot fall through to the broad admin owner', () => {
  assertMutationFails((document) => {
    rule(document, 'admin-content-publish-tasks').upstreamOwner = 'admin-ops-service';
  }, /content publish task reads must remain.*owned by content-service/);
});

test('equal-priority Gateway route matches fail closed', () => {
  assertMutationFails((document) => {
    const duplicate = structuredClone(rule(document, 'content-domain'));
    duplicate.ruleId = 'content-domain-conflict';
    document[extension].routeRules.push(duplicate);
  }, /equal-priority owner conflict/);
});

test('route rules cannot nominate an unknown upstream owner', () => {
  assertMutationFails((document) => {
    rule(document, 'learning-domain').upstreamOwner = 'rogue-service';
  }, /unknown upstream owner/);
});

test('public writes cannot become a core-api route or target an internal-only class', () => {
  assertMutationFails((document) => {
    const content = rule(document, 'content-domain');
    content.upstreamOwner = 'core-api';
    content.internalTargetClass = 'INTERNAL_ONLY';
  }, /not public-route eligible|core-api write route is forbidden|cannot target an internal-only/);
});

test('all internal operations remain externally denied and require network isolation', () => {
  assertMutationFails((document) => {
    document[extension].internalOperationPolicy.externalExposure = 'ALLOW';
    document[extension].internalOperationPolicy.applicationDenyIsSufficient = true;
  }, /all internal operations must deny public exposure|require network isolation/);
});

test('M1-015 entitlement operations remain internal-only and cannot be exposed publicly', () => {
  assertMutationFails((document, canonicalOpenApi) => {
    const revoke = canonicalOpenApi.paths['/internal/v1/commerce/entitlements/{entitlementId}/revoke'];
    canonicalOpenApi.paths['/api/v1/commerce/entitlements/{entitlementId}/revoke'] = structuredClone(revoke);
  }, /public operation baseline drift|must not be exposed under the public prefix/);
});

test('M1-015 entitlement operations cannot weaken workload-only authorization', () => {
  assertMutationFails((document, canonicalOpenApi) => {
    canonicalOpenApi.paths['/internal/v1/commerce/entitlements/{entitlementId}/snapshot'].post.security = [{ bearerAuth: [] }];
  }, /must use B8WorkloadIdentity/);
});

test('M1-016 notification retry and recovery operations remain exact workload-only internal projections', () => {
  assertMutationFails((document, canonicalOpenApi) => {
    canonicalOpenApi.paths['/internal/v1/notifications/retry'].post.security = [{ bearerAuth: [] }];
  }, /M1-016 internal operation must use B8WorkloadIdentity/);
  assertMutationFails((document, canonicalOpenApi) => {
    canonicalOpenApi.paths['/internal/v1/notifications/recovery'].post['x-authorization'].allowedActors = ['CLIENT'];
  }, /M1-016 internal operation authorization is invalid/);
});

test('M1-016 notification operations cannot be exposed under the public prefix', () => {
  assertMutationFails((document, canonicalOpenApi) => {
    canonicalOpenApi.paths['/api/v1/notifications/retry'] = structuredClone(canonicalOpenApi.paths['/internal/v1/notifications/retry']);
  }, /public operation baseline drift|must not be exposed under the public prefix/);
});

test('M1-017 has exactly eight public and nine internal operations with exact owner, security and authorization', () => {
  const report = validateGatewayContract({ root });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.equal(report.summary.publicOperationCount, 365);
  assert.equal(report.summary.routeRuleCount, 56);
  assert.equal(report.summary.internalOperationCount, 62);
});

test('M1-017 public operations cannot weaken owner or authorization', () => {
  assertMutationFails((document, canonicalOpenApi) => {
    m1017Operation(canonicalOpenApi, '/api/v1/analytics/telemetry', 'POST')['x-owner'] = 'rogue-service';
  }, /M1-017 public operation is missing or has an invalid identity\/owner/);
  assertMutationFails((document, canonicalOpenApi) => {
    m1017Operation(canonicalOpenApi, '/api/v1/privacy/exports', 'POST')['x-authorization'].defaultDecision = 'ALLOW';
  }, /M1-017 public operation authorization is invalid or not fail-closed/);
  assertMutationFails((document, canonicalOpenApi) => {
    m1017Operation(canonicalOpenApi, '/api/v1/analytics/telemetry', 'POST').security = [{ B8ServiceIdentity: [] }];
  }, /M1-017 public operation security is invalid/);
});

test('M1-017 internal operations require exact workload security and fail-closed authorization', () => {
  assertMutationFails((document, canonicalOpenApi) => {
    m1017Operation(canonicalOpenApi, '/internal/v1/privacy/exports/{exportId}/recovery', 'POST').security = [{ bearerAuth: [] }];
  }, /M1-017 internal operation security is invalid/);
  assertMutationFails((document, canonicalOpenApi) => {
    m1017Operation(canonicalOpenApi, '/internal/v1/audit/exports', 'POST')['x-owner'] = 'admin-ops-service';
  }, /M1-017 internal operation is missing or has an invalid identity\/owner/);
  assertMutationFails((document, canonicalOpenApi) => {
    m1017Operation(canonicalOpenApi, '/internal/v1/iam/account-deletions/{deletionRequestId}/execute', 'POST')['x-authorization'].defaultDecision = 'ALLOW';
  }, /M1-017 internal operation authorization is invalid or not fail-closed/);
});

test('M1-017 internal operations cannot be exposed under the public prefix', () => {
  assertMutationFails((document, canonicalOpenApi) => {
    canonicalOpenApi.paths['/api/v1/audit/exports'] = structuredClone(canonicalOpenApi.paths['/internal/v1/audit/exports']);
  }, /public operation baseline drift|M1-017 public operation set|M1-017 internal operation must not be exposed/);
  assertMutationFails((document, canonicalOpenApi) => {
    const leaked = structuredClone(canonicalOpenApi.paths['/internal/v1/privacy/exports/{exportId}/recovery']);
    leaked.post.operationId = 'legacyPrivacyRecoveryAlias';
    leaked.post['x-contract'].task = 'LEGACY';
    canonicalOpenApi.paths['/api/v1/privacy/exports/{exportId}/recovery'] = leaked;
  }, /M1-017 internal operation route must not be exposed publicly/);
});

test('canonical operations outside the governed API prefixes fail closed', () => {
  assertMutationFails((document, canonicalOpenApi) => {
    canonicalOpenApi.paths['/v1/audit/exports'] = structuredClone(canonicalOpenApi.paths['/internal/v1/audit/exports']);
  }, /canonical operation uses an ungoverned API prefix/);
});

test('M1-017 Gateway route rules remain exact for telemetry, IAM deletion and privacy export paths', () => {
  assertMutationFails((document) => {
    rule(document, 'analytics-telemetry').match.type = 'PREFIX';
  }, /M1-017 Gateway route rule is missing or not exact/);
  assertMutationFails((document) => {
    rule(document, 'privacy-exports').match.methods = ['POST'];
  }, /M1-017 Gateway route rule is missing or not exact|public route has no owner rule/);
});

test('credentialed browser origins cannot use a wildcard', () => {
  assertMutationFails((document) => {
    document[extension].originProfiles.LEARNER_WEB.wildcardAllowed = true;
  }, /LEARNER_WEB must be a credentialed exact-origin profile/);
});

test('Web Cookie CSRF requires an exact Origin and canonical 403 failure', () => {
  assertMutationFails((document) => {
    document[extension].csrf.origin.required = false;
    document[extension].csrf.failureStatus = 401;
  }, /CSRF must require an exact allowed Origin|CSRF failures must deny with canonical 403/);
});

test('native secure storage cannot re-enable Cookie transport', () => {
  assertMutationFails((document) => {
    document[extension].nativeTransport.cookieRequestAllowed = true;
    document[extension].originProfiles.NATIVE.setCookieAllowed = true;
  }, /native transport must not use cookies|NATIVE origin profile must not use browser cookies/);
});

test('JWT precheck cannot trust client authority or change RS256', () => {
  assertMutationFails((document) => {
    document[extension].jwtPrecheck.algorithm = 'ES256';
    document[extension].jwtPrecheck.clientAuthorityHeadersTrusted = true;
  }, /JWT precheck must require IAM RS256|JWT precheck must fail closed/);
});

test('every route class requires a fail-closed 429 and Retry-After rate policy', () => {
  assertMutationFails((document) => {
    document[extension].rateLimitPolicies.AUTH_LOGIN.retryAfterRequired = false;
    document[extension].rateLimitPolicies.AUTH_LOGIN.backendFailure = 'FAIL_OPEN';
  }, /Retry-After 429 and fail-closed 503 for AUTH_LOGIN/);
});

test('correlation and idempotency cannot weaken canonical request safety', () => {
  assertMutationFails((document) => {
    document[extension].correlation.requestId.sanitizeAndBound = false;
    document[extension].idempotency.persistentWritesRequired = false;
  }, /requestId must be bounded|idempotency policy must preserve canonical write semantics/);
});

test('canonical error envelope, audit redaction, direct-connect denial and M2 gaps remain mandatory', () => {
  assertMutationFails((document) => {
    document[extension].errors['403'] = '#/components/responses/ApiUnauthorized';
    document[extension].audit.redactedFields = [];
    document[extension].directConnect.publicDomainServicePorts = true;
    document[extension].m2RuntimeGaps.pop();
  }, /Gateway error 403|audit allow-list\/redaction is incomplete|direct-connect policy must deny|runtime gaps are incomplete/);
});

test('M2 runtime Evidence responsibility preserves the dependency edge and downstream owners', () => {
  assert.deepEqual(
    fragment[extension].runtimeEvidenceResponsibility.m2003DependsOn,
    ['P1R-M2-001', 'P1R-M2-002'],
  );
  assert.ok(fragment[extension].m2RuntimeGaps.every((gap) => gap.status === 'OPEN'));
  assertMutationFails((document) => {
    document[extension].audit.durableEvidenceTask = 'P1R-M2-001';
  }, /Gateway audit responsibility must keep envelope in M2-001, durable evidence in M2-006/);
  assertMutationFails((document) => {
    document[extension].directConnect.networkPolicyImplementationTask = 'P1R-M2-001';
  }, /Gateway direct-connect responsibility must keep application deny in M2-001, NetworkPolicy evidence in M2-008/);
  assertMutationFails((document) => {
    document[extension].runtimeEvidenceResponsibility.m2003DependsOn.pop();
  }, /Gateway runtime Evidence responsibility must preserve the dated addendum, M2-003 dependency and unchanged final standard/);
});

test('each M2 runtime GAP has exact implementation, Evidence and final-gate owners', () => {
  assertMutationFails((document) => {
    document[extension].m2RuntimeGaps.find((gap) => gap.id === 'M2-GW-AUDIT').implementationOwnerTask = 'P1R-M2-001';
  }, /M2 Gateway runtime gap responsibility drifted: M2-GW-AUDIT/);
  assertMutationFails((document) => {
    document[extension].m2RuntimeGaps.find((gap) => gap.id === 'M2-GW-DIRECT-CONNECT').evidenceOwnerTask = 'P1R-M2-001';
  }, /M2 Gateway runtime gap responsibility drifted: M2-GW-DIRECT-CONNECT/);
  assertMutationFails((document) => {
    document[extension].m2RuntimeGaps.find((gap) => gap.id === 'M2-GW-RUNTIME-EVIDENCE').finalGateTask = 'P1R-M2-001';
  }, /M2 Gateway runtime gap responsibility drifted: M2-GW-RUNTIME-EVIDENCE/);
  assertMutationFails((document) => {
    document[extension].m2RuntimeGaps.find((gap) => gap.id === 'M2-GW-CSRF').status = 'CLOSED';
  }, /fields do not match lifecycle state|closure manifest must belong|closure requires/);
});
