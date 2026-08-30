import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..', '..');

export const DEFAULT_LEARNER_PLANNING_POLICY = 'config/p1r-learner-planning-contract.v1.json';
export const DEFAULT_PLACEMENT_POLICY = 'config/p1r-placement-contract.v1.json';
export const DEFAULT_B9_OPENAPI = 'packages/contracts/fragments/b9/b9-learner.openapi.json';
export const DEFAULT_B1_OPENAPI = 'packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json';
export const DEFAULT_CANONICAL_OPENAPI = 'packages/contracts/openapi/v1/openapi.json';
export const DEFAULT_EVENT_FRAGMENT = 'packages/contracts/events/v1/fragments/b9-learner-content.events.json';
export const DEFAULT_EVENT_CATALOG = 'packages/contracts/events/v1/catalog.json';
export const DEFAULT_GAP_REGISTRY = 'config/p1r-gap-registry.v1.json';
export const DEFAULT_DATA_OWNERSHIP = 'config/p1r-data-ownership.v1.json';
export const DEFAULT_SAGA_RECOVERY = 'config/p1r-saga-recovery.v1.json';
export const DEFAULT_EVENT_RELIABILITY = 'packages/contracts/events/v1/reliability-policy.json';
export const DEFAULT_B26_RUNTIME = 'config/b26-event-runtime.json';

const FROZEN_POLICY_SHA256 = '184b85687a8a3916cf2746d425fb49a99f348e24062359e498368ccdd3dbd310';
const FROZEN_M1_012_PLACEMENT_POLICY_SHA256 = '9eb39bdaa5f4965d3940b3718dbaf519832948912acaaf5a3d78954dcc4f303b';
const POLICY_KEYS = [
  '$schema', 'schemaVersion', 'task', 'phase', 'maturity', 'runtimeStatus', 'canonicalSources',
  'compatibilityPromotion', 'runtimeBoundary', 'canonicalRoutes', 'authorization', 'goalCatalog',
  'versionEquivalence', 'concurrency', 'planningInput', 'firstDay', 'recovery', 'ownership', 'legacyCompatibility',
  'events', 'b26Static', 'phase1Prohibitions', 'adversarialCases',
];
const AUTHORIZATION_KEYS = ['clientAuthority', 'defaultDecision', 'pep', 'requiredPermission', 'trustedFacts'];
const FORBIDDEN_PHASE_ONE_PROPERTIES = [
  'aiScore', 'aiAssessment', 'mastery', 'masterySignal', 'reward', 'ban', 'officialCertification',
  'nationwidePercentile', 'placementRaw', 'placementScore', 'placementAlgorithm', 'srsState',
];
const HTTP_METHODS = new Set(['get', 'put', 'post', 'patch', 'delete', 'head', 'options']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function same(left, right) {
  return stableJson(left) === stableJson(right);
}

function exact(errors, actual, expected, label) {
  add(errors, same(actual, expected), `${label} must exactly match the frozen policy contract`);
}

function exactKeys(errors, value, expected, label) {
  add(errors, isRecord(value), `${label} must be an object`);
  if (isRecord(value)) exact(errors, Object.keys(value).sort(), [...expected].sort(), `${label} keys`);
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function resolveLocalReference(document, reference) {
  if (typeof reference !== 'string' || !reference.startsWith('#/')) return undefined;
  return reference.slice(2).split('/').reduce(
    (value, token) => value?.[token.replaceAll('~1', '/').replaceAll('~0', '~')],
    document,
  );
}

function dereference(document, value, fallback, seen = new Set()) {
  if (!isRecord(value) || typeof value.$ref !== 'string') return value;
  if (seen.has(value.$ref)) return value;
  const resolved = resolveLocalReference(document, value.$ref) ?? resolveLocalReference(fallback, value.$ref);
  if (!isRecord(resolved)) return value;
  const nextSeen = new Set(seen);
  nextSeen.add(value.$ref);
  const siblings = { ...value };
  delete siblings.$ref;
  return dereference(document, { ...resolved, ...siblings }, fallback, nextSeen);
}

function component(document, name) {
  return document?.components?.schemas?.[name];
}

function schemaProperties(document, schema, fallback) {
  const resolved = dereference(document, schema, fallback);
  if (!isRecord(resolved)) return {};
  const inherited = Array.isArray(resolved.allOf)
    ? Object.assign({}, ...resolved.allOf.map((part) => schemaProperties(document, part, fallback)))
    : {};
  return { ...inherited, ...(resolved.properties ?? {}) };
}

function schemaRequired(document, schema, fallback) {
  const resolved = dereference(document, schema, fallback);
  if (!isRecord(resolved)) return [];
  const inherited = Array.isArray(resolved.allOf)
    ? resolved.allOf.flatMap((part) => schemaRequired(document, part, fallback))
    : [];
  return [...new Set([...inherited, ...(resolved.required ?? [])])];
}

function directSchema(document, schema, fallback) {
  return dereference(document, schema, fallback);
}

function closedObject(document, schema, fallback) {
  const resolved = directSchema(document, schema, fallback);
  return resolved?.type === 'object' && resolved.additionalProperties === false;
}

function enumFor(document, schema, fallback) {
  const resolved = directSchema(document, schema, fallback);
  if (!isRecord(resolved)) return undefined;
  if (Object.hasOwn(resolved, 'const')) return [resolved.const];
  return resolved.enum;
}

function positiveInteger(document, schema, fallback) {
  const resolved = directSchema(document, schema, fallback);
  return resolved?.type === 'integer'
    && resolved?.nullable !== true
    && !Array.isArray(resolved?.type)
    && Number(resolved?.minimum) >= 1;
}

function nonNegativeInteger(document, schema, fallback) {
  const resolved = directSchema(document, schema, fallback);
  return resolved?.type === 'integer'
    && resolved?.nullable !== true
    && !Array.isArray(resolved?.type)
    && Number(resolved?.minimum) >= 0;
}

function opaqueNonNullableString(document, schema, fallback) {
  const resolved = directSchema(document, schema, fallback);
  return resolved?.type === 'string'
    && resolved?.nullable !== true
    && Number(resolved?.minLength) >= 1
    && typeof resolved?.pattern === 'string';
}

function nonEmptyNonNullableString(document, schema, fallback) {
  const resolved = directSchema(document, schema, fallback);
  return resolved?.type === 'string' && resolved?.nullable !== true && Number(resolved?.minLength) >= 1;
}

function methodAt(document, route) {
  return document?.paths?.[route.path]?.[route.method.toLowerCase()];
}

function responseSchema(operation) {
  if (!isRecord(operation?.responses)) return undefined;
  const status = Object.keys(operation.responses).sort().find((code) => /^2\d\d$/.test(code));
  return operation?.responses?.[status]?.content?.['application/json']?.schema;
}

function containsReference(value, target, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (value.$ref === target) return true;
  return Object.values(value).some((child) => containsReference(child, target, seen));
}

function findParameter(document, operation, name, fallback) {
  return (operation?.parameters ?? [])
    .map((parameter) => directSchema(document, parameter, fallback))
    .find((parameter) => parameter?.name === name);
}

function findEvent(document, eventName) {
  return (document?.events ?? []).find((event) => event?.eventName === eventName);
}

function eventPayload(document, event) {
  const payloadRef = event?.payloadSchema?.$ref;
  return resolveLocalReference(document, payloadRef);
}

function hasForbiddenProperty(document, schema, forbidden, fallback, seen = new Set()) {
  if (!schema || typeof schema !== 'object' || seen.has(schema)) return false;
  seen.add(schema);
  const resolved = directSchema(document, schema, fallback);
  if (!resolved || typeof resolved !== 'object') return false;
  if (Object.keys(resolved.properties ?? {}).some((key) => forbidden.includes(key))) return true;
  const children = [
    ...Object.values(resolved.properties ?? {}),
    ...(resolved.allOf ?? []),
    ...(resolved.oneOf ?? []),
    ...(resolved.anyOf ?? []),
  ];
  if (resolved.items) children.push(resolved.items);
  return children.some((child) => hasForbiddenProperty(document, child, forbidden, fallback, seen));
}

function allB9PublicOperationIds(document) {
  return Object.entries(document?.paths ?? {})
    .filter(([routePath]) => routePath.startsWith('/api/v1/learner/'))
    .flatMap(([, pathItem]) => Object.entries(pathItem ?? {})
      .filter(([method, operation]) => HTTP_METHODS.has(method) && isRecord(operation))
      .map(([, operation]) => operation.operationId)
      .filter(Boolean))
    .sort();
}

function responseContains(operation, schemaName) {
  return containsReference(responseSchema(operation), `#/components/schemas/${schemaName}`);
}

function expectedVersionPolicy(rule) {
  return {
    serverOwned: [rule.versionField, rule.stateVersionField],
    equality: `${rule.versionField} MUST equal ${rule.stateVersionField} in every response; ${rule.stateVersionField} is retained as a compatibility alias`,
    clientMaySubmit: false,
  };
}

function forbiddenNot(fields) {
  return { anyOf: fields.map((field) => ({ required: [field] })) };
}

function insertBefore(values, additions, anchor) {
  const result = [...values];
  const anchorIndex = result.indexOf(anchor);
  result.splice(anchorIndex < 0 ? result.length : anchorIndex, 0, ...additions);
  return result;
}

function deriveM1012LearnerPlanningPolicy(basePolicy, placementPolicy, errors) {
  add(errors, digest(placementPolicy) === FROZEN_M1_012_PLACEMENT_POLICY_SHA256, 'M1-012 placement successor policy digest drift');
  exact(errors, placementPolicy?.task, 'P1R-M1-012', 'M1-012 successor task');
  exact(errors, placementPolicy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'M1-012 successor runtime status');
  const successor = placementPolicy?.learnerPlanningSuccessor;
  add(errors, isRecord(successor), 'M1-012 learner planning successor must be an object');
  if (!isRecord(successor)) return structuredClone(basePolicy);
  exact(errors, successor?.task, 'P1R-M1-012', 'learner planning successor task');
  exact(errors, successor?.basePolicyId, 'M1-011_LEARNER_PLANNING_CONTRACT_PROMOTION', 'learner planning successor base policy');
  exact(errors, successor?.planningFragment, DEFAULT_B9_OPENAPI, 'learner planning successor fragment');
  exact(errors, successor?.placementBaselineSchema, 'B9PlacementBaseline', 'learner planning successor baseline schema');
  exact(errors, successor?.planningInput?.schema, basePolicy?.planningInput?.schema, 'learner planning successor input schema');
  exact(errors, successor?.firstDay?.commonSchema, basePolicy?.firstDay?.commonSchema, 'learner planning successor first-day common schema');
  exact(errors, successor?.placementBinding?.lineage, successor?.lineage, 'learner planning successor lineage binding');
  exact(errors, successor?.placementBinding?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'learner planning successor binding runtime status');

  const effective = structuredClone(basePolicy);
  effective.planningInput.requiredFields = insertBefore(
    insertBefore(basePolicy.planningInput.requiredFields, ['contentVersionId'], 'contentEpoch'),
    ['placementBaseline'],
    'planningRuleVersion',
  );
  effective.planningInput.forbiddenFields = [...(successor?.planningInput?.addedForbiddenFields ?? [])];
  effective.planningInput.positiveIntegerFields = insertBefore(
    basePolicy.planningInput.positiveIntegerFields,
    ['contentVersionId'],
    'contentEpoch',
  );
  effective.planningInput.sourceMapping = {
    ...basePolicy.planningInput.sourceMapping,
    contentProjection: [
      ...(successor?.planningInput?.sourceMappingAdditions?.contentProjection ?? []),
      ...basePolicy.planningInput.sourceMapping.contentProjection,
    ],
    assessmentPlacement: [...(successor?.planningInput?.sourceMappingAdditions?.assessmentPlacement ?? [])],
  };
  effective.planningInput.placementBinding = structuredClone(successor?.placementBinding);
  effective.planningInput.placementBaselineSchema = successor?.placementBaselineSchema;
  effective.firstDay.consistency = [
    ...basePolicy.firstDay.consistency,
    ...(successor?.firstDay?.addedConsistency ?? []),
  ];
  return effective;
}

/**
 * Validates a safe, synthetic GoalOptions response against the catalog's
 * exactly-once governance. This is static contract testing only: it does not
 * claim that a deployed service has emitted such a response.
 */
export function validateGoalOptionsPayload(payload, policy) {
  const errors = [];
  const expectedCodes = policy?.goalCatalog?.goalCodes;
  add(errors, Array.isArray(expectedCodes) && expectedCodes.length === 4, 'goal catalog policy must define four expected goal codes');
  add(errors, isRecord(payload), 'GoalOptions payload must be an object');
  const options = payload?.options;
  add(errors, Array.isArray(options), 'GoalOptions payload.options must be an array');
  if (!Array.isArray(expectedCodes) || !Array.isArray(options)) {
    return { result: errors.length === 0 ? 'PASS' : 'FAIL', errors };
  }
  add(errors, options.length === expectedCodes.length, 'GoalOptions payload must contain exactly four options');
  const counts = new Map();
  for (const option of options) {
    const goalCode = option?.goalCode;
    add(errors, typeof goalCode === 'string' && expectedCodes.includes(goalCode), 'GoalOptions payload must not contain an unknown goalCode');
    if (typeof goalCode === 'string') counts.set(goalCode, (counts.get(goalCode) ?? 0) + 1);
  }
  for (const goalCode of expectedCodes) {
    add(errors, counts.get(goalCode) === 1, `GoalOptions payload goalCode ${goalCode} must occur exactly once, independently of label text`);
  }
  return { result: errors.length === 0 ? 'PASS' : 'FAIL', errors };
}

function checkPolicy(policy, errors) {
  exactKeys(errors, policy, POLICY_KEYS, 'learner planning policy');
  add(errors, digest(policy) === FROZEN_POLICY_SHA256, 'learner planning policy digest drift');
  exact(errors, policy?.$schema, 'p1r.learner-planning-contract.v1', 'policy schema');
  exact(errors, policy?.schemaVersion, 'p1r.learner-planning-contract.v1', 'policy schemaVersion');
  exact(errors, policy?.task, 'P1R-M1-011', 'policy task');
  exact(errors, policy?.phase, 'P1', 'policy phase');
  exact(errors, policy?.maturity, 'D2_CONTRACT_READY', 'policy maturity');
  exact(errors, policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'policy runtime status');
  exact(errors, policy?.compatibilityPromotion?.sourceContractBaseline, 'cd92378bd8ba0c57c920fc6e79db52de717b0b05', 'promotion source baseline');
  exact(errors, policy?.compatibilityPromotion?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'promotion runtime status');
  exact(errors, policy?.compatibilityPromotion?.scope, 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC', 'promotion scope');
  exact(errors, policy?.compatibilityPromotion?.eventCatalogDecision, 'TARGET_CANONICAL_D2_PROFILE_AND_FIRST_DAY_HISTORICAL', 'promotion event decision');
  add(errors, policy?.runtimeBoundary?.staticContractOnly === true, 'policy must remain static contract only');
  add(errors, Array.isArray(policy?.runtimeBoundary?.prohibitedRuntimeClaims) && policy.runtimeBoundary.prohibitedRuntimeClaims.length === 7, 'runtime prohibited claim boundary must be exact');
  add(errors, Array.isArray(policy?.canonicalRoutes) && policy.canonicalRoutes.length === 10, 'canonical route inventory must contain exactly ten operations');
  add(errors, new Set((policy?.canonicalRoutes ?? []).map((route) => route?.id)).size === 10, 'canonical route ids must be unique');
  add(errors, new Set((policy?.canonicalRoutes ?? []).map((route) => `${route?.method}:${route?.path}`)).size === 10, 'canonical route method/path pairs must be unique');
  add(errors, new Set(policy?.goalCatalog?.goalCodes ?? []).size === 4, 'goal codes must remain exact and unique');
  add(errors, new Set(policy?.goalCatalog?.dailyQuotaMinutes ?? []).size === 4, 'daily quota values must remain exact and unique');
  add(errors, Array.isArray(policy?.adversarialCases) && policy.adversarialCases.length >= 60, 'policy requires at least sixty adversarial cases');
  add(errors, new Set(policy?.adversarialCases ?? []).size === policy?.adversarialCases?.length, 'adversarial case ids must be unique');
  add(errors, policy?.events?.gap?.catalogStatus === 'D2_CONTRACT_CLOSED', 'ONB-001 catalog governance must remain D2_CONTRACT_CLOSED');
  add(errors, policy?.events?.gap?.registryStatus === 'OPEN', 'ONB-001 registry status must remain OPEN until runtime/evidence closure');
  add(errors, policy?.b26Static?.runtimeStatus === 'pending' && policy?.b26Static?.mode === 'static-only' && policy?.b26Static?.defaultDecision === 'NO-GO', 'B26 must remain static-only pending NO-GO');
}

function checkAuthorization(document, operation, route, policy, errors, label) {
  const authorization = operation?.['x-authorization'];
  exactKeys(errors, authorization, AUTHORIZATION_KEYS, `${label} x-authorization`);
  exact(errors, authorization?.defaultDecision, policy.authorization.defaultDecision, `${label} default decision`);
  exact(errors, authorization?.requiredPermission, route.requiredPermission, `${label} required permission`);
  exact(errors, authorization?.pep, policy.authorization.pep, `${label} PEP`);
  exact(errors, authorization?.trustedFacts, policy.authorization.trustedFacts, `${label} trusted facts`);
  exact(errors, authorization?.clientAuthority, route.operationId === policy.recovery.operationId
    ? policy.authorization.recoveryClientAuthority
    : policy.authorization.genericClientAuthority, `${label} client authority boundary`);
  exact(errors, operation?.security, policy.authorization.bearerSecurity, `${label} bearer security`);
  add(errors, operation?.['x-contract']?.owner === route.owner, `${label} owner must remain ${route.owner}`);
}

function checkRequestBoundary(document, fallback, operation, route, policy, errors, label) {
  if (route.requestSchema === null) {
    add(errors, !Object.hasOwn(operation ?? {}, 'requestBody'), `${label} must not accept a request body`);
    return;
  }
  const request = operation?.requestBody?.content?.['application/json']?.schema;
  add(errors, operation?.requestBody?.required === true, `${label} request body must be required`);
  add(errors, containsReference(request, `#/components/schemas/${route.requestSchema}`), `${label} request schema drift`);
  const schema = component(document, route.requestSchema) ?? component(fallback, route.requestSchema);
  add(errors, closedObject(document, schema, fallback), `${label} request must be closed`);
  const properties = schemaProperties(document, schema, fallback);
  const required = schemaRequired(document, schema, fallback);
  const authorityRule = policy.authorization.forbiddenClientFieldsBySchema.find((entry) => entry.schema === route.requestSchema);
  if (authorityRule) {
    exact(errors, schema?.['x-forbidden-client-fields'], authorityRule.fields, `${label} forbidden client fields`);
    add(errors, authorityRule.fields.every((field) => !Object.hasOwn(properties, field)), `${label} must reject server-owned authority fields`);
    add(errors, required.includes('expectedStateVersion'), `${label} must require expectedStateVersion`);
    add(errors, nonNegativeInteger(document, properties.expectedStateVersion, fallback), `${label}.expectedStateVersion must be non-null non-negative integer`);
  }
}

function checkIdempotency(document, fallback, operation, route, errors, label) {
  if (!route.idempotencyRequired) {
    add(errors, operation?.['x-idempotency']?.required !== true, `${label} must not claim an idempotent write boundary`);
    return;
  }
  exact(errors, operation?.['x-idempotency'], route.idempotencyPolicy, `${label} idempotency semantics`);
  const parameter = findParameter(document, operation, 'Idempotency-Key', fallback);
  add(errors, parameter?.in === 'header' && parameter?.required === true, `${label} must require Idempotency-Key header`);
}

function checkCanonicalRoutes(b9OpenApi, canonicalOpenApi, policy, errors) {
  const expectedOperationIds = policy.canonicalRoutes.map((route) => route.operationId).sort();
  exact(errors, allB9PublicOperationIds(b9OpenApi), expectedOperationIds, 'B9 public learner operation set');
  for (const route of policy.canonicalRoutes) {
    for (const [document, labelPrefix] of [[b9OpenApi, 'B9 fragment'], [canonicalOpenApi, 'composed OpenAPI']]) {
      const operation = methodAt(document, route);
      const label = `${labelPrefix} ${route.operationId}`;
      add(errors, isRecord(operation), `${label} route is required`);
      if (!isRecord(operation)) continue;
      exact(errors, operation.operationId, route.operationId, `${label} operationId`);
      checkAuthorization(document, operation, route, policy, errors, label);
      checkRequestBoundary(document, canonicalOpenApi, operation, route, policy, errors, label);
      checkIdempotency(document, canonicalOpenApi, operation, route, errors, label);
      add(errors, responseContains(operation, route.responseSchema), `${label} must return ${route.responseSchema}`);
    }
  }
  const recoveryPaths = Object.keys(b9OpenApi?.paths ?? {}).filter((routePath) => routePath.startsWith('/api/v1/learner/first-day/recovery'));
  exact(errors, recoveryPaths, [policy.recovery.path], 'recovery route inventory');
  exact(errors, Object.keys(b9OpenApi?.paths?.[policy.recovery.path] ?? {}).sort(), ['get'], 'recovery route methods');
}

function checkGoalCatalog(b9OpenApi, canonicalOpenApi, policy, errors) {
  const options = component(b9OpenApi, policy.goalCatalog.responseSchema);
  const option = component(b9OpenApi, policy.goalCatalog.optionSchema);
  exact(errors, policy.goalCatalog.coverage, 'EXACTLY_ONCE', 'goal catalog exactly-once coverage policy');
  exact(errors, policy.goalCatalog.uniqueBy, 'goalCode', 'goal catalog unique-by policy');
  exact(errors, policy.goalCatalog.optionsUniqueBy, 'goalCode', 'goal catalog option unique-by policy');
  add(errors, closedObject(b9OpenApi, options, canonicalOpenApi), 'B9GoalOptions must be closed');
  exact(errors, schemaRequired(b9OpenApi, options, canonicalOpenApi), policy.goalCatalog.requiredFields, 'B9GoalOptions required fields');
  exact(errors, options?.['x-goal-catalog-policy'], {
    codes: policy.goalCatalog.goalCodes,
    dailyQuotaMinutes: policy.goalCatalog.dailyQuotaMinutes,
    unknownCodeDecision: policy.goalCatalog.unknownCodeDecision,
    coverage: policy.goalCatalog.coverage,
    uniqueBy: policy.goalCatalog.uniqueBy,
  }, 'B9 goal catalog policy');
  const optionList = schemaProperties(b9OpenApi, options, canonicalOpenApi).options;
  const optionListResolved = directSchema(b9OpenApi, optionList, canonicalOpenApi);
  add(errors, optionListResolved?.minItems === 4 && optionListResolved?.maxItems === 4 && optionListResolved?.uniqueItems === true, 'goal catalog must expose exactly four unique choices');
  exact(errors, optionListResolved?.['x-unique-by'], policy.goalCatalog.optionsUniqueBy, 'goal catalog unique-by governance');
  add(errors, containsReference(optionListResolved?.items, `#/components/schemas/${policy.goalCatalog.optionSchema}`), 'goal catalog option item schema drift');
  add(errors, closedObject(b9OpenApi, option, canonicalOpenApi), 'B9GoalOption must be closed');
  exact(errors, schemaRequired(b9OpenApi, option, canonicalOpenApi), policy.goalCatalog.optionRequiredFields, 'B9GoalOption required fields');
  const optionProperties = schemaProperties(b9OpenApi, option, canonicalOpenApi);
  exact(errors, enumFor(b9OpenApi, optionProperties.goalCode, canonicalOpenApi), policy.goalCatalog.goalCodes, 'goal option goalCode enum');
  const optionDurations = directSchema(b9OpenApi, optionProperties.dailyQuotaMinutes, canonicalOpenApi);
  exact(errors, enumFor(b9OpenApi, optionDurations?.items, canonicalOpenApi), policy.goalCatalog.dailyQuotaMinutes, 'goal option daily quota enum');
  for (const schemaName of ['B9LearnerTarget', 'B9LearnerTargetUpsert', policy.planningInput.schema]) {
    const schema = component(b9OpenApi, schemaName);
    const properties = schemaProperties(b9OpenApi, schema, canonicalOpenApi);
    if (schemaName !== policy.planningInput.schema) exact(errors, enumFor(b9OpenApi, properties.goalCode, canonicalOpenApi), policy.goalCatalog.goalCodes, `${schemaName}.goalCode enum`);
    exact(errors, enumFor(b9OpenApi, properties.dailyQuotaMinutes, canonicalOpenApi), policy.goalCatalog.dailyQuotaMinutes, `${schemaName}.dailyQuotaMinutes enum`);
  }
  const targetGoalRule = policy.goalCatalog.profileTargetGoal;
  const profile = component(b9OpenApi, targetGoalRule.schema);
  const profilePatch = component(b9OpenApi, targetGoalRule.patchSchema);
  const profileField = schemaProperties(b9OpenApi, profile, canonicalOpenApi)[targetGoalRule.field];
  const patchField = schemaProperties(b9OpenApi, profilePatch, canonicalOpenApi)[targetGoalRule.field];
  add(errors, profileField?.deprecated === true && patchField?.deprecated === true, 'profile targetGoal must remain compatibility-only and deprecated');
  add(errors, String(profileField?.description ?? '').includes('never selects a goal'), 'profile targetGoal must not become planning authority');
  add(errors, String(patchField?.description ?? '').includes('server-rejected with 422') && String(patchField?.description ?? '').includes('never become planning authority'), 'profile patch targetGoal must be server-rejected and never become planning authority');
  exact(errors, profilePatch?.['x-compatibility-shadow-policy'], targetGoalRule.patchPolicy, 'profile patch targetGoal compatibility shadow policy');
  exact(errors, profilePatch?.not, targetGoalRule.patchNot, 'profile patch targetGoal schema-level prohibition');
  for (const [document, labelPrefix] of [[b9OpenApi, 'B9 fragment'], [canonicalOpenApi, 'composed OpenAPI']]) {
    const route = policy.canonicalRoutes.find((candidate) => candidate?.operationId === targetGoalRule.patchOperationId);
    const operation = methodAt(document, route ?? {});
    const patchSchema = component(document, targetGoalRule.patchSchema);
    const patchTargetGoal = schemaProperties(document, patchSchema, canonicalOpenApi)[targetGoalRule.field];
    exact(errors, patchSchema?.['x-compatibility-shadow-policy'], targetGoalRule.patchPolicy, `${labelPrefix} profile PATCH compatibility shadow policy`);
    exact(errors, patchSchema?.not, targetGoalRule.patchNot, `${labelPrefix} profile PATCH targetGoal prohibition`);
    add(errors, patchTargetGoal?.deprecated === true && String(patchTargetGoal?.description ?? '').includes('server-rejected with 422'), `${labelPrefix} profile PATCH targetGoal must remain a rejected compatibility shadow`);
    add(errors, Object.hasOwn(operation?.responses ?? {}, targetGoalRule.patchResponseStatus), `${labelPrefix} profile PATCH must expose ${targetGoalRule.patchResponseStatus} for targetGoal compatibility-shadow writes`);
  }
  exact(errors, profile?.['x-planning-source-policy'], policy.goalCatalog.planningSourcePolicies.profile, 'profile planning source policy');
  const preferences = component(b9OpenApi, 'B9LearnerPreferences');
  const preferencePatch = component(b9OpenApi, 'B9LearnerPreferencesPatch');
  exact(errors, preferences?.['x-planning-source-policy'], policy.goalCatalog.planningSourcePolicies.preferences, 'preferences planning source policy');
  add(errors, schemaRequired(b9OpenApi, preferences, canonicalOpenApi).includes('weeklyStudyDays'), 'preferences response must require weeklyStudyDays');
  const weeklyDays = schemaProperties(b9OpenApi, preferences, canonicalOpenApi).weeklyStudyDays;
  const weeklyDaysPatch = schemaProperties(b9OpenApi, preferencePatch, canonicalOpenApi).weeklyStudyDays;
  for (const [label, value] of [['preferences', weeklyDays], ['preferences patch', weeklyDaysPatch]]) {
    const resolved = directSchema(b9OpenApi, value, canonicalOpenApi);
    add(errors, resolved?.type === 'array' && resolved?.minItems === 1 && resolved?.maxItems === 7 && resolved?.uniqueItems === true, `${label}.weeklyStudyDays must be a unique 1..7 planning input`);
    add(errors, directSchema(b9OpenApi, resolved?.items, canonicalOpenApi)?.minimum === 1 && directSchema(b9OpenApi, resolved?.items, canonicalOpenApi)?.maximum === 7, `${label}.weeklyStudyDays items must be 1..7`);
  }
  for (const [label, schema] of [
    ['profile', profile], ['profile patch', profilePatch], ['preferences', preferences], ['preferences patch', preferencePatch],
  ]) {
    exact(errors, schemaProperties(b9OpenApi, schema, canonicalOpenApi).timezone?.pattern, policy.goalCatalog.timezonePattern, `${label}.timezone IANA-like pattern`);
  }
}

function checkVersionEquivalence(b9OpenApi, canonicalOpenApi, policy, errors) {
  for (const rule of policy.versionEquivalence) {
    const response = component(b9OpenApi, rule.schema);
    const request = component(b9OpenApi, rule.requestSchema);
    const responseProperties = schemaProperties(b9OpenApi, response, canonicalOpenApi);
    const requestProperties = schemaProperties(b9OpenApi, request, canonicalOpenApi);
    add(errors, closedObject(b9OpenApi, response, canonicalOpenApi), `${rule.schema} must be closed`);
    add(errors, closedObject(b9OpenApi, request, canonicalOpenApi), `${rule.requestSchema} must be closed`);
    add(errors, schemaRequired(b9OpenApi, response, canonicalOpenApi).includes(rule.versionField) && schemaRequired(b9OpenApi, response, canonicalOpenApi).includes(rule.stateVersionField), `${rule.schema} must require server versions`);
    add(errors, positiveInteger(b9OpenApi, responseProperties[rule.versionField], canonicalOpenApi), `${rule.schema}.${rule.versionField} must be a non-null positive integer`);
    add(errors, positiveInteger(b9OpenApi, responseProperties[rule.stateVersionField], canonicalOpenApi), `${rule.schema}.${rule.stateVersionField} must be a non-null positive integer`);
    exact(errors, response?.['x-version-policy'], expectedVersionPolicy(rule), `${rule.schema} version policy`);
    add(errors, schemaRequired(b9OpenApi, request, canonicalOpenApi).includes(rule.expectedStateVersionField), `${rule.requestSchema} must require expectedStateVersion`);
    add(errors, nonNegativeInteger(b9OpenApi, requestProperties[rule.expectedStateVersionField], canonicalOpenApi), `${rule.requestSchema}.expectedStateVersion must be non-null and allow only non-negative values`);
    add(errors, !Object.hasOwn(requestProperties, rule.versionField) && !Object.hasOwn(requestProperties, rule.stateVersionField), `${rule.requestSchema} must not accept server-owned versions`);
  }
}

function checkConcurrency(b9OpenApi, canonicalOpenApi, policy, errors) {
  const concurrency = policy?.concurrency;
  exactKeys(errors, concurrency, ['ifMatchParameter', 'writeOperationIds', 'writeParameterRefs', 'operationBinding'], 'concurrency policy');
  const versionOperationIds = (policy?.versionEquivalence ?? []).map((rule) => rule?.operationId).sort();
  exact(errors, [...(concurrency?.writeOperationIds ?? [])].sort(), versionOperationIds, 'concurrency write operation inventory');
  for (const [document, labelPrefix] of [[b9OpenApi, 'B9 fragment'], [canonicalOpenApi, 'composed OpenAPI']]) {
    const ifMatch = directSchema(document, { $ref: '#/components/parameters/B9IfMatch' }, canonicalOpenApi);
    exact(errors, ifMatch, concurrency?.ifMatchParameter, `${labelPrefix} B9IfMatch parameter`);
    for (const operationId of concurrency?.writeOperationIds ?? []) {
      const route = policy.canonicalRoutes.find((candidate) => candidate?.operationId === operationId);
      const operation = methodAt(document, route ?? {});
      const label = `${labelPrefix} ${operationId}`;
      add(errors, isRecord(operation), `${label} concurrency route is required`);
      if (!isRecord(operation)) continue;
      exact(errors, operation.parameters, concurrency?.writeParameterRefs, `${label} write parameter refs`);
      exact(errors, operation['x-concurrency'], concurrency?.operationBinding, `${label} expectedStateVersion If-Match binding`);
      add(errors, Object.hasOwn(operation.responses ?? {}, '409'), `${label} must expose a 409 version/idempotency conflict response`);
      exact(errors, findParameter(document, operation, 'If-Match', canonicalOpenApi), concurrency?.ifMatchParameter, `${label} If-Match parameter resolution`);
    }
  }
}

function checkPlanningInput(b9OpenApi, canonicalOpenApi, policy, errors) {
  const snapshot = component(b9OpenApi, policy.planningInput.schema);
  const properties = schemaProperties(b9OpenApi, snapshot, canonicalOpenApi);
  add(errors, closedObject(b9OpenApi, snapshot, canonicalOpenApi), 'B9PlanningInputSnapshot must be closed');
  exact(errors, schemaRequired(b9OpenApi, snapshot, canonicalOpenApi), policy.planningInput.requiredFields, 'B9PlanningInputSnapshot required fields');
  exact(errors, snapshot?.['x-forbidden-fields'], policy.planningInput.forbiddenFields, 'B9PlanningInputSnapshot forbidden fields');
  exact(errors, snapshot?.['x-source-mapping'], policy.planningInput.sourceMapping, 'B9PlanningInputSnapshot source mapping');
  exact(errors, snapshot?.['x-p1r-placement-plan-saga'], policy.planningInput.placementBinding, 'B9PlanningInputSnapshot placement-to-plan saga binding');
  add(errors, !policy.planningInput.forbiddenFields.some((field) => Object.hasOwn(properties, field)), 'planning input must not absorb placement, SRS, mastery, or raw assessment facts');
  for (const field of policy.planningInput.positiveIntegerFields) {
    add(errors, positiveInteger(b9OpenApi, properties[field], canonicalOpenApi), `B9PlanningInputSnapshot.${field} must be non-null positive integer`);
  }
  for (const field of policy.planningInput.pinnedStringFields) {
    add(errors, nonEmptyNonNullableString(b9OpenApi, properties[field], canonicalOpenApi), `B9PlanningInputSnapshot.${field} must be a non-null pinned string`);
  }
  for (const field of policy.planningInput.opaqueStringFields) add(errors, opaqueNonNullableString(b9OpenApi, properties[field], canonicalOpenApi), `B9PlanningInputSnapshot.${field} must remain opaque and pattern-bound`);
  exact(errors, directSchema(b9OpenApi, properties.pinDigest, canonicalOpenApi), {
    type: 'string',
    minLength: policy.planningInput.pinDigest.minLength,
    maxLength: policy.planningInput.pinDigest.maxLength,
    pattern: policy.planningInput.pinDigest.pattern,
  }, 'B9PlanningInputSnapshot.pinDigest SHA-256 guard');
  exact(errors, directSchema(b9OpenApi, properties.eligibilitySnapshotDigest, canonicalOpenApi), {
    type: 'string',
    minLength: policy.planningInput.eligibilitySnapshotDigest.minLength,
    maxLength: policy.planningInput.eligibilitySnapshotDigest.maxLength,
    pattern: policy.planningInput.eligibilitySnapshotDigest.pattern,
  }, 'B9PlanningInputSnapshot.eligibilitySnapshotDigest server-derived SHA-256 guard');
  exact(errors, properties.timezone?.pattern, policy.goalCatalog.timezonePattern, 'B9PlanningInputSnapshot.timezone IANA-like pattern');
  const placementBaseline = component(b9OpenApi, policy.planningInput.placementBaselineSchema);
  add(errors, containsReference(properties.placementBaseline, `#/components/schemas/${policy.planningInput.placementBaselineSchema}`), 'B9PlanningInputSnapshot.placementBaseline reference drift');
  add(errors, closedObject(b9OpenApi, placementBaseline, canonicalOpenApi), 'B9PlacementBaseline must remain closed');
  add(errors, placementBaseline?.readOnly === true, 'B9PlacementBaseline must remain read-only');
  exact(errors, placementBaseline?.['x-p1r-placement-baseline']?.lineage, policy.planningInput.placementBinding?.lineage, 'B9PlacementBaseline lineage binding');
  exact(errors, placementBaseline?.['x-p1r-placement-baseline']?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'B9PlacementBaseline runtime status');
  const baselineRequired = schemaRequired(b9OpenApi, placementBaseline, canonicalOpenApi);
  for (const field of [
    'resultKind', 'placementSessionId', 'placementResultId', 'resultVersion', 'reportId', 'reportVersion',
    'manifest', 'contentPin', 'answerRulePin', 'targetPin', 'sourceEventId', 'rootEventId', 'placementFactWatermark',
  ]) add(errors, baselineRequired.includes(field), `B9PlacementBaseline must require ${field}`);
  const referenceBindings = policy?.planningInput?.referenceBindings;
  exactKeys(errors, referenceBindings, ['job', 'plan'], 'planning input reference bindings');
  if (!isRecord(referenceBindings)) return;
  for (const [bindingName, bindingPolicy] of Object.entries(referenceBindings)) {
    const schema = component(b9OpenApi, bindingPolicy?.schema);
    const bindingProperties = schemaProperties(b9OpenApi, schema, canonicalOpenApi);
    const label = `planning input ${bindingName} reference`;
    add(errors, closedObject(b9OpenApi, schema, canonicalOpenApi), `${label} must be closed`);
    exact(errors, schemaRequired(b9OpenApi, schema, canonicalOpenApi), bindingPolicy?.requiredFields, `${label} required fields`);
    exact(errors, schema?.['x-input-binding'], bindingPolicy?.inputBinding, `${label} input binding`);
    for (const field of bindingPolicy?.positiveIntegerFields ?? []) {
      add(errors, positiveInteger(b9OpenApi, bindingProperties[field], canonicalOpenApi), `${label}.${field} must be a non-null positive integer`);
    }
    for (const field of bindingPolicy?.nonEmptyStringFields ?? []) {
      add(errors, nonEmptyNonNullableString(b9OpenApi, bindingProperties[field], canonicalOpenApi), `${label}.${field} must be a non-null non-empty string`);
    }
    for (const field of bindingPolicy?.opaqueStringFields ?? []) {
      add(errors, opaqueNonNullableString(b9OpenApi, bindingProperties[field], canonicalOpenApi), `${label}.${field} must remain opaque and pattern-bound`);
    }
    if (bindingPolicy?.sha256Field) {
      exact(errors, directSchema(b9OpenApi, bindingProperties[bindingPolicy.sha256Field], canonicalOpenApi), {
        type: 'string',
        minLength: policy.planningInput.pinDigest.minLength,
        maxLength: policy.planningInput.pinDigest.maxLength,
        pattern: policy.planningInput.pinDigest.pattern,
      }, `${label}.${bindingPolicy.sha256Field} SHA-256 guard`);
    }
  }
}

function firstDayBranches(projection) {
  return projection?.allOf?.find((part) => Array.isArray(part?.oneOf))?.oneOf ?? [];
}

function branchForState(branches, state) {
  return branches.find((branch) => branch?.properties?.state?.const === state);
}

function stateInputReferenceExpected(policy) {
  const reference = policy?.inputReference;
  if (!isRecord(reference)) return undefined;
  return {
    allOf: [
      { $ref: `#/components/schemas/${reference.schema}` },
      { required: ['status'], properties: { status: { enum: reference.statuses } } },
    ],
  };
}

function checkFirstDayProjection(b9OpenApi, canonicalOpenApi, policy, errors) {
  const projection = component(b9OpenApi, policy.firstDay.schema);
  const common = component(b9OpenApi, policy.firstDay.commonSchema);
  add(errors, Array.isArray(projection?.allOf) && projection.allOf.length === 2, 'B9FirstDayProjection must remain an allOf common model plus oneOf state model');
  exact(errors, projection?.allOf?.[0], { $ref: `#/components/schemas/${policy.firstDay.commonSchema}` }, 'B9FirstDayProjection common reference');
  exact(errors, projection?.['x-state-policy'], policy.firstDay.statePolicy, 'B9FirstDayProjection state policy');
  add(errors, closedObject(b9OpenApi, common, canonicalOpenApi), 'B9FirstDayProjectionCommon must be closed');
  exact(errors, schemaRequired(b9OpenApi, common, canonicalOpenApi), policy.firstDay.baseRequiredFields, 'B9FirstDayProjectionCommon required fields');
  exact(errors, common?.['x-consistency'], policy.firstDay.consistency, 'B9FirstDayProjectionCommon consistency policy');
  const commonProperties = schemaProperties(b9OpenApi, common, canonicalOpenApi);
  exact(errors, enumFor(b9OpenApi, commonProperties.state, canonicalOpenApi), policy.firstDay.states, 'B9 first-day states');
  add(errors, positiveInteger(b9OpenApi, commonProperties.projectionVersion, canonicalOpenApi), 'first-day projectionVersion must be non-null positive integer');
  add(errors, opaqueNonNullableString(b9OpenApi, commonProperties.projectionWatermark, canonicalOpenApi), 'first-day projectionWatermark must be non-null opaque string');
  const branches = firstDayBranches(projection);
  add(errors, branches.length === policy.firstDay.statePolicies.length, 'B9FirstDayProjection must expose exactly four state branches');
  for (const statePolicy of policy.firstDay.statePolicies) {
    const branch = branchForState(branches, statePolicy.state);
    const label = `B9FirstDayProjection ${statePolicy.state}`;
    add(errors, isRecord(branch), `${label} branch is required`);
    if (!isRecord(branch)) continue;
    exact(errors, branch.required, statePolicy.required, `${label} required fields`);
    add(errors, statePolicy.required.every((field) => Object.hasOwn(branch.properties ?? {}, field)), `${label} branch must explicitly declare every branch-required field`);
    exact(errors, branch.not, forbiddenNot(statePolicy.forbidden), `${label} not guard`);
    exact(errors, branch.properties?.state, { const: statePolicy.state }, `${label} discriminator`);
    exact(errors, branch.properties?.taskCount, statePolicy.taskCount, `${label} taskCount guard`);
    exact(errors, branch.properties?.tasks, statePolicy.tasks, `${label} tasks guard`);
    add(errors, !Object.hasOwn(branch.properties ?? {}, 'reason'), `${label} must use degradedReason and must not introduce a reason alias`);
    for (const [field, value] of Object.entries(statePolicy.constants)) exact(errors, branch.properties?.[field], { const: value }, `${label}.${field} state guard`);
    if (statePolicy.required.includes('planningInput')) add(errors, containsReference(branch.properties?.planningInput, `#/components/schemas/${policy.planningInput.schema}`), `${label} must pin planning input`);
    if (statePolicy.required.includes('job')) add(errors, containsReference(branch.properties?.job, '#/components/schemas/B9PlanningJobRef'), `${label} must expose a planning job reference`);
    if (statePolicy.required.includes('plan')) add(errors, containsReference(branch.properties?.plan, '#/components/schemas/B9PlanReference'), `${label} must expose a plan reference`);
    if (statePolicy.required.includes('recovery')) add(errors, containsReference(branch.properties?.recovery, `#/components/schemas/${policy.recovery.responseSchema}`), `${label} must expose learner-safe recovery only`);
    if (statePolicy.inputReference) {
      exact(errors, branch.properties?.[statePolicy.inputReference.field], stateInputReferenceExpected(statePolicy), `${label} input-bound ${statePolicy.inputReference.field} state guard`);
    }
  }
}

function workflowStateBranchesExpected(policy, codeField) {
  return policy.recovery.workflowStatePolicies.map((statePolicy) => ({
    required: ['status', 'retryable', codeField],
    properties: {
      status: statePolicy.statuses.length === 1 ? { const: statePolicy.statuses[0] } : { enum: statePolicy.statuses },
      retryable: { const: statePolicy.retryable },
      [codeField]: statePolicy.safeFailureCodes.length === 1 ? { const: statePolicy.safeFailureCodes[0] } : { enum: statePolicy.safeFailureCodes },
    },
  }));
}

function checkRecovery(b9OpenApi, canonicalOpenApi, policy, errors) {
  const schema = component(b9OpenApi, policy.recovery.responseSchema);
  const properties = schemaProperties(b9OpenApi, schema, canonicalOpenApi);
  add(errors, closedObject(b9OpenApi, schema, canonicalOpenApi), 'B9FirstDayRecovery must be closed');
  exact(errors, schemaRequired(b9OpenApi, schema, canonicalOpenApi), policy.recovery.requiredFields, 'B9FirstDayRecovery required fields');
  add(errors, !policy.recovery.forbiddenFields.some((field) => Object.hasOwn(properties, field)), 'B9FirstDayRecovery must not leak operator, subject, or raw failure fields');
  exact(errors, enumFor(b9OpenApi, properties.status, canonicalOpenApi), policy.recovery.statuses, 'B9FirstDayRecovery statuses');
  exact(errors, enumFor(b9OpenApi, properties.safeFailureCode, canonicalOpenApi), policy.recovery.safeFailureCodes, 'B9FirstDayRecovery safe failure codes');
  add(errors, containsReference(properties.planningInput, `#/components/schemas/${policy.planningInput.schema}`), 'B9FirstDayRecovery must pin planning input');
  add(errors, containsReference(properties.job, '#/components/schemas/B9PlanningJobRef'), 'B9FirstDayRecovery must expose a job reference');
  add(errors, positiveInteger(b9OpenApi, properties.projectionVersion, canonicalOpenApi), 'B9FirstDayRecovery.projectionVersion must be non-null positive integer');
  add(errors, opaqueNonNullableString(b9OpenApi, properties.projectionWatermark, canonicalOpenApi), 'B9FirstDayRecovery.projectionWatermark must be non-null opaque string');
  exact(errors, schema?.oneOf, workflowStateBranchesExpected(policy, 'safeFailureCode'), 'B9FirstDayRecovery retryable/safeFailureCode state branches');
  exact(errors, schema?.['x-input-binding'], policy.recovery.inputBinding, 'B9FirstDayRecovery input binding');
  const job = component(b9OpenApi, 'B9PlanningJobRef');
  add(errors, closedObject(b9OpenApi, job, canonicalOpenApi), 'B9PlanningJobRef must be closed');
  exact(errors, schemaRequired(b9OpenApi, job, canonicalOpenApi), policy.recovery.jobRequiredFields, 'B9PlanningJobRef required fields');
  exact(errors, job?.oneOf, workflowStateBranchesExpected(policy, 'lastErrorCode'), 'B9PlanningJobRef retryable/lastErrorCode state branches');
  const route = policy.canonicalRoutes.find((entry) => entry.operationId === policy.recovery.operationId);
  const operation = methodAt(b9OpenApi, route);
  add(errors, !Object.hasOwn(operation ?? {}, 'requestBody'), 'recovery must remain read-only without a request body');
  exact(errors, findParameter(b9OpenApi, operation, policy.recovery.pathParameter.name, canonicalOpenApi), policy.recovery.pathParameter, 'recovery path parameter');
  exact(errors, operation?.['x-contract'], policy.recovery.contract, 'recovery subject-binding contract');
  add(errors, policy.recovery.clientMayExecuteRecovery === false, 'client recovery execution must remain prohibited');
}

function checkLegacyTargetMapping(b1OpenApi, policy, errors) {
  const mapping = policy?.goalCatalog?.legacyB1TargetMapping;
  const schema = component(b1OpenApi, mapping?.schema);
  const properties = schemaProperties(b1OpenApi, schema);
  const expectedMapping = {
    sourceField: mapping?.sourceField,
    dailyQuotaField: mapping?.dailyQuotaField,
    expectedStateVersionField: mapping?.expectedStateVersionField,
    missingOrUnknownDecision: mapping?.missingOrUnknownDecision,
    dailyQuotaMinutes: mapping?.dailyQuotaMinutes,
    mappings: mapping?.mappings,
  };
  add(errors, closedObject(b1OpenApi, schema), 'B1 legacy profile mapping schema must remain closed');
  exact(errors, schema?.[mapping?.extension], expectedMapping, 'B1 legacy target mapping policy');
  exact(errors, enumFor(b1OpenApi, properties[mapping?.sourceField]), mapping?.legacyGoalCodes, 'B1 legacy targetGoal enum');
  exact(errors, enumFor(b1OpenApi, properties[mapping?.dailyQuotaField]), mapping?.dailyQuotaMinutes, 'B1 legacy daily quota enum');
  exact(errors, directSchema(b1OpenApi, properties[mapping?.expectedStateVersionField]), mapping?.expectedVersionSchema, 'B1 legacy expectedVersion non-negative integer guard');
}

function checkLegacy(b1OpenApi, policy, errors) {
  checkLegacyTargetMapping(b1OpenApi, policy, errors);
  for (const route of policy.legacyCompatibility) {
    const operation = methodAt(b1OpenApi, route);
    const label = `B1 legacy ${route.operationId}`;
    add(errors, isRecord(operation), `${label} route is required`);
    if (!isRecord(operation)) continue;
    exact(errors, operation.operationId, route.operationId, `${label} operationId`);
    add(errors, operation.deprecated === true, `${label} must remain deprecated`);
    exactKeys(errors, operation['x-p1r-deprecation'], ['deprecationAt', 'migrationLink', 'sunsetAt'], `${label} deprecation`);
    exact(errors, operation['x-p1r-b9-adapter'], route.adapterPolicy, `${label} adapter-only policy`);
    add(errors, operation?.['x-contract']?.owner === 'learner-service' && operation?.['x-contract']?.compatibility === 'ADAPTER_ONLY', `${label} owner/compatibility boundary`);
    const authorization = operation['x-authorization'];
    exactKeys(errors, authorization, AUTHORIZATION_KEYS, `${label} x-authorization`);
    exact(errors, authorization?.defaultDecision, policy.authorization.defaultDecision, `${label} default decision`);
    exact(errors, authorization?.requiredPermission, route.requiredPermission, `${label} permission`);
    exact(errors, authorization?.pep, policy.authorization.pep, `${label} PEP`);
    exact(errors, authorization?.trustedFacts, policy.authorization.trustedFacts, `${label} trusted facts`);
    add(errors, typeof authorization?.clientAuthority === 'string' && /(server-derived|cannot expand|cannot establish)/.test(authorization.clientAuthority), `${label} must deny client authority`);
    exact(errors, operation?.security, policy.authorization.bearerSecurity, `${label} bearer security`);
    exact(errors, Object.keys(operation.responses ?? {}).sort(), [...route.responseStatuses].sort(), `${label} response statuses`);
    if (route.method !== 'GET') exact(errors, operation?.['x-idempotency'], route.idempotencyPolicy, `${label} write adapter idempotency semantics`);
    if (route.operationId === 'createB1FirstGoal') {
      const adapter = operation['x-p1r-b9-adapter'];
      const mapping = policy?.goalCatalog?.legacyB1TargetMapping;
      add(errors, !Object.hasOwn(operation, 'requestBody'), `${label} must retain its bodyless legacy wire shape`);
      exact(errors, adapter?.requestBodyPolicy, 'FORBIDDEN_USE_SERVER_OWNED_LEGACY_PROFILE_SNAPSHOT', `${label} bodyless source policy`);
      exact(errors, adapter?.sourceSnapshotSchema, mapping?.schema, `${label} source snapshot schema`);
      exact(errors, adapter?.targetMappingPolicy, `${mapping?.schema}.${mapping?.extension}`, `${label} target mapping policy`);
      exact(errors, adapter?.expectedStateVersionSource, 'SERVER_READ_CURRENT_TARGET_VERSION_OR_ZERO', `${label} expected state version source`);
    }
  }
}

function checkEventPayload(document, event, eventPolicy, policy, errors, label) {
  add(errors, isRecord(event), `${eventPolicy.eventName} ${label} entry is required`);
  if (!isRecord(event)) return;
  add(errors, containsReference(event.payloadSchema, `#/payloadSchemas/${eventPolicy.payloadSchema}`), `${eventPolicy.eventName} ${label} payload schema drift`);
  const payload = eventPayload(document, event);
  add(errors, closedObject(document, payload), `${eventPolicy.eventName} ${label} payload must be closed`);
  exact(errors, schemaRequired(document, payload), eventPolicy.requiredFields, `${eventPolicy.eventName} ${label} required fields`);
  exact(errors, payload?.['x-canonical-required-fields'] ?? [], eventPolicy.canonicalRequiredFields, `${eventPolicy.eventName} ${label} canonical required fields`);
  exact(errors, payload?.['x-forbidden-fields'] ?? [], eventPolicy.canonicalForbiddenFields, `${eventPolicy.eventName} ${label} forbidden field policy`);
  const properties = schemaProperties(document, payload);
  add(errors, eventPolicy.historicalPinFields.every((field) => Object.hasOwn(properties, field)), `${eventPolicy.eventName} ${label} historical pin fields drift`);
  add(errors, !eventPolicy.prohibitedProperties.some((field) => Object.hasOwn(properties, field)), `${eventPolicy.eventName} ${label} must not leak sensitive payload detail`);
  if (eventPolicy.eventName === 'learner.target.updated.v1') {
    exact(errors, Object.keys(properties).sort(), [...(eventPolicy.allowedProperties ?? [])].sort(), `${eventPolicy.eventName} ${label} payload property allowlist`);
    exact(errors, enumFor(document, properties.goalCode), policy.goalCatalog.goalCodes, `${eventPolicy.eventName} ${label} goal enum`);
    exact(errors, enumFor(document, properties.dailyQuotaMinutes), policy.goalCatalog.dailyQuotaMinutes, `${eventPolicy.eventName} ${label} duration enum`);
    exact(errors, properties.targetSnapshotDigest, { type: 'string', minLength: 64, maxLength: 64, pattern: '^[A-Fa-f0-9]{64}$' }, `${eventPolicy.eventName} ${label} target digest SHA-256 guard`);
    const weeklyDays = directSchema(document, properties.weeklyStudyDays);
    add(errors, weeklyDays?.type === 'array' && weeklyDays?.minItems === 1 && weeklyDays?.maxItems === 7 && weeklyDays?.uniqueItems === true, `${eventPolicy.eventName} ${label} must self-contain weeklyStudyDays`);
    exact(errors, properties.timezone?.pattern, policy.goalCatalog.timezonePattern, `${eventPolicy.eventName} ${label} timezone pattern`);
    add(errors, typeof properties.contentLocale?.pattern === 'string', `${eventPolicy.eventName} ${label} must self-contain authoritative contentLocale`);
  }
  if (eventPolicy.eventName === 'learner.first_day.projected.v1') {
    exact(errors, enumFor(document, properties.readiness), policy.firstDay.states, `${eventPolicy.eventName} ${label} readiness enum`);
    exact(errors, enumFor(document, properties.failureCode), policy.events.firstDaySafeFailurePolicy.failureCodeEnum, `${eventPolicy.eventName} ${label} safe failure codes`);
    add(errors, properties.rawFailureDetail === undefined && properties.rawError === undefined && properties.stackTrace === undefined, `${eventPolicy.eventName} ${label} must not leak raw failure detail`);
  }
}

function checkEvents(eventFragment, catalog, gapRegistry, policy, errors) {
  for (const eventPolicy of policy.events.eventPolicies) {
    const fragmentEvent = findEvent(eventFragment, eventPolicy.eventName);
    const catalogEvent = findEvent(catalog, eventPolicy.eventName);
    add(errors, !Object.hasOwn(fragmentEvent ?? {}, 'status'), `${eventPolicy.eventName} fragment must not self-promote a catalog status`);
    checkEventPayload(eventFragment, fragmentEvent, eventPolicy, policy, errors, 'fragment');
    add(errors, catalogEvent?.status === eventPolicy.catalogStatus, `${eventPolicy.eventName} catalog status drift`);
    checkEventPayload(catalog, catalogEvent, eventPolicy, policy, errors, 'catalog');
    if (eventPolicy.eventName === 'learner.target.updated.v1') {
      exact(errors, catalogEvent?.['x-p1r-governance']?.status, policy.events.targetGovernance.status, 'target canonical governance status');
      exact(errors, catalogEvent?.['x-p1r-governance']?.runtimeStatus, policy.events.targetGovernance.runtimeStatus, 'target canonical governance runtime boundary');
      exact(errors, catalogEvent?.['x-p1r-governance']?.scope, policy.events.targetGovernance.scope, 'target canonical governance scope');
      exact(errors, catalogEvent?.['x-p1r-governance']?.producer, policy.events.targetGovernance.producer, 'target canonical producer');
      exact(errors, catalogEvent?.['x-p1r-governance']?.consumers, policy.events.targetGovernance.consumers, 'target canonical consumers');
      exact(errors, catalogEvent?.['x-p1r-governance']?.transport, policy.events.targetGovernance.transport, 'target canonical transport');
      add(errors, !String(fragmentEvent?.compatibility?.consumerRule ?? '').includes('历史 v1 可缺'), 'target fragment may not retain a historical-missing-fields bypass');
    }
  }
  const governanceGap = (catalog?.['x-p1r-event-governance']?.plannedClosures ?? []).find((entry) => entry?.gapId === policy.events.gap.id);
  add(errors, isRecord(governanceGap), 'EVENT-GAP-ONB-001 governance closure entry is required');
  exact(errors, governanceGap?.status, policy.events.gap.catalogStatus, 'EVENT-GAP-ONB-001 governance status');
  exact(errors, [...(governanceGap?.d2ClosureTasks ?? [])].sort(), [...policy.events.gap.closureTasks].sort(), 'EVENT-GAP-ONB-001 governance closure tasks');
  const gap = (gapRegistry?.gaps ?? []).find((entry) => entry?.id === policy.events.gap.id);
  add(errors, isRecord(gap), 'EVENT-GAP-ONB-001 registry entry is required');
  exact(errors, gap?.status, policy.events.gap.registryStatus, 'EVENT-GAP-ONB-001 registry status');
  exact(errors, [...(gap?.closureTasks ?? [])].sort(), [...policy.events.gap.closureTasks].sort(), 'EVENT-GAP-ONB-001 registry closure tasks');
  exact(errors, gap?.closureEvidence ?? null, policy.events.gap.closureEvidence, 'EVENT-GAP-ONB-001 closure evidence');
}

function checkB26Static(b26Runtime, policy, errors) {
  const expected = policy?.b26Static ?? {};
  exact(errors, b26Runtime?.runtimeStatus, expected.runtimeStatus, 'B26 runtime status');
  exact(errors, b26Runtime?.mode, expected.mode, 'B26 mode');
  exact(errors, b26Runtime?.staticDecision, expected.staticDecision, 'B26 static decision');
  exact(errors, b26Runtime?.defaultDecision, expected.defaultDecision, 'B26 default decision');
  const topic = (b26Runtime?.topics ?? []).find((entry) => entry?.name === expected.topic?.name);
  add(errors, isRecord(topic), 'B26 learner topic is required');
  exact(errors, topic?.ownerService, expected.topic?.ownerService, 'B26 learner topic owner');
  exact(errors, topic?.producerPrincipal, expected.topic?.producerPrincipal, 'B26 learner producer principal');
  exact(errors, topic?.partitionKey, expected.topic?.partitionKey, 'B26 learner partition key');
  exact(errors, topic?.consumerGroups, expected.topic?.consumerGroups, 'B26 learner consumers');
  const routing = (b26Runtime?.eventRouting ?? []).find((entry) => entry?.eventName === expected.routing?.eventName);
  exact(errors, routing, expected.routing, 'B26 learner target routing');
}

function checkOwnershipAndRuntime(dataOwnership, sagaRecovery, eventReliability, policy, errors) {
  exact(errors, dataOwnership?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'data ownership runtime status');
  exact(errors, sagaRecovery?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'saga recovery runtime status');
  exact(errors, eventReliability?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'event reliability runtime status');
  const owners = new Map((dataOwnership?.serviceOwners ?? []).map((entry) => [entry?.service, entry]));
  for (const service of ['learner-service', 'learning-service', 'workflow-service']) add(errors, owners.get(service)?.dataOwner === true, `${service} must remain a declared data owner`);
  add(errors, sagaRecovery?.manualRecovery?.clientTriggered === false && sagaRecovery?.manualRecovery?.directDomainWrite === false, 'workflow recovery must remain server/operator-controlled and cannot cross-write domain facts');
  exact(errors, policy.ownership?.profileAndTargetOwner, 'learner-service', 'profile and target owner');
  exact(errors, policy.ownership?.planningInputAndPlanOwner, 'learning-service', 'planning input and plan owner');
  exact(errors, policy.ownership?.firstDayProjectionOwner, 'learner-service', 'first-day projection owner');
  exact(errors, policy.ownership?.recoveryTaskOwner, 'workflow-service', 'recovery task owner');
  add(errors, policy.ownership?.forbiddenCrossOwnerWrites?.includes('learner-service->learning-plan') === true, 'learner-service must not write learning plans');
  add(errors, policy.ownership?.forbiddenCrossOwnerWrites?.includes('workflow-service->learner-target') === true, 'workflow-service must not write learner targets');
}

function checkPhaseBoundary(b9OpenApi, canonicalOpenApi, policy, errors) {
  exact(errors, policy.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'policy runtime boundary');
  exact(errors, policy.compatibilityPromotion.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'promotion runtime boundary');
  for (const route of policy.canonicalRoutes) {
    const schema = component(b9OpenApi, route.responseSchema) ?? component(canonicalOpenApi, route.responseSchema);
    add(errors, !hasForbiddenProperty(b9OpenApi, schema, FORBIDDEN_PHASE_ONE_PROPERTIES, canonicalOpenApi), `${route.operationId} must not expose Phase 1 prohibited authority fields`);
  }
}

export function validateLearnerPlanningContractData(input = {}) {
  const errors = [];
  const requiredInputs = [
    ['policy', 'learner planning policy'], ['b9OpenApi', 'B9 OpenAPI'], ['b1OpenApi', 'B1 OpenAPI'],
    ['canonicalOpenApi', 'composed OpenAPI'], ['eventFragment', 'B9 event fragment'], ['catalog', 'event catalog'],
    ['gapRegistry', 'P1R gap registry'], ['dataOwnership', 'P1R data ownership'], ['sagaRecovery', 'P1R saga recovery'],
    ['eventReliability', 'P1R event reliability'], ['b26Runtime', 'B26 static runtime config'],
    ['placementPolicy', 'M1-012 placement successor policy'],
  ];
  for (const [key, label] of requiredInputs) add(errors, isRecord(input[key]), `${label} must be an object`);
  if (errors.length === 0) {
    checkPolicy(input.policy, errors);
    const effectivePolicy = deriveM1012LearnerPlanningPolicy(input.policy, input.placementPolicy, errors);
    checkCanonicalRoutes(input.b9OpenApi, input.canonicalOpenApi, input.policy, errors);
    checkGoalCatalog(input.b9OpenApi, input.canonicalOpenApi, effectivePolicy, errors);
    checkVersionEquivalence(input.b9OpenApi, input.canonicalOpenApi, input.policy, errors);
    checkConcurrency(input.b9OpenApi, input.canonicalOpenApi, input.policy, errors);
    checkPlanningInput(input.b9OpenApi, input.canonicalOpenApi, effectivePolicy, errors);
    checkFirstDayProjection(input.b9OpenApi, input.canonicalOpenApi, effectivePolicy, errors);
    checkRecovery(input.b9OpenApi, input.canonicalOpenApi, effectivePolicy, errors);
    checkLegacy(input.b1OpenApi, input.policy, errors);
    checkEvents(input.eventFragment, input.catalog, input.gapRegistry, input.policy, errors);
    checkB26Static(input.b26Runtime, input.policy, errors);
    checkOwnershipAndRuntime(input.dataOwnership, input.sagaRecovery, input.eventReliability, input.policy, errors);
    checkPhaseBoundary(input.b9OpenApi, input.canonicalOpenApi, input.policy, errors);
    if (input.goalOptionsPayload !== undefined) {
      const goalOptions = validateGoalOptionsPayload(input.goalOptionsPayload, input.policy);
      errors.push(...goalOptions.errors.map((message) => `GoalOptions payload: ${message}`));
    }
  }
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    summary: {
      taskId: input.policy?.task,
      maturity: input.policy?.maturity,
      runtimeStatus: input.policy?.runtimeStatus,
      canonicalRoutes: input.policy?.canonicalRoutes?.length ?? 0,
      adversarialCases: input.policy?.adversarialCases?.length ?? 0,
      targetEventStatus: input.policy?.events?.eventPolicies?.find((entry) => entry.eventName === 'learner.target.updated.v1')?.catalogStatus,
    },
    errors,
  };
}

export function readLearnerPlanningContractInputs(options = {}) {
  const root = options.root || defaultRoot;
  return {
    policy: readJson(root, DEFAULT_LEARNER_PLANNING_POLICY),
    placementPolicy: readJson(root, DEFAULT_PLACEMENT_POLICY),
    b9OpenApi: readJson(root, DEFAULT_B9_OPENAPI),
    b1OpenApi: readJson(root, DEFAULT_B1_OPENAPI),
    canonicalOpenApi: readJson(root, DEFAULT_CANONICAL_OPENAPI),
    eventFragment: readJson(root, DEFAULT_EVENT_FRAGMENT),
    catalog: readJson(root, DEFAULT_EVENT_CATALOG),
    gapRegistry: readJson(root, DEFAULT_GAP_REGISTRY),
    dataOwnership: readJson(root, DEFAULT_DATA_OWNERSHIP),
    sagaRecovery: readJson(root, DEFAULT_SAGA_RECOVERY),
    eventReliability: readJson(root, DEFAULT_EVENT_RELIABILITY),
    b26Runtime: readJson(root, DEFAULT_B26_RUNTIME),
  };
}

export function validateLearnerPlanningContract(options = {}) {
  return validateLearnerPlanningContractData(readLearnerPlanningContractInputs(options));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  try {
    const report = validateLearnerPlanningContract();
    if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`P1R learner planning contract ${report.result} (${report.summary.canonicalRoutes} canonical routes, ${report.summary.adversarialCases} adversarial cases, target=${report.summary.targetEventStatus}, runtimeStatus=${report.summary.runtimeStatus || 'UNKNOWN'}).`);
      for (const error of report.errors) console.error(`- ${error}`);
    }
    if (report.result !== 'PASS') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
