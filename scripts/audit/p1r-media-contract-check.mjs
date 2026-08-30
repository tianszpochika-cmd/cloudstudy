import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const DEFAULT_MEDIA_POLICY = 'config/p1r-media-contract.v1.json';
export const DEFAULT_CANONICAL_OPENAPI = 'packages/contracts/openapi/v1/openapi.json';
export const DEFAULT_EVENT_CATALOG = 'packages/contracts/events/v1/catalog.json';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const REQUIRED_ROUTE_IDENTITIES = Object.freeze([
  ['media-upload-intent', '/api/v1/media/upload-intents', 'POST', 'media-service', 'createMediaUploadIntent', 'MediaUploadIntentRequest', 'MediaUploadIntent', '201', true],
  ['media-upload-complete', '/api/v1/media/upload-intents/{uploadIntentId}/complete', 'POST', 'media-service', 'completeMediaUploadIntent', 'MediaUploadIntentCompleteRequest', 'MediaUploadIntentCompletion', '202', true],
  ['media-processing-task-read', '/api/v1/media/processing-tasks/{taskId}', 'GET', 'media-service', 'getMediaProcessingTask', null, 'MediaProcessingTask', '200', false],
  ['media-processing-task-retry', '/api/v1/media/processing-tasks/{taskId}/retry', 'POST', 'media-service', 'retryMediaProcessingTask', 'MediaProcessingTaskRetryRequest', 'MediaProcessingTask', '202', true],
  ['media-asset-read', '/api/v1/media/assets/{assetId}', 'GET', 'media-service', 'getMediaAsset', null, 'MediaAsset', '200', false],
  ['media-manifest-read', '/api/v1/media/assets/{assetId}/manifest', 'GET', 'media-service', 'getMediaAssetManifest', null, 'MediaManifest', '200', false],
  ['media-signed-access', '/api/v1/media/assets/{assetId}/signed-access', 'POST', 'media-service', 'createMediaAssetSignedAccess', 'MediaSignedAccessRequest', 'MediaSignedAccessGrant', '200', true],
  ['speaking-recording-upload-intent', '/api/v1/speaking/recordings/upload-intents', 'POST', 'media-service', 'createSpeakingRecordingUploadIntent', 'SpeakingRecordingUploadIntentRequest', 'SpeakingRecordingUploadIntent', '201', true],
  ['speaking-recording-complete', '/api/v1/speaking/recordings/{recordingId}/complete', 'POST', 'media-service', 'completeSpeakingRecording', 'SpeakingRecordingCompleteRequest', 'SpeakingRecording', '202', true],
  ['speaking-recording-read', '/api/v1/speaking/recordings/{recordingId}', 'GET', 'media-service', 'getSpeakingRecording', null, 'SpeakingRecording', '200', false],
  ['speaking-recording-delete', '/api/v1/speaking/recordings/{recordingId}', 'DELETE', 'media-service', 'deleteSpeakingRecording', null, 'SpeakingRecordingDeleteReceipt', '202', true],
  ['shadowing-session-create', '/api/v1/speaking/shadowing/sessions', 'POST', 'assessment-service', 'createSpeakingShadowingSession', 'SpeakingShadowingSessionCreateRequest', 'SpeakingShadowingSession', '201', true],
  ['shadowing-session-progress', '/api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress', 'POST', 'assessment-service', 'recordSpeakingShadowingProgress', 'SpeakingShadowingProgressRequest', 'SpeakingShadowingSession', '200', true],
  ['shadowing-session-complete', '/api/v1/speaking/shadowing/sessions/{shadowingSessionId}/complete', 'POST', 'assessment-service', 'completeSpeakingShadowingSession', 'SpeakingShadowingCompletionRequest', 'SpeakingShadowingCompletionReceipt', '200', true],
]);

const REQUIRED_SCHEMA_NAMES = Object.freeze([
  'MediaUploadIntentRequest',
  'MediaExpectedObject',
  'MediaUploadIntent',
  'MediaUploadGrant',
  'MediaUploadBinding',
  'MediaUploadIntentCompleteRequest',
  'MediaUploadIntentCompletion',
  'MediaProcessingTask',
  'MediaProcessingTaskRetryRequest',
  'MediaAsset',
  'MediaManifest',
  'MediaFallbackAlternative',
  'MediaSignedAccessRequest',
  'MediaSignedAccessGrant',
  'MediaAccessBinding',
  'MediaIntegrity',
  'MediaRendition',
  'MediaSubtitleTrack',
  'SpeakingRecordingUploadIntentRequest',
  'SpeakingRecordingUploadIntent',
  'SpeakingRecordingCompleteRequest',
  'SpeakingRecording',
  'SpeakingRecordingDeleteReceipt',
  'SpeakingShadowingSessionCreateRequest',
  'SpeakingShadowingSession',
  'SpeakingShadowingProgressRequest',
  'SpeakingShadowingCompletionRequest',
  'SpeakingShadowingCompletionReceipt',
  'MediaPlaybackCapability',
  'MediaPublishEligibility',
]);

const REQUIRED_TASK_TYPES = Object.freeze([
  'UPLOAD_VERIFY',
  'MALWARE_SCAN',
  'TRANSCODE',
  'RENDITION',
  'SUBTITLE_INGEST',
  'DELETE_OBJECT',
]);

const REQUIRED_MALWARE_STATUSES = Object.freeze(['PENDING', 'CLEAN', 'INFECTED', 'ERROR']);
const REQUIRED_DELETE_STATES = Object.freeze(['DELETE_REQUESTED', 'HOLD_BLOCKED', 'PURGE_PENDING', 'DELETED', 'PURGE_FAILED']);
const REQUIRED_PLAYBACK_PRESETS = Object.freeze([0.5, 0.75, 1, 1.25, 1.5, 2]);
const REQUIRED_PHASE_FEATURES = Object.freeze(['ASR', 'AI_SCORING', 'GENERATIVE_AI', 'DIGITAL_HUMAN', 'RTC']);
const REQUIRED_HISTORICAL_EVENTS = Object.freeze([
  'media.started.v1',
  'media.segment_completed.v1',
  'media.downloaded.v1',
  'media.revoked.v1',
  'recording.saved.v1',
  'speaking.permission_requested.v1',
  'shadowing.completed.v1',
  'speaking.self_rating.submitted.v1',
  'speaking.shadowing.progressed.v1',
  'media.offline.package.synced.v1',
  'listening.dictation.submitted.v1',
]);
const FORBIDDEN_CANDIDATE_EVENTS = Object.freeze([
  'media.asset_registered',
  'media.asset_activated',
  'media.asset_transcoding_updated',
  'media.asset_rendition_updated',
  'media.asset_revoked',
]);
const REQUIRED_ADVERSARIAL_CASES = Object.freeze([
  'CLIENT_AUTHORITY_AND_CONSENT_INJECTION',
  'CROSS_OWNER_OR_TENANT_ACCESS',
  'MISSING_INVALID_OR_WITHDRAWN_VOICE_CONSENT',
  'UPLOAD_INTENT_REPLAY_OR_EXPIRY',
  'MIME_POLYGLOT_HASH_SIZE_DURATION_MISMATCH',
  'QUOTA_RESERVATION_BYPASS',
  'MALWARE_NOT_CLEAN',
  'STALE_CALLBACK_AND_RETRY_SPOOF',
  'URL_LEAK_OR_SCOPE_ESCALATION',
  'LEGAL_HOLD_DELETE_RACE',
  'SENSITIVE_ALIAS_OR_UNKNOWN_FIELD',
  'AI_ASR_ALIAS',
  'PLAYBACK_RATE_OR_CLIENT_PITCH_CLAIM',
  'SUBTITLE_OWNER_OR_TRANSCRIPT_CONFUSION',
  'DUPLICATE_POLICY_VALUE',
  'RUNTIME_PROMOTION',
]);

const ROOT_POLICY_KEYS = Object.freeze([
  '$schema',
  'schemaVersion',
  'task',
  'phase',
  'maturity',
  'runtimeStatus',
  'canonicalSources',
  'compatibilityPromotion',
  'runtimeBoundary',
  'owners',
  'authorization',
  'canonicalRoutes',
  'schemaRequirements',
  'upload',
  'tasks',
  'rendition',
  'subtitles',
  'delivery',
  'capture',
  'publishEligibility',
  'lifecycle',
  'playback',
  'phaseFeatures',
  'historicalEvents',
  'eventPromotion',
  'legacyCompatibility',
  'adversarialCases',
]);

const FORBIDDEN_URL_FIELD = /(?:^|[_-])(url|uri)(?:$|[_-])|^(?:signed|permanent|object|download|upload)Url$/i;
const EXPECTED_POLICY_FINGERPRINT = '56fbe9c62beea0e22478a03778c2597a41751280497ca254950504e294d818fe';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableWithNormalizedArrays(value) {
  if (Array.isArray(value)) return `[${value.map(stableWithNormalizedArrays).sort().join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableWithNormalizedArrays(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function policyFingerprint(policy) {
  return createHash('sha256').update(stableWithNormalizedArrays(policy)).digest('hex');
}

function assertKnownKeys(errors, value, allowed, label) {
  add(errors, isRecord(value), `${label} must be an object`);
  if (!isRecord(value)) return;
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  add(errors, unknown.length === 0, `${label} has unknown field(s): ${unknown.join(', ')}`);
}

function assertArray(errors, value, label) {
  add(errors, Array.isArray(value), `${label} must be an array`);
  return Array.isArray(value) ? value : [];
}

function assertUnique(errors, value, label) {
  if (!Array.isArray(value)) return;
  const seen = new Set();
  const duplicates = [];
  for (const item of value) {
    const key = stable(item);
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  }
  add(errors, duplicates.length === 0, `${label} contains duplicate value(s)`);
}

function assertExactSet(errors, actual, expected, label) {
  assertArray(errors, actual, label);
  assertUnique(errors, actual, label);
  if (!Array.isArray(actual)) return;
  const actualSet = new Set(actual.map(stable));
  const expectedSet = new Set(expected.map(stable));
  const equal = actualSet.size === expectedSet.size
    && [...expectedSet].every((item) => actualSet.has(item));
  add(errors, equal, `${label} must be exactly ${JSON.stringify(expected)}`);
}

function assertIncludes(errors, actual, expected, label) {
  assertArray(errors, actual, label);
  if (!Array.isArray(actual)) return;
  const actualSet = new Set(actual.map(stable));
  add(errors, expected.every((item) => actualSet.has(stable(item))), `${label} is incomplete`);
}

function checkNoDuplicates(value, errors, label = 'policy') {
  if (Array.isArray(value)) {
    assertUnique(errors, value, label);
    value.forEach((entry, index) => checkNoDuplicates(entry, errors, `${label}[${index}]`));
  } else if (isRecord(value)) {
    Object.entries(value).forEach(([key, entry]) => checkNoDuplicates(entry, errors, `${label}.${key}`));
  }
}

function checkNoRuntimePromotion(value, errors, label = 'policy') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => checkNoRuntimePromotion(entry, errors, `${label}[${index}]`));
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, entry]) => checkNoRuntimePromotion(entry, errors, `${label}.${key}`));
    return;
  }
  if (typeof value !== 'string' || value === 'NOT_RUNTIME_VERIFIED') return;
  const normalized = value.toUpperCase().replace(/[-\s]+/g, '_');
  const promoted = /(RUNTIME_(?:PASS|VERIFIED|COMPLETE)|(?:^|_)DEPLOYED(?:_|$)|(?:^|_)CERTIFIED(?:_|$)|PRODUCTION_VERIFIED)/.test(normalized);
  add(errors, !promoted, `${label} must not promote unverified runtime evidence`);
}

function schemaRef(name) {
  return `#/components/schemas/${name}`;
}

function getSchema(document, name) {
  return document?.components?.schemas?.[name];
}

function getPointer(document, ref) {
  if (!nonEmptyString(ref) || !ref.startsWith('#/')) return undefined;
  return ref.slice(2).split('/').reduce((current, token) => current?.[token.replace(/~1/g, '/').replace(/~0/g, '~')], document);
}

function resolveReference(document, candidate, depth = 0) {
  if (!isRecord(candidate) || depth > 12) return candidate;
  if (!nonEmptyString(candidate.$ref)) return candidate;
  return resolveReference(document, getPointer(document, candidate.$ref), depth + 1);
}

function containsSchemaReference(document, candidate, expectedRef, seen = new Set(), depth = 0) {
  if (!isRecord(candidate) || depth > 16) return false;
  if (candidate.$ref === expectedRef) return true;
  const marker = candidate.$ref ?? `${depth}:${stable(candidate)}`;
  if (seen.has(marker)) return false;
  seen.add(marker);
  if (candidate.$ref) return containsSchemaReference(document, getPointer(document, candidate.$ref), expectedRef, seen, depth + 1);
  if (Array.isArray(candidate.allOf) && candidate.allOf.some((entry) => containsSchemaReference(document, entry, expectedRef, seen, depth + 1))) return true;
  if (Array.isArray(candidate.oneOf) && candidate.oneOf.some((entry) => containsSchemaReference(document, entry, expectedRef, seen, depth + 1))) return true;
  if (Array.isArray(candidate.anyOf) && candidate.anyOf.some((entry) => containsSchemaReference(document, entry, expectedRef, seen, depth + 1))) return true;
  if (Object.values(candidate.properties ?? {}).some((entry) => containsSchemaReference(document, entry, expectedRef, seen, depth + 1))) return true;
  if (isRecord(candidate.items) && containsSchemaReference(document, candidate.items, expectedRef, seen, depth + 1)) return true;
  if (isRecord(candidate.additionalProperties) && containsSchemaReference(document, candidate.additionalProperties, expectedRef, seen, depth + 1)) return true;
  return false;
}

function operationRequestUses(document, operation, expectedName) {
  if (!expectedName) return operation?.requestBody === undefined;
  const request = resolveReference(document, operation?.requestBody);
  return containsSchemaReference(document, request?.content?.['application/json']?.schema, schemaRef(expectedName));
}

function operationResponseUses(document, operation, status, expectedName) {
  const response = resolveReference(document, operation?.responses?.[status]);
  return containsSchemaReference(document, response?.content?.['application/json']?.schema, schemaRef(expectedName));
}

function operationParameters(document, pathItem, operation) {
  const raw = [
    ...(Array.isArray(pathItem?.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(operation?.parameters) ? operation.parameters : []),
  ];
  return raw.map((parameter) => resolveReference(document, parameter)).filter(isRecord);
}

function hasIdempotencyHeader(document, pathItem, operation) {
  return operation?.['x-idempotency']?.required === true
    && operation?.['x-idempotency']?.keyHeader === 'Idempotency-Key'
    && operationParameters(document, pathItem, operation)
      .some((parameter) => parameter.name === 'Idempotency-Key' && parameter.in === 'header' && parameter.required === true);
}

function propertyExactValue(property, value) {
  return property?.const === value
    || (Array.isArray(property?.enum) && property.enum.length === 1 && property.enum[0] === value);
}

function propertyEnumIncludes(property, value) {
  return propertyExactValue(property, value) || property?.enum?.includes(value) === true;
}

function propertyEnumExact(property, expected) {
  return Array.isArray(property?.enum)
    && property.enum.length === expected.length
    && expected.every((value) => property.enum.includes(value))
    && new Set(property.enum.map(stable)).size === property.enum.length;
}

function propertyFixedNumber(property, expected) {
  return propertyExactValue(property, expected)
    || (property?.type === 'integer' && property?.minimum === expected && property?.maximum === expected);
}

function hasExactArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && expected.every((value) => actual.includes(value))
    && new Set(actual.map(stable)).size === actual.length;
}

function normalizePathTemplate(value) {
  return String(value).replace(/\{[^}]+\}/g, '{}');
}

function routeIdentity(route) {
  return [
    route?.id,
    route?.path,
    String(route?.method ?? '').toUpperCase(),
    route?.owner,
    route?.operationId,
    route?.requestSchema ?? null,
    route?.responseSchema,
    route?.successStatus,
    route?.idempotencyRequired === true,
  ];
}

function expectedRouteIdentity(row) {
  return row;
}

function matchesGatewayRule(rule, route) {
  const match = rule?.match;
  if (!isRecord(match) || !Array.isArray(match.methods)) return false;
  if (!match.methods.map((method) => String(method).toUpperCase()).includes(String(route.method).toUpperCase())) return false;
  if (match.type === 'EXACT') return match.path === route.path;
  if (match.type === 'PREFIX') return route.path === match.path || route.path.startsWith(`${match.path}/`);
  return false;
}

function authoritativeGatewayOwner(document, route) {
  const rules = document?.['x-p1r-gateway-boundary']?.routeRules;
  if (!Array.isArray(rules)) return { error: 'x-p1r-gateway-boundary.routeRules is required' };
  const matches = rules.filter((rule) => matchesGatewayRule(rule, route));
  if (matches.length === 0) return { error: `no Gateway rule covers ${route.method} ${route.path}` };
  const highestPriority = Math.max(...matches.map((rule) => Number(rule.priority)));
  const selected = matches.filter((rule) => Number(rule.priority) === highestPriority);
  if (selected.length !== 1) return { error: `Gateway owner is ambiguous for ${route.method} ${route.path}` };
  return { owner: selected[0].upstreamOwner, rule: selected[0] };
}

function findOperation(document, route) {
  const pathItem = document?.paths?.[route.path];
  return { pathItem, operation: pathItem?.[String(route.method).toLowerCase()] };
}

function findRequirement(policy, name) {
  return policy?.schemaRequirements?.find((requirement) => requirement?.name === name);
}

function checkRequirement(policy, errors, name, expected = {}) {
  const requirement = findRequirement(policy, name);
  add(errors, isRecord(requirement), `schemaRequirements must include ${name}`);
  if (!isRecord(requirement)) return undefined;
  assertKnownKeys(errors, requirement, ['name', 'requiredFields', 'allowedFields', 'forbiddenFields', 'constants'], `schemaRequirement ${name}`);
  assertArray(errors, requirement.requiredFields, `${name}.requiredFields`);
  assertArray(errors, requirement.allowedFields, `${name}.allowedFields`);
  assertArray(errors, requirement.forbiddenFields, `${name}.forbiddenFields`);
  assertUnique(errors, requirement.requiredFields, `${name}.requiredFields`);
  assertUnique(errors, requirement.allowedFields, `${name}.allowedFields`);
  assertUnique(errors, requirement.forbiddenFields, `${name}.forbiddenFields`);
  const allowed = new Set(requirement.allowedFields ?? []);
  const forbidden = new Set(requirement.forbiddenFields ?? []);
  add(errors, (requirement.requiredFields ?? []).every((field) => allowed.has(field)), `${name} required fields must be allowed`);
  add(errors, (requirement.requiredFields ?? []).every((field) => !forbidden.has(field)), `${name} must not both require and forbid a field`);
  add(errors, (requirement.allowedFields ?? []).every((field) => !forbidden.has(field)), `${name} must not both allow and forbid a field`);
  if (expected.required) assertIncludes(errors, requirement.requiredFields, expected.required, `${name}.requiredFields`);
  if (expected.allowed) assertIncludes(errors, requirement.allowedFields, expected.allowed, `${name}.allowedFields`);
  if (expected.forbidden) assertIncludes(errors, requirement.forbiddenFields, expected.forbidden, `${name}.forbiddenFields`);
  if (expected.constants) {
    add(errors, isRecord(requirement.constants), `${name}.constants is required`);
    for (const [field, value] of Object.entries(expected.constants)) {
      add(errors, requirement.constants?.[field] === value, `${name}.${field} must be ${JSON.stringify(value)}`);
    }
  }
  return requirement;
}

function checkPolicyBasics(policy, errors) {
  assertKnownKeys(errors, policy, ROOT_POLICY_KEYS, 'media policy');
  add(errors, policy?.$schema === 'p1r.media-contract.v1', 'media policy $schema must be p1r.media-contract.v1');
  add(errors, policy?.schemaVersion === 'p1r.media-contract.v1', 'media policy schemaVersion must be p1r.media-contract.v1');
  add(errors, policy?.task === 'P1R-M1-009', 'media policy must be owned by P1R-M1-009');
  add(errors, policy?.phase === 'P1', 'media policy phase must be P1');
  add(errors, policy?.maturity === 'D2_CONTRACT_READY', 'media policy maturity must be D2_CONTRACT_READY');
  add(errors, policy?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'media policy runtimeStatus must be NOT_RUNTIME_VERIFIED');
  assertKnownKeys(errors, policy?.canonicalSources, ['openApi', 'eventCatalog', 'gatewayExtension'], 'canonicalSources');
  add(errors, policy?.canonicalSources?.openApi === DEFAULT_CANONICAL_OPENAPI, 'canonicalSources.openApi is invalid');
  add(errors, policy?.canonicalSources?.eventCatalog === DEFAULT_EVENT_CATALOG, 'canonicalSources.eventCatalog is invalid');
  add(errors, policy?.canonicalSources?.gatewayExtension === 'x-p1r-gateway-boundary', 'canonicalSources.gatewayExtension is invalid');
  const promotion = policy?.compatibilityPromotion;
  assertKnownKeys(errors, promotion, ['id', 'sourceContractBaseline', 'previousPromotion', 'runtimeStatus', 'scope', 'eventCatalogDecision', 'canonicalFragment'], 'compatibilityPromotion');
  add(errors, promotion?.id === 'M1-009_MEDIA_CONTRACT_PROMOTION', 'compatibilityPromotion.id is invalid');
  add(errors, promotion?.sourceContractBaseline === 'ca282cd00dabeeb3fafbf6b4570054bd5b9f8549', 'compatibilityPromotion.sourceContractBaseline is invalid');
  add(errors, promotion?.previousPromotion === 'M1-008_CONTENT_LIFECYCLE_PROMOTION', 'compatibilityPromotion.previousPromotion is invalid');
  add(errors, promotion?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'compatibilityPromotion.runtimeStatus must be NOT_RUNTIME_VERIFIED');
  add(errors, promotion?.scope === 'OPENAPI_ONLY', 'compatibilityPromotion.scope must be OPENAPI_ONLY');
  add(errors, promotion?.eventCatalogDecision === 'UNCHANGED_HISTORICAL_ONLY', 'compatibilityPromotion.eventCatalogDecision must be UNCHANGED_HISTORICAL_ONLY');
  add(errors, promotion?.canonicalFragment === 'packages/contracts/fragments/b11/p1r-media.openapi.json', 'compatibilityPromotion.canonicalFragment is invalid');
  assertKnownKeys(errors, policy?.runtimeBoundary, ['staticContractOnly', 'prohibitedRuntimeClaims'], 'runtimeBoundary');
  add(errors, policy?.runtimeBoundary?.staticContractOnly === true, 'runtimeBoundary must be staticContractOnly');
  assertArray(errors, policy?.runtimeBoundary?.prohibitedRuntimeClaims, 'runtimeBoundary.prohibitedRuntimeClaims');
  add(errors, (policy?.runtimeBoundary?.prohibitedRuntimeClaims?.length ?? 0) >= 8, 'runtimeBoundary must enumerate runtime evidence still unverified');
}

function checkPolicyOwners(policy, errors) {
  const owners = policy?.owners;
  assertKnownKeys(errors, owners, ['content', 'media', 'assessment', 'privacy', 'identity', 'workflow', 'audit'], 'owners');
  const expected = {
    content: 'content-service',
    media: 'media-service',
    assessment: 'assessment-service',
    privacy: 'learner-service.privacy',
    identity: 'iam-service',
    workflow: 'workflow-service',
    audit: 'audit-service',
  };
  for (const [name, service] of Object.entries(expected)) {
    assertKnownKeys(errors, owners?.[name], name === 'workflow' ? ['service', 'facts', 'foreignDomainWrite'] : name === 'audit' ? ['service', 'facts', 'businessStateOwner'] : ['service', 'facts'], `owners.${name}`);
    add(errors, owners?.[name]?.service === service, `owners.${name}.service must be ${service}`);
    assertArray(errors, owners?.[name]?.facts, `owners.${name}.facts`);
  }
  add(errors, owners?.workflow?.foreignDomainWrite === 'PROHIBITED', 'workflow must not write foreign domain state');
  add(errors, owners?.audit?.businessStateOwner === false, 'audit must not own business state');
}

function checkPolicyAuthorization(policy, errors) {
  const authorization = policy?.authorization;
  assertKnownKeys(errors, authorization, ['serverDerivedFields', 'forbiddenClientAuthorityFields', 'adultGate', 'consent', 'sourceRights'], 'authorization');
  assertIncludes(errors, authorization?.serverDerivedFields, ['tenant', 'subject', 'owner', 'actor', 'rights', 'consent', 'taskAttempt', 'assetVersion', 'objectVerification'], 'authorization.serverDerivedFields');
  assertIncludes(errors, authorization?.forbiddenClientAuthorityFields, ['tenant', 'tenantId', 'subject', 'subjectId', 'owner', 'ownerId', 'actor', 'actorId', 'rights', 'consent', 'media_consent', 'taskAttempt', 'attempt', 'retryable', 'malwareStatus'], 'authorization.forbiddenClientAuthorityFields');
  assertKnownKeys(errors, authorization?.adultGate, ['authority', 'requiredState', 'missingOrUncertain'], 'authorization.adultGate');
  add(errors, authorization?.adultGate?.authority === 'iam-service', 'adult Gate authority must be iam-service');
  add(errors, authorization?.adultGate?.requiredState === 'ELIGIBLE', 'adult Gate must require ELIGIBLE');
  add(errors, authorization?.adultGate?.missingOrUncertain === 'DENY', 'adult Gate uncertainty must deny');

  const consent = authorization?.consent;
  assertKnownKeys(errors, consent, ['type', 'purpose', 'genericMediaConsentAllowed', 'requiredFacts', 'states', 'withdrawnOrStale'], 'authorization.consent');
  add(errors, consent?.type === 'VOICE_RECORDING', 'consent type must be VOICE_RECORDING');
  add(errors, consent?.purpose === 'ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY', 'consent purpose must be dedicated adult voice-recording storage/replay');
  add(errors, consent?.genericMediaConsentAllowed === false, 'generic media_consent must be prohibited');
  assertExactSet(errors, consent?.states, ['GRANTED', 'WITHDRAWN'], 'voice recording consent states');
  assertIncludes(errors, consent?.requiredFacts, ['documentVersion', 'documentDigest', 'state', 'effectiveAt', 'withdrawalEffect', 'revalidation', 'provenance', 'policyRef', 'policyVersion', 'decisionRef'], 'voice recording consent facts');
  add(errors, consent?.withdrawnOrStale === 'DENY_UPLOAD_PROCESS_AND_DELIVERY', 'withdrawn/stale voice consent must deny upload, processing and delivery');

  const sourceRights = authorization?.sourceRights;
  assertKnownKeys(errors, sourceRights, ['requiredForSourceAudioAndOfficialSubtitle', 'revokedOrExpired', 'personalRecordingReplay', 'personalRecordingDeleteAndExport'], 'authorization.sourceRights');
  add(errors, sourceRights?.requiredForSourceAudioAndOfficialSubtitle === true, 'source audio and official subtitles must require rights');
  add(errors, sourceRights?.revokedOrExpired === 'DENY_SOURCE_AND_OFFICIAL_SUBTITLE', 'source rights revocation must deny source audio and official subtitles');
  add(errors, sourceRights?.personalRecordingReplay === 'DENY', 'personal recording replay must fail closed on revoked/expired source rights');
  add(errors, sourceRights?.personalRecordingDeleteAndExport === 'ALLOW_OWNER_PRIVACY_FLOW', 'personal recording delete/export must remain available through owner privacy flow');
}

function checkPolicyRoutes(policy, errors) {
  assertArray(errors, policy?.canonicalRoutes, 'canonicalRoutes');
  for (const route of policy?.canonicalRoutes ?? []) {
    assertKnownKeys(errors, route, ['id', 'path', 'method', 'owner', 'operationId', 'requestSchema', 'responseSchema', 'successStatus', 'idempotencyRequired'], `canonicalRoute ${route?.id ?? '<unknown>'}`);
  }
  assertExactSet(errors, (policy?.canonicalRoutes ?? []).map(routeIdentity), REQUIRED_ROUTE_IDENTITIES.map(expectedRouteIdentity), 'canonical route identities');
  const normalized = new Map();
  for (const route of policy?.canonicalRoutes ?? []) {
    const key = `${String(route?.method).toUpperCase()} ${normalizePathTemplate(route?.path)}`;
    normalized.set(key, (normalized.get(key) ?? 0) + 1);
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(route?.method).toUpperCase());
    add(errors, !isWrite || route?.idempotencyRequired === true, `${route?.id} must require idempotency`);
  }
  add(errors, [...normalized.values()].every((count) => count === 1), 'canonical routes must not contain template-equivalent duplicates');
  add(errors, !(policy?.canonicalRoutes ?? []).some((route) => route.path === '/api/v1/speaking/recordings/{recordingId}/signed-access'), 'recording-specific signed-access route is forbidden; use media asset signed-access with channel=RECORDING');
}

function checkPolicySchemas(policy, errors) {
  assertArray(errors, policy?.schemaRequirements, 'schemaRequirements');
  assertExactSet(errors, (policy?.schemaRequirements ?? []).map((entry) => entry?.name), REQUIRED_SCHEMA_NAMES, 'schema requirement names');
  for (const name of REQUIRED_SCHEMA_NAMES) checkRequirement(policy, errors, name);

  checkRequirement(policy, errors, 'MediaProcessingTask', {
    required: ['taskId', 'taskType', 'assetId', 'assetVersion', 'taskVersion', 'attempt', 'dedupeKey', 'nextAttemptAt', 'failureClass', 'status', 'auditId'],
  });
  checkRequirement(policy, errors, 'MediaProcessingTaskRetryRequest', {
    required: ['expectedTaskVersion'],
    forbidden: ['attempt', 'taskAttempt', 'retryable', 'workerId', 'actorId'],
  });
  checkRequirement(policy, errors, 'MediaUploadBinding', {
    required: ['uploadIntentId', 'assetId', 'assetVersion', 'tenantRef', 'subjectRef', 'expiresAt'],
    allowed: ['uploadIntentId', 'assetId', 'assetVersion', 'tenantRef', 'subjectRef', 'expiresAt'],
    forbidden: ['tenant', 'subject', 'owner', 'credential', 'token', 'objectKey', 'objectUrl'],
  });
  for (const name of ['MediaAsset', 'MediaManifest', 'SpeakingRecording']) {
    checkRequirement(policy, errors, name, { required: ['malwareStatus'], allowed: ['malwareStatus'] });
  }
  checkRequirement(policy, errors, 'MediaManifest', { required: ['fallbackAlternatives', 'malwareStatus'] });
  checkRequirement(policy, errors, 'MediaFallbackAlternative', { required: ['kind', 'availability', 'reasonCode'] });
  checkRequirement(policy, errors, 'SpeakingRecordingDeleteReceipt', {
    required: ['recordingId', 'status', 'deleteRequestId', 'legalHoldState', 'retentionPolicyRef', 'retentionPolicyVersion', 'auditId'],
    allowed: ['purgeReceiptRef'],
  });
  checkRequirement(policy, errors, 'SpeakingShadowingSessionCreateRequest', { forbidden: ['targetGapMs'] });
  checkRequirement(policy, errors, 'SpeakingShadowingSession', {
    required: ['targetGapMs'],
    constants: { targetGapMs: 500 },
  });
  checkRequirement(policy, errors, 'MediaPlaybackCapability', {
    constants: {
      minimumRate: 0.5,
      maximumRate: 2,
      continuous: true,
      pitchPreservationRequired: true,
      timelineUnit: 'MILLISECONDS',
      fallback: 'EXPLICIT_DISABLE_OR_UNSUPPORTED',
    },
  });
  checkRequirement(policy, errors, 'MediaPublishEligibility', {
    required: ['contentVersionId', 'assetId', 'assetVersion', 'mediaStatus', 'malwareStatus', 'rightsState', 'subtitleEligibility', 'decision', 'decisionRef', 'policyVersion', 'evaluatedAt', 'scheduleDueAt', 'recheckRequired'],
  });
}

function checkPolicyMediaRules(policy, errors) {
  const upload = policy?.upload;
  assertKnownKeys(errors, upload, ['intent', 'verification', 'malware'], 'upload');
  assertKnownKeys(errors, upload?.intent, ['singleUse', 'shortLived', 'bindingFields', 'quota'], 'upload.intent');
  add(errors, upload?.intent?.singleUse === true && upload?.intent?.shortLived === true, 'upload intent must be single-use and short-lived');
  assertExactSet(errors, upload?.intent?.bindingFields, ['principal', 'tenant', 'asset'], 'upload intent binding fields');
  assertKnownKeys(errors, upload?.intent?.quota, ['policyRefRequired', 'policyVersionRequired', 'reservationRequired', 'numericLimitsInvented'], 'upload.intent.quota');
  add(errors, upload?.intent?.quota?.policyRefRequired === true && upload?.intent?.quota?.policyVersionRequired === true && upload?.intent?.quota?.reservationRequired === true, 'quota must use policy ref/version and reservation');
  add(errors, upload?.intent?.quota?.numericLimitsInvented === false, 'D2 policy must not invent numeric quota limits');
  assertKnownKeys(errors, upload?.verification, ['authorities', 'requiredFacts', 'clientDeclaredFacts'], 'upload.verification');
  assertExactSet(errors, upload?.verification?.authorities, ['verified-provider', 'verified-worker'], 'verification authorities');
  assertExactSet(errors, upload?.verification?.requiredFacts, ['objectVersion', 'sha256', 'realSizeBytes', 'magicMimeType', 'realDurationMs'], 'verification facts');
  add(errors, upload?.verification?.clientDeclaredFacts === 'NON_AUTHORITATIVE', 'client-declared object facts must be non-authoritative');
  assertKnownKeys(errors, upload?.malware, ['statuses', 'processAndDeliveryRequires', 'nonCleanDecision'], 'upload.malware');
  assertExactSet(errors, upload?.malware?.statuses, REQUIRED_MALWARE_STATUSES, 'malware statuses');
  add(errors, upload?.malware?.processAndDeliveryRequires === 'CLEAN' && upload?.malware?.nonCleanDecision === 'DENY', 'only CLEAN malware status may process or deliver');

  const tasks = policy?.tasks;
  assertKnownKeys(errors, tasks, ['types', 'requiredFields', 'staleCallback', 'retry'], 'tasks');
  assertExactSet(errors, tasks?.types, REQUIRED_TASK_TYPES, 'processing task types');
  assertIncludes(errors, tasks?.requiredFields, ['taskId', 'taskType', 'assetVersion', 'taskVersion', 'attempt', 'dedupeKey', 'nextAttemptAt', 'failureClass', 'auditId'], 'processing task required fields');
  add(errors, tasks?.staleCallback === 'COMPARE_AND_SET_ASSET_VERSION_AND_TASK_VERSION', 'stale task callback must use asset/task-version compare-and-set');
  assertKnownKeys(errors, tasks?.retry, ['policyTask', 'onlyFailureClass', 'maxAttempts', 'strategy', 'minimumBackoffSeconds', 'maximumBackoffSeconds', 'terminalFailureClasses', 'unknownFailureClass', 'exhausted', 'clientMayClassifyOrOverride'], 'tasks.retry');
  add(errors, tasks?.retry?.policyTask === 'P1R-M1-007', 'task retry must reuse P1R-M1-007');
  add(errors, tasks?.retry?.onlyFailureClass === 'TRANSIENT', 'only transient task failures may retry');
  add(errors, tasks?.retry?.maxAttempts === 5, 'task retry maxAttempts must be 5');
  add(errors, tasks?.retry?.strategy === 'EXPONENTIAL_WITH_JITTER', 'task retry must use exponential backoff with jitter');
  add(errors, tasks?.retry?.minimumBackoffSeconds === 1 && tasks?.retry?.maximumBackoffSeconds === 60, 'task retry backoff must be 1s through 60s');
  add(errors, tasks?.retry?.unknownFailureClass === 'FAIL_CLOSED', 'unknown task failure class must fail closed');
  add(errors, tasks?.retry?.exhausted === 'WORKFLOW_OWNED_DLQ_AND_MANUAL_RECOVERY', 'exhausted task retry must go to workflow-owned DLQ/manual recovery');
  add(errors, tasks?.retry?.clientMayClassifyOrOverride === false, 'client may not classify or override task retry');
  assertIncludes(errors, tasks?.retry?.terminalFailureClasses, ['CHECKSUM_MISMATCH', 'MIME_DISALLOWED', 'SIZE_EXCEEDED', 'QUOTA_EXCEEDED', 'MALWARE_INFECTED', 'CONSENT_WITHDRAWN', 'RIGHTS_REVOKED', 'DELETE_REQUESTED', 'STALE_CALLBACK', 'UNKNOWN'], 'task terminal failure classes');

  const rendition = policy?.rendition;
  assertKnownKeys(errors, rendition, ['requiredFields', 'deliveryRequiresReadyRendition'], 'rendition');
  assertIncludes(errors, rendition?.requiredFields, ['sourceChecksumSha256', 'outputChecksumSha256', 'objectVersion', 'mimeType', 'sizeBytes', 'status', 'failureClass', 'assetVersion'], 'rendition required fields');
  add(errors, rendition?.deliveryRequiresReadyRendition === true, 'delivery must require a ready rendition');

  const subtitles = policy?.subtitles;
  assertKnownKeys(errors, subtitles, ['officialTextOwner', 'officialTextRequirements', 'artifactMetadataOwner', 'personalRecordingTranscript', 'asrGeneration'], 'subtitles');
  add(errors, subtitles?.officialTextOwner === 'content-service' && subtitles?.artifactMetadataOwner === 'media-service', 'content/media subtitle ownership is invalid');
  assertIncludes(errors, subtitles?.officialTextRequirements, ['content-version', 'rights', 'review', 'publication'], 'official subtitle requirements');
  add(errors, subtitles?.personalRecordingTranscript === 'PROHIBITED' && subtitles?.asrGeneration === 'PROHIBITED', 'recording transcript/ASR must be prohibited in Phase 1');
}

function checkPolicyDeliveryAndLifecycle(policy, errors) {
  const delivery = policy?.delivery;
  assertKnownKeys(errors, delivery, ['manifest', 'subtitleUnavailableAlternatives', 'grantKinds', 'grantBindingFields', 'personalRecordingReplay', 'forbiddenSinks', 'rangeMismatch'], 'delivery');
  add(errors, delivery?.manifest === 'METADATA_ONLY', 'manifest must be metadata-only');
  assertKnownKeys(errors, delivery?.subtitleUnavailableAlternatives, ['requiredFields', 'requiredKinds', 'exactCount', 'uniqueKinds', 'decision'], 'delivery.subtitleUnavailableAlternatives');
  assertExactSet(errors, delivery?.subtitleUnavailableAlternatives?.requiredFields, ['fallbackAlternatives'], 'subtitle unavailable alternatives');
  assertExactSet(errors, delivery?.subtitleUnavailableAlternatives?.requiredKinds, ['TEXT_ALTERNATIVE', 'PRACTICE_ALTERNATIVE'], 'subtitle unavailable alternative kinds');
  add(errors, delivery?.subtitleUnavailableAlternatives?.exactCount === 2 && delivery?.subtitleUnavailableAlternatives?.uniqueKinds === true, 'subtitle alternatives must contain exactly one text and one practice entry');
  add(errors, delivery?.subtitleUnavailableAlternatives?.decision === 'EXPLICIT_AVAILABLE_OR_UNAVAILABLE_WITH_REASON', 'subtitle alternatives must report explicit availability/reason');
  assertExactSet(errors, delivery?.grantKinds, ['UPLOAD', 'ACCESS'], 'grant kinds');
  assertExactSet(errors, delivery?.grantBindingFields, ['asset', 'assetVersion', 'tenant', 'subject', 'channel', 'range', 'expiry', 'revocationVersion'], 'grant binding fields');
  assertKnownKeys(errors, delivery?.personalRecordingReplay, ['canonicalPath', 'channel', 'dedicatedRecordingSignedAccessRouteForbidden'], 'delivery.personalRecordingReplay');
  add(errors, delivery?.personalRecordingReplay?.canonicalPath === '/api/v1/media/assets/{assetId}/signed-access', 'personal recording replay must use media asset signed-access');
  add(errors, delivery?.personalRecordingReplay?.channel === 'RECORDING', 'personal recording replay must bind channel=RECORDING');
  add(errors, delivery?.personalRecordingReplay?.dedicatedRecordingSignedAccessRouteForbidden === true, 'recording-specific signed-access route must be forbidden');
  assertExactSet(errors, delivery?.forbiddenSinks, ['event', 'log', 'telemetry', 'ordinary-audit'], 'URL forbidden sinks');
  add(errors, delivery?.rangeMismatch === 'DENY', 'access range mismatch must deny');

  const capture = policy?.capture;
  assertKnownKeys(errors, capture, ['microphoneStart', 'permissionDenied', 'localDraft'], 'capture');
  add(errors, capture?.microphoneStart === 'EXPLICIT_USER_ACTION_ONLY', 'microphone start must require explicit user action');
  assertKnownKeys(errors, capture?.permissionDenied, ['remoteRecordingCreated', 'fallback'], 'capture.permissionDenied');
  add(errors, capture?.permissionDenied?.remoteRecordingCreated === false && capture?.permissionDenied?.fallback === 'SILENT_PRACTICE', 'permission denial must not create a remote recording and must offer silent practice');
  assertKnownKeys(errors, capture?.localDraft, ['state', 'remoteAssetState', 'ordinaryStorageFallback', 'clientPermissionIsServerEvidence', 'localDraftIsRemoteCompletionEvidence'], 'capture.localDraft');
  add(errors, capture?.localDraft?.state === 'LOCAL_ENCRYPTED_DRAFT' && capture?.localDraft?.remoteAssetState === 'REMOTE_ASSET', 'local draft and remote asset states must remain separate');
  add(errors, capture?.localDraft?.ordinaryStorageFallback === false, 'ordinary storage fallback is prohibited');
  add(errors, capture?.localDraft?.clientPermissionIsServerEvidence === false && capture?.localDraft?.localDraftIsRemoteCompletionEvidence === false, 'client permission/local draft cannot prove server completion');

  const publish = policy?.publishEligibility;
  assertKnownKeys(errors, publish, ['schema', 'bindingFields', 'allowRequires', 'serverDerivedFields', 'missingStaleOrRevoked', 'scheduleDueTimeRecheck'], 'publishEligibility');
  add(errors, publish?.schema === 'MediaPublishEligibility', 'publish eligibility must use MediaPublishEligibility');
  assertExactSet(errors, publish?.bindingFields, ['contentVersionId', 'assetId', 'assetVersion'], 'publish eligibility binding fields');
  assertKnownKeys(errors, publish?.allowRequires, ['mediaStatus', 'malwareStatus', 'rightsState', 'subtitleEligibility'], 'publishEligibility.allowRequires');
  add(errors, publish?.allowRequires?.mediaStatus === 'READY' && publish?.allowRequires?.malwareStatus === 'CLEAN' && publish?.allowRequires?.rightsState === 'VALID', 'publish eligibility must require READY/CLEAN/VALID');
  assertExactSet(errors, publish?.allowRequires?.subtitleEligibility, ['OFFICIAL_SUBTITLE_READY', 'TEXT_ALTERNATIVE_READY'], 'publish subtitle eligibility');
  assertIncludes(errors, publish?.serverDerivedFields, ['decision', 'decisionRef', 'policyVersion', 'evaluatedAt', 'scheduleDueAt', 'recheckRequired'], 'publish eligibility server-derived fields');
  add(errors, publish?.missingStaleOrRevoked === 'DENY' && publish?.scheduleDueTimeRecheck === true, 'publish eligibility must fail closed and recheck at schedule due time');

  const lifecycle = policy?.lifecycle;
  assertKnownKeys(errors, lifecycle, ['retention', 'deleteStates', 'legalHoldBeforeDelete', 'revokeGrantAndCancelEligibleTaskBeforePurge', 'falseDeleteSuccess', 'ownerReceiptRequired', 'deleteReceipt'], 'lifecycle');
  assertKnownKeys(errors, lifecycle?.retention, ['policyTask', 'policyRefRequired', 'policyVersionRequired', 'exactDaysFrozen'], 'lifecycle.retention');
  add(errors, lifecycle?.retention?.policyTask === 'P1R-M1-017', 'retention policy must defer exact duration to P1R-M1-017');
  add(errors, lifecycle?.retention?.policyRefRequired === true && lifecycle?.retention?.policyVersionRequired === true && lifecycle?.retention?.exactDaysFrozen === false, 'retention must freeze policy ref/version, not exact days');
  assertExactSet(errors, lifecycle?.deleteStates, REQUIRED_DELETE_STATES, 'delete lifecycle states');
  add(errors, lifecycle?.legalHoldBeforeDelete === true && lifecycle?.revokeGrantAndCancelEligibleTaskBeforePurge === true, 'legal hold/revocation must precede purge');
  add(errors, lifecycle?.falseDeleteSuccess === 'PROHIBITED' && lifecycle?.ownerReceiptRequired === true, 'delete cannot claim false success and must require owner receipt');
  assertKnownKeys(errors, lifecycle?.deleteReceipt, ['purgeReceiptRef', 'nonDeletedStatesMayNotClaimPurgeSuccess'], 'lifecycle.deleteReceipt');
  assertKnownKeys(errors, lifecycle?.deleteReceipt?.purgeReceiptRef, ['requiredWhen', 'forbiddenWhen'], 'lifecycle.deleteReceipt.purgeReceiptRef');
  add(errors, lifecycle?.deleteReceipt?.purgeReceiptRef?.requiredWhen === 'DELETED', 'purge receipt must be required only on DELETED');
  assertExactSet(errors, lifecycle?.deleteReceipt?.purgeReceiptRef?.forbiddenWhen, ['HOLD_BLOCKED', 'PURGE_FAILED'], 'purge receipt forbidden states');
  add(errors, lifecycle?.deleteReceipt?.nonDeletedStatesMayNotClaimPurgeSuccess === true, 'non-deleted states cannot claim purge success');
}

function checkPolicyPlaybackAndPhase(policy, errors) {
  const playback = policy?.playback;
  assertKnownKeys(errors, playback, ['minimumRate', 'maximumRate', 'continuous', 'presets', 'pitchPreservationRequired', 'timelineUnit', 'fallback', 'clientClaimIsEvidence'], 'playback');
  add(errors, playback?.minimumRate === 0.5 && playback?.maximumRate === 2 && playback?.continuous === true, 'playback must support continuous 0.5 through 2.0');
  assertExactSet(errors, playback?.presets, REQUIRED_PLAYBACK_PRESETS, 'playback presets');
  add(errors, playback?.pitchPreservationRequired === true && playback?.timelineUnit === 'MILLISECONDS' && playback?.fallback === 'EXPLICIT_DISABLE_OR_UNSUPPORTED', 'playback pitch/timeline/fallback constraints are invalid');
  add(errors, playback?.clientClaimIsEvidence === false, 'client pitch claim cannot be evidence');

  const phase = policy?.phaseFeatures;
  assertKnownKeys(errors, phase, ['disabled', 'rejectedAliases', 'failureCode'], 'phaseFeatures');
  assertExactSet(errors, phase?.disabled, REQUIRED_PHASE_FEATURES, 'Phase 1 disabled media features');
  assertIncludes(errors, phase?.rejectedAliases, ['asr', 'transcribe', 'transcript', 'aiScore', 'aiScoring', 'voiceModel', 'voiceClone', 'prompt', 'digitalHuman', 'rtc'], 'Phase 1 rejected feature aliases');
  add(errors, phase?.failureCode === 'PHASE_FEATURE_DISABLED', 'disabled Phase 1 feature failure code is invalid');
}

function legacyIdentity(entry) {
  return [entry?.method, entry?.path, entry?.operationId, entry?.mode, entry?.replacement?.method, entry?.replacement?.path, entry?.replacement?.operationId];
}

const REQUIRED_LEGACY_IDENTITIES = Object.freeze([
  ['POST', '/api/v1/content/media/upload-intents', 'createContentMediaUploadIntent', 'REPLACED', 'POST', '/api/v1/media/upload-intents', 'createMediaUploadIntent'],
  ['POST', '/api/v1/content/media/{mediaAssetId}/complete', 'completeContentMediaUpload', 'REPLACED', 'POST', '/api/v1/media/upload-intents/{uploadIntentId}/complete', 'completeMediaUploadIntent'],
  ['POST', '/api/v1/content/media/{mediaAssetId}/signed-access', 'signContentMediaAccess', 'REPLACED', 'POST', '/api/v1/media/assets/{assetId}/signed-access', 'createMediaAssetSignedAccess'],
  ['POST', '/api/v1/speaking/recordings', 'createB3SpeakingRecording', 'REPLACED', 'POST', '/api/v1/speaking/recordings/upload-intents', 'createSpeakingRecordingUploadIntent'],
  ['GET', '/api/v1/speaking/recordings/{recordingId}', 'getB3SpeakingRecording', 'CONVERGED_IN_PLACE', 'GET', '/api/v1/speaking/recordings/{recordingId}', 'getSpeakingRecording'],
  ['DELETE', '/api/v1/speaking/recordings/{recordingId}', 'deleteB3SpeakingRecording', 'CONVERGED_IN_PLACE', 'DELETE', '/api/v1/speaking/recordings/{recordingId}', 'deleteSpeakingRecording'],
  ['POST', '/api/v1/speaking/recordings/{recordingId}/self-rating', 'submitB3SpeakingSelfRating', 'REPLACED', 'POST', '/api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress', 'recordSpeakingShadowingProgress'],
  ['POST', '/api/v1/speaking/shadowing/sessions', 'createB3ShadowingSession', 'CONVERGED_IN_PLACE', 'POST', '/api/v1/speaking/shadowing/sessions', 'createSpeakingShadowingSession'],
  ['POST', '/api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress', 'updateB3ShadowingProgress', 'CONVERGED_IN_PLACE', 'POST', '/api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress', 'recordSpeakingShadowingProgress'],
  ['GET', '/api/v1/media/assets/{assetId}', 'getB11MediaAsset', 'CONVERGED_IN_PLACE', 'GET', '/api/v1/media/assets/{assetId}', 'getMediaAsset'],
  ['GET', '/api/v1/media/assets/{assetId}/manifest', 'getB11MediaManifest', 'CONVERGED_IN_PLACE', 'GET', '/api/v1/media/assets/{assetId}/manifest', 'getMediaAssetManifest'],
  ['POST', '/api/v1/media/assets/{assetId}/signed-url', 'createB11MediaAccess', 'REPLACED', 'POST', '/api/v1/media/assets/{assetId}/signed-access', 'createMediaAssetSignedAccess'],
  ['GET', '/api/v1/media/assets/{assetId}/content', 'streamB11MediaContent', 'REPLACED', 'POST', '/api/v1/media/assets/{assetId}/signed-access', 'createMediaAssetSignedAccess'],
  ['POST', '/api/v1/multimodal/recordings', 'createB11Recording', 'REPLACED', 'POST', '/api/v1/speaking/recordings/upload-intents', 'createSpeakingRecordingUploadIntent'],
  ['POST', '/api/v1/speaking/shadowing/completions', 'updateB11ShadowingCompletion', 'REPLACED', 'POST', '/api/v1/speaking/shadowing/sessions/{shadowingSessionId}/complete', 'completeSpeakingShadowingSession'],
]);

function checkPolicyHistoricalAndLegacy(policy, errors) {
  assertExactSet(errors, policy?.historicalEvents, REQUIRED_HISTORICAL_EVENTS, 'historical media/speaking events');
  assertKnownKeys(errors, policy?.eventPromotion, ['historicalOnly', 'unpublishedCandidates'], 'eventPromotion');
  add(errors, policy?.eventPromotion?.historicalOnly === true, 'historical events must remain historical-only');
  assertExactSet(errors, policy?.eventPromotion?.unpublishedCandidates, FORBIDDEN_CANDIDATE_EVENTS, 'unpublished media candidate events');
  assertExactSet(errors, policy?.adversarialCases, REQUIRED_ADVERSARIAL_CASES, 'adversarial cases');
  assertArray(errors, policy?.legacyCompatibility, 'legacyCompatibility');
  for (const legacy of policy?.legacyCompatibility ?? []) {
    assertKnownKeys(errors, legacy, ['path', 'method', 'operationId', 'mode', 'replacement'], `legacy ${legacy?.operationId ?? '<unknown>'}`);
    assertKnownKeys(errors, legacy?.replacement, ['path', 'method', 'operationId'], `legacy replacement ${legacy?.operationId ?? '<unknown>'}`);
  }
  assertExactSet(errors, (policy?.legacyCompatibility ?? []).map(legacyIdentity), REQUIRED_LEGACY_IDENTITIES, 'legacy replacement/deprecation map');
}

function validatePolicy(policy) {
  const errors = [];
  add(errors, isRecord(policy), 'media policy must be an object');
  if (!isRecord(policy)) return errors;
  checkNoDuplicates(policy, errors);
  checkNoRuntimePromotion(policy, errors);
  add(errors, policyFingerprint(policy) === EXPECTED_POLICY_FINGERPRINT, 'media policy has unknown or unapproved semantic value (baseline fingerprint mismatch)');
  checkPolicyBasics(policy, errors);
  checkPolicyOwners(policy, errors);
  checkPolicyAuthorization(policy, errors);
  checkPolicyRoutes(policy, errors);
  checkPolicySchemas(policy, errors);
  checkPolicyMediaRules(policy, errors);
  checkPolicyDeliveryAndLifecycle(policy, errors);
  checkPolicyPlaybackAndPhase(policy, errors);
  checkPolicyHistoricalAndLegacy(policy, errors);
  return errors;
}

function checkCanonicalConsent(policy, document, errors) {
  const consent = getSchema(document, 'B8Consent');
  add(errors, isRecord(consent), 'B8Consent is required for dedicated voice-recording consent');
  if (!isRecord(consent)) return;
  add(errors, consent.additionalProperties === false, 'B8Consent must reject unknown fields');
  const required = ['type', 'purpose', 'document', 'state', 'effectiveAt', 'withdrawalEffect', 'revalidation', 'provenance', 'policyRef', 'policyVersion', 'decisionRef'];
  assertIncludes(errors, consent.required, required, 'B8Consent.required');
  add(errors, required.every((field) => isRecord(consent.properties?.[field])), 'B8Consent must expose every dedicated consent decision field');
  add(errors, propertyEnumIncludes(consent.properties?.type, policy.authorization.consent.type), 'B8Consent must support type VOICE_RECORDING');
  add(errors, propertyEnumIncludes(consent.properties?.purpose, policy.authorization.consent.purpose), 'B8Consent must support the dedicated voice-recording purpose');
  add(errors, propertyEnumIncludes(consent.properties?.state, 'GRANTED') && propertyEnumIncludes(consent.properties?.state, 'WITHDRAWN'), 'B8Consent must expose GRANTED/WITHDRAWN');
  const documentSchema = getSchema(document, 'B8ConsentDocument');
  add(errors, isRecord(documentSchema), 'B8ConsentDocument is required for voice-recording consent');
  if (isRecord(documentSchema)) {
    add(errors, documentSchema.additionalProperties === false, 'B8ConsentDocument must reject unknown fields');
    assertIncludes(errors, documentSchema.required, ['version', 'digest'], 'B8ConsentDocument.required');
  }
  const authoritative = consent['x-server-authoritative-fields'];
  assertIncludes(errors, authoritative, ['document', 'state', 'effectiveAt', 'withdrawalEffect', 'revalidation', 'provenance', 'policyRef', 'policyVersion', 'decisionRef'], 'B8Consent server-authoritative fields');
}

function checkCanonicalRoutes(policy, document, errors) {
  add(errors, isRecord(document?.paths), 'canonical OpenAPI paths must be an object');
  const canonicalTemplates = new Set(policy.canonicalRoutes
    .map((route) => `${String(route.method).toUpperCase()} ${normalizePathTemplate(route.path)}`));
  const normalizedPaths = new Map();
  for (const [pathName, pathItem] of Object.entries(document?.paths ?? {})) {
    if (!isRecord(pathItem)) continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      const key = `${method.toUpperCase()} ${normalizePathTemplate(pathName)}`;
      if (!canonicalTemplates.has(key)) continue;
      const exact = `${method.toUpperCase()} ${pathName}`;
      const prior = normalizedPaths.get(key);
      if (prior && prior !== exact) errors.push(`OpenAPI contains template-equivalent noncanonical routes: ${prior} and ${exact}`);
      normalizedPaths.set(key, exact);
    }
  }

  let covered = 0;
  for (const route of policy.canonicalRoutes) {
    const { pathItem, operation } = findOperation(document, route);
    const label = `${route.method} ${route.path}`;
    add(errors, isRecord(operation), `${label} is required`);
    if (!isRecord(operation)) continue;
    covered += 1;
    add(errors, operation.operationId === route.operationId, `${label} operationId must be ${route.operationId}`);
    assertKnownKeys(errors, operation['x-contract'], ['owner', 'phase', 'maturity', 'runtimeStatus'], `${label} x-contract`);
    add(errors, operation['x-contract']?.owner === route.owner, `${label} x-contract owner must be ${route.owner}`);
    add(errors, operation['x-contract']?.phase === 'P1', `${label} must remain P1`);
    add(errors, operation['x-contract']?.maturity === 'D2_CONTRACT_READY', `${label} x-contract maturity must be D2_CONTRACT_READY`);
    add(errors, operation['x-contract']?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${label} x-contract runtimeStatus must be NOT_RUNTIME_VERIFIED`);
    add(errors, operationRequestUses(document, operation, route.requestSchema), `${label} request schema must be ${route.requestSchema ?? 'absent'}`);
    add(errors, operationResponseUses(document, operation, route.successStatus, route.responseSchema), `${label} ${route.successStatus} response schema must be ${route.responseSchema}`);
    if (route.idempotencyRequired) add(errors, hasIdempotencyHeader(document, pathItem, operation), `${label} must require Idempotency-Key and x-idempotency`);
    const gateway = authoritativeGatewayOwner(document, route);
    add(errors, !gateway.error, gateway.error ?? '');
    if (!gateway.error) add(errors, gateway.owner === route.owner, `${label} Gateway owner must be ${route.owner}`);
  }
  return covered;
}

function checkClosedSchema(requirement, document, errors) {
  const name = requirement.name;
  const candidate = getSchema(document, name);
  add(errors, isRecord(candidate), `${name} schema is required`);
  if (!isRecord(candidate)) return;
  add(errors, candidate.additionalProperties === false, `${name} must reject unknown fields`);
  assertExactSet(errors, candidate.required, requirement.requiredFields, `${name}.required`);
  assertExactSet(errors, Object.keys(candidate.properties ?? {}), requirement.allowedFields, `${name}.properties`);
  for (const field of requirement.forbiddenFields ?? []) {
    add(errors, candidate.properties?.[field] === undefined, `${name} must forbid ${field}`);
  }
  for (const [field, value] of Object.entries(requirement.constants ?? {})) {
    const fixed = field === 'targetGapMs'
      ? propertyFixedNumber(candidate.properties?.[field], value)
      : propertyExactValue(candidate.properties?.[field], value);
    add(errors, fixed, `${name}.${field} must be fixed to ${JSON.stringify(value)}`);
  }
}

function isDeleteReceiptConditional(candidate, status, required, field) {
  const choices = [...(candidate?.oneOf ?? []), ...(candidate?.allOf ?? [])];
  return choices.some((choice) => {
    const statusMatches = propertyEnumIncludes(choice?.properties?.status, status);
    if (!statusMatches) return false;
    if (required) return Array.isArray(choice?.required) && choice.required.includes(field);
    return choice?.not?.required?.includes(field) === true;
  });
}

function checkCanonicalSchemas(policy, document, errors) {
  for (const requirement of policy.schemaRequirements) checkClosedSchema(requirement, document, errors);

  const task = getSchema(document, 'MediaProcessingTask');
  add(errors, propertyEnumExact(task?.properties?.taskType, REQUIRED_TASK_TYPES), 'MediaProcessingTask.taskType must be the exact supported task types');
  add(errors, task?.properties?.taskVersion?.type === 'integer' && Number(task?.properties?.taskVersion?.minimum) >= 1, 'MediaProcessingTask.taskVersion must be a positive server version');
  add(errors, task?.['x-stale-callback-rule'] === policy.tasks.staleCallback, 'MediaProcessingTask must declare asset/task-version stale callback CAS');
  const retryPolicy = task?.['x-retry-policy'];
  add(errors, retryPolicy?.sourceTask === 'P1R-M1-007', 'MediaProcessingTask retry policy must reuse P1R-M1-007');
  add(errors, retryPolicy?.onlyFailureClass === 'TRANSIENT', 'MediaProcessingTask retry policy must allow only TRANSIENT failures');
  add(errors, retryPolicy?.maxAttempts === 5 && retryPolicy?.backoff === 'EXPONENTIAL_WITH_JITTER', 'MediaProcessingTask retry policy must use 5-attempt exponential jitter');
  add(errors, retryPolicy?.minimumDelaySeconds === 1 && retryPolicy?.maximumDelaySeconds === 60, 'MediaProcessingTask retry policy must use 1s to 60s backoff');
  add(errors, retryPolicy?.unknownFailure === 'FAIL_CLOSED' && retryPolicy?.exhausted === 'WORKFLOW_OWNED_DLQ_AND_MANUAL_RECOVERY', 'MediaProcessingTask retry unknown/exhausted handling must fail closed to workflow DLQ/manual recovery');
  add(errors, retryPolicy?.clientMayClassifyOrOverride === false, 'MediaProcessingTask retry policy must reject client classification/override');
  const retry = getSchema(document, 'MediaProcessingTaskRetryRequest');
  add(errors, retry?.properties?.expectedTaskVersion?.type === 'integer' && Number(retry?.properties?.expectedTaskVersion?.minimum) >= 1, 'MediaProcessingTaskRetryRequest.expectedTaskVersion must be a positive CAS version');

  for (const name of ['MediaAsset', 'MediaManifest', 'SpeakingRecording']) {
    const candidate = getSchema(document, name);
    add(errors, propertyEnumExact(candidate?.properties?.malwareStatus, REQUIRED_MALWARE_STATUSES), `${name}.malwareStatus must enumerate PENDING/CLEAN/INFECTED/ERROR`);
    const gate = candidate?.['x-p1r-media-malware-gate'];
    add(errors, gate?.readyRequires === 'CLEAN' && gate?.deliveryRequires === 'CLEAN' && gate?.nonCleanDecision === 'DENY', `${name} must statically declare a CLEAN-only readiness/delivery malware gate`);
  }

  const manifest = getSchema(document, 'MediaManifest');
  const alternatives = manifest?.properties?.fallbackAlternatives;
  add(errors, alternatives?.type === 'array'
    && alternatives?.minItems === 2
    && alternatives?.maxItems === 2
    && alternatives?.uniqueItems === true
    && alternatives?.items?.$ref === schemaRef('MediaFallbackAlternative'), 'MediaManifest.fallbackAlternatives must be an exact-two unique MediaFallbackAlternative array');
  const alternativeGovernance = manifest?.['x-p1r-media-fallback-alternatives'];
  assertKnownKeys(errors, alternativeGovernance, ['requiredKinds', 'uniqueKinds', 'unavailableRequiresReason'], 'MediaManifest fallback alternatives governance');
  add(errors, hasExactArray(alternativeGovernance?.requiredKinds, ['TEXT_ALTERNATIVE', 'PRACTICE_ALTERNATIVE'])
    && alternativeGovernance?.uniqueKinds === true
    && alternativeGovernance?.unavailableRequiresReason === true, 'MediaManifest fallback alternatives must require one TEXT and one PRACTICE kind and a reason when unavailable');
  const fallback = getSchema(document, 'MediaFallbackAlternative');
  add(errors, propertyEnumExact(fallback?.properties?.kind, ['TEXT_ALTERNATIVE', 'PRACTICE_ALTERNATIVE']), 'MediaFallbackAlternative.kind must distinguish text and practice alternatives');
  add(errors, propertyEnumExact(fallback?.properties?.availability, ['AVAILABLE', 'UNAVAILABLE']), 'MediaFallbackAlternative.availability must explicitly distinguish available/unavailable');
  add(errors, fallback?.properties?.reasonCode?.type === 'string', 'MediaFallbackAlternative.reasonCode is required');

  const accessRequest = getSchema(document, 'MediaSignedAccessRequest');
  add(errors, propertyEnumIncludes(accessRequest?.properties?.channel, 'RECORDING'), 'MediaSignedAccessRequest.channel must support RECORDING');
  const accessGrant = getSchema(document, 'MediaSignedAccessGrant');
  add(errors, accessGrant?.['x-sensitive-transient-value'] === true, 'MediaSignedAccessGrant URL must be marked sensitive and transient');
  assertExactSet(errors, accessGrant?.['x-forbidden-sinks'], policy.delivery.forbiddenSinks, 'MediaSignedAccessGrant forbidden URL sinks');

  const deleteReceipt = getSchema(document, 'SpeakingRecordingDeleteReceipt');
  add(errors, propertyEnumExact(deleteReceipt?.properties?.status, REQUIRED_DELETE_STATES), 'SpeakingRecordingDeleteReceipt.status must use the exact delete lifecycle');
  add(errors, isDeleteReceiptConditional(deleteReceipt, 'DELETED', true, 'purgeReceiptRef'), 'DELETED delete receipt must require purgeReceiptRef');
  for (const status of ['HOLD_BLOCKED', 'PURGE_FAILED']) {
    add(errors, isDeleteReceiptConditional(deleteReceipt, status, false, 'purgeReceiptRef'), `${status} delete receipt must not claim purgeReceiptRef`);
  }

  const playback = getSchema(document, 'MediaPlaybackCapability');
  add(errors, playback?.properties?.presets?.type === 'array' && playback?.properties?.presets?.uniqueItems === true && propertyEnumExact(playback?.properties?.presets?.items, REQUIRED_PLAYBACK_PRESETS), 'MediaPlaybackCapability.presets must be the exact unique supported preset set');

  const session = getSchema(document, 'SpeakingShadowingSession');
  add(errors, propertyFixedNumber(session?.properties?.targetGapMs, 500), 'SpeakingShadowingSession.targetGapMs must be server-fixed at 500');

  const publish = getSchema(document, 'MediaPublishEligibility');
  const allowBranch = (publish?.oneOf ?? []).find((candidate) => propertyExactValue(candidate?.properties?.decision, 'ALLOW'));
  add(errors, isRecord(allowBranch), 'MediaPublishEligibility must contain an ALLOW oneOf branch');
  add(errors, propertyExactValue(allowBranch?.properties?.mediaStatus, 'READY'), 'MediaPublishEligibility ALLOW must require mediaStatus=READY');
  add(errors, propertyExactValue(allowBranch?.properties?.malwareStatus, 'CLEAN'), 'MediaPublishEligibility ALLOW must require malwareStatus=CLEAN');
  add(errors, propertyExactValue(allowBranch?.properties?.rightsState, 'VALID'), 'MediaPublishEligibility ALLOW must require rightsState=VALID');
  add(errors, propertyEnumExact(allowBranch?.properties?.subtitleEligibility, ['OFFICIAL_SUBTITLE_READY', 'TEXT_ALTERNATIVE_READY']), 'MediaPublishEligibility ALLOW must require official subtitle or text alternative READY');
  const publishGate = publish?.['x-p1r-media-publish-eligibility'];
  add(errors, publishGate?.missingStaleOrRevoked === 'DENY' && publishGate?.scheduleDueTimeRecheck === true, 'MediaPublishEligibility must fail closed on missing/stale/revoked facts and recheck at due time');
  assertIncludes(errors, publishGate?.serverDerivedFields, policy.publishEligibility.serverDerivedFields, 'MediaPublishEligibility server-derived decision fields');

  const aliases = policy.phaseFeatures.rejectedAliases.map((alias) => alias.toLowerCase());
  for (const requirement of policy.schemaRequirements) {
    const candidate = getSchema(document, requirement.name);
    for (const key of Object.keys(candidate?.properties ?? {})) {
      add(errors, !aliases.includes(key.toLowerCase()), `${requirement.name} must reject disabled Phase 1 alias ${key}`);
    }
  }
}

function checkCanonicalLegacy(policy, document, errors) {
  for (const legacy of policy.legacyCompatibility) {
    const legacyPath = document?.paths?.[legacy.path];
    const legacyOperation = legacyPath?.[legacy.method.toLowerCase()];
    const label = `${legacy.method} ${legacy.path}`;
    if (legacy.mode === 'REPLACED') {
      add(errors, isRecord(legacyOperation), `${label} legacy operation is required until retirement`);
      if (isRecord(legacyOperation)) {
        add(errors, legacyOperation.operationId === legacy.operationId, `${label} legacy operationId must remain ${legacy.operationId}`);
        add(errors, legacyOperation.deprecated === true, `${label} must be deprecated`);
        add(errors, stable(legacyOperation['x-p1r-media-legacy']) === stable({
          classification: 'HISTORICAL_COMPATIBILITY_ONLY',
          authoritySource: false,
          replacement: legacy.replacement,
        }), `${label} must have exact non-authoritative replacement metadata`);
      }
    } else {
      const replacementPath = document?.paths?.[legacy.replacement.path];
      const replacementOperation = replacementPath?.[legacy.replacement.method.toLowerCase()];
      add(errors, isRecord(replacementOperation), `${label} in-place canonical replacement is required`);
      if (isRecord(replacementOperation)) {
        add(errors, replacementOperation.operationId === legacy.replacement.operationId, `${label} in-place operationId must be ${legacy.replacement.operationId}`);
        add(errors, stable(replacementOperation['x-p1r-media-compatibility']) === stable({
          mode: 'CONVERGED_IN_PLACE',
          legacyOperationId: legacy.operationId,
          historicalAuthority: false,
        }), `${label} must mark the legacy operation non-authoritative`);
      }
    }
  }
  const oldShadowing = {
    path: '/api/v1/speaking/shadowing/completions',
    method: 'POST',
  };
  const oldOperation = document?.paths?.[oldShadowing.path]?.post;
  add(errors, oldOperation?.deprecated === true, 'legacy shadowing completion must be deprecated');
  add(errors, oldOperation?.['x-contract']?.owner === 'assessment-service', 'legacy shadowing completion must be owned by assessment-service');
  const gateway = authoritativeGatewayOwner(document, oldShadowing);
  add(errors, !gateway.error, gateway.error ?? '');
  if (!gateway.error) add(errors, gateway.owner === 'assessment-service', 'legacy shadowing completion Gateway owner must be assessment-service');
}

function checkCanonicalAuthorityAndUrls(policy, document, errors) {
  for (const route of policy.canonicalRoutes) {
    if (!route.requestSchema) continue;
    const candidate = getSchema(document, route.requestSchema);
    for (const field of policy.authorization.forbiddenClientAuthorityFields) {
      add(errors, candidate?.properties?.[field] === undefined, `${route.requestSchema} must not accept client authority field ${field}`);
    }
  }
  const recordingRequest = getSchema(document, 'SpeakingRecordingUploadIntentRequest');
  const recordingComplete = getSchema(document, 'SpeakingRecordingCompleteRequest');
  for (const field of ['permissionState', 'localDraft', 'localDraftState']) {
    add(errors, recordingRequest?.properties?.[field] === undefined && recordingComplete?.properties?.[field] === undefined, `recording requests must not treat ${field} as server completion evidence`);
  }
  for (const requirement of policy.schemaRequirements) {
    if (['MediaUploadGrant', 'MediaSignedAccessGrant'].includes(requirement.name)) continue;
    const candidate = getSchema(document, requirement.name);
    for (const field of Object.keys(candidate?.properties ?? {})) {
      add(errors, !FORBIDDEN_URL_FIELD.test(field), `${requirement.name} must not expose direct URL field ${field}`);
    }
  }
}

function eventPayload(eventCatalog, event) {
  const reference = event?.payloadSchema?.$ref;
  return getPointer(eventCatalog, reference);
}

function containsEventUrl(value, location = 'payload') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = containsEventUrl(value[index], `${location}[${index}]`);
      if (nested) return nested;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_URL_FIELD.test(key)) return `${location}.${key}`;
    const nested = containsEventUrl(nestedValue, `${location}.${key}`);
    if (nested) return nested;
  }
  return undefined;
}

function checkEventCatalog(policy, eventCatalog, errors) {
  add(errors, isRecord(eventCatalog), 'event catalog must be an object');
  if (!isRecord(eventCatalog)) return 0;
  assertArray(errors, eventCatalog.events, 'event catalog events');
  let covered = 0;
  for (const eventName of policy.historicalEvents) {
    const matches = (eventCatalog.events ?? []).filter((event) => event?.eventName === eventName);
    add(errors, matches.length === 1, `historical event ${eventName} must occur exactly once`);
    if (matches.length !== 1) continue;
    covered += 1;
    add(errors, matches[0].status === 'HISTORICAL_CANDIDATE', `historical event ${eventName} must remain HISTORICAL_CANDIDATE`);
    const leak = containsEventUrl(eventPayload(eventCatalog, matches[0]));
    add(errors, !leak, `historical event ${eventName} must not contain URL-like payload field ${leak ?? ''}`);
  }
  for (const candidate of policy.eventPromotion.unpublishedCandidates) {
    add(errors, !(eventCatalog.events ?? []).some((event) => event?.eventName === candidate), `candidate event ${candidate} must not be published`);
  }
  return covered;
}

export function validateMediaContractData({ policy, canonicalOpenApi, openApi, document, eventCatalog } = {}) {
  const errors = [];
  const canonical = canonicalOpenApi ?? openApi ?? document;
  errors.push(...validatePolicy(policy));
  if (!isRecord(policy)) {
    return {
      result: 'FAIL',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      errors,
      counts: { canonicalRoutes: 0, coveredCanonicalRoutes: 0, requiredSchemas: 0, historicalEvents: 0, coveredHistoricalEvents: 0 },
    };
  }
  add(errors, isRecord(canonical), 'canonical OpenAPI must be an object');
  let coveredCanonicalRoutes = 0;
  if (isRecord(canonical)) {
    checkCanonicalConsent(policy, canonical, errors);
    coveredCanonicalRoutes = checkCanonicalRoutes(policy, canonical, errors);
    checkCanonicalSchemas(policy, canonical, errors);
    checkCanonicalLegacy(policy, canonical, errors);
    checkCanonicalAuthorityAndUrls(policy, canonical, errors);
  }
  const coveredHistoricalEvents = checkEventCatalog(policy, eventCatalog, errors);
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    runtimeStatus: policy.runtimeStatus,
    errors,
    counts: {
      canonicalRoutes: policy.canonicalRoutes.length,
      coveredCanonicalRoutes,
      requiredSchemas: policy.schemaRequirements.length,
      historicalEvents: policy.historicalEvents.length,
      coveredHistoricalEvents,
    },
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function validateMediaContract({
  root = process.cwd(),
  policyInput,
  canonicalInput,
  eventCatalogInput,
  policyPath,
  canonicalPath,
  eventCatalogPath,
} = {}) {
  const selectedPolicy = path.resolve(root, policyInput ?? policyPath ?? DEFAULT_MEDIA_POLICY);
  const selectedCanonical = path.resolve(root, canonicalInput ?? canonicalPath ?? DEFAULT_CANONICAL_OPENAPI);
  const selectedEvents = path.resolve(root, eventCatalogInput ?? eventCatalogPath ?? DEFAULT_EVENT_CATALOG);
  let policy;
  let canonicalOpenApi;
  let eventCatalog;
  const errors = [];
  for (const [label, target, setter] of [
    ['policy', selectedPolicy, (value) => { policy = value; }],
    ['canonical OpenAPI', selectedCanonical, (value) => { canonicalOpenApi = value; }],
    ['event catalog', selectedEvents, (value) => { eventCatalog = value; }],
  ]) {
    try {
      setter(readJson(target));
    } catch (error) {
      errors.push(`${label} read failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const report = validateMediaContractData({ policy, canonicalOpenApi, eventCatalog });
  const combinedErrors = [...errors, ...report.errors];
  return {
    inputs: {
      policy: path.relative(root, selectedPolicy),
      canonicalOpenApi: path.relative(root, selectedCanonical),
      eventCatalog: path.relative(root, selectedEvents),
    },
    ...report,
    result: combinedErrors.length === 0 ? 'PASS' : 'FAIL',
    errors: combinedErrors,
  };
}

function parseCli(argv) {
  const result = {};
  const names = new Map([
    ['--policy', 'policyInput'],
    ['--canonical', 'canonicalInput'],
    ['--events', 'eventCatalogInput'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') return { help: true };
    const [flag, inline] = String(value).split('=', 2);
    const outputName = names.get(flag);
    if (!outputName) return { error: `unknown argument: ${value}` };
    const next = inline ?? argv[++index];
    if (!next || String(next).startsWith('--')) return { error: `${flag} requires a JSON file path` };
    result[outputName] = next;
  }
  return result;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const parsed = parseCli(process.argv.slice(2));
  if (parsed.help) {
    console.log('Usage: node scripts/audit/p1r-media-contract-check.mjs [--policy <json>] [--canonical <openapi.json>] [--events <catalog.json>]');
    process.exit(0);
  }
  if (parsed.error) {
    console.log(JSON.stringify({
      result: 'FAIL',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      errors: [parsed.error],
      counts: {},
    }, null, 2));
    process.exit(1);
  }
  const report = validateMediaContract(parsed);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === 'PASS' ? 0 : 1);
}
