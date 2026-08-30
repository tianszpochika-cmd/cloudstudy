import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const DEFAULT_INPUT = path.join('packages', 'contracts', 'fragments', 'p1r-gateway-boundary.openapi.json');
const DEFAULT_CANONICAL = path.join('packages', 'contracts', 'openapi', 'v1', 'openapi.json');
const ROOT_EXTENSION = 'x-p1r-gateway-boundary';
const EXPECTED_PUBLIC_OPERATION_COUNT = 350;
const EXPECTED_INTERNAL_OPERATION_COUNT = 51;
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
  add(errors, policy.schemaVersion === '1.0.0', 'Gateway policy schemaVersion must be 1.0.0');
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

function checkInternalPolicy(policy, canonicalOpenApi, errors) {
  const internal = policy.internalOperationPolicy;
  add(errors, internal?.pathPrefix === '/internal/v1', 'internal operation policy pathPrefix must be /internal/v1');
  add(errors, internal?.externalExposure === 'DENY' && internal?.externalCors === 'DENY', 'all internal operations must deny public exposure and CORS');
  add(errors, internal?.requiredCallerIdentity === 'VALIDATED_WORKLOAD_IDENTITY', 'internal operations must require validated workload identity');
  add(errors, internal?.networkIsolationRequired === true && internal?.applicationDenyIsSufficient === false, 'internal operations require network isolation beyond application denial');
  add(errors, internal?.baselineOperationCount === EXPECTED_INTERNAL_OPERATION_COUNT, `internal operation baseline must be ${EXPECTED_INTERNAL_OPERATION_COUNT}`);
  const internalOperations = operations(canonicalOpenApi, internal?.pathPrefix ?? '/internal/v1');
  add(errors, internalOperations.length === EXPECTED_INTERNAL_OPERATION_COUNT, `internal operation baseline drift: expected ${EXPECTED_INTERNAL_OPERATION_COUNT}, got ${internalOperations.length}`);
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
  add(errors, cookie?.name === 'yuxuexing_refresh' && cookie?.httpOnly === true && cookie?.secure === true && cookie?.sameSite === 'Lax' && cookie?.path === '/api/v1/auth', 'Web refresh cookie security attributes are invalid');
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
  add(errors, audit?.required === true && audit?.sink === 'audit-service' && audit?.boundedFields === true && audit?.clientAuthorityFactsPersisted === false && audit?.durableRuntimeEvidenceRequired === true, 'Gateway audit policy must be bounded, redacted and durably evidenced');
  add(errors, hasAll(audit?.allowedFields, ['routeId', 'method', 'status', 'requestId', 'traceId', 'subjectHash', 'tenantHash', 'decision', 'reasonCode']) && hasAll(audit?.redactedFields, ['Authorization', 'Cookie', 'Set-Cookie', 'accessToken', 'refreshToken', 'password', 'requestBody', 'queryString']), 'Gateway audit allow-list/redaction is incomplete');
  const direct = policy.directConnect;
  add(errors, direct?.externalTrafficGatewayOnly === true && direct?.publicDomainServicePorts === false && direct?.ingressNetworkPolicyRequired === true && direct?.serviceCredentialsRequired === true && direct?.gatewayInternalPathDenyIsSufficient === false && direct?.runtimeProbeRequired === true && direct?.failureDecision === 'DENY', 'Gateway direct-connect policy must deny public service access and require runtime network proof');
  const gaps = policy.m2RuntimeGaps;
  const requiredGaps = ['M2-GW-CSRF', 'M2-GW-PUBLIC-PATH', 'M2-GW-RATE-LIMIT', 'M2-GW-AUDIT', 'M2-GW-DIRECT-CONNECT', 'M2-GW-RUNTIME-EVIDENCE'];
  add(errors, Array.isArray(gaps) && gaps.length === requiredGaps.length, 'M2 Gateway runtime gaps are incomplete');
  const ids = new Set();
  for (const gap of gaps ?? []) {
    add(errors, nonEmpty(gap?.id) && !ids.has(gap.id), `M2 Gateway runtime gap is invalid or duplicated: ${gap?.id ?? '<unknown>'}`);
    if (nonEmpty(gap?.id)) ids.add(gap.id);
    add(errors, gap?.ownerTask === 'P1R-M2-001' && gap?.status === 'OPEN' && nonEmpty(gap?.description), `M2 Gateway runtime gap must remain open and owned by M2-001: ${gap?.id ?? '<unknown>'}`);
  }
  for (const id of requiredGaps) add(errors, ids.has(id), `M2 Gateway runtime gap is missing: ${id}`);
}

export function validateGatewayContractData({ document, canonicalOpenApi } = {}) {
  const errors = [];
  checkDocumentRoot(document, errors);
  if (!isRecord(document) || !isRecord(document[ROOT_EXTENSION])) return { result: 'FAIL', errors, summary: {} };
  const projectionMatches = checkProjection(document, canonicalOpenApi, errors);
  const policy = document[ROOT_EXTENSION];
  checkBoundary(policy, errors);
  const owners = checkServiceOwners(policy, errors);
  const routeSummary = checkRouteRules(policy, canonicalOpenApi, owners, errors);
  const internalSummary = checkInternalPolicy(policy, canonicalOpenApi, errors);
  checkOriginsCsrfAndNative(policy, errors);
  checkJwtAndRatePolicy(policy, errors);
  checkEnvelopeAuditAndRuntimeGaps(policy, errors);
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
    summary: {
      routeRuleCount: routeSummary.ruleCount,
      publicOperationCount: routeSummary.publicOperations.length,
      coveredPublicOperationCount: routeSummary.covered,
      publicCoverageErrorCount: routeSummary.coverageErrors,
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
      ...validateGatewayContractData({ document, canonicalOpenApi }),
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
