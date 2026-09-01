import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const fragmentPath = 'packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json';
const canonicalOpenApiPath = 'packages/contracts/openapi/v1/openapi.json';
const policyPath = 'config/p1r-analytics-ingress.v1.json';
const eventFragmentPath = 'packages/contracts/events/v1/fragments/b13-commerce-admin-analytics.events.json';

const forbiddenAuthorityFields = new Set([
  'tenant',
  'tenantId',
  'subject',
  'ownerId',
  'owner',
  'ownerService',
  'principal',
  'principalId',
  'subjectId',
  'actor',
  'actorId',
  'user',
  'userId',
  'role',
  'roles',
  'permission',
  'permissions',
  'assignment',
  'assignee',
  'queueId',
  'priority',
  'sla',
  'slaDueAt',
  'state',
  'stateVersion',
  'status',
  'deliveryStatus',
  'readAt',
  'legalHold',
  'retention',
  'retentionPolicyRef',
  'auditId',
]);

const forbiddenSensitiveFields = new Set([
  'rawText',
  'rawBody',
  'rawContent',
  'rawDescription',
  'rawPayload',
  'rawTranscript',
  'description',
  'body',
  'freeText',
  'plainText',
  'unredactedFreeText',
  'unredactedDescription',
  'password',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'rawAudio',
  'audioBytes',
  'recordingBytes',
  'rawAttachmentBytes',
  'transcript',
  'answerKey',
  'rawAnswer',
  'paymentCredential',
  'paymentToken',
  'cardNumber',
  'cvv',
  'cvc',
  'jws',
  'signature',
  'objectKey',
  'url',
  'signedUrl',
  'downloadUrl',
  'uploadUrl',
]);

const normalizeField = (field) => String(field).replace(/[\s_-]/g, '').toLowerCase();
const normalizedForbiddenFields = new Set([
  ...[...forbiddenAuthorityFields].map(normalizeField),
  ...[...forbiddenSensitiveFields].map(normalizeField),
]);
const normalizedForbiddenSensitiveFields = new Set([...forbiddenSensitiveFields].map(normalizeField));
const expectedAllowlistedEvents = {
  'ui.page.viewed.v1': {
    schema: 'ui.page.viewed',
    payloadSchema: 'M1017UiPageViewedPayload',
    kind: 'UI_TELEMETRY',
  },
  'ui.element.clicked.v1': {
    schema: 'ui.element.clicked',
    payloadSchema: 'M1017UiElementClickedPayload',
    kind: 'UI_TELEMETRY',
  },
  'ui.media.playback.started.v1': {
    schema: 'ui.media.playback.started',
    payloadSchema: 'M1017UiMediaPlaybackStartedPayload',
    kind: 'UI_TELEMETRY',
  },
  'telemetry.error.v1': {
    schema: 'telemetry.error',
    payloadSchema: 'M1017TelemetryErrorPayload',
    kind: 'UI_TELEMETRY',
  },
};

function clone(value) {
  return structuredClone(value);
}

function mergeOpenApi(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) return clone(patch);
  if (!base || typeof base !== 'object' || !patch || typeof patch !== 'object') return clone(patch);
  const merged = clone(base);
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = Object.hasOwn(merged, key) ? mergeOpenApi(merged[key], value) : clone(value);
  }
  return merged;
}

function resolve(document, reference) {
  assert.equal(typeof reference, 'string', 'schema reference must be a string');
  assert.match(reference, /^#\//, `analytics reference must stay local: ${reference}`);
  return reference.slice(2).split('/').reduce((current, segment) => {
    const key = segment.replaceAll('~1', '/').replaceAll('~0', '~');
    assert.ok(current && Object.hasOwn(current, key), `unresolved analytics reference ${reference}`);
    return current[key];
  }, document);
}

function assertAllRefsResolve(document, value, location = '$', seenRefs = new Set(), parentKey = null) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertAllRefsResolve(document, entry, `${location}[${index}]`, seenRefs, parentKey));
    return;
  }
  if (!value || typeof value !== 'object') return;

  if (Object.hasOwn(value, '$ref')) {
    assert.equal(typeof value.$ref, 'string', `${location}.$ref must be a string`);
    assert.match(value.$ref, /^#\//, `${location}.$ref must be a local JSON pointer`);
    const resolved = resolve(document, value.$ref);
    assert.ok(resolved && typeof resolved === 'object', `${location}.$ref must resolve to an object`);
    if (!seenRefs.has(value.$ref)) {
      seenRefs.add(value.$ref);
      assertAllRefsResolve(document, resolved, `${location}(${value.$ref})`, seenRefs, null);
    }
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === '$ref') continue;
    // A JSON-Schema property named `description` is valid only below the
    // `properties` map; OpenAPI metadata descriptions must remain literals.
    if (key === 'description' && parentKey !== 'properties') {
      assert.equal(typeof nested, 'string', `${location}.description must not be a forged reference`);
    }
    assertAllRefsResolve(document, nested, `${location}.${key}`, seenRefs, key);
  }
}

function walkSchema(document, schema, visitor, location = '$', seen = new Set()) {
  assert.ok(schema && typeof schema === 'object', `${location} must be a schema object`);
  visitor(schema, location);

  if (schema.$ref) {
    if (!seen.has(schema.$ref)) {
      seen.add(schema.$ref);
      walkSchema(document, resolve(document, schema.$ref), visitor, `${location}->$ref(${schema.$ref})`, seen);
    }
  }

  for (const keyword of ['allOf', 'oneOf', 'anyOf']) {
    for (const [index, child] of (schema[keyword] ?? []).entries()) {
      walkSchema(document, child, visitor, `${location}.${keyword}.${index}`, seen);
    }
  }
  for (const keyword of ['$defs', 'dependentSchemas']) {
    for (const [name, child] of Object.entries(schema[keyword] ?? {})) {
      walkSchema(document, child, visitor, `${location}.${keyword}.${name}`, seen);
    }
  }
  for (const keyword of ['if', 'then', 'else', 'contains', 'propertyNames', 'unevaluatedProperties']) {
    if (schema[keyword] && typeof schema[keyword] === 'object') {
      walkSchema(document, schema[keyword], visitor, `${location}.${keyword}`, seen);
    }
  }
  for (const [index, child] of (schema.prefixItems ?? []).entries()) {
    walkSchema(document, child, visitor, `${location}.prefixItems.${index}`, seen);
  }
  if (schema.not) walkSchema(document, schema.not, visitor, `${location}.not`, seen);
  if (schema.items) walkSchema(document, schema.items, visitor, `${location}.items`, seen);
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    walkSchema(document, schema.additionalProperties, visitor, `${location}.additionalProperties`, seen);
  }
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    walkSchema(document, child, visitor, `${location}.properties.${name}`, seen);
  }
  for (const [name, child] of Object.entries(schema.patternProperties ?? {})) {
    walkSchema(document, child, visitor, `${location}.patternProperties.${name}`, seen);
  }
}

function operations(document) {
  return Object.entries(document.paths ?? {}).flatMap(([route, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(([method, operation]) => ({ route, method, operation })));
}

function assertExactClientAuthority(value, location) {
  assert.equal(value, 'NONE', `${location}.clientAuthority must be exactly NONE`);
}

function assertClosedObjectSchemas(document, rootSchema, rootLocation, forbiddenFields = normalizedForbiddenFields) {
  walkSchema(document, rootSchema, (schema, location) => {
    if (schema.type === 'object' && schema.properties) {
      assert.equal(schema.additionalProperties, false, `${rootLocation}${location} must be closed`);
    }
    for (const field of schema.required ?? []) {
      assert.equal(
        forbiddenFields.has(normalizeField(field)),
        false,
        `${rootLocation}${location}.required.${field} is a client authority or sensitive field`,
      );
    }
    for (const field of Object.keys(schema.properties ?? {})) {
      assert.equal(
        forbiddenFields.has(normalizeField(field)),
        false,
        `${rootLocation}${location}.properties.${field} is a client authority or sensitive field`,
      );
    }
    if (Object.hasOwn(schema, 'clientAuthority')) {
      assertExactClientAuthority(schema.clientAuthority, `${rootLocation}${location}`);
    }
  });
}

function assertAnalyticsIngressContract(document, policy, resolutionDocument) {
  assertAllRefsResolve(resolutionDocument ?? document, document);
  assert.equal(policy.defaultEffect, 'deny');
  assert.equal(policy.task, 'P1R-M1-017');
  assert.equal(policy.owner, 'analytics-service');
  assert.equal(policy.dataOwner, 'analytics-service');
  assert.equal(policy.route, '/api/v1/analytics/telemetry');
  assert.equal(policy.operationId, 'ingestM1017AnalyticsTelemetry');
  assert.equal(policy.maturity, 'D2_CONTRACT_READY');
  assert.equal(policy.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(policy.clientAuthority, 'NONE');
  assert.equal(policy.transport.mode, 'HTTP_TELEMETRY_ONLY');
  assert.equal(policy.transport.kafkaTopic, null);
  assert.equal(policy.transport.publishesDomainFacts, false);
  assert.equal(policy.transport.writesDomainFacts, false);
  assert.equal(policy.transport.clientIsKafkaProducer, false);
  assert.deepEqual(policy.trustedContext.required, ['subject', 'tenant', 'consent', 'deletionStatus', 'policyVersion']);
  assert.equal(policy.trustedContext.source, 'verified-server-context');
  assert.equal(policy.trustedContext.missingEffect, 'SUPPRESS');
  assert.equal(policy.consent.required, true);
  assert.deepEqual(policy.consent.acceptedValues, ['GRANTED']);
  assert.equal(policy.consent.missingEffect, 'SUPPRESS');
  assert.equal(policy.consent.revokedEffect, 'SUPPRESS');
  assert.equal(policy.consent.unknownEffect, 'SUPPRESS');
  assert.deepEqual(policy.deletion.allowedStatus, ['ACTIVE']);
  assert.deepEqual(policy.deletion.suppressedStatuses, ['PENDING_COOLING_OFF', 'EXECUTING', 'RECOVERY_REQUIRED', 'ANONYMIZED']);
  assert.equal(policy.deletion.cancelledEffect, 'SUPPRESS');
  assert.equal(policy.deletion.missingEffect, 'SUPPRESS');
  assert.equal(policy.deletion.unknownEffect, 'SUPPRESS');
  assert.equal(policy.retry.domainFactRetry, false);
  assert.equal(policy.retry.telemetryRetryMayChangeDomainFact, false);
  assert.equal(policy.retry.failureEffect, 'NON_BLOCKING');
  assert.equal(policy.sampling.mode, 'SERVER_CONTROLLED');
  assert.equal(policy.sampling.clientMaySelect, false);
  assert.equal(policy.sampling.clientHintAuthority, 'NONE');
  assert.equal(policy.retention.clientMayOverride, false);
  assert.equal(policy.retention.rawPayloadPersistence, false);
  assert.equal(policy.redaction.unknownFieldEffect, 'REJECT');
  assert.equal(policy.redaction.nestedObjectEffect, 'EXPLICIT_SCHEMA_ONLY');
  assert.deepEqual(policy.redaction.forbiddenFieldNames, [...forbiddenSensitiveFields]);
  assert.deepEqual(policy.allowlistedEvents, expectedAllowlistedEvents);

  const contract = document['x-m1017-contract'];
  assert.ok(contract, 'B13 fragment must declare the M1-017 analytics contract');
  assert.equal(contract.task, 'P1R-M1-017');
  assert.equal(contract.owner, 'analytics-service');
  assert.equal(contract.dataOwner, 'analytics-service');
  assert.deepEqual(contract.canonicalOperations, ['ingestM1017AnalyticsTelemetry']);
  assert.deepEqual(contract.historicalOperations, []);
  assert.equal(contract.maturity, 'D2_CONTRACT_READY');
  assert.equal(contract.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assertExactClientAuthority(contract.clientAuthority, 'x-m1017-analytics-contract');
  assert.equal(contract.transport, 'HTTP_TELEMETRY_ONLY');
  assert.equal(contract.kafkaEventEmission, false);
  assert.equal(contract.domainFactsWrite, false);
  assert.equal(contract.consentSource, 'server-derived');
  assert.equal(contract.deletionSource, 'iam-service-server-derived');
  assert.deepEqual(contract.deletionAllowedStatus, ['ACTIVE']);
  assert.deepEqual(contract.deletionSuppressedStatuses, ['PENDING_COOLING_OFF', 'EXECUTING', 'RECOVERY_REQUIRED', 'ANONYMIZED']);
  assert.equal(contract.deletionCancelledEffect, 'SUPPRESS');
  assert.equal(contract.retentionPolicyRef, 'ANALYTICS-RETENTION-V1');

  const operation = document.paths['/api/v1/analytics/telemetry']?.post;
  assert.ok(operation, 'analytics telemetry ingress route is required');
  assert.equal(operation.operationId, 'ingestM1017AnalyticsTelemetry');
  assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
  assert.equal(operation['x-owner'], 'analytics-service');
  assert.equal(operation['x-data-owner'], 'analytics-service');
  assert.equal(operation['x-permission'], 'analytics.telemetry.ingest');
  assert.equal(operation['x-contract']?.task, 'P1R-M1-017');
  assert.equal(operation['x-contract']?.canonical, true);
  assert.equal(operation['x-contract']?.maturity, 'D2_CONTRACT_READY');
  assert.equal(operation['x-contract']?.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assertExactClientAuthority(operation['x-contract']?.clientAuthority, 'operation.x-contract');
  assert.equal(operation['x-authorization']?.defaultDecision, 'DENY');
  assert.equal(operation['x-authorization']?.requiredPermission, 'analytics.telemetry.ingest');
  assert.deepEqual(operation['x-authorization']?.trustedFacts, ['subject', 'tenant', 'consent', 'deletionStatus', 'policyVersion']);
  assertExactClientAuthority(operation['x-authorization']?.clientAuthority, 'operation.x-authorization');
  assert.equal(operation['x-telemetry']?.transport, 'HTTP_TELEMETRY_ONLY');
  assert.equal(operation['x-telemetry']?.kafkaTopic, null);
  assert.equal(operation['x-telemetry']?.publishesDomainFacts, false);
  assert.equal(operation['x-telemetry']?.writesDomainFacts, false);
  assert.equal(operation['x-telemetry']?.clientIsKafkaProducer, false);
  assert.equal(operation['x-telemetry']?.consentMissingEffect, 'SUPPRESS');
  assert.equal(operation['x-telemetry']?.consentRevokedEffect, 'SUPPRESS');
  assert.equal(operation['x-telemetry']?.deletionRequestedEffect, 'SUPPRESS');
  assert.deepEqual(operation['x-telemetry']?.deletionAllowedStatus, ['ACTIVE']);
  assert.deepEqual(operation['x-telemetry']?.deletionSuppressedStatuses, ['PENDING_COOLING_OFF', 'EXECUTING', 'RECOVERY_REQUIRED', 'ANONYMIZED']);
  assert.equal(operation['x-telemetry']?.deletionCancelledEffect, 'SUPPRESS');
  assert.equal(operation['x-telemetry']?.failureEffect, 'NON_BLOCKING');
  assert.equal(operation['x-telemetry']?.retentionPolicyRef, 'ANALYTICS-RETENTION-V1');
  assert.equal(operation['x-telemetry']?.redactionVersion, 'analytics-redaction-v1');
  assert.equal(operation['x-idempotency']?.required, true);
  assert.equal(operation.requestBody.required, true);
  assert.equal(operation.requestBody.content['application/json'].schema.$ref, '#/components/schemas/M1017AnalyticsTelemetryRequest');
  assert.equal(operation.parameters?.[0]?.$ref, '#/components/parameters/M1017TelemetryIdempotencyKey');
  assert.equal(operation.responses['202'].content['application/json'].schema.$ref, '#/components/schemas/M1017AnalyticsTelemetryReceipt');
  assert.equal(operation.responses['429'].$ref, '#/components/responses/B13RateLimited');
  const rateLimited = resolve(document, '#/components/responses/B13RateLimited');
  assert.equal(rateLimited.headers['Retry-After'].schema.type, 'integer');
  assert.equal(rateLimited.content['application/json'].schema.$ref, '#/components/schemas/B13Problem');

  const requestSchema = resolve(document, '#/components/schemas/M1017AnalyticsTelemetryRequest');
  assert.deepEqual(requestSchema.required, ['clientEventId', 'eventName', 'eventVersion', 'occurredAt', 'payload']);
  assert.equal(requestSchema.additionalProperties, false);
  assert.equal(requestSchema['x-client-authority'], 'NONE');
  assert.equal(requestSchema['x-telemetry-only'], true);
  assert.equal(requestSchema['x-domain-facts-write'], false);
  assert.equal(requestSchema['x-consent-source'], 'server-derived');
  assert.equal(requestSchema['x-deletion-source'], 'iam-service-server-derived');
  assert.equal(requestSchema['x-retention-policy-ref'], 'ANALYTICS-RETENTION-V1');
  assert.deepEqual(requestSchema['x-forbidden-fields'], [...forbiddenAuthorityFields, ...forbiddenSensitiveFields]);
  for (const [field, schema] of Object.entries(requestSchema.properties)) {
    if (field === 'payload') continue;
    assert.equal(typeof schema.type, 'string', `request.${field} must have one scalar type`);
  }
  assert.equal(requestSchema.properties.payload.oneOf.length, Object.keys(policy.allowlistedEvents).length);
  assert.equal(requestSchema.oneOf.length, Object.keys(policy.allowlistedEvents).length);
  for (const [index, branch] of requestSchema.oneOf.entries()) {
    const eventName = branch['x-event-name'];
    assert.ok(eventName, `request oneOf branch ${index} must identify its event`);
    assert.deepEqual(branch.required, ['eventName', 'payload']);
    assert.deepEqual(branch.properties.eventName.enum, [eventName]);
    assert.equal(branch.properties.payload.$ref, `#/components/schemas/${policy.allowlistedEvents[eventName].payloadSchema}`);
  }
  assertClosedObjectSchemas(document, requestSchema, 'request');

  const eventNames = Object.keys(policy.allowlistedEvents);
  for (const eventName of eventNames) {
    const policyEvent = policy.allowlistedEvents[eventName];
    assert.equal(policyEvent.kind, 'UI_TELEMETRY');
    const payloadSchema = resolve(document, `#/components/schemas/${policyEvent.payloadSchema}`);
    assert.equal(payloadSchema['x-event-name'], eventName);
    assert.equal(payloadSchema['x-client-authority'], 'NONE');
    assertClosedObjectSchemas(document, payloadSchema, `payload.${eventName}`);
    for (const field of payloadSchema.required) {
      assert.ok(payloadSchema.properties[field], `${eventName} required field ${field} must be declared`);
    }
    for (const [field, schema] of Object.entries(payloadSchema.properties)) {
      assert.equal(typeof schema.type, 'string', `${eventName}.${field} must have one scalar type`);
    }
  }

  const receiptSchema = resolve(document, '#/components/schemas/M1017AnalyticsTelemetryReceipt');
  assert.equal(receiptSchema.additionalProperties, false);
  assert.equal(receiptSchema.properties.domainFactsUntouched.const, true);
  assert.deepEqual(receiptSchema.properties.state.enum, ['ACCEPTED', 'SUPPRESSED', 'REPLAYED', 'REJECTED']);
  for (const [field, schema] of Object.entries(receiptSchema.properties)) {
    assert.equal(typeof schema.type, 'string', `receipt.${field} must have one scalar type`);
  }
  assertClosedObjectSchemas(document, receiptSchema, 'receipt', normalizedForbiddenSensitiveFields);

  for (const { route, method, operation: candidate } of operations(document)) {
    if (route !== '/api/v1/analytics/telemetry') continue;
    assert.equal(candidate['x-kafka'], undefined, `${method} ${route} must not define x-kafka`);
    assert.equal(candidate['x-asyncapi'], undefined, `${method} ${route} must not define x-asyncapi`);
  }

  const eventFragment = readJson(eventFragmentPath);
  assert.equal(eventFragment.events.some((event) => event.eventName.startsWith('ui.')), false,
    'UI telemetry must not be added to the Kafka event fragment');
  assert.equal(eventFragment.events.some((event) => event.eventName === 'telemetry.error.v1'), false,
    'telemetry errors must not be added to the Kafka event fragment');

  return true;
}

test('M1-017 analytics ingress canonical contract is closed, consent-gated and telemetry-only', () => {
  const fragment = readJson(fragmentPath);
  assertAnalyticsIngressContract(fragment, readJson(policyPath), mergeOpenApi(readJson(canonicalOpenApiPath), fragment));
});

test('M1-017 analytics ingress rejects authority and sensitive-field mutations', () => {
  const canonical = readJson(fragmentPath);
  const policy = readJson(policyPath);

  const mutations = [
    ['top-level clientAuthority prefix', (document) => { document['x-m1017-contract'].clientAuthority = 'NONE_FOR_CLIENT'; }],
    ['operation clientAuthority prefix', (document) => { document.paths['/api/v1/analytics/telemetry'].post['x-authorization'].clientAuthority = 'NONE-ish'; }],
    ['request tenant authority', (document) => { document.components.schemas.M1017AnalyticsTelemetryRequest.properties.tenantId = { type: 'string' }; }],
    ['request required tenant authority', (document) => { document.components.schemas.M1017AnalyticsTelemetryRequest.required.push('tenant'); }],
    ['nested rawText', (document) => { document.components.schemas.M1017UiPageViewedPayload.properties.rawText = { type: 'string' }; }],
    ['nested rawBody', (document) => { document.components.schemas.M1017UiPageViewedPayload.properties.rawBody = { type: 'string' }; }],
    ['nested rawContent', (document) => { document.components.schemas.M1017UiPageViewedPayload.properties.rawContent = { type: 'string' }; }],
    ['nested plainText', (document) => { document.components.schemas.M1017UiPageViewedPayload.properties.plainText = { type: 'string' }; }],
    ['nested description', (document) => { document.components.schemas.M1017UiElementClickedPayload.properties.description = { type: 'string' }; }],
    ['nested body', (document) => { document.components.schemas.M1017UiElementClickedPayload.properties.body = { type: 'string' }; }],
    ['nested freeText', (document) => { document.components.schemas.M1017UiMediaPlaybackStartedPayload.properties.freeText = { type: 'string' }; }],
    ['nested allOf owner', (document) => { document.components.schemas.M1017UiPageViewedPayload.allOf = [{ type: 'object', properties: { owner: { type: 'string' } } }]; }],
    ['nested anyOf principal', (document) => { document.components.schemas.M1017UiPageViewedPayload.anyOf = [{ type: 'object', properties: { principal: { type: 'string' } } }]; }],
    ['nested not role', (document) => { document.components.schemas.M1017UiPageViewedPayload.not = { type: 'object', properties: { role: { type: 'string' } } }; }],
    ['open nested object', (document) => { document.components.schemas.M1017TelemetryErrorPayload.additionalProperties = true; }],
    ['unconstrained type', (document) => { delete document.components.schemas.M1017UiPageViewedPayload.properties.pageCode.type; }],
    ['union type widening', (document) => { document.components.schemas.M1017UiPageViewedPayload.properties.pageCode.type = ['string', 'object']; }],
    ['event/payload mismatch', (document) => { document.components.schemas.M1017AnalyticsTelemetryRequest.oneOf[0].properties.payload.$ref = '#/components/schemas/M1017UiElementClickedPayload'; }],
    ['unknown payload reference', (document) => { document.components.schemas.M1017AnalyticsTelemetryRequest.properties.payload.oneOf[0].$ref = '#/components/schemas/M1017UnknownPayload'; }],
    ['external payload reference', (document) => { document.components.schemas.M1017AnalyticsTelemetryRequest.properties.payload.oneOf[0].$ref = 'https://example.invalid/telemetry.json'; }],
    ['unknown description reference', (document) => { document.paths['/api/v1/analytics/telemetry'].post.description = { $ref: '#/components/schemas/M1017UnknownDescription' }; }],
    ['external description reference', (document) => { document.paths['/api/v1/analytics/telemetry'].post.description = { $ref: 'https://example.invalid/description.json' }; }],
    ['Kafka topic promotion', (document) => { document.paths['/api/v1/analytics/telemetry'].post['x-telemetry'].kafkaTopic = 'platform.analytics.v1'; }],
    ['domain fact write promotion', (document) => { document.paths['/api/v1/analytics/telemetry'].post['x-telemetry'].writesDomainFacts = true; }],
    ['consent fail-open', (_document, currentPolicy) => { currentPolicy.consent.missingEffect = 'ACCEPT'; }],
    ['deletion fail-open', (_document, currentPolicy) => { currentPolicy.deletion.allowedStatus.push('REQUESTED'); }],
    ['cancelled deletion fail-open', (_document, currentPolicy) => { currentPolicy.deletion.cancelledEffect = 'ACCEPT'; }],
    ['allowlist expansion', (_document, currentPolicy) => { currentPolicy.allowlistedEvents['ui.page.viewed.v2'] = currentPolicy.allowlistedEvents['ui.page.viewed.v1']; }],
  ];

  for (const [name, mutate] of mutations) {
    const document = clone(canonical);
    const mutatedPolicy = clone(policy);
    mutate(document, mutatedPolicy);
    assert.throws(
      () => assertAnalyticsIngressContract(document, mutatedPolicy, mergeOpenApi(readJson(canonicalOpenApiPath), document)),
      undefined,
      name,
    );
  }
});
