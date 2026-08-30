import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  validateMediaContract,
  validateMediaContractData,
} from '../../scripts/audit/p1r-media-contract-check.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'config', 'p1r-media-contract.v1.json'), 'utf8'));

function ref(name) {
  return `#/components/schemas/${name}`;
}

function simpleProperty(name) {
  if (/(?:Ms|Version|attempt|sizeBytes|progress)/.test(name)) return { type: 'integer', minimum: 1 };
  if (/Available|continuous|Required/.test(name)) return { type: 'boolean' };
  return { type: 'string' };
}

function fixtureSchema(requirement) {
  const properties = Object.fromEntries(requirement.allowedFields.map((field) => [field, simpleProperty(field)]));
  for (const [field, value] of Object.entries(requirement.constants ?? {})) properties[field] = { const: value };
  return {
    type: 'object',
    additionalProperties: false,
    required: [...requirement.requiredFields],
    properties,
  };
}

function makeFixture() {
  const schemas = Object.fromEntries(policy.schemaRequirements.map((requirement) => [requirement.name, fixtureSchema(requirement)]));
  const document = {
    openapi: '3.1.0',
    info: { title: 'P1R media fixture', version: '1.0.0' },
    paths: {},
    components: { schemas },
    'x-p1r-gateway-boundary': { routeRules: [] },
  };

  schemas.MediaProcessingTask.properties.taskType = { type: 'string', enum: [...policy.tasks.types] };
  schemas.MediaProcessingTask.properties.taskVersion = { type: 'integer', minimum: 1 };
  schemas.MediaProcessingTask['x-stale-callback-rule'] = policy.tasks.staleCallback;
  schemas.MediaProcessingTask['x-retry-policy'] = {
    sourceTask: 'P1R-M1-007',
    onlyFailureClass: 'TRANSIENT',
    maxAttempts: 5,
    backoff: 'EXPONENTIAL_WITH_JITTER',
    minimumDelaySeconds: 1,
    maximumDelaySeconds: 60,
    unknownFailure: 'FAIL_CLOSED',
    exhausted: 'WORKFLOW_OWNED_DLQ_AND_MANUAL_RECOVERY',
    clientMayClassifyOrOverride: false,
  };
  schemas.MediaProcessingTaskRetryRequest.properties.expectedTaskVersion = { type: 'integer', minimum: 1 };
  for (const name of ['MediaAsset', 'MediaManifest', 'SpeakingRecording']) {
    schemas[name].properties.malwareStatus = { type: 'string', enum: [...policy.upload.malware.statuses] };
    schemas[name]['x-p1r-media-malware-gate'] = {
      readyRequires: 'CLEAN',
      deliveryRequires: 'CLEAN',
      nonCleanDecision: 'DENY',
    };
  }
  schemas.MediaFallbackAlternative.properties.kind = { type: 'string', enum: ['TEXT_ALTERNATIVE', 'PRACTICE_ALTERNATIVE'] };
  schemas.MediaFallbackAlternative.properties.availability = { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE'] };
  schemas.MediaFallbackAlternative.properties.reasonCode = { type: 'string' };
  schemas.MediaManifest.properties.fallbackAlternatives = {
    type: 'array',
    minItems: 2,
    maxItems: 2,
    uniqueItems: true,
    items: { $ref: ref('MediaFallbackAlternative') },
  };
  schemas.MediaManifest['x-p1r-media-fallback-alternatives'] = {
    requiredKinds: ['TEXT_ALTERNATIVE', 'PRACTICE_ALTERNATIVE'],
    uniqueKinds: true,
    unavailableRequiresReason: true,
  };
  schemas.MediaSignedAccessRequest.properties.channel = { type: 'string', enum: ['STREAM', 'DOWNLOAD', 'RECORDING'] };
  schemas.MediaSignedAccessGrant['x-sensitive-transient-value'] = true;
  schemas.MediaSignedAccessGrant['x-forbidden-sinks'] = [...policy.delivery.forbiddenSinks];
  schemas.SpeakingRecordingDeleteReceipt.properties.status = { type: 'string', enum: [...policy.lifecycle.deleteStates] };
  schemas.SpeakingRecordingDeleteReceipt.oneOf = [
    { properties: { status: { enum: ['DELETED'] } }, required: ['purgeReceiptRef'] },
    { properties: { status: { enum: ['HOLD_BLOCKED'] } }, not: { required: ['purgeReceiptRef'] } },
    { properties: { status: { enum: ['PURGE_FAILED'] } }, not: { required: ['purgeReceiptRef'] } },
  ];
  schemas.MediaPlaybackCapability.properties.presets = {
    type: 'array',
    uniqueItems: true,
    items: { enum: [...policy.playback.presets] },
  };
  schemas.SpeakingShadowingSession.properties.targetGapMs = { const: 500 };
  schemas.MediaPublishEligibility.properties.mediaStatus = { enum: ['READY', 'NOT_READY'] };
  schemas.MediaPublishEligibility.properties.malwareStatus = { enum: ['PENDING', 'CLEAN', 'INFECTED', 'ERROR'] };
  schemas.MediaPublishEligibility.properties.rightsState = { enum: ['VALID', 'EXPIRED', 'REVOKED', 'UNKNOWN_DENY'] };
  schemas.MediaPublishEligibility.properties.subtitleEligibility = { enum: ['OFFICIAL_SUBTITLE_READY', 'TEXT_ALTERNATIVE_READY', 'MISSING', 'STALE', 'REVOKED'] };
  schemas.MediaPublishEligibility.properties.decision = { enum: ['ALLOW', 'DENY'] };
  schemas.MediaPublishEligibility.oneOf = [
    {
      properties: {
        decision: { const: 'ALLOW' },
        mediaStatus: { const: 'READY' },
        malwareStatus: { const: 'CLEAN' },
        rightsState: { const: 'VALID' },
        subtitleEligibility: { enum: ['OFFICIAL_SUBTITLE_READY', 'TEXT_ALTERNATIVE_READY'] },
      },
    },
    { properties: { decision: { const: 'DENY' } } },
  ];
  schemas.MediaPublishEligibility['x-p1r-media-publish-eligibility'] = {
    missingStaleOrRevoked: 'DENY',
    scheduleDueTimeRecheck: true,
    serverDerivedFields: [...policy.publishEligibility.serverDerivedFields],
  };

  schemas.B8ConsentDocument = {
    type: 'object',
    additionalProperties: false,
    required: ['version', 'digest'],
    properties: { version: { type: 'string' }, digest: { type: 'string' } },
  };
  schemas.B8Consent = {
    type: 'object',
    additionalProperties: false,
    required: ['type', 'purpose', 'document', 'state', 'effectiveAt', 'withdrawalEffect', 'revalidation', 'provenance', 'policyRef', 'policyVersion', 'decisionRef'],
    properties: {
      type: { enum: ['VOICE_RECORDING'] },
      purpose: { enum: ['ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY'] },
      document: { $ref: ref('B8ConsentDocument') },
      state: { enum: ['GRANTED', 'WITHDRAWN'] },
      effectiveAt: { type: 'string' },
      withdrawalEffect: { type: 'string' },
      revalidation: { type: 'string' },
      provenance: { type: 'string' },
      policyRef: { type: 'string' },
      policyVersion: { type: 'string' },
      decisionRef: { type: 'string' },
    },
    'x-server-authoritative-fields': ['document', 'state', 'effectiveAt', 'withdrawalEffect', 'revalidation', 'provenance', 'policyRef', 'policyVersion', 'decisionRef'],
  };

  for (const route of policy.canonicalRoutes) {
    const method = route.method.toLowerCase();
    document.paths[route.path] ??= {};
    const operation = {
      operationId: route.operationId,
      'x-contract': {
        owner: route.owner,
        phase: 'P1',
        maturity: 'D2_CONTRACT_READY',
        runtimeStatus: 'NOT_RUNTIME_VERIFIED',
      },
      responses: {
        [route.successStatus]: {
          description: 'fixture',
          content: { 'application/json': { schema: { $ref: ref(route.responseSchema) } } },
        },
      },
    };
    if (route.requestSchema) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: { $ref: ref(route.requestSchema) } } },
      };
    }
    if (route.idempotencyRequired) {
      operation['x-idempotency'] = { required: true, keyHeader: 'Idempotency-Key' };
      operation.parameters = [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } }];
    }
    document.paths[route.path][method] = operation;
    document['x-p1r-gateway-boundary'].routeRules.push({
      ruleId: `fixture-${route.id}`,
      priority: 1000,
      match: { type: 'EXACT', path: route.path, methods: [route.method] },
      upstreamOwner: route.owner,
    });
  }

  for (const legacy of policy.legacyCompatibility) {
    const method = legacy.method.toLowerCase();
    if (legacy.mode === 'REPLACED') {
      document.paths[legacy.path] ??= {};
      document.paths[legacy.path][method] = {
        operationId: legacy.operationId,
        deprecated: true,
        'x-contract': {
          owner: legacy.path === '/api/v1/speaking/shadowing/completions' ? 'assessment-service' : 'media-service',
          phase: 'P1',
          maturity: 'D2_CONTRACT_READY',
          runtimeStatus: 'NOT_RUNTIME_VERIFIED',
        },
        'x-p1r-media-legacy': {
          classification: 'HISTORICAL_COMPATIBILITY_ONLY',
          authoritySource: false,
          replacement: structuredClone(legacy.replacement),
        },
        responses: { 202: { description: 'legacy fixture' } },
      };
      document['x-p1r-gateway-boundary'].routeRules.push({
        ruleId: `legacy-${legacy.operationId}`,
        priority: 1000,
        match: { type: 'EXACT', path: legacy.path, methods: [legacy.method] },
        upstreamOwner: legacy.path === '/api/v1/speaking/shadowing/completions' ? 'assessment-service' : 'media-service',
      });
    } else {
      const operation = document.paths[legacy.replacement.path][legacy.replacement.method.toLowerCase()];
      operation['x-p1r-media-compatibility'] = {
        mode: 'CONVERGED_IN_PLACE',
        legacyOperationId: legacy.operationId,
        historicalAuthority: false,
      };
    }
  }

  const eventCatalog = {
    events: policy.historicalEvents.map((eventName, index) => ({
      eventName,
      status: 'HISTORICAL_CANDIDATE',
      payloadSchema: { $ref: `#/payloadSchemas/P${index}` },
    })),
    payloadSchemas: Object.fromEntries(policy.historicalEvents.map((_, index) => [`P${index}`, {
      type: 'object',
      additionalProperties: false,
      properties: { assetId: { type: 'string' }, auditId: { type: 'string' } },
    }])),
  };
  return { document, eventCatalog };
}

function assertFixtureMutationFails(mutate, expected) {
  const localPolicy = structuredClone(policy);
  const { document, eventCatalog } = makeFixture();
  mutate({ policy: localPolicy, document, eventCatalog });
  const report = validateMediaContractData({ policy: localPolicy, canonicalOpenApi: document, eventCatalog });
  assert.equal(report.result, 'FAIL', report.errors.join('\n'));
  assert(report.errors.some((error) => expected.test(error)), `missing ${expected}; got ${report.errors.join('\n')}`);
}

test('M1-009 static media policy passes an independently generated strict canonical fixture', () => {
  const { document, eventCatalog } = makeFixture();
  const report = validateMediaContractData({ policy, canonicalOpenApi: document, eventCatalog });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.deepEqual(report.counts, {
    canonicalRoutes: 14,
    coveredCanonicalRoutes: 14,
    requiredSchemas: 30,
    historicalEvents: 11,
    coveredHistoricalEvents: 11,
  });
});

test('current repository canonical OpenAPI satisfies the frozen M1-009 contract projection', () => {
  const report = validateMediaContract({ root });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.deepEqual(report.errors, []);
  assert.equal(report.counts.coveredCanonicalRoutes, 14);
  assert.equal(report.counts.coveredHistoricalEvents, 11);
});

test('CLI reports a D2 PASS without promoting runtime verification', () => {
  const result = spawnSync(process.execPath, ['scripts/audit/p1r-media-contract-check.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.result, 'PASS');
  assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(report.counts.canonicalRoutes, 14);
});

test('adversarial policy and contract mutations fail closed', async (t) => {
  const cases = [
    ['unknown policy field', ({ policy: localPolicy }) => { localPolicy.unrecognizedAuthority = true; }, /unknown field/],
    ['unapproved nested schema field', ({ policy: localPolicy }) => { localPolicy.schemaRequirements.find((entry) => entry.name === 'MediaManifest').allowedFields.push('rawAccessHint'); }, /unknown or unapproved semantic value/],
    ['duplicate playback preset', ({ policy: localPolicy }) => { localPolicy.playback.presets.push(2); }, /duplicate value/],
    ['runtime promotion', ({ policy: localPolicy }) => { localPolicy.runtimeStatus = 'RUNTIME_VERIFIED'; }, /runtimeStatus must be NOT_RUNTIME_VERIFIED|runtime evidence/],
    ['compatibility promotion drift', ({ policy: localPolicy }) => { localPolicy.compatibilityPromotion.scope = 'EVENTS_AND_OPENAPI'; }, /compatibilityPromotion\.scope must be OPENAPI_ONLY/],
    ['client authority injection', ({ policy: localPolicy }) => { localPolicy.authorization.forbiddenClientAuthorityFields = localPolicy.authorization.forbiddenClientAuthorityFields.filter((field) => field !== 'tenant'); }, /forbiddenClientAuthorityFields is incomplete/],
    ['generic consent reuse', ({ policy: localPolicy }) => { localPolicy.authorization.consent.genericMediaConsentAllowed = true; }, /generic media_consent/],
    ['missing dedicated consent fact', ({ document }) => { delete document.components.schemas.B8Consent.properties.decisionRef; }, /B8Consent must expose every dedicated consent decision field/],
    ['cross-owner Gateway route', ({ document }) => { document['x-p1r-gateway-boundary'].routeRules.find((rule) => rule.ruleId === 'fixture-shadowing-session-complete').upstreamOwner = 'media-service'; }, /Gateway owner must be assessment-service/],
    ['operation runtime promotion', ({ document }) => { document.paths['/api/v1/media/assets/{assetId}/signed-access'].post['x-contract'].runtimeStatus = 'RUNTIME_VERIFIED'; }, /runtimeStatus must be NOT_RUNTIME_VERIFIED/],
    ['upload intent replay or expiry', ({ policy: localPolicy }) => { localPolicy.upload.intent.singleUse = false; }, /single-use and short-lived/],
    ['MIME/polyglot/hash/size verification bypass', ({ policy: localPolicy }) => { localPolicy.upload.verification.requiredFacts = ['sha256']; }, /verification facts/],
    ['quota reservation bypass', ({ policy: localPolicy }) => { localPolicy.upload.intent.quota.reservationRequired = false; }, /quota must use/],
    ['upload binding missing subject scope', ({ document }) => { delete document.components.schemas.MediaUploadBinding.properties.subjectRef; }, /MediaUploadBinding\.properties/],
    ['upload binding tenant alias injection', ({ document }) => { document.components.schemas.MediaUploadBinding.properties.tenant = { type: 'string' }; }, /MediaUploadBinding\.properties|must forbid tenant/],
    ['upload binding unknown field injection', ({ document }) => { document.components.schemas.MediaUploadBinding.properties.untrustedScope = { type: 'string' }; }, /MediaUploadBinding\.properties/],
    ['malware non-clean delivery', ({ document }) => { document.components.schemas.MediaAsset['x-p1r-media-malware-gate'].deliveryRequires = 'PENDING'; }, /CLEAN-only readiness\/delivery malware gate/],
    ['stale callback retry spoof', ({ document }) => { document.components.schemas.MediaProcessingTaskRetryRequest.properties.expectedTaskVersion = { type: 'string' }; }, /expectedTaskVersion must be a positive CAS version/],
    ['retry classifier override', ({ document }) => { document.components.schemas.MediaProcessingTask['x-retry-policy'].clientMayClassifyOrOverride = true; }, /reject client classification\/override/],
    ['retry policy drift', ({ policy: localPolicy }) => { localPolicy.tasks.retry.maxAttempts = 6; }, /maxAttempts must be 5/],
    ['signed URL scope leak', ({ document }) => { document.components.schemas.MediaManifest.properties.streamUrl = { type: 'string' }; document.components.schemas.MediaManifest.required.push('streamUrl'); }, /MediaManifest\.properties|direct URL/],
    ['signed URL audit sink', ({ document }) => { document.components.schemas.MediaSignedAccessGrant['x-forbidden-sinks'] = ['event']; }, /forbidden URL sinks/],
    ['legal hold delete race false receipt', ({ document }) => { document.components.schemas.SpeakingRecordingDeleteReceipt.oneOf = []; }, /DELETED delete receipt must require purgeReceiptRef/],
    ['sensitive alias or unknown request field', ({ document }) => { document.components.schemas.SpeakingRecordingCompleteRequest.properties.ownerId = { type: 'string' }; document.components.schemas.SpeakingRecordingCompleteRequest.required.push('ownerId'); }, /SpeakingRecordingCompleteRequest\.properties|client authority field ownerId/],
    ['AI/ASR alias', ({ document }) => { document.components.schemas.SpeakingShadowingCompletionRequest.properties.asr = { type: 'string' }; }, /disabled Phase 1 alias asr|SpeakingShadowingCompletionRequest\.properties/],
    ['playback rate/preset drift', ({ document }) => { document.components.schemas.MediaPlaybackCapability.properties.presets.items.enum = [1]; }, /presets must be the exact unique/],
    ['client pitch claim', ({ document }) => { document.components.schemas.MediaPlaybackCapability.properties.clientPitchPreserved = { type: 'boolean' }; }, /MediaPlaybackCapability\.properties|must forbid clientPitchPreserved/],
    ['subtitle owner/transcript confusion', ({ policy: localPolicy }) => { localPolicy.subtitles.officialTextOwner = 'media-service'; }, /subtitle ownership/],
    ['manifest alternative omitted', ({ document }) => { delete document.components.schemas.MediaManifest.properties.fallbackAlternatives; }, /MediaManifest\.properties|fallbackAlternatives must be/],
    ['manifest alternative count drift', ({ document }) => { document.components.schemas.MediaManifest.properties.fallbackAlternatives.maxItems = 3; }, /exact-two unique/],
    ['manifest alternative kind bypass', ({ document }) => { document.components.schemas.MediaManifest['x-p1r-media-fallback-alternatives'].requiredKinds = ['TEXT_ALTERNATIVE']; }, /fallback alternatives must require one TEXT and one PRACTICE/],
    ['manifest fallback permits duplicate TEXT', ({ document }) => { document.components.schemas.MediaManifest['x-p1r-media-fallback-alternatives'].requiredKinds = ['TEXT_ALTERNATIVE', 'TEXT_ALTERNATIVE']; }, /fallback alternatives must require one TEXT and one PRACTICE/],
    ['manifest fallback permits duplicate PRACTICE', ({ document }) => { document.components.schemas.MediaManifest['x-p1r-media-fallback-alternatives'].requiredKinds = ['PRACTICE_ALTERNATIVE', 'PRACTICE_ALTERNATIVE']; }, /fallback alternatives must require one TEXT and one PRACTICE/],
    ['publish eligibility stale bypass', ({ document }) => { document.components.schemas.MediaPublishEligibility['x-p1r-media-publish-eligibility'].scheduleDueTimeRecheck = false; }, /fail closed.*due time/],
    ['publish eligibility ALLOW bypass', ({ document }) => { document.components.schemas.MediaPublishEligibility.oneOf[0].properties.malwareStatus.const = 'PENDING'; }, /ALLOW must require malwareStatus=CLEAN/],
    ['shadowing gap client drift', ({ document }) => { document.components.schemas.SpeakingShadowingSession.properties.targetGapMs = { const: 250 }; }, /targetGapMs must be server-fixed at 500/],
    ['permission/local draft promoted as server evidence', ({ document }) => { document.components.schemas.SpeakingRecordingCompleteRequest.properties.localDraft = { type: 'string' }; }, /localDraft as server completion evidence|SpeakingRecordingCompleteRequest\.properties/],
    ['legacy authority source not deprecated', ({ document }) => { document.paths['/api/v1/speaking/shadowing/completions'].post.deprecated = false; }, /legacy shadowing completion must be deprecated|must be deprecated/],
    ['historical event promotion', ({ eventCatalog }) => { eventCatalog.events[0].status = 'CANONICAL_D2'; }, /must remain HISTORICAL_CANDIDATE/],
    ['event URL leak', ({ eventCatalog }) => { eventCatalog.payloadSchemas.P0.properties.downloadUrl = { type: 'string' }; }, /must not contain URL-like payload field/],
    ['dedicated recording signed route reintroduced', ({ policy: localPolicy }) => { localPolicy.canonicalRoutes.push({ id: 'recording-signed', path: '/api/v1/speaking/recordings/{recordingId}/signed-access', method: 'POST', owner: 'media-service', operationId: 'bad', requestSchema: 'MediaSignedAccessRequest', responseSchema: 'MediaSignedAccessGrant', successStatus: '200', idempotencyRequired: true }); }, /canonical route identities|recording-specific signed-access route is forbidden/],
  ];
  for (const [name, mutate, expected] of cases) {
    await t.test(name, () => assertFixtureMutationFails(mutate, expected));
  }
});
