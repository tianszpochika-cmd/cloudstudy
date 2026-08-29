import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isRecord, resolveJsonPointer } from '../contracts/schema-utils.mjs';

const DEFAULT_INPUT = path.join('packages', 'contracts', 'fragments', 'b8', 'b8-auth-iam.openapi.json');
const CORRELATION_HEADERS = ['X-Request-Id', 'X-Trace-Id', 'X-API-Version'];
const REQUIRED_AUTHORITY_FACTS = [
  'subject',
  'tenant',
  'roles',
  'permissions',
  'phase',
  'adultGate',
  'consent',
  'deviceTrust',
  'policyVersion',
  'provenance',
];
const CLIENT_AUTHORITY_FIELDS = [
  'subject',
  'tenant',
  'owner',
  'roles',
  'permissions',
  'phase',
  'adultGate',
  'consent',
  'deviceTrust',
  'contentRights',
  'policyVersion',
];
const POLICY_LIFECYCLE = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'REVOKED'];
const REMOTE_PDP_TRIGGERS = ['HIGH_RISK_OPERATION', 'DYNAMIC_POLICY', 'SECURITY_CACHE_MISS'];
const FAIL_CLOSED_REASONS = [
  'MISSING_TRUSTED_CONTEXT',
  'EXPIRED_POLICY_VERSION',
  'REVOCATION_UNCERTAIN',
  'PDP_ERROR',
  'PDP_TIMEOUT',
  'INVALID_SERVICE_IDENTITY',
];
const POLICY_OPERATIONS = Object.freeze({
  listB8PolicyVersions: {
    route: '/api/v1/iam/policy-versions',
    method: 'get',
    permission: 'iam.policy.read',
    success: ['200', 'B8PolicyVersionList'],
  },
  createB8PolicyDraft: {
    route: '/api/v1/iam/policy-versions',
    method: 'post',
    permission: 'iam.policy.draft.create',
    success: ['201', 'B8PolicyVersionCreated'],
    request: 'B8PolicyDraftCreateRequest',
    write: true,
  },
  getB8PolicyVersion: {
    route: '/api/v1/iam/policy-versions/{policyVersionId}',
    method: 'get',
    permission: 'iam.policy.read',
    success: ['200', 'B8PolicyVersionRead'],
  },
  updateB8PolicyDraft: {
    route: '/api/v1/iam/policy-versions/{policyVersionId}',
    method: 'put',
    permission: 'iam.policy.draft.update',
    lifecycle: 'DRAFT',
    success: ['200', 'B8PolicyVersionMutation'],
    request: 'B8PolicyDraftUpdateRequest',
    write: true,
  },
  submitB8PolicyVersion: {
    route: '/api/v1/iam/policy-versions/{policyVersionId}/submit',
    method: 'post',
    permission: 'iam.policy.submit',
    lifecycle: 'DRAFT',
    success: ['200', 'B8PolicyVersionMutation'],
    request: 'B8PolicySubmitRequest',
    write: true,
    separation: true,
  },
  approveB8PolicyVersion: {
    route: '/api/v1/iam/policy-versions/{policyVersionId}/approvals',
    method: 'post',
    permission: 'iam.policy.approve',
    lifecycle: 'SUBMITTED',
    success: ['200', 'B8PolicyVersionMutation'],
    request: 'B8PolicyApprovalRequest',
    write: true,
    separation: true,
  },
  activateB8PolicyVersion: {
    route: '/api/v1/iam/policy-versions/{policyVersionId}/activate',
    method: 'post',
    permission: 'iam.policy.activate',
    lifecycle: 'APPROVED',
    success: ['200', 'B8PolicyVersionMutation'],
    request: 'B8PolicyActivationRequest',
    write: true,
    separation: true,
    invalidation: true,
  },
  revokeB8PolicyVersion: {
    route: '/api/v1/iam/policy-versions/{policyVersionId}/revoke',
    method: 'post',
    permission: 'iam.policy.revoke',
    success: ['200', 'B8PolicyVersionMutation'],
    request: 'B8PolicyRevocationRequest',
    write: true,
    invalidation: true,
  },
});

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasAll(actual, expected) {
  return Array.isArray(actual) && expected.every((value) => actual.includes(value));
}

function exactArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && expected.every((value) => actual.includes(value));
}

function schema(document, name) {
  return document.components?.schemas?.[name];
}

function schemaRef(name) {
  return `#/components/schemas/${name}`;
}

function responseRef(name) {
  return `#/components/responses/${name}`;
}

function resolveLocal(document, candidate) {
  if (!isRecord(candidate)) return candidate;
  if (!nonEmpty(candidate.$ref)) return candidate;
  try {
    return resolveJsonPointer(document, candidate.$ref);
  } catch {
    return undefined;
  }
}

function parameterRefs(pathItem, operation) {
  return [...(Array.isArray(pathItem?.parameters) ? pathItem.parameters : []), ...(Array.isArray(operation?.parameters) ? operation.parameters : [])]
    .map((parameter) => parameter?.$ref)
    .filter(Boolean);
}

function checkRootGovernance(document, errors) {
  const governance = document['x-b8-iam-policy-governance'];
  add(errors, isRecord(governance), 'x-b8-iam-policy-governance is required');
  if (!isRecord(governance)) return;
  add(errors, governance.sourceTask === 'P1R-M1-003', 'IAM policy governance must be owned by P1R-M1-003');
  add(errors, /RBAC.*ABAC/i.test(governance.authorizationModel ?? ''), 'authorizationModel must combine RBAC and ABAC');
  add(errors, governance.defaultDecision === 'DENY', 'authorization defaultDecision must be DENY');
  add(errors, governance.clientAuthority?.trusted === false, 'client authority must be explicitly untrusted');
  add(errors, hasAll(governance.clientAuthority?.prohibitedAuthorityFields, CLIENT_AUTHORITY_FIELDS), 'client authority prohibition is incomplete');
  add(errors, /never.*authori|cannot.*expand/i.test(governance.clientAuthority?.rule ?? ''), 'client authority rule must forbid authorization expansion');
  add(errors, /iam-service.*validated.*JWT/i.test(governance.principal?.source ?? ''), 'principal must come from iam-service and a validated JWT');
  add(errors, hasAll(governance.principal?.requiredFacts, REQUIRED_AUTHORITY_FACTS), 'principal required facts are incomplete');

  const adult = governance.adultGate;
  add(errors, adult?.minimumAge === 18, 'adult Gate minimum age must be 18');
  add(errors, /iam-service/i.test(adult?.authority ?? ''), 'adult Gate authority must be iam-service');
  add(errors, adult?.clientBirthOrConfirmation === 'not-an-authorization-fact', 'client birth/confirmation must not be an authorization fact');
  add(errors, exactArray(adult?.states, ['ELIGIBLE', 'RESTRICTED']), 'adult Gate states must be ELIGIBLE and RESTRICTED');
  add(errors, /revalid|required|stale|uncertain/i.test(adult?.revalidation ?? ''), 'adult Gate revalidation rule is required');

  const consent = governance.consent;
  add(errors, /iam-service/i.test(consent?.authority ?? ''), 'consent authority must be iam-service');
  add(errors, consent?.requiredConsentFailure === 'RESTRICTED_AND_DENY', 'required consent failure must restrict and deny');
  add(errors, /restriction|revocation|revalidation/i.test(consent?.withdrawal ?? ''), 'consent withdrawal effects are incomplete');

  const pepPdp = governance.pepPdp;
  add(errors, /local PEP.*validated JWT.*local resource facts.*versioned policy/i.test(pepPdp?.normalPath ?? ''), 'normal authorization path must use local PEP, validated JWT, local resource facts and a versioned policy');
  add(errors, exactArray(pepPdp?.remotePdpTriggers, REMOTE_PDP_TRIGGERS), 'remote PDP triggers must be exactly high risk, dynamic policy and cache miss');
  add(errors, /service identity/i.test(pepPdp?.trustedInternalCaller ?? ''), 'remote PDP must require trusted service identity');
  add(errors, hasAll(pepPdp?.failClosedOn, FAIL_CLOSED_REASONS), 'PEP/PDP fail-closed reasons are incomplete');

  const controlPlane = governance.policyControlPlane;
  add(errors, exactArray(controlPlane?.lifecycle, POLICY_LIFECYCLE), 'policy lifecycle must be DRAFT, SUBMITTED, APPROVED, ACTIVE, REVOKED');
  add(errors, /cannot independently approve|independent/i.test(controlPlane?.separationOfDuties ?? ''), 'policy lifecycle must require independent approval');
  add(errors, /requestId.*traceId.*auditId/i.test(controlPlane?.audit ?? ''), 'policy audit correlation must include requestId, traceId and auditId');
  add(errors, /cache invalidation/i.test(controlPlane?.cacheInvalidation ?? ''), 'policy activation/revocation must invalidate PEP caches');
}

function checkPrincipal(document, errors) {
  const principal = schema(document, 'B8PrincipalResponse');
  add(errors, isRecord(principal), 'B8PrincipalResponse is required');
  if (!isRecord(principal)) return;
  const required = ['principalId', 'subject', 'tenantId', 'tenant', 'roles', 'permissions', 'phase', 'adultGate', 'consentState', 'deviceTrust', 'policyVersion', 'policy', 'authorityProvenance'];
  add(errors, hasAll(principal.required, ['principalId', 'tenantId', 'sessionId', 'deviceId', 'roles', 'permissions', 'authMode']), 'B8PrincipalResponse must preserve its legacy required fields');
  add(errors, hasAll(Object.keys(principal.properties ?? {}), required), 'B8PrincipalResponse must expose all server-derived authority facts');
  add(errors, hasAll(principal['x-server-authoritative-fields'], required), 'B8PrincipalResponse server-authoritative fields are incomplete');
  add(errors, principal['x-client-authority']?.trusted === false, 'B8PrincipalResponse must reject client authority');
  add(errors, principal.properties?.subject?.$ref === schemaRef('B8ServerDerivedSubject'), 'principal subject must use B8ServerDerivedSubject');
  add(errors, principal.properties?.tenant?.$ref === schemaRef('B8ServerDerivedTenant'), 'principal tenant must use B8ServerDerivedTenant');
  add(errors, principal.properties?.authorityProvenance?.$ref === schemaRef('B8AuthorityProvenance'), 'principal authority provenance is required');

  const subject = schema(document, 'B8ServerDerivedSubject');
  add(errors, subject?.properties?.source?.const === 'IAM_VALIDATED_JWT_AND_SESSION', 'subject source must be validated IAM JWT and session');
  const tenant = schema(document, 'B8ServerDerivedTenant');
  add(errors, hasAll(tenant?.properties?.provenance?.enum, ['IAM_PLATFORM_TENANT', 'IAM_VALIDATED_TENANT_SCOPE']), 'tenant provenance must be server-derived');
  const authority = schema(document, 'B8AuthorityProvenance');
  add(errors, authority?.properties?.authority?.const === 'IAM_SERVER_DERIVED', 'authority provenance must be IAM_SERVER_DERIVED');
  add(errors, authority?.properties?.jwtValidation?.const === 'VALIDATED_IAM_RS256_JWT', 'authority provenance must require validated RS256 JWT');
  add(errors, authority?.properties?.revocationState?.enum?.includes('UNCERTAIN_FAIL_CLOSED'), 'uncertain revocation must fail closed');
}

function checkAdultAndConsent(document, errors) {
  const request = schema(document, 'B8AdultGateRequest');
  add(errors, request?.additionalProperties === false, 'B8AdultGateRequest must reject unknown fields');
  add(errors, hasAll(request?.['x-client-assertion-fields'], ['confirmed', 'birthYear', 'policyVersion']), 'adult Gate input must be marked as client assertions');
  add(errors, request?.['x-server-decision-required']?.authority === 'iam-service', 'adult Gate requires an iam-service server decision');
  add(errors, /do not authorize|cannot grant|do not authori/i.test(request?.['x-server-decision-required']?.rule ?? ''), 'adult Gate input must not directly authorize access');

  const response = schema(document, 'B8AdultGateResponse');
  const adultRequired = ['learningAccess', 'policyVersion', 'policyAsOf', 'minimumAge', 'evidenceDigest', 'evidenceStatus', 'evaluationProvenance', 'revalidation'];
  add(errors, hasAll(Object.keys(response?.properties ?? {}), adultRequired) && hasAll(response?.['x-server-authoritative-fields'], adultRequired), 'adult Gate response lacks authoritative policy/evidence/revalidation fields');
  add(errors, response?.properties?.minimumAge?.const === 18, 'adult Gate response minimumAge must be 18');
  add(errors, exactArray(response?.properties?.learningAccess?.enum, ['ELIGIBLE', 'RESTRICTED']), 'adult Gate learningAccess must be ELIGIBLE or RESTRICTED');
  add(errors, response?.properties?.evaluationProvenance?.$ref === schemaRef('B8AdultGateEvaluationProvenance'), 'adult Gate evaluation provenance is required');
  add(errors, response?.properties?.revalidation?.$ref === schemaRef('B8RevalidationRequirement'), 'adult Gate revalidation is required');

  const consent = schema(document, 'B8Consent');
  const consentRequired = ['purpose', 'required', 'document', 'state', 'effectiveAt', 'restrictionEffect', 'revalidation', 'withdrawalEffect', 'provenance'];
  add(errors, hasAll(Object.keys(consent?.properties ?? {}), consentRequired) && hasAll(consent?.['x-server-authoritative-fields'], consentRequired), 'consent record lacks purpose/document/withdrawal/revalidation facts');
  add(errors, consent?.properties?.document?.$ref === schemaRef('B8ConsentDocument'), 'consent document version/digest is required');
  add(errors, exactArray(consent?.properties?.state?.enum, ['GRANTED', 'WITHDRAWN']), 'consent state must be GRANTED or WITHDRAWN');
  add(errors, consent?.properties?.withdrawalEffect?.$ref === schemaRef('B8ConsentWithdrawalEffect'), 'consent withdrawal effect is required');
  add(errors, schema(document, 'B8ConsentDocument')?.required?.includes('digest'), 'consent document digest is required');

  const consentState = schema(document, 'B8ConsentState');
  const consentStateFacts = ['learningAccess', 'requiredPurposes', 'unsatisfiedPurposes', 'policyVersion', 'revalidation', 'provenance'];
  add(errors, hasAll(Object.keys(consentState?.properties ?? {}), consentStateFacts) && hasAll(consentState?.['x-server-authoritative-fields'], consentStateFacts), 'consent summary lacks restriction/revalidation provenance');
  add(errors, exactArray(consentState?.properties?.learningAccess?.enum, ['ELIGIBLE', 'RESTRICTED']), 'consent summary must expose ELIGIBLE or RESTRICTED');
  const update = schema(document, 'B8ConsentUpdateRequest');
  add(errors, update?.additionalProperties === false, 'B8ConsentUpdateRequest must reject authority injection');
  add(errors, /cannot directly grant access/i.test(update?.['x-server-decision-required'] ?? ''), 'consent update must not directly grant access');
}

function checkPdp(document, errors) {
  const bundleRoute = '/internal/v1/iam/policy-bundles/active';
  const bundle = document.paths?.[bundleRoute]?.get;
  add(errors, bundle?.operationId === 'getB8ActivePolicyBundle', 'active policy-bundle endpoint is required');
  add(errors, JSON.stringify(bundle?.security) === JSON.stringify([{ B8ServiceIdentity: [] }]), 'policy-bundle endpoint must require B8ServiceIdentity');
  add(errors, bundle?.['x-contract']?.internalOnly === true, 'policy-bundle endpoint must be internal only');
  add(errors, bundle?.['x-pep-pdp']?.perRequestRemotePdp === false, 'normal PEP path must not call PDP for every request');
  add(errors, bundle?.['x-pep-pdp']?.failureMode === 'fail-closed', 'policy-bundle failure must fail closed');

  const route = '/internal/v1/iam/pdp/decisions';
  const operation = document.paths?.[route]?.post;
  add(errors, operation?.operationId === 'evaluateB8PdpDecision', 'structured internal PDP endpoint is required');
  add(errors, JSON.stringify(operation?.security) === JSON.stringify([{ B8ServiceIdentity: [] }]), 'PDP endpoint must require B8ServiceIdentity');
  add(errors, operation?.['x-contract']?.internalOnly === true, 'PDP endpoint must be internal only');
  add(errors, exactArray(operation?.['x-pep-pdp']?.remotePdpOnlyWhen, REMOTE_PDP_TRIGGERS), 'PDP endpoint triggers are incomplete');
  add(errors, operation?.['x-pep-pdp']?.defaultDecision === 'DENY', 'PDP endpoint must default to DENY');
  add(errors, operation?.['x-pep-pdp']?.failureMode === 'fail-closed', 'PDP endpoint must fail closed');
  add(errors, /trusted-service-identity/i.test(operation?.['x-pep-pdp']?.requiredCallerIdentity ?? ''), 'PDP endpoint must bind a trusted service identity');
  add(errors, operation?.requestBody?.content?.['application/json']?.schema?.$ref === schemaRef('B8PdpAuthorizationDecisionRequest'), 'PDP endpoint must use the structured decision request');
  add(errors, operation?.responses?.['200']?.$ref === responseRef('B8PdpDecision'), 'PDP success must use the canonical decision envelope');
  for (const [status, name] of Object.entries({ 400: 'ApiBadRequest', 401: 'ApiUnauthorized', 403: 'ApiForbidden', 409: 'ApiConflict', 503: 'ApiServiceUnavailable', 504: 'ApiGatewayTimeout' })) {
    add(errors, operation?.responses?.[status]?.$ref === responseRef(name), `PDP ${status} must use ${name}`);
  }

  const request = schema(document, 'B8PdpAuthorizationDecisionRequest');
  add(errors, request?.additionalProperties === false, 'PDP request must reject unknown authority fields');
  add(errors, hasAll(request?.required, ['invocationReason', 'action', 'principal', 'resource', 'policy', 'serviceIdentity']), 'PDP request context is incomplete');
  add(errors, exactArray(request?.properties?.invocationReason?.enum, REMOTE_PDP_TRIGGERS), 'PDP request invocation reasons are incomplete');
  add(errors, request?.['x-default-decision'] === 'DENY', 'PDP request must declare DENY as default');
  add(errors, hasAll(request?.['x-server-derived-authorization-facts'], ['principal', 'resource.owner', 'resource.tenant', 'resource.contentRights', 'policy', 'serviceIdentity']), 'PDP trusted facts are incomplete');

  const principal = schema(document, 'B8PdpPrincipalContext');
  add(errors, hasAll(principal?.required, ['subject', 'tenant', 'roles', 'permissions', 'phase', 'adultGate', 'consent', 'deviceTrust', 'authorityProvenance']), 'PDP principal context is incomplete');
  add(errors, principal?.properties?.adultGate?.$ref === schemaRef('B8PdpAdultGateContext'), 'PDP principal must use the strict adult Gate context');
  add(errors, principal?.properties?.consent?.$ref === schemaRef('B8PdpConsentContext'), 'PDP principal must use the strict consent context');
  const strictAdult = schema(document, 'B8PdpAdultGateContext');
  add(errors, hasAll(strictAdult?.allOf?.[1]?.required, ['learningAccess', 'policyVersion', 'policyAsOf', 'minimumAge', 'evidenceDigest', 'evidenceStatus', 'evaluationProvenance', 'revalidation']), 'strict PDP adult context is incomplete');
  const strictConsent = schema(document, 'B8PdpConsentContext');
  add(errors, hasAll(strictConsent?.allOf?.[1]?.required, ['learningAccess', 'requiredPurposes', 'unsatisfiedPurposes', 'evaluatedAt', 'policyVersion', 'revalidation', 'provenance']), 'strict PDP consent context is incomplete');
  const resource = schema(document, 'B8PdpResourceContext');
  add(errors, hasAll(resource?.required, ['resourceType', 'resourceId', 'owner', 'tenant', 'phase', 'contentRights', 'provenance']), 'PDP resource context lacks owner/tenant/rights provenance');
  add(errors, resource?.properties?.owner?.properties?.provenance?.const === 'RESOURCE_OWNER_SERVICE', 'resource owner provenance must come from the owner service');
  const serviceIdentity = schema(document, 'B8TrustedServiceIdentityContext');
  add(errors, serviceIdentity?.properties?.credentialBinding?.const === 'VALIDATED_SERVICE_JWT_BOUND_TO_PEP', 'service identity must be bound to the calling PEP');
  add(errors, /not trusted from an arbitrary body field/i.test(serviceIdentity?.['x-server-derived'] ?? ''), 'service identity body values must be cross-checked, not trusted');

  const decision = schema(document, 'B8AuthorizationDecisionResponse');
  add(errors, exactArray(decision?.properties?.decision?.enum, ['ALLOW', 'DENY']), 'authorization result must be ALLOW or DENY');
  add(errors, hasAll(decision?.properties?.reasonCode?.enum, ['CONTEXT_MISSING', 'POLICY_UNAVAILABLE', 'POLICY_VERSION_EXPIRED', 'REVOCATION_UNCERTAIN', 'PDP_ERROR', 'PDP_TIMEOUT', 'INVALID_SERVICE_IDENTITY', 'RESOURCE_PROVENANCE_MISSING', 'TENANT_PROVENANCE_MISMATCH', 'OWNER_PROVENANCE_MISMATCH']), 'authorization fail-closed reason codes are incomplete');
  const enforcement = schema(document, 'B8AuthorizationEnforcement');
  add(errors, enforcement?.properties?.defaultDecision?.const === 'DENY', 'authorization enforcement default must be DENY');
  add(errors, enforcement?.properties?.failureMode?.const === 'FAIL_CLOSED', 'authorization enforcement must fail closed');
  add(errors, enforcement?.properties?.localPepRequired?.const === true, 'authorization enforcement must require the local PEP');
  const strictDecision = schema(document, 'B8PdpAuthorizationDecisionResponse');
  add(errors, strictDecision?.allOf?.[0]?.$ref === schemaRef('B8AuthorizationDecisionResponse') && hasAll(strictDecision?.allOf?.[1]?.required, ['enforcement', 'auditLink']), 'new PDP decision must require enforcement and auditLink');
  add(errors, schema(document, 'B8AuthorizationDecisionEnvelope')?.allOf?.[1]?.properties?.data?.$ref === schemaRef('B8PdpAuthorizationDecisionResponse'), 'PDP envelope must use the strict decision payload');

  const legacy = document.paths?.['/internal/v1/iam/authorization/decisions']?.post;
  add(errors, legacy?.deprecated === true, 'legacy authorization decision operation must be deprecated');
  add(errors, legacy?.['x-superseded-by'] === route, 'legacy authorization decision operation must point to the structured PDP endpoint');
  add(errors, legacy?.['x-pep-pdp']?.missingOrUntrustedContext === 'fail-closed', 'legacy decision compatibility must fail closed');
  add(errors, legacy?.responses?.['200']?.content?.['application/json']?.schema?.$ref === schemaRef('B8AuthorizationDecisionResponse'), 'legacy decision response shape must remain compatible during deprecation');
  add(errors, legacy?.responses?.['401']?.$ref === responseRef('B8Unauthorized') && legacy?.responses?.['403']?.$ref === responseRef('B8Forbidden'), 'legacy decision errors must remain compatible during deprecation');
}

function checkResponseEnvelopeAndHeaders(document, errors, responseName, envelopeName) {
  const response = document.components?.responses?.[responseName];
  add(errors, isRecord(response), `${responseName} response component is required`);
  if (!isRecord(response)) return;
  for (const header of CORRELATION_HEADERS) add(errors, isRecord(response.headers?.[header]), `${responseName} must expose ${header}`);
  const contentSchema = response.content?.['application/json']?.schema;
  const expected = schemaRef(envelopeName);
  const usesEnvelope = contentSchema?.$ref === expected
    || (Array.isArray(contentSchema?.allOf) && contentSchema.allOf.some((entry) => entry?.$ref === expected));
  add(errors, usesEnvelope, `${responseName} must use ${envelopeName}`);
}

function checkPolicyControlPlane(document, errors) {
  const requestSchemas = new Set();
  for (const [operationId, spec] of Object.entries(POLICY_OPERATIONS)) {
    const pathItem = document.paths?.[spec.route];
    const operation = pathItem?.[spec.method];
    const label = `${spec.method.toUpperCase()} ${spec.route}`;
    add(errors, isRecord(operation), `${label} is required`);
    if (!isRecord(operation)) continue;
    add(errors, operation.operationId === operationId, `${label} operationId must be ${operationId}`);
    add(errors, operation['x-contract']?.owner === 'iam-service' && operation['x-contract']?.phase === 'P1', `${label} must be owned by iam-service in P1`);
    add(errors, JSON.stringify(operation.security) === JSON.stringify([{ bearerAuth: [] }]), `${label} must require the platform bearer token`);
    add(errors, operation['x-authorization']?.requiredPermission === spec.permission, `${label} must require ${spec.permission}`);
    add(errors, operation['x-authorization']?.defaultDecision === 'DENY', `${label} must default to DENY`);
    if (spec.lifecycle) add(errors, operation['x-authorization']?.requiredLifecycleState === spec.lifecycle, `${label} must require lifecycle state ${spec.lifecycle}`);
    add(errors, operation['x-audit']?.required === true && nonEmpty(operation['x-audit']?.event), `${label} must emit a correlated audit fact`);
    add(errors, operation.responses?.[spec.success[0]]?.$ref === responseRef(spec.success[1]), `${label} success must use ${spec.success[1]}`);
    add(errors, operation.responses?.['401']?.$ref === responseRef('ApiUnauthorized'), `${label} must use canonical 401`);
    add(errors, operation.responses?.['403']?.$ref === responseRef('ApiForbidden'), `${label} must use canonical 403`);
    if (spec.request) {
      requestSchemas.add(spec.request);
      add(errors, operation.requestBody?.content?.['application/json']?.schema?.$ref === schemaRef(spec.request), `${label} must use ${spec.request}`);
    }
    if (spec.write) {
      add(errors, operation['x-idempotency']?.required === true, `${label} must require Idempotency-Key`);
      add(errors, operation['x-idempotency']?.keyHeader === 'Idempotency-Key', `${label} idempotency header must be Idempotency-Key`);
      add(errors, parameterRefs(pathItem, operation).filter((ref) => ref === '#/components/parameters/B8IdempotencyKey').length === 1, `${label} must reference B8IdempotencyKey exactly once`);
      for (const [status, name] of Object.entries({ 400: 'ApiBadRequest', 401: 'ApiUnauthorized', 403: 'ApiForbidden', 409: 'ApiConflict', 422: 'ApiUnprocessableEntity' })) {
        add(errors, operation.responses?.[status]?.$ref === responseRef(name), `${label} ${status} must use ${name}`);
      }
    }
    if (spec.separation) add(errors, isRecord(operation['x-separation-of-duties']), `${label} must declare separation of duties`);
    if (operationId === 'approveB8PolicyVersion') {
      const separation = operation['x-separation-of-duties'];
      add(errors, separation?.selfApproval === 'forbidden', 'policy self-approval must be forbidden');
      add(errors, hasAll(separation?.mustDifferFrom, ['draftAuthor', 'draftContributors', 'submitter']), 'policy approver must differ from author, contributors and submitter');
      add(errors, separation?.clientSuppliedApprover === 'forbidden', 'client-supplied approver must be forbidden');
    }
    if (spec.invalidation) {
      add(errors, operation['x-cache-invalidation']?.required === true, `${label} must require cache invalidation`);
      add(errors, /deny/i.test(operation['x-cache-invalidation']?.failureMode ?? ''), `${label} cache invalidation failure must deny`);
    }
  }

  for (const name of requestSchemas) {
    const candidate = schema(document, name);
    add(errors, candidate?.additionalProperties === false, `${name} must reject authority injection`);
    add(errors, exactArray(candidate?.['x-client-authority-fields'], []), `${name} must not accept client authority fields`);
    const forbidden = ['actor', 'actorId', 'approver', 'approverId', 'tenant', 'tenantId', 'roles', 'permissions'];
    add(errors, forbidden.every((field) => candidate?.properties?.[field] === undefined), `${name} must not expose actor/approver/tenant/role/permission authority fields`);
  }

  checkResponseEnvelopeAndHeaders(document, errors, 'B8PolicyVersionList', 'B8PolicyVersionListEnvelope');
  checkResponseEnvelopeAndHeaders(document, errors, 'B8PolicyVersionCreated', 'B8PolicyVersionMutationEnvelope');
  checkResponseEnvelopeAndHeaders(document, errors, 'B8PolicyVersionRead', 'B8PolicyVersionEnvelope');
  checkResponseEnvelopeAndHeaders(document, errors, 'B8PolicyVersionMutation', 'B8PolicyVersionMutationEnvelope');
  checkResponseEnvelopeAndHeaders(document, errors, 'B8PolicyBundle', 'B8PolicyBundleEnvelope');
  checkResponseEnvelopeAndHeaders(document, errors, 'B8PdpDecision', 'B8AuthorizationDecisionEnvelope');

  const policy = schema(document, 'B8PolicyVersion');
  add(errors, hasAll(policy?.required, ['status', 'revision', 'tenant', 'document', 'artifactDigest', 'createdBy', 'separationOfDuties', 'auditLinks', 'cacheInvalidation']), 'policy version lacks lifecycle/provenance/audit/cache facts');
  add(errors, exactArray(policy?.properties?.status?.enum, POLICY_LIFECYCLE), 'policy version status lifecycle is invalid');
  const separation = policy?.properties?.separationOfDuties;
  add(errors, separation?.properties?.independentApprovalRequired?.const === true, 'policy version must require independent approval');
  add(errors, separation?.properties?.authorMayApprove?.const === false, 'policy author must not approve the same version');
  add(errors, separation?.properties?.submitterMayApprove?.const === false, 'policy submitter must not approve the same version');

  const roleBinding = schema(document, 'B8RolePermissionBinding');
  add(errors, roleBinding?.additionalProperties === false, 'B8RolePermissionBinding is required and must be closed');
  add(errors, hasAll(roleBinding?.required, ['roleCode', 'permissions', 'assignmentScope']), 'role-to-permission binding is incomplete');
  add(errors, roleBinding?.properties?.permissions?.minItems === 1 && roleBinding?.properties?.permissions?.uniqueItems === true, 'role binding must contain unique permissions');
  const documentSchema = schema(document, 'B8PolicyDocument');
  add(errors, hasAll(documentSchema?.required, ['name', 'roleBindings', 'rules']), 'policy document must include RBAC role bindings and ABAC rules');
  add(errors, documentSchema?.properties?.roleBindings?.items?.$ref === schemaRef('B8RolePermissionBinding'), 'policy document roleBindings must use B8RolePermissionBinding');
  const rule = schema(document, 'B8PolicyRule');
  add(errors, hasAll(rule?.required, ['effect', 'requiredPermissions', 'actions', 'resourceTypes', 'conditions']), 'policy rule must bind required permissions to actions/resources/ABAC conditions');
  add(errors, rule?.properties?.conditions?.additionalProperties === false, 'policy ABAC conditions must reject arbitrary expressions');
  add(errors, hasAll(Object.keys(rule?.properties?.conditions?.properties ?? {}), ['phases', 'requiresAdultEligibility', 'requiredConsentPurposes', 'minimumDeviceTrust', 'contentRights', 'ownerMatchRequired', 'tenantMatchRequired']), 'policy ABAC conditions are incomplete');

  const receipt = schema(document, 'B8PolicyCacheInvalidationReceipt');
  add(errors, hasAll(receipt?.required, ['required', 'status', 'scope', 'issuedAt', 'denyUntilCurrentVersionProven']), 'policy cache invalidation receipt is incomplete');
  add(errors, receipt?.properties?.denyUntilCurrentVersionProven?.const === true, 'PEPs must deny until the current policy version is proven');
  const mutation = schema(document, 'B8PolicyMutationResult');
  add(errors, hasAll(mutation?.required, ['policy', 'auditLink', 'cacheInvalidation']), 'policy mutation result must return policy, audit link and cache invalidation receipt');
}

export function validateIamPolicyContractData({ document, openApi, fragment } = {}) {
  const input = document ?? openApi ?? fragment;
  const errors = [];
  add(errors, isRecord(input), 'IAM policy OpenAPI document must be an object');
  if (!isRecord(input)) return { result: 'FAIL', errors, summary: {} };
  checkRootGovernance(input, errors);
  checkPrincipal(input, errors);
  checkAdultAndConsent(input, errors);
  checkPdp(input, errors);
  checkPolicyControlPlane(input, errors);
  const covered = Object.values(POLICY_OPERATIONS).filter((spec) => Boolean(input.paths?.[spec.route]?.[spec.method])).length;
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
    summary: {
      requiredPolicyOperationCount: Object.keys(POLICY_OPERATIONS).length,
      coveredPolicyOperationCount: covered,
      structuredPdpOperationCount: input.paths?.['/internal/v1/iam/pdp/decisions']?.post ? 1 : 0,
      policySchemaCount: Object.keys(input.components?.schemas ?? {}).filter((name) => /^B8(?:Policy|Pdp|RolePermission|Authorization|Authority)/.test(name)).length,
    },
  };
}

export function validateIamPolicyContract({ root = process.cwd(), input } = {}) {
  const inputPath = path.resolve(root, input ?? DEFAULT_INPUT);
  try {
    const document = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    return { input: path.relative(root, inputPath), ...validateIamPolicyContractData({ document }) };
  } catch (error) {
    return {
      input: path.relative(root, inputPath),
      result: 'FAIL',
      errors: [error instanceof Error ? error.message : String(error)],
      summary: {},
    };
  }
}

function cliInput(argv) {
  const args = [...argv];
  let input;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--input') {
      const next = args[++index];
      if (!next || next.startsWith('--')) return { error: '--input requires a JSON document path' };
      input = next;
    } else if (value?.startsWith('--input=')) {
      input = value.slice('--input='.length);
      if (!input) return { error: '--input requires a JSON document path' };
    } else if (value === '--help' || value === '-h') return { help: true };
    else if (value) return { error: `unknown argument: ${value}` };
  }
  return { input };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const parsed = cliInput(process.argv.slice(2));
  if (parsed.help) {
    console.log('Usage: node scripts/audit/p1r-iam-policy-contract-check.mjs [--input <openapi.json>]');
    process.exit(0);
  }
  if (parsed.error) {
    console.error(JSON.stringify({ result: 'FAIL', errors: [parsed.error], summary: {} }, null, 2));
    process.exit(1);
  }
  const report = validateIamPolicyContract({ input: parsed.input });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === 'PASS' ? 0 : 1);
}
