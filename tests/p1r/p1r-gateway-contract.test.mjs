import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  validateGatewayContract,
  validateGatewayContractData,
} from '../../scripts/audit/p1r-gateway-contract-check.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const extension = 'x-p1r-gateway-boundary';
const fragment = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'contracts', 'fragments', 'p1r-gateway-boundary.openapi.json'), 'utf8'));
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json'), 'utf8'));

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

function assertMutationFails(mutate, expected, { syncProjection = true } = {}) {
  const { document, canonicalOpenApi } = fixture();
  mutate(document, canonicalOpenApi);
  if (syncProjection) canonicalOpenApi[extension] = structuredClone(document[extension]);
  const report = validateGatewayContractData({ document, canonicalOpenApi });
  assert.equal(report.result, 'FAIL', report.errors.join('\n'));
  assert(report.errors.some((error) => expected.test(error)), `missing ${expected}; got ${report.errors.join('\n')}`);
}

test('Gateway contract audit passes the dedicated fragment and exact canonical projection', () => {
  const report = validateGatewayContract({ root });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.summary, {
    routeRuleCount: 53,
    publicOperationCount: 335,
    coveredPublicOperationCount: 335,
    publicCoverageErrorCount: 0,
    internalOperationCount: 51,
    externalDeniedInternalOperationCount: 51,
    canonicalProjectionMatches: true,
  });
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
