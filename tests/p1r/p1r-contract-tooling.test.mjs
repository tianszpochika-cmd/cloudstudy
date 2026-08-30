import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import { findCanonicalMergeDrift, mergeEvents, selectEventFragmentFiles } from '../../scripts/contracts/merge-b1-fragments.mjs';
import { buildGeneratedOutputs, findGeneratedOutputDrift } from '../../scripts/contracts/generate-contracts.mjs';
import {
  buildM1008OpenApiExpectedProjection,
  buildM1009OpenApiExpectedProjection,
  buildM1010EventExpectedProjection,
  buildM1010OpenApiExpectedProjection,
  buildM1011B26ExpectedProjection,
  buildM1011EventExpectedProjection,
  buildM1011OpenApiExpectedProjection,
  buildM1012B26ExpectedProjection,
  buildM1012EventExpectedProjection,
  buildM1012OpenApiExpectedProjection,
  compareM1011OpenApiDescriptors,
  compareM1012EventDescriptors,
  compareM1012OpenApiDescriptors,
  compareB26WorkflowGovernance,
  compareContracts,
  M1008_OPENAPI_EXPECTED_SEMANTIC_SHA256,
  M1008_CONTENT_EVENT_NAMES,
  M1008_REVIEWED_EVENT_COMPATIBILITY,
  M1008_REVIEWED_EVENT_PAYLOAD_SCHEMA,
  M1009_MEDIA_PROMOTION_ID,
  M1009_OPENAPI_EXPECTED_SEMANTIC_SHA256,
  M1010_ASSESSMENT_EVENT_NAMES,
  M1010_ASSESSMENT_PROMOTION_ID,
  M1010_EVENT_EXPECTED_SEMANTIC_SHA256,
  M1010_OPENAPI_EXPECTED_SEMANTIC_SHA256,
  M1011_B26_EXPECTED_SEMANTIC_SHA256,
  M1011_EVENT_EXPECTED_CHANGE_DESCRIPTORS,
  M1011_EVENT_EXPECTED_SEMANTIC_SHA256,
  M1011_LEARNER_PLANNING_PROMOTION_ID,
  M1011_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS,
  M1011_OPENAPI_EXPECTED_SEMANTIC_SHA256,
  M1012_B26_EXPECTED_SEMANTIC_SHA256,
  M1012_EVENT_EXPECTED_CHANGE_DESCRIPTORS,
  M1012_EVENT_EXPECTED_SEMANTIC_SHA256,
  M1012_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS,
  M1012_OPENAPI_EXPECTED_SEMANTIC_SHA256,
  M1012_PLACEMENT_PROMOTION_ID,
  M1012_SOURCE_CONTRACT_BASELINE_REF,
  runCompatibilityDiff,
  stableGovernanceSha256,
} from '../../scripts/contracts/compatibility-diff.mjs';
import {
  hasRequiredCiContractBaseline,
  inspectRequiredCiContractGate,
  REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
  REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
  REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
  REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
  REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
  REQUIRED_CI_CONTRACT_COMPATIBILITY_COMMAND,
  REQUIRED_CI_CONTRACT_BASELINE_REF,
  REQUIRED_EVENT_GOVERNANCE_BASELINE_REF,
  runGitBaselineCompatibility,
  validateM1009CompatibilityPolicy,
  validateM1010CompatibilityPolicy,
  validateM1011CompatibilityPolicy,
  validateM1012CompatibilityPolicy,
} from '../../scripts/contracts/compatibility-git-baseline.mjs';
import { validateEventCatalog } from '../../scripts/contracts/validate-contracts.mjs';
import { schemaToTs } from '../../scripts/contracts/schema-utils.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const openApiPath = path.join(root, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json');
const eventCatalogPath = path.join(root, 'packages', 'contracts', 'events', 'v1', 'catalog.json');
const b26RuntimePath = path.join(root, 'config', 'b26-event-runtime.json');
const contentLifecyclePolicyPath = path.join(root, 'config', 'p1r-content-lifecycle.v1.json');
const mediaContractPolicyPath = path.join(root, 'config', 'p1r-media-contract.v1.json');
const assessmentContractPolicyPath = path.join(root, 'config', 'p1r-assessment-contract.v1.json');
const learnerPlanningContractPolicyPath = path.join(root, 'config', 'p1r-learner-planning-contract.v1.json');
const placementContractPolicyPath = path.join(root, 'config', 'p1r-placement-contract.v1.json');
const openApi = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
const eventCatalog = JSON.parse(fs.readFileSync(eventCatalogPath, 'utf8'));
const b26Runtime = JSON.parse(fs.readFileSync(b26RuntimePath, 'utf8'));
const ciWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const EXPECTED_EVENT_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';

test('generated TypeScript preserves shared fields around oneOf constraints', () => {
  const schemas = openApi.components.schemas;
  const composedSchemas = [
    'B9ContentCommandRequest',
    'B9ScheduledPublishTask',
    'B9SessionContentPin',
    'B10ContentVersionPin',
    'B10ContentRecovery',
    'B10ActiveSessionAttemptPin',
  ];
  for (const schemaName of composedSchemas) {
    const schema = schemas[schemaName];
    const generated = schemaToTs(openApi, schema);
    assert.doesNotMatch(generated, /(?:^|[< &(])unknown(?:$|[> )|&])/, `${schemaName} widened to unknown`);
    for (const field of schema.required ?? []) {
      assert.match(generated, new RegExp(`(?:^|[ {])${field}:`), `${schemaName}.${field} stopped being required`);
    }
    for (const branch of schema.oneOf ?? []) {
      for (const field of branch.required ?? []) {
        assert.match(generated, new RegExp(`(?:^|[ {])${field}:`), `${schemaName} oneOf stopped requiring ${field}`);
      }
    }
  }

  const commandType = schemaToTs(openApi, schemas.B9ContentCommandRequest);
  assert.doesNotMatch(commandType, /command\?:/);
  assert.match(commandType, /content\?: never/);
  const pinType = schemaToTs(openApi, schemas.B10ContentVersionPin);
  assert.doesNotMatch(pinType, /pinStatus\?:/);
  assert.match(pinType, /fallbackVersionId\?: never/);
  const recoveryType = schemaToTs(openApi, schemas.B10ContentRecovery);
  assert.doesNotMatch(recoveryType, /resolution\?:/);
  assert.match(recoveryType, /resolvedVersionId\?: never/);

  const reviewRecords = schemas.B9AdminContentState.properties.reviewRecords;
  const generatedReviewRecords = schemaToTs(openApi, reviewRecords);
  assert.match(generatedReviewRecords, /readonly \[\]/);
  assert.match(generatedReviewRecords, /readonly \[[^\]]*contentVersionId:/);
  assert.doesNotMatch(generatedReviewRecords, /(?:^|[< &(])unknown(?:$|[> )|&])/);
  for (const field of ['contentVersionId', 'contentHash', 'reviewStage', 'decision', 'reviewVersion', 'auditId', 'decidedAt']) {
    assert.match(generatedReviewRecords, new RegExp(`(?:^|[ {])${field}:`));
  }
});

test('generated TypeScript carries allOf common item types into cardinality-only branches', () => {
  const document = {
    components: {
      schemas: {
        Task: {
          type: 'object',
          additionalProperties: false,
          required: ['taskId'],
          properties: { taskId: { type: 'string' } },
        },
        Common: {
          type: 'object',
          additionalProperties: false,
          required: ['state', 'taskCount', 'tasks'],
          properties: {
            state: { type: 'string', enum: ['READY', 'EMPTY'] },
            taskCount: { type: 'integer', minimum: 0 },
            tasks: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
          },
        },
      },
    },
  };
  const generated = schemaToTs(document, {
    allOf: [
      { $ref: '#/components/schemas/Common' },
      {
        oneOf: [
          {
            required: ['state', 'tasks'],
            properties: {
              state: { const: 'READY' },
              taskCount: { minimum: 1 },
              tasks: { minItems: 1 },
            },
          },
          {
            required: ['state', 'tasks'],
            properties: {
              state: { const: 'EMPTY' },
              taskCount: { const: 0 },
              tasks: { maxItems: 0 },
            },
          },
        ],
      },
    ],
  });

  assert.match(generated, /state: \"READY\"/);
  assert.match(generated, /taskCount: number/);
  assert.match(generated, /tasks: readonly \[Task, \.\.\.Array<Task>\]/);
  assert.match(generated, /state: \"EMPTY\"/);
  assert.match(generated, /taskCount: 0/);
  assert.match(generated, /tasks: readonly \[\]/);
  assert.doesNotMatch(generated, /tasks: readonly \[unknown/);
});

test('generated TypeScript lets oneOf branches narrow a referenced common discriminator', () => {
  const document = {
    components: {
      schemas: {
        State: { type: 'string', enum: ['OPEN', 'CLOSED'] },
      },
    },
  };
  const generated = schemaToTs(document, {
    type: 'object',
    additionalProperties: false,
    required: ['state'],
    properties: {
      state: { $ref: '#/components/schemas/State' },
      result: { type: 'string' },
    },
    oneOf: [
      {
        required: ['state'],
        properties: { state: { type: 'string', enum: ['OPEN'] } },
        not: { required: ['result'] },
      },
      {
        required: ['state', 'result'],
        properties: { state: { type: 'string', enum: ['CLOSED'] } },
      },
    ],
  });

  assert.match(generated, /state: "OPEN"/);
  assert.match(generated, /state: "CLOSED"/);
  assert.match(generated, /result\?: never/);
});

test('generated TypeScript preserves closed JSON Schema prefixItems tuples', () => {
  const generated = schemaToTs({}, {
    type: 'array',
    minItems: 2,
    maxItems: 2,
    prefixItems: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['dimensionId', 'coverageRatio'],
        properties: {
          dimensionId: { const: 'VOCABULARY' },
          coverageRatio: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['dimensionId', 'coverageRatio'],
        properties: {
          dimensionId: { const: 'READING' },
          coverageRatio: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    ],
    items: false,
  });

  assert.match(generated, /^readonly \[/);
  assert.match(generated, /dimensionId: \"VOCABULARY\"/);
  assert.match(generated, /dimensionId: \"READING\"/);
  assert.match(generated, /coverageRatio: number/);
  assert.doesNotMatch(generated, /unknown/);
  assert.doesNotMatch(generated, /\.\.\.Array/);
});

test('generated TypeScript lets an allOf branch narrow a nullable common property', () => {
  const generated = schemaToTs({}, {
    allOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'score'],
        properties: {
          kind: { type: 'string', enum: ['ASSESSED', 'SKIPPED'] },
          score: { type: 'integer', nullable: true },
        },
      },
      {
        oneOf: [
          {
            required: ['kind', 'score'],
            properties: {
              kind: { const: 'ASSESSED' },
              score: { type: 'integer', minimum: 0 },
            },
          },
          {
            required: ['kind', 'score'],
            properties: {
              kind: { const: 'SKIPPED' },
              score: { const: null },
            },
          },
        ],
      },
    ],
  });

  assert.match(generated, /kind: \"ASSESSED\"; score: number/);
  assert.doesNotMatch(generated, /kind: \"ASSESSED\"; score: number \| null/);
  assert.match(generated, /kind: \"SKIPPED\"; score: null/);
});

test('generated TypeScript preserves nullable JSON Schema type arrays', () => {
  assert.equal(
    schemaToTs(openApi, { type: ['string', 'null'], nullable: true }),
    'string | null',
  );
});

test('no-write merge detects an in-memory canonical artifact drift', () => {
  const expectedOpenApi = structuredClone(openApi);
  expectedOpenApi.info = { ...expectedOpenApi.info, title: 'drift fixture' };
  const drift = findCanonicalMergeDrift({
    expectedOpenApi,
    actualOpenApi: openApi,
    expectedEventCatalog: eventCatalog,
    actualEventCatalog: eventCatalog,
  });
  assert.deepEqual(drift, ['packages/contracts/openapi/v1/openapi.json']);
});

test('no-write merge detects historical fragment semantic drift behind an unchanged catalog', () => {
  const fragmentPath = path.join(root, 'packages', 'contracts', 'events', 'v1', 'fragments', 'b10-learning-assessment.events.json');
  const fragment = JSON.parse(fs.readFileSync(fragmentPath, 'utf8'));
  fragment.events.find((event) => event.eventName === 'assessment.attempt.submitted.v1').description = 'manual fragment drift';
  const expectedEventCatalog = structuredClone(eventCatalog);
  mergeEvents(expectedEventCatalog, fragment, 'packages/contracts/events/v1/fragments/b10-learning-assessment.events.json');
  const drift = findCanonicalMergeDrift({
    expectedOpenApi: openApi,
    actualOpenApi: openApi,
    expectedEventCatalog,
    actualEventCatalog: eventCatalog,
  });
  assert.deepEqual(drift, ['packages/contracts/events/v1/catalog.json']);
});

async function loadPrivateMergeOpenApiForTest() {
  const mergeScriptPath = path.join(root, 'scripts', 'contracts', 'merge-b1-fragments.mjs');
  const auditModuleUrl = pathToFileURL(path.join(root, 'scripts', 'audit', 'p1r-event-governance-check.mjs')).href;
  const projectionModuleUrl = pathToFileURL(path.join(root, 'scripts', 'contracts', 'event-governance-projection.mjs')).href;
  let source = fs.readFileSync(mergeScriptPath, 'utf8');
  source = source
    .replaceAll("'../audit/p1r-event-governance-check.mjs'", JSON.stringify(auditModuleUrl))
    .replaceAll("'./event-governance-projection.mjs'", JSON.stringify(projectionModuleUrl))
    .replace(
      'const scriptDir = path.dirname(fileURLToPath(import.meta.url));',
      `const scriptDir = ${JSON.stringify(path.dirname(mergeScriptPath))};`,
    )
    .replace(
      "const repoRoot = path.resolve(scriptDir, '..', '..');",
      `const repoRoot = ${JSON.stringify(root)};`,
    )
    .replace(/const isCli = [^\n]+;/, 'const isCli = false;');
  return import(`data:text/javascript;base64,${Buffer.from(`${source}\nexport { mergeOpenApi };\n`).toString('base64')}`);
}

test('B1 onboarding adapter rejects route and schema overrides outside its exact allowlist', async () => {
  const { mergeOpenApi } = await loadPrivateMergeOpenApiForTest();
  const filePath = 'packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json';
  const base = {
    tags: [],
    paths: {
      '/api/v1/learner/profile': { get: { summary: 'canonical learner profile' } },
    },
    components: {
      schemas: { B9LearnerProfile: { type: 'string' } },
      parameters: {},
      responses: {},
      headers: {},
      securitySchemes: {},
      requestBodies: {},
      examples: {},
    },
  };

  assert.throws(
    () => mergeOpenApi(
      structuredClone(base),
      { paths: { '/api/v1/learner/profile': { post: { summary: 'unapproved B1 override' } } } },
      filePath,
      new Set(),
      new Set(),
      new Set(),
    ),
    /conflicts with OpenAPI route \/api\/v1\/learner\/profile/,
  );
  assert.throws(
    () => mergeOpenApi(
      structuredClone(base),
      { components: { schemas: { B9LearnerProfile: { type: 'object' } } } },
      filePath,
      new Set(),
      new Set(),
      new Set(),
    ),
    /OpenAPI schemas duplicate with different definitions: B9LearnerProfile/,
  );
});

test('B26 semantic fragments can evolve without taking ownership of status or governance', () => {
  const governance = { status: 'CANONICAL_D2' };
  const base = {
    events: [{
      eventName: 'workflow.example.v1',
      status: 'CANONICAL_D2',
      'x-p1r-governance': governance,
      version: 1,
      payloadSchema: { $ref: '#/payloadSchemas/Example' },
    }],
    payloadSchemas: { Example: { type: 'object', properties: {} } },
  };
  const fragment = {
    events: [{
      eventName: 'workflow.example.v1',
      version: 1,
      description: 'updated semantic description',
      payloadSchema: { $ref: '#/payloadSchemas/Example' },
    }],
    payloadSchemas: { Example: { type: 'object', properties: { eventId: { type: 'string' } } } },
  };
  mergeEvents(base, fragment, 'packages/contracts/events/v1/fragments/b26-reliability.events.json');
  assert.equal(base.events[0].description, 'updated semantic description');
  assert.equal(base.events[0].status, 'CANONICAL_D2');
  assert.deepEqual(base.events[0]['x-p1r-governance'], governance);
  assert.deepEqual(base.payloadSchemas.Example, fragment.payloadSchemas.Example);

  const forbidden = structuredClone(fragment);
  forbidden.events[0].status = 'CANONICAL_D2';
  assert.throws(
    () => mergeEvents(base, forbidden, 'packages/contracts/events/v1/fragments/b26-reliability.events.json'),
    /must not define catalog-owned status/,
  );
});

test('event merge discovery includes every events fragment so unknown files fail governance instead of being ignored', () => {
  assert.deepEqual(selectEventFragmentFiles([
    'b26-reliability.events.json',
    'z-unknown.events.json',
    'notes.json',
  ]), [
    'b26-reliability.events.json',
    'z-unknown.events.json',
  ]);
});

test('no-write merge check preserves canonical artifacts whether it passes or reports drift', () => {
  const before = new Map([
    [openApiPath, fs.readFileSync(openApiPath, 'utf8')],
    [eventCatalogPath, fs.readFileSync(eventCatalogPath, 'utf8')],
  ]);
  const result = spawnSync(process.execPath, ['scripts/contracts/merge-b1-fragments.mjs'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  const after = new Map([
    [openApiPath, fs.readFileSync(openApiPath, 'utf8')],
    [eventCatalogPath, fs.readFileSync(eventCatalogPath, 'utf8')],
  ]);
  assert.deepEqual(after, before);
  const output = `${result.stdout}${result.stderr}`;
  assert(result.status === 0 || /Canonical merge drift detected/.test(output), output);
  if (result.status === 0) assert.match(result.stdout, /Contract fragment merge checked/);
});

test('generated output check detects drift without writing files', () => {
  const outputs = buildGeneratedOutputs({ contractsOnly: true });
  const actual = new Map(outputs.map((output) => [output.path, output.contents]));
  actual.set(outputs[0].path, 'stale generated contents\n');
  const drift = findGeneratedOutputDrift(outputs, { readFile: (filePath) => actual.get(filePath) });
  assert.deepEqual(drift, [outputs[0].path]);
});

test('generated output no-write check reports disk drift without writing files', () => {
  const outputs = buildGeneratedOutputs();
  const expectedDrift = findGeneratedOutputDrift(outputs);
  const before = new Map(outputs.map((output) => [output.path, fs.readFileSync(output.path, 'utf8')]));
  const result = spawnSync(process.execPath, ['scripts/contracts/generate-contracts.mjs', '--check'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  const after = new Map(outputs.map((output) => [output.path, fs.readFileSync(output.path, 'utf8')]));
  assert.deepEqual(after, before);
  assert.equal(result.status === 0, expectedDrift.length === 0, String(result.stderr || result.stdout));
  if (expectedDrift.length === 0) assert.match(result.stdout, /Contract generation checked/);
  else assert.match(`${result.stdout}${result.stderr}`, /Generated contract drift detected/);
});

test('compatibility requires explicit baseline and current inputs', () => {
  assert.throws(
    () => runCompatibilityDiff({ kind: 'openapi' }),
    /Compatibility --baseline is required; pass both --baseline <old.json> and --current <new.json>/,
  );
  const result = spawnSync(process.execPath, ['scripts/contracts/compatibility-diff.mjs', '--kind', 'openapi'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /Compatibility --baseline is required/);
  assert.throws(
    () => runCompatibilityDiff({ kind: 'openapi', baseline: openApiPath, current: openApiPath }),
    /Compatibility --baseline and --current must resolve to different files/,
  );
});

test('events compatibility treats independently parsed equivalent type arrays as equal', () => {
  const independentlyParsedCatalog = JSON.parse(fs.readFileSync(eventCatalogPath, 'utf8'));
  assert.deepEqual(compareContracts('events', eventCatalog, independentlyParsedCatalog), []);
});

test('events compatibility freezes established governance and requires a second immutable baseline for its first introduction', () => {
  const current = structuredClone(eventCatalog);
  const topicDrift = structuredClone(eventCatalog);
  const governed = topicDrift.events.find((event) => event.status === 'CANONICAL_D2');
  governed['x-p1r-governance'].transport.topic = 'platform.changed.v1';
  assert.ok(compareContracts('events', current, topicDrift)
    .some((change) => change.location === `${governed.eventName}.x-p1r-governance`));

  const statusDrift = structuredClone(eventCatalog);
  statusDrift.events[0].status = 'DEPRECATED';
  assert.ok(compareContracts('events', current, statusDrift)
    .some((change) => change.location === `${statusDrift.events[0].eventName}.status`));

  const policyDrift = structuredClone(eventCatalog);
  policyDrift['x-p1r-event-governance'].transportPolicy.redisStreams = 'ALLOWED';
  assert.ok(compareContracts('events', current, policyDrift)
    .some((change) => change.location === 'x-p1r-event-governance'));

  const plannedClosureDrift = structuredClone(eventCatalog);
  plannedClosureDrift['x-p1r-event-governance'].plannedClosures.pop();
  assert.ok(compareContracts('events', current, plannedClosureDrift)
    .some((change) => change.location === 'x-p1r-event-governance'));

  const traceabilityDrift = structuredClone(eventCatalog);
  traceabilityDrift['x-p1r-event-governance'].traceability.sourceRefs.reverse();
  assert.ok(compareContracts('events', current, traceabilityDrift)
    .some((change) => change.location === 'x-p1r-event-governance'));

  const consumerOrderDrift = structuredClone(eventCatalog);
  consumerOrderDrift.events.find((event) => event.status === 'CANONICAL_D2')['x-p1r-governance'].consumers.reverse();
  assert.ok(compareContracts('events', current, consumerOrderDrift)
    .some((change) => change.location.endsWith('.x-p1r-governance')));

  for (const field of ['breakingChange', 'consumerRule']) {
    const compatibilityDrift = structuredClone(eventCatalog);
    const event = compatibilityDrift.events.find((candidate) => candidate.status === 'CANONICAL_D2');
    event.compatibility[field] = `changed ${field}`;
    assert.ok(compareContracts('events', current, compatibilityDrift)
      .some((change) => change.location === `${event.eventName}.compatibility`));
  }

  const asyncApiRuntimeDrift = structuredClone(eventCatalog);
  asyncApiRuntimeDrift.asyncapi['x-runtime-status'] = 'RUNTIME_VERIFIED';
  assert.ok(compareContracts('events', current, asyncApiRuntimeDrift)
    .some((change) => change.location === 'asyncapi'));

  const catalogPolicyDrifts = [
    ['description', (catalog) => { catalog.description = 'Kafka runtime verified and accepted'; }],
    ['x-v2-event-platform', (catalog) => { catalog['x-v2-event-platform'].runtimeAttestation = 'RUNTIME VERIFIED'; }],
    ['envelope', (catalog) => { catalog.envelope.properties.eventId.pattern = '^.*$'; }],
    ['compatibilityPolicy', (catalog) => { catalog.compatibilityPolicy.consumer = 'ignore compatibility'; }],
    ['forbiddenPayloadFieldPatterns', (catalog) => { catalog.forbiddenPayloadFieldPatterns = []; }],
  ];
  for (const [location, mutate] of catalogPolicyDrifts) {
    const drift = structuredClone(eventCatalog);
    mutate(drift);
    assert.ok(compareContracts('events', current, drift)
      .some((change) => change.location === location));
  }

  const aggregateDrift = structuredClone(eventCatalog);
  aggregateDrift.events[0].aggregateIdField = 'changedId';
  assert.ok(compareContracts('events', current, aggregateDrift)
    .some((change) => change.location === `${aggregateDrift.events[0].eventName}.aggregateIdField`));

  const envelopeDrift = structuredClone(eventCatalog);
  envelopeDrift.events[0]['x-envelope-required'] = [
    ...(envelopeDrift.events[0]['x-envelope-required'] ?? []),
    'dedupeKey',
  ];
  assert.ok(compareContracts('events', current, envelopeDrift)
    .some((change) => change.reason === 'new required envelope field: dedupeKey'));

  const withoutGovernance = structuredClone(eventCatalog);
  delete withoutGovernance['x-p1r-event-governance'];
  for (const event of withoutGovernance.events) {
    delete event.status;
    delete event['x-p1r-governance'];
  }
  assert.ok(compareContracts('events', withoutGovernance, eventCatalog)
    .some((change) => change.reason === 'first governance introduction requires an explicit immutable governance baseline'));
  assert.deepEqual(compareContracts(
    'events',
    withoutGovernance,
    eventCatalog,
    { governanceBaseline: eventCatalog },
  ), []);
});

test('events compatibility rejects changed established payload constraints', () => {
  const cases = [
    (schema) => {
      const field = Object.keys(schema.properties).find((name) => schema.properties[name].pattern);
      schema.properties[field].pattern = '^.*$';
    },
    (schema) => { schema.required = schema.required.filter((field) => field !== 'attempt'); },
    (schema) => { schema.description = 'KafkaBrokerOnline'; },
    (schema) => { schema.title = 'Kafka broker reachable'; },
    (schema) => { schema.examples = ['Kafka broker reachable']; },
    (schema) => { schema.connectionConfirmed = true; },
    (schema) => { schema.executionSucceeded = true; },
    (schema) => { schema.properties.brokerUp = { type: 'boolean' }; },
    (schema) => { schema.properties.deliveryState = { type: 'string', enum: ['BROKER_UP'] }; },
  ];
  for (const mutate of cases) {
    const changed = structuredClone(eventCatalog);
    const event = changed.events.find((candidate) => candidate.eventName === 'workflow.outbox.published.v1');
    const schema = changed.payloadSchemas[event.payloadSchema.$ref.split('/').at(-1)];
    mutate(schema);
    assert.ok(compareContracts('events', eventCatalog, changed).length > 0);
  }

  const infrastructureFact = structuredClone(eventCatalog);
  infrastructureFact.payloadSchemas.LearningSrsBatchCreated.properties.deliveryState = { type: 'string', enum: ['BROKER_UP'] };
  assert.ok(compareContracts('events', eventCatalog, infrastructureFact)
    .some((change) => change.location === 'payloadSchemas'));

  const additiveHistoricalField = structuredClone(eventCatalog);
  additiveHistoricalField.payloadSchemas.LearningSrsBatchCreated.properties.migrationNote = { type: 'string', maxLength: 64 };
  assert.doesNotThrow(() => validateEventCatalog(additiveHistoricalField));
  assert.deepEqual(compareContracts('events', eventCatalog, additiveHistoricalField), []);

  const invalidOptionalFields = [
    { type: 'not-a-json-schema-type', maxLength: 64 },
    { type: 'string', maxLength: -1 },
    { type: 'array', minItems: 1.5, items: { type: 'string' } },
    { type: 'string', minLength: 8, maxLength: 4 },
  ];
  for (const invalidSchema of invalidOptionalFields) {
    const invalidHistoricalField = structuredClone(eventCatalog);
    invalidHistoricalField.payloadSchemas.LearningSrsBatchCreated.properties.invalidOptional = invalidSchema;
    assert.throws(() => validateEventCatalog(invalidHistoricalField), /JSON Schema primitive types|non-negative integer|cannot exceed/);
    assert.ok(compareContracts('events', eventCatalog, invalidHistoricalField).length > 0);
  }

  for (const sensitiveName of ['accessTokenValue', 'refresh_token_value', 'emailAddress', 'phoneNumber', 'rawAuthorizationHeader']) {
    const sensitiveHistoricalField = structuredClone(eventCatalog);
    sensitiveHistoricalField.payloadSchemas.LearningSrsBatchCreated.properties[sensitiveName] = { type: 'string', maxLength: 64 };
    assert.throws(() => validateEventCatalog(sensitiveHistoricalField), /forbidden sensitive payload field|forbidden payload field/);
    assert.ok(compareContracts('events', eventCatalog, sensitiveHistoricalField).length > 0);
  }
});

test('events compatibility detects duplicate event names before map normalization', () => {
  const duplicate = structuredClone(eventCatalog);
  duplicate.events.push(structuredClone(duplicate.events[0]));
  const changes = compareContracts('events', eventCatalog, duplicate);
  assert.ok(changes.some((change) => change.reason === 'current catalog contains a duplicate event name'));
});

test('git baseline compatibility requires an explicit historical ref', () => {
  assert.throws(
    () => runGitBaselineCompatibility(),
    /Compatibility --ref is required/,
  );
});

test('CI compatibility baseline is immutable within the accepted M1-006 review window', () => {
  assert.equal(REQUIRED_EVENT_GOVERNANCE_BASELINE_REF, EXPECTED_EVENT_GOVERNANCE_BASELINE_REF);
  assert.equal(
    REQUIRED_CI_CONTRACT_COMPATIBILITY_COMMAND,
    `pnpm contracts:compatibility:git -- --ref ${REQUIRED_CI_CONTRACT_BASELINE_REF} --governance-ref ${EXPECTED_EVENT_GOVERNANCE_BASELINE_REF} --kind all --json`,
  );
  assert.equal(hasRequiredCiContractBaseline(ciWorkflow), true);
  assert.equal(inspectRequiredCiContractGate(ciWorkflow).valid, true);
  const movedBaseline = ciWorkflow.replace(REQUIRED_CI_CONTRACT_BASELINE_REF, 'f'.repeat(40));
  assert.equal(hasRequiredCiContractBaseline(movedBaseline), false);
  const movedGovernanceBaseline = ciWorkflow.replace(REQUIRED_EVENT_GOVERNANCE_BASELINE_REF, 'e'.repeat(40));
  assert.equal(hasRequiredCiContractBaseline(movedGovernanceBaseline), false);

  const jobMarker = '  contracts-and-data:\n';
  for (const override of [
    `    env:\n      P1R_CONTRACT_BASELINE_REF: ${'f'.repeat(40)}\n`,
    `    env:\n      "P1R_CONTRACT_BASELINE_REF": ${'f'.repeat(40)}\n`,
    `    steps:\n      - run: echo "P1R_CONTRACT_BASELINE_REF=${'f'.repeat(40)}" >> $GITHUB_ENV\n`,
    `    env:\n      P1R_EVENT_GOVERNANCE_BASELINE_REF: ${'e'.repeat(40)}\n`,
    `    steps:\n      - run: echo "P1R_EVENT_GOVERNANCE_BASELINE_REF=${'e'.repeat(40)}" >> $GITHUB_ENV\n`,
  ]) {
    const jobOverride = ciWorkflow.replace(jobMarker, `${jobMarker}${override}`);
    assert.equal(inspectRequiredCiContractGate(jobOverride).valid, false);
  }

  const compatibilityCommand = REQUIRED_CI_CONTRACT_COMPATIBILITY_COMMAND;
  for (const bypass of [
    `${compatibilityCommand} || true`,
    `${compatibilityCommand}\n        || true`,
    `# - run: ${compatibilityCommand}`,
  ]) {
    const mutated = ciWorkflow.replace(`- run: ${compatibilityCommand}`, `- run: ${bypass}`);
    assert.equal(inspectRequiredCiContractGate(mutated).valid, false);
  }

  const conditional = ciWorkflow.replace(
    `- run: ${compatibilityCommand}`,
    `- run: ${compatibilityCommand}\n        if: false`,
  );
  assert.equal(inspectRequiredCiContractGate(conditional).valid, false);

  for (const jobControl of [
    '"if": false',
    "'if': false",
    'if : false',
    '"continue-on-error": true',
    'continue-on-error : true',
    String.raw`"\x69f": false`,
    String.raw`"\x63ontinue-on-error": true`,
    'steps: []',
  ]) {
    const controlledJob = ciWorkflow.replace(jobMarker, `${jobMarker}    ${jobControl}\n`);
    assert.equal(inspectRequiredCiContractGate(controlledJob).valid, false);
  }

  const shallowCheckout = ciWorkflow.replace(
    '          fetch-depth: 0',
    '          fetch-depth: 0\n          "fetch-depth": 1',
  );
  assert.equal(inspectRequiredCiContractGate(shallowCheckout).valid, false);
});

test('Git compatibility adds the fixed governance freeze when the historical baseline lacks it', () => {
  const accepted = runGitBaselineCompatibility({
    ref: REQUIRED_CI_CONTRACT_BASELINE_REF,
    governanceRef: REQUIRED_EVENT_GOVERNANCE_BASELINE_REF,
    kind: 'events',
  });
  assert.equal(accepted.compatible, true);
  assert.deepEqual(accepted.governanceBaseline, {
    ref: EXPECTED_EVENT_GOVERNANCE_BASELINE_REF,
    commit: EXPECTED_EVENT_GOVERNANCE_BASELINE_REF,
    sources: {
      catalog: `git:${EXPECTED_EVENT_GOVERNANCE_BASELINE_REF}:packages/contracts/events/v1/catalog.json`,
      b26StaticPolicy: `git:${EXPECTED_EVENT_GOVERNANCE_BASELINE_REF}:config/b26-event-runtime.json`,
    },
    scope: 'static-governance-only',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  });

  const withoutCurrentGovernance = structuredClone(eventCatalog);
  delete withoutCurrentGovernance['x-p1r-event-governance'];
  for (const event of withoutCurrentGovernance.events) {
    delete event.status;
    delete event['x-p1r-governance'];
  }
  const readWithoutGovernance = (filePath) => {
    if (path.resolve(filePath) === eventCatalogPath) return JSON.stringify(withoutCurrentGovernance);
    if (path.resolve(filePath) === b26RuntimePath) return JSON.stringify(b26Runtime);
    return fs.readFileSync(filePath, 'utf8');
  };
  const deletedGovernance = runGitBaselineCompatibility({
    ref: REQUIRED_CI_CONTRACT_BASELINE_REF,
    kind: 'events',
    readFile: readWithoutGovernance,
  });
  assert.equal(deletedGovernance.compatible, false);
  assert.equal(deletedGovernance.governanceBaseline.ref, EXPECTED_EVENT_GOVERNANCE_BASELINE_REF);
  assert.ok(deletedGovernance.results[0].breakingChanges
    .some((change) => change.location.startsWith('m1-012.eventPromotion')));

  const synchronizedCatalogDrift = structuredClone(eventCatalog);
  const canonicalEvents = synchronizedCatalogDrift.events.filter((event) => event.status === 'CANONICAL_D2');
  assert.equal(canonicalEvents.length, 7 + M1008_CONTENT_EVENT_NAMES.length + 2);
  for (const canonical of canonicalEvents) {
    canonical['x-p1r-governance'].producer.service = 'audit-service';
    canonical['x-p1r-governance'].producer.dataOwner = 'audit-service';
  }
  const synchronizedB26Drift = structuredClone(b26Runtime);
  const workflowTopic = synchronizedB26Drift.topics.find((topic) => topic.name === 'platform.workflow.v1');
  workflowTopic.ownerService = 'audit-service';
  workflowTopic.producerPrincipal = 'svc.audit-service';
  workflowTopic.acl.find((entry) => entry.operation === 'WRITE').principal = 'svc.audit-service';
  workflowTopic.consumerGroups.reverse();
  workflowTopic.retentionMs += 1;
  synchronizedB26Drift.eventRouting
    .find((route) => route.eventName === 'workflow.outbox.published.v1')
    .partitionKey = 'eventId';
  const readSynchronizedDrift = (filePath) => {
    if (path.resolve(filePath) === eventCatalogPath) return JSON.stringify(synchronizedCatalogDrift);
    if (path.resolve(filePath) === b26RuntimePath) return JSON.stringify(synchronizedB26Drift);
    return fs.readFileSync(filePath, 'utf8');
  };
  const synchronizedDrift = runGitBaselineCompatibility({
    ref: REQUIRED_CI_CONTRACT_BASELINE_REF,
    kind: 'events',
    readFile: readSynchronizedDrift,
  });
  assert.equal(synchronizedDrift.compatible, false);
  const locations = synchronizedDrift.results[0].breakingChanges.map((change) => change.location);
  assert.ok(locations.some((location) => location.startsWith('m1-012.eventPromotion')));
  assert.ok(locations.includes('b26.topics.platform.workflow.v1.ownerService'));
  assert.ok(locations.includes('b26.topics.platform.workflow.v1.consumerGroups'));
  assert.ok(locations.includes('b26.topics.platform.workflow.v1.acl'));
  assert.ok(locations.includes('b26.topics'));
  assert.ok(locations.includes('b26.topics.platform.workflow.v1'));
  assert.ok(locations.includes('b26.eventRouting'));

  assert.throws(
    () => runGitBaselineCompatibility({
      ref: REQUIRED_CI_CONTRACT_BASELINE_REF,
      governanceRef: REQUIRED_CI_CONTRACT_BASELINE_REF,
      kind: 'events',
    }),
    /must remain immutable/,
  );
});

test('git baseline compatibility reads immutable baseline blobs and rejects a true self-comparison', () => {
  const currentText = fs.readFileSync(openApiPath, 'utf8');
  const m1009SourceText = JSON.stringify(gitJson(
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/openapi/v1/openapi.json',
  ));
  const m1010SourceText = JSON.stringify(gitJson(
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/openapi/v1/openapi.json',
  ));
  const m1010SourceEventsText = JSON.stringify(gitJson(
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/events/v1/catalog.json',
  ));
  const m1011SourceText = JSON.stringify(gitJson(
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/openapi/v1/openapi.json',
  ));
  const m1011SourceEventsText = JSON.stringify(gitJson(
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/events/v1/catalog.json',
  ));
  const m1011SourceB26Text = JSON.stringify(gitJson(
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    'config/b26-event-runtime.json',
  ));
  const m1012SourceText = JSON.stringify(gitJson(
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/openapi/v1/openapi.json',
  ));
  const m1012SourceEventsText = JSON.stringify(gitJson(
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/events/v1/catalog.json',
  ));
  const m1012SourceB26Text = JSON.stringify(gitJson(
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    'config/b26-event-runtime.json',
  ));
  const git = (args) => {
    if (args[0] === 'rev-parse' && args[2] === 'HEAD^{commit}') return 'current-commit';
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse') return 'baseline-commit';
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return m1009SourceText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return m1010SourceText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return m1010SourceEventsText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return m1011SourceText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return m1011SourceEventsText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}:config/b26-event-runtime.json`) return m1011SourceB26Text;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return m1012SourceText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return m1012SourceEventsText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}:config/b26-event-runtime.json`) return m1012SourceB26Text;
    if (args[0] === 'show') return currentText;
    throw new Error(`Unexpected git invocation: ${args.join(' ')}`);
  };
  const result = runGitBaselineCompatibility({ ref: 'accepted-contract', kind: 'openapi', git });
  assert.equal(result.compatible, true);
  assert.equal(result.results[0].breakingChanges.length, 0);

  const sameHeadGit = (args) => {
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse') return 'current-commit';
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return m1009SourceText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return m1010SourceText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return m1010SourceEventsText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return m1011SourceText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return m1011SourceEventsText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}:config/b26-event-runtime.json`) return m1011SourceB26Text;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return m1012SourceText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return m1012SourceEventsText;
    if (args[0] === 'show' && args[1] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}:config/b26-event-runtime.json`) return m1012SourceB26Text;
    if (args[0] === 'show') return currentText;
    throw new Error(`Unexpected git invocation: ${args.join(' ')}`);
  };
  assert.throws(
    () => runGitBaselineCompatibility({ ref: 'HEAD', kind: 'openapi', git: sameHeadGit }),
    /resolves to the current HEAD and every selected contract is identical/,
  );
});

function gitJson(ref, relativePath) {
  const result = spawnSync('git', ['show', `${ref}:${relativePath}`], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function runM1008PromotionWithMutation({ mutateCatalog, mutateB26, mutatePolicy } = {}) {
  const mutatedCatalog = structuredClone(eventCatalog);
  const mutatedB26 = structuredClone(b26Runtime);
  const mutatedPolicy = JSON.parse(fs.readFileSync(contentLifecyclePolicyPath, 'utf8'));
  mutateCatalog?.(mutatedCatalog);
  mutateB26?.(mutatedB26);
  mutatePolicy?.(mutatedPolicy);
  const readFile = (filePath) => {
    const resolved = path.resolve(filePath);
    if (resolved === path.resolve(eventCatalogPath)) return JSON.stringify(mutatedCatalog);
    if (resolved === path.resolve(b26RuntimePath)) return JSON.stringify(mutatedB26);
    if (resolved === path.resolve(contentLifecyclePolicyPath)) return JSON.stringify(mutatedPolicy);
    return fs.readFileSync(filePath, 'utf8');
  };
  return runGitBaselineCompatibility({
    ref: REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    kind: 'events',
    readFile,
  });
}

const m1008SourceOpenApi = gitJson(
  REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
  'packages/contracts/openapi/v1/openapi.json',
);
const m1008AcceptedOpenApi = gitJson(
  REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
  'packages/contracts/openapi/v1/openapi.json',
);
const contentLifecyclePolicy = JSON.parse(fs.readFileSync(contentLifecyclePolicyPath, 'utf8'));
const m1008PolicyPromotion = contentLifecyclePolicy.eventGovernance.compatibilityPromotion;
const m1008OpenApiAllowance = Object.freeze({
  id: 'M1-008_CONTENT_LIFECYCLE_PROMOTION',
  sourceContractBaseline: m1008PolicyPromotion.sourceContractBaseline,
  immutableGovernanceBaseline: m1008PolicyPromotion.immutableGovernanceBaseline,
  fromStatus: m1008PolicyPromotion.fromStatus,
  toStatus: m1008PolicyPromotion.toStatus,
  eventNames: [...m1008PolicyPromotion.eventNames],
  gapIds: [...m1008PolicyPromotion.gapIds],
  topic: m1008PolicyPromotion.topic,
  addedConsumerGroups: [...m1008PolicyPromotion.addedConsumerGroups],
  runtimeStatus: m1008PolicyPromotion.runtimeStatus,
  canonicalEnvelope: [...contentLifecyclePolicy.eventGovernance.canonicalEnvelope],
  closureStatus: 'D2_CONTRACT_CLOSED',
});

function m1008ExpectedOpenApiProjection(approved) {
  const projection = buildM1008OpenApiExpectedProjection(m1008SourceOpenApi, approved);
  assert.ok(projection, 'frozen-source M1-008 OpenAPI projection must be constructible');
  return projection;
}

function runM1008OpenApiPromotionWithMutation({ mutateOpenApi } = {}) {
  const mutatedOpenApi = m1008ExpectedOpenApiProjection(m1008AcceptedOpenApi);
  mutateOpenApi?.(mutatedOpenApi);
  const breakingChanges = compareContracts('openapi', m1008SourceOpenApi, mutatedOpenApi, {
    allowance: m1008OpenApiAllowance,
  });
  return {
    compatible: breakingChanges.length === 0,
    results: [{
      promotion: {
        id: 'M1-008_CONTENT_LIFECYCLE_PROMOTION',
        sourceContractBaseline: REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
        immutableGovernanceBaseline: EXPECTED_EVENT_GOVERNANCE_BASELINE_REF,
      },
      breakingChanges,
    }],
  };
}

test('M1-008 exact OpenAPI promotion passes with the frozen projection', () => {
  const expectedProjection = m1008ExpectedOpenApiProjection(m1008AcceptedOpenApi);
  assert.deepEqual(expectedProjection, m1008AcceptedOpenApi);
  assert.equal(stableGovernanceSha256(expectedProjection), M1008_OPENAPI_EXPECTED_SEMANTIC_SHA256);
  const result = runM1008OpenApiPromotionWithMutation();
  assert.equal(result.compatible, true);
  assert.equal(result.results[0].promotion.id, 'M1-008_CONTENT_LIFECYCLE_PROMOTION');
  assert.equal(result.results[0].promotion.sourceContractBaseline, REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF);
  assert.equal(result.results[0].promotion.immutableGovernanceBaseline, EXPECTED_EVENT_GOVERNANCE_BASELINE_REF);
  assert.deepEqual(result.results[0].breakingChanges, []);
  assert.equal(M1008_OPENAPI_EXPECTED_SEMANTIC_SHA256.length, 64);
});

test('default OpenAPI compatibility remains strict for the M1-008 promotion', () => {
  const sourceOpenApi = gitJson(
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/openapi/v1/openapi.json',
  );
  const changes = compareContracts('openapi', sourceOpenApi, m1008ExpectedOpenApiProjection(m1008AcceptedOpenApi));
  assert.ok(changes.length > 0);
  assert.ok(changes.some((change) => change.location === 'POST /api/v1/admin/content-commands.request.oneOf'));
});

test('M1-008 OpenAPI promotion rejects extra paths, schemas, enum values, weakened oneOf and authority drift', () => {
  const mutations = [
    ['extra path', (document) => {
      document.paths['/api/v1/admin/content-publish-tasks/injected'] = {
        get: { responses: { 200: { description: 'injected' } } },
      };
    }],
    ['extra schema', (document) => {
      document.components.schemas.M1008Injected = { type: 'object', additionalProperties: false };
    }],
    ['command enum injection', (document) => {
      document.components.schemas.B9ContentCommandRequest.properties.command.enum.push('INJECTED');
    }],
    ['oneOf weakening', (document) => {
      document.components.schemas.B9ContentCommandRequest.oneOf[0].not = { anyOf: [] };
    }],
    ['B1 authority reactivation', (document) => {
      document.paths['/api/v1/content'].post['x-authority-inputs-ignored'] = [];
    }],
    ['B1 publish replay contradiction', (document) => {
      document.paths['/api/v1/content/{contentId}/versions/{versionId}/publish'].post['x-idempotency'].replayBehavior = 'old version enters ARCHIVED';
    }],
    ['B1 archive replay contradiction', (document) => {
      document.paths['/api/v1/content/{contentId}/versions/{versionId}/archive'].post['x-idempotency'].replayBehavior = 'returns ARCHIVED';
    }],
    ['B10 future pin oneOf weakening', (document) => {
      document.components.schemas.B10ContentVersionPin.oneOf[3].required.pop();
    }],
    ['B10 recovery emergency reason mismatch', (document) => {
      document.components.schemas.B10ContentRecovery.properties.recoveryReasonCode.enum.pop();
    }],
    ['B10 active pin ref drift', (document) => {
      document.components.schemas.B10AssessmentSession.properties.pin.$ref = '#/components/schemas/B10ContentVersionPin';
    }],
    ['B9 review record identity removed', (document) => {
      const records = document.components.schemas.B9AdminContentState.properties.reviewRecords;
      records.items.required = records.items.required.filter((field) => field !== 'contentHash');
      delete records.items.properties.contentHash;
    }],
    ['B9 review stage cardinality weakened', (document) => {
      document.components.schemas.B9AdminContentState.properties.reviewRecords.oneOf[2].allOf.shift();
    }],
    ['B9 review chain policy drift', (document) => {
      document.components.schemas.B9AdminContentState.properties.reviewRecords['x-p1r-review-records-policy'].identityConstraint = 'BEST_EFFORT';
    }],
    ['Gateway owner drift', (document) => {
      document['x-p1r-gateway-boundary'].routeRules.find((rule) => rule.ruleId === 'admin-content').upstreamOwner = 'audit-service';
    }],
  ];
  for (const [label, mutateOpenApi] of mutations) {
    const result = runM1008OpenApiPromotionWithMutation({ mutateOpenApi });
    assert.equal(result.compatible, false, `${label} unexpectedly passed`);
    assert.ok(result.results[0].breakingChanges.length > 0, `${label} produced no evidence`);
  }
});

const mediaContractPolicy = JSON.parse(fs.readFileSync(mediaContractPolicyPath, 'utf8'));
const m1009SourceOpenApi = m1008AcceptedOpenApi;
const m1009AcceptedOpenApi = gitJson(
  REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
  'packages/contracts/openapi/v1/openapi.json',
);
const m1009Allowance = mediaContractPolicy.compatibilityPromotion;

function runM1009OpenApiPromotionWithMutation(mutateOpenApi) {
  const mutatedOpenApi = structuredClone(m1009AcceptedOpenApi);
  mutateOpenApi?.(mutatedOpenApi);
  const breakingChanges = compareContracts('openapi', m1009SourceOpenApi, mutatedOpenApi, {
    allowance: m1009Allowance,
  });
  return { compatible: breakingChanges.length === 0, breakingChanges };
}

test('M1-009 exact media OpenAPI promotion passes from the immutable M1-008 checkpoint', () => {
  assert.deepEqual(validateM1009CompatibilityPolicy(mediaContractPolicy), []);
  const projection = buildM1009OpenApiExpectedProjection(m1009SourceOpenApi, m1009AcceptedOpenApi, m1009Allowance);
  assert.ok(projection, 'frozen-source M1-009 OpenAPI projection must be constructible');
  assert.deepEqual(projection, m1009AcceptedOpenApi);
  assert.equal(stableGovernanceSha256(projection), M1009_OPENAPI_EXPECTED_SEMANTIC_SHA256);
  assert.equal(M1009_OPENAPI_EXPECTED_SEMANTIC_SHA256.length, 64);
  assert.equal(m1009Allowance.id, M1009_MEDIA_PROMOTION_ID);
  assert.deepEqual(runM1009OpenApiPromotionWithMutation(), { compatible: true, breakingChanges: [] });

  const baselineCatalog = gitJson(
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/events/v1/catalog.json',
  );
  const acceptedCatalog = gitJson(
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/events/v1/catalog.json',
  );
  assert.equal(stableGovernanceSha256(baselineCatalog), stableGovernanceSha256(acceptedCatalog));
});

test('default OpenAPI compatibility remains strict for the M1-009 promotion', () => {
  const changes = compareContracts('openapi', m1009SourceOpenApi, m1009AcceptedOpenApi);
  assert.ok(changes.length > 0);
  assert.ok(changes.some((change) => change.location === 'components.schemas.B8Consent.required'));
});

test('M1-009 promotion rejects unapproved routes, schemas, owner, consent, retry, delivery and Phase 1 drift', () => {
  const mutations = [
    ['extra route', (document) => {
      document.paths['/api/v1/media/injected'] = { get: { responses: { 200: { description: 'injected' } } } };
    }],
    ['extra schema', (document) => {
      document.components.schemas.M1009Injected = { type: 'object', additionalProperties: false };
    }],
    ['Gateway owner drift', (document) => {
      document['x-p1r-gateway-boundary'].routeRules.find((rule) => rule.ruleId === 'speaking-recordings').upstreamOwner = 'learning-service';
    }],
    ['voice consent removed', (document) => {
      document.components.schemas.B8Consent.properties.type.enum = document.components.schemas.B8Consent.properties.type.enum.filter((value) => value !== 'VOICE_RECORDING');
    }],
    ['voice purpose removed', (document) => {
      document.components.schemas.B8Consent.properties.purpose.enum = document.components.schemas.B8Consent.properties.purpose.enum.filter((value) => value !== 'ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY');
    }],
    ['retry budget drift', (document) => {
      document.components.schemas.MediaProcessingTask['x-retry-policy'].maxAttempts = 6;
    }],
    ['malware gate weakened', (document) => {
      document.components.schemas.MediaAsset['x-p1r-media-malware-gate'].deliveryRequires = 'PENDING_OR_CLEAN';
    }],
    ['signed access binding weakened', (document) => {
      document.components.schemas.MediaAccessBinding.required = document.components.schemas.MediaAccessBinding.required.filter((field) => field !== 'revocationVersion');
    }],
    ['manifest fallback weakened', (document) => {
      document.components.schemas.MediaManifest.properties.fallbackAlternatives.minItems = 1;
    }],
    ['delete receipt false success', (document) => {
      document.components.schemas.SpeakingRecordingDeleteReceipt.oneOf = [];
    }],
    ['publish eligibility bypass', (document) => {
      document.components.schemas.MediaPublishEligibility.oneOf[0].properties.malwareStatus.const = 'PENDING';
    }],
    ['Phase 1 AI alias', (document) => {
      document.components.schemas.SpeakingShadowingCompletionReceipt.properties.aiScore = { type: 'number' };
    }],
  ];
  for (const [label, mutateOpenApi] of mutations) {
    const result = runM1009OpenApiPromotionWithMutation(mutateOpenApi);
    assert.equal(result.compatible, false, `${label} unexpectedly passed`);
    assert.ok(result.breakingChanges.length > 0, `${label} produced no evidence`);
  }
});

test('M1-009 policy remains frozen inside the full M1-012 fixed-baseline chain', () => {
  for (const mutate of [
    (policy) => { policy.compatibilityPromotion.sourceContractBaseline = 'f'.repeat(40); },
    (policy) => { policy.compatibilityPromotion.previousPromotion = 'M1-007_EVENT_RELIABILITY_PROMOTION'; },
    (policy) => { policy.compatibilityPromotion.runtimeStatus = 'RUNTIME_VERIFIED'; },
    (policy) => { policy.compatibilityPromotion.eventCatalogDecision = 'PROMOTE_MEDIA_EVENTS'; },
    (policy) => { policy.compatibilityPromotion.canonicalFragment = 'packages/contracts/openapi/v1/openapi.json'; },
  ]) {
    const mutated = structuredClone(mediaContractPolicy);
    mutate(mutated);
    assert.ok(validateM1009CompatibilityPolicy(mutated).length > 0);
  }

  const result = runGitBaselineCompatibility({
    ref: REQUIRED_CI_CONTRACT_BASELINE_REF,
    governanceRef: EXPECTED_EVENT_GOVERNANCE_BASELINE_REF,
    kind: 'all',
  });
  assert.equal(result.compatible, true);
  assert.equal(result.results.find((entry) => entry.kind === 'openapi').promotion.id, M1012_PLACEMENT_PROMOTION_ID);
  assert.deepEqual(result.results.flatMap((entry) => entry.breakingChanges), []);
});

const assessmentContractPolicy = JSON.parse(fs.readFileSync(assessmentContractPolicyPath, 'utf8'));
const m1010SourceOpenApi = gitJson(
  REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
  'packages/contracts/openapi/v1/openapi.json',
);
const m1010SourceEventCatalog = gitJson(
  REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
  'packages/contracts/events/v1/catalog.json',
);
const m1010Allowance = assessmentContractPolicy.compatibilityPromotion;

function runM1010PromotionWithMutation({ mutateOpenApi, mutateCatalog } = {}) {
  const mutatedOpenApi = structuredClone(m1011SourceOpenApi);
  const mutatedCatalog = structuredClone(m1011SourceEventCatalog);
  mutateOpenApi?.(mutatedOpenApi);
  mutateCatalog?.(mutatedCatalog);
  const openApiChanges = compareContracts('openapi', m1010SourceOpenApi, mutatedOpenApi, {
    allowance: m1010Allowance,
  });
  const eventChanges = compareContracts('events', m1010SourceEventCatalog, mutatedCatalog, {
    allowance: m1010Allowance,
  });
  return { openApiChanges, eventChanges, compatible: openApiChanges.length === 0 && eventChanges.length === 0 };
}

test('M1-010 exact assessment OpenAPI and historical event payload promotion passes from the immutable M1-009 checkpoint', () => {
  assert.deepEqual(validateM1010CompatibilityPolicy(assessmentContractPolicy), []);
  assert.equal(m1010Allowance.id, M1010_ASSESSMENT_PROMOTION_ID);

  const openApiProjection = buildM1010OpenApiExpectedProjection(m1010SourceOpenApi, m1011SourceOpenApi, m1010Allowance);
  assert.ok(openApiProjection, 'frozen-source M1-010 OpenAPI projection must be constructible');
  assert.deepEqual(openApiProjection, m1011SourceOpenApi);
  assert.equal(stableGovernanceSha256(openApiProjection), M1010_OPENAPI_EXPECTED_SEMANTIC_SHA256);
  assert.equal(M1010_OPENAPI_EXPECTED_SEMANTIC_SHA256.length, 64);

  const eventProjection = buildM1010EventExpectedProjection(m1010SourceEventCatalog, m1011SourceEventCatalog, m1010Allowance);
  assert.ok(eventProjection, 'frozen-source M1-010 event projection must be constructible');
  assert.deepEqual(eventProjection, m1011SourceEventCatalog);
  assert.equal(stableGovernanceSha256(eventProjection), M1010_EVENT_EXPECTED_SEMANTIC_SHA256);
  assert.equal(M1010_EVENT_EXPECTED_SEMANTIC_SHA256.length, 64);
  assert.deepEqual(m1011SourceEventCatalog.asyncapi, m1010SourceEventCatalog.asyncapi);

  for (const eventName of M1010_ASSESSMENT_EVENT_NAMES) {
    const event = m1011SourceEventCatalog.events.find((candidate) => candidate.eventName === eventName);
    assert.equal(event.status, 'HISTORICAL_CANDIDATE');
    assert.equal(event['x-p1r-governance'], undefined);
  }
  assert.deepEqual(runM1010PromotionWithMutation(), { openApiChanges: [], eventChanges: [], compatible: true });
});

test('default compatibility remains strict for M1-010 OpenAPI and event changes', () => {
  assert.ok(compareContracts('openapi', m1010SourceOpenApi, m1011SourceOpenApi).length > 0);
  assert.ok(compareContracts('events', m1010SourceEventCatalog, m1011SourceEventCatalog).length > 0);
});

test('M1-010 promotion rejects unapproved assessment, authority, event-governance and AsyncAPI drift', () => {
  const openApiMutations = [
    ['extra route', (document) => {
      document.paths['/api/v1/assessment/injected'] = { get: { responses: { 200: { description: 'injected' } } } };
    }],
    ['extra schema', (document) => {
      document.components.schemas.M1010Injected = { type: 'object', additionalProperties: false };
    }],
    ['root metadata drift', (document) => {
      document.info.title = 'injected';
    }],
    ['checkpoint replay weakened', (document) => {
      document.paths['/api/v1/assessment/sessions/{sessionId}/checkpoint'].put['x-checkpoint-concurrency'].sameVersionDifferentDigest = 'REPLAY';
    }],
    ['checkpoint base version removed', (document) => {
      const schema = document.components.schemas.B10AssessmentSessionCheckpointRequest;
      schema.required = schema.required.filter((field) => field !== 'baseStateVersion');
    }],
    ['PEP trusted fact removed', (document) => {
      document.paths['/api/v1/assessment/sessions'].post['x-authorization'].trustedFacts.pop();
    }],
    ['client score injection', (document) => {
      document.components.schemas.B10AttemptSubmission.properties.score = { type: 'number' };
    }],
    ['report mastery ownership', (document) => {
      document.components.schemas.B10AssessmentReport.properties.mastery = { type: 'number' };
    }],
    ['anti-cheat authority promotion', (document) => {
      document.paths['/api/v1/exam/sessions/{sessionId}/anti-cheat-events'].post['x-p1r-assessment-legacy'].authority = 'AUTHORITATIVE';
    }],
  ];
  for (const [label, mutateOpenApi] of openApiMutations) {
    const result = runM1010PromotionWithMutation({ mutateOpenApi });
    assert.equal(result.compatible, false, `${label} unexpectedly passed`);
    assert.ok(result.openApiChanges.length > 0, `${label} produced no OpenAPI evidence`);
  }

  const eventMutations = [
    ['canonical status promotion', (catalog) => {
      catalog.events.find((event) => event.eventName === 'assessment.attempt.assessed.v1').status = 'CANONICAL_D2';
    }],
    ['governance injection', (catalog) => {
      catalog.events.find((event) => event.eventName === 'assessment.attempt.assessed.v1')['x-p1r-governance'] = {};
    }],
    ['AsyncAPI channel injection', (catalog) => {
      catalog.asyncapi.channels.m1010Injected = { address: 'assessment.injected.v1', messages: {} };
    }],
    ['raw response leak', (catalog) => {
      catalog.payloadSchemas.B10AssessmentAttemptSubmitted.properties.rawResponse = { type: 'string' };
    }],
    ['safe digest removal', (catalog) => {
      const schema = catalog.payloadSchemas.B10AssessmentAttemptSubmitted;
      schema.required = schema.required.filter((field) => field !== 'submissionDigest');
    }],
    ['non-objective event outcome', (catalog) => {
      catalog.payloadSchemas.B10AssessmentAttemptAssessed.properties.outcomeKind.enum = ['OBJECTIVE', 'SELF_RATING'];
    }],
  ];
  for (const [label, mutateCatalog] of eventMutations) {
    const result = runM1010PromotionWithMutation({ mutateCatalog });
    assert.equal(result.compatible, false, `${label} unexpectedly passed`);
    assert.ok(result.eventChanges.length > 0, `${label} produced no event evidence`);
  }
});

test('M1-010 policy remains frozen inside the full M1-012 fixed-baseline chain', () => {
  for (const mutate of [
    (policy) => { policy.compatibilityPromotion.sourceContractBaseline = 'f'.repeat(40); },
    (policy) => { policy.compatibilityPromotion.previousPromotion = 'M1-008_CONTENT_LIFECYCLE_PROMOTION'; },
    (policy) => { policy.compatibilityPromotion.runtimeStatus = 'RUNTIME_VERIFIED'; },
    (policy) => { policy.compatibilityPromotion.eventCatalogDecision = 'CANONICAL_PROMOTION'; },
    (policy) => { policy.compatibilityPromotion.historicalEventFragment = 'packages/contracts/events/v1/catalog.json'; },
  ]) {
    const mutated = structuredClone(assessmentContractPolicy);
    mutate(mutated);
    assert.ok(validateM1010CompatibilityPolicy(mutated).length > 0);
  }

  const result = runGitBaselineCompatibility({
    ref: REQUIRED_CI_CONTRACT_BASELINE_REF,
    governanceRef: EXPECTED_EVENT_GOVERNANCE_BASELINE_REF,
    kind: 'all',
  });
  assert.equal(result.compatible, true);
  assert.equal(result.promotion.id, M1012_PLACEMENT_PROMOTION_ID);
  assert.equal(result.promotion.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(result.results.find((entry) => entry.kind === 'openapi').promotion.id, M1012_PLACEMENT_PROMOTION_ID);
  assert.equal(result.results.find((entry) => entry.kind === 'events').promotion.id, M1012_PLACEMENT_PROMOTION_ID);
  assert.deepEqual(result.results.flatMap((entry) => entry.breakingChanges), []);

  const mutatedB26 = structuredClone(b26Runtime);
  mutatedB26.eventRouting.push(structuredClone(mutatedB26.eventRouting[0]));
  const readFile = (filePath) => path.resolve(filePath) === path.resolve(b26RuntimePath)
    ? JSON.stringify(mutatedB26)
    : fs.readFileSync(filePath, 'utf8');
  const b26Drift = runGitBaselineCompatibility({
    ref: REQUIRED_CI_CONTRACT_BASELINE_REF,
    governanceRef: EXPECTED_EVENT_GOVERNANCE_BASELINE_REF,
    kind: 'events',
    readFile,
  });
  assert.equal(b26Drift.compatible, false);
  assert.ok(b26Drift.results[0].breakingChanges.some((change) => change.location.startsWith('b26.')));
});

const m1011SourceOpenApi = gitJson(
  REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
  'packages/contracts/openapi/v1/openapi.json',
);
const m1011SourceEventCatalog = gitJson(
  REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
  'packages/contracts/events/v1/catalog.json',
);
const m1011SourceB26 = gitJson(
  REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
  'config/b26-event-runtime.json',
);
const m1012SourceOpenApi = gitJson(
  REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
  'packages/contracts/openapi/v1/openapi.json',
);
const m1012SourceEventCatalog = gitJson(
  REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
  'packages/contracts/events/v1/catalog.json',
);
const m1012SourceB26 = gitJson(
  REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
  'config/b26-event-runtime.json',
);
const learnerPlanningContractPolicy = JSON.parse(fs.readFileSync(learnerPlanningContractPolicyPath, 'utf8'));
const m1011Allowance = learnerPlanningContractPolicy.compatibilityPromotion;

function m1011ExpectedOpenApiProjection(approved = m1012SourceOpenApi) {
  const projection = buildM1011OpenApiExpectedProjection(m1011SourceOpenApi, approved, m1011Allowance);
  assert.ok(projection, 'frozen-source M1-011 OpenAPI projection must be constructible');
  return projection;
}

function m1011ExpectedEventProjection(approved = m1012SourceEventCatalog) {
  const projection = buildM1011EventExpectedProjection(m1011SourceEventCatalog, approved, m1011Allowance);
  assert.ok(projection, 'frozen-source M1-011 event projection must be constructible');
  return projection;
}

function m1011ExpectedB26Projection(approved = m1012SourceB26) {
  const projection = buildM1011B26ExpectedProjection(m1011SourceB26, approved, m1011Allowance);
  assert.ok(projection, 'frozen-source M1-011 B26 projection must be constructible');
  return projection;
}

function runM1011PromotionWithMutation({ mutateOpenApi, mutateCatalog, mutateB26 } = {}) {
  const mutatedOpenApi = m1011ExpectedOpenApiProjection();
  const mutatedCatalog = m1011ExpectedEventProjection();
  const mutatedB26 = m1011ExpectedB26Projection();
  mutateOpenApi?.(mutatedOpenApi);
  mutateCatalog?.(mutatedCatalog);
  mutateB26?.(mutatedB26);
  const openApiChanges = compareContracts('openapi', m1011SourceOpenApi, mutatedOpenApi, {
    allowance: m1011Allowance,
  });
  const eventChanges = compareContracts('events', m1011SourceEventCatalog, mutatedCatalog, {
    allowance: m1011Allowance,
  });
  const b26Changes = compareB26WorkflowGovernance(m1011SourceB26, mutatedB26, {
    allowance: m1011Allowance,
  });
  return {
    openApiChanges,
    eventChanges,
    b26Changes,
    compatible: openApiChanges.length === 0 && eventChanges.length === 0 && b26Changes.length === 0,
  };
}

test('M1-011 exact static contract promotion has frozen source, descriptors and semantic projections', () => {
  assert.deepEqual(validateM1011CompatibilityPolicy(learnerPlanningContractPolicy), []);
  assert.equal(m1011Allowance.id, M1011_LEARNER_PLANNING_PROMOTION_ID);
  assert.equal(m1011Allowance.runtimeStatus, 'NOT_RUNTIME_VERIFIED');

  const openApiProjection = m1011ExpectedOpenApiProjection();
  assert.deepEqual(openApiProjection, m1012SourceOpenApi);
  assert.equal(stableGovernanceSha256(openApiProjection), M1011_OPENAPI_EXPECTED_SEMANTIC_SHA256);
  assert.equal(M1011_OPENAPI_EXPECTED_SEMANTIC_SHA256.length, 64);
  const sortDescriptor = (left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right));
  assert.deepEqual(
    compareM1011OpenApiDescriptors(m1011SourceOpenApi, m1012SourceOpenApi)
      .map((change) => [change.location, change.reason])
      .sort(sortDescriptor),
    [...M1011_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS].sort(sortDescriptor),
  );

  const eventProjection = m1011ExpectedEventProjection();
  assert.deepEqual(eventProjection, m1012SourceEventCatalog);
  assert.equal(stableGovernanceSha256(eventProjection), M1011_EVENT_EXPECTED_SEMANTIC_SHA256);
  assert.equal(M1011_EVENT_EXPECTED_SEMANTIC_SHA256.length, 64);
  assert.deepEqual(
    compareContracts('events', m1011SourceEventCatalog, m1012SourceEventCatalog).map((change) => [change.location, change.reason]),
    M1011_EVENT_EXPECTED_CHANGE_DESCRIPTORS,
  );

  const b26Projection = m1011ExpectedB26Projection();
  assert.deepEqual(b26Projection, m1012SourceB26);
  assert.equal(stableGovernanceSha256(b26Projection), M1011_B26_EXPECTED_SEMANTIC_SHA256);
  assert.equal(M1011_B26_EXPECTED_SEMANTIC_SHA256.length, 64);
  assert.deepEqual(runM1011PromotionWithMutation(), {
    openApiChanges: [],
    eventChanges: [],
    b26Changes: [],
    compatible: true,
  });
});

test('default compatibility remains strict for M1-011 OpenAPI and event changes', () => {
  assert.ok(compareContracts('openapi', m1011SourceOpenApi, m1012SourceOpenApi).length > 0);
  assert.ok(compareContracts('events', m1011SourceEventCatalog, m1012SourceEventCatalog).length > 0);
});

test('M1-011 promotion rejects unapproved learner-planning, canonical-event and B26 drift', () => {
  const openApiMutations = [
    ['extra learner path', (document) => {
      document.paths['/api/v1/learner/injected'] = { get: { responses: { 200: { description: 'injected' } } } };
    }],
    ['extra OpenAPI root extension', (document) => {
      document['x-m1011-injected'] = { status: 'not-approved' };
    }],
    ['extra operation on an approved learner path', (document) => {
      document.paths['/api/v1/learner/targets'].post = structuredClone(document.paths['/api/v1/learner/targets'].put);
      document.paths['/api/v1/learner/targets'].post.operationId = 'postM1011InjectedTarget';
    }],
    ['extra learner schema', (document) => {
      document.components.schemas.M1011Injected = { type: 'object', additionalProperties: false };
    }],
    ['If-Match exact decimal guard weakened', (document) => {
      document.components.parameters.B9IfMatch.schema.pattern = '^.*$';
    }],
    ['If-Match operation binding removed', (document) => {
      delete document.paths['/api/v1/learner/profile'].patch['x-concurrency'];
    }],
    ['canonical same key with different payload is allowed', (document) => {
      document.paths['/api/v1/learner/targets'].put['x-idempotency'].sameKeyDifferentPayload = 'ALLOW_NEW_COMMAND';
    }],
    ['legacy same key with different payload is allowed', (document) => {
      document.paths['/api/v1/onboarding/goals/first'].post['x-idempotency'].sameKeyDifferentPayload = 'ALLOW_NEW_COMMAND';
    }],
    ['B1 expectedVersion minimum is tightened', (document) => {
      document.components.schemas.B1OnboardingProfileRequest.properties.expectedVersion.minimum = 1;
    }],
    ['profile targetGoal reject guard removed', (document) => {
      delete document.components.schemas.B9LearnerProfilePatch.not;
    }],
    ['profile targetGoal 422 response removed', (document) => {
      delete document.paths['/api/v1/learner/profile'].patch.responses['422'];
    }],
    ['planning eligibility version pin removed', (document) => {
      document.components.schemas.B9PlanningInputSnapshot.required = document.components.schemas.B9PlanningInputSnapshot.required
        .filter((field) => field !== 'eligibilitySnapshotVersion');
    }],
    ['planning eligibility digest is weakened', (document) => {
      document.components.schemas.B9PlanningInputSnapshot.properties.eligibilitySnapshotDigest.maxLength = 128;
    }],
    ['planning eligibility source mapping removed', (document) => {
      delete document.components.schemas.B9PlanningInputSnapshot['x-source-mapping'].iamEligibility;
    }],
    ['goal catalog expansion', (document) => {
      document.components.schemas.B9PlanningInputSnapshot.properties.dailyQuotaMinutes.enum.push(60);
    }],
    ['recovery identity removed', (document) => {
      document.paths['/api/v1/learner/first-day/recovery/{recoveryTaskId}'].get.parameters = [];
    }],
    ['first-day branch weakened', (document) => {
      document.components.schemas.B9FirstDayProjection.allOf[1].oneOf[0].required.pop();
    }],
    ['READY branch allows zero tasks', (document) => {
      document.components.schemas.B9FirstDayProjection.allOf[1].oneOf[2].properties.tasks.minItems = 0;
    }],
    ['DEGRADED branch accepts a reason alias', (document) => {
      document.components.schemas.B9FirstDayProjection.allOf[1].oneOf[3].properties.reason = { type: 'string' };
    }],
    ['plan input binding drift', (document) => {
      document.components.schemas.B9PlanReference['x-input-binding'].planningInputPinVersion = 'MAY_DIFFER_FROM_PLANNING_INPUT_PIN_VERSION';
    }],
    ['processing job status widened', (document) => {
      document.components.schemas.B9FirstDayProjection.allOf[1].oneOf[1]
        .properties.job.allOf[1].properties.status.enum.push('FAILED');
    }],
    ['degraded recovery status widened', (document) => {
      document.components.schemas.B9FirstDayProjection.allOf[1].oneOf[3]
        .properties.recovery.allOf[1].properties.status.enum.push('COMPLETED');
    }],
    ['first-day cross-reference consistency removed', (document) => {
      document.components.schemas.B9FirstDayProjectionCommon['x-consistency'].pop();
    }],
  ];
  for (const [label, mutateOpenApi] of openApiMutations) {
    const result = runM1011PromotionWithMutation({ mutateOpenApi });
    assert.equal(result.compatible, false, `${label} unexpectedly passed`);
    assert.ok(result.openApiChanges.length > 0, `${label} produced no OpenAPI evidence`);
  }

  const eventMutations = [
    ['canonical status demotion', (catalog) => {
      catalog.events.find((event) => event.eventName === 'learner.target.updated.v1').status = 'HISTORICAL_CANDIDATE';
    }],
    ['target goal expansion', (catalog) => {
      catalog.payloadSchemas.B9LearnerTargetUpdated.properties.goalCode.enum.push('INJECTED');
    }],
    ['AsyncAPI operation injection', (catalog) => {
      catalog.asyncapi.operations.m1011Injected = structuredClone(catalog.asyncapi.operations.publish_learner_target_updated_v1);
    }],
    ['first-day historical compatibility drift', (catalog) => {
      catalog.payloadSchemas.B9LearnerFirstDayProjected.properties.readiness.enum = ['READY'];
    }],
    ['ONB closure regression', (catalog) => {
      catalog['x-p1r-event-governance'].plannedClosures
        .find((entry) => entry.gapId === 'EVENT-GAP-ONB-001').status = 'PLANNED';
    }],
  ];
  for (const [label, mutateCatalog] of eventMutations) {
    const result = runM1011PromotionWithMutation({ mutateCatalog });
    assert.equal(result.compatible, false, `${label} unexpectedly passed`);
    assert.ok(result.eventChanges.length > 0, `${label} produced no event evidence`);
  }

  const b26Mutations = [
    ['learner topic owner drift', (runtime) => {
      runtime.topics.find((topic) => topic.name === 'platform.learner.v1').ownerService = 'workflow-service';
    }],
    ['learner route consumer drift', (runtime) => {
      runtime.eventRouting.find((route) => route.eventName === 'learner.target.updated.v1').consumerGroups.pop();
    }],
    ['extra learner route', (runtime) => {
      runtime.eventRouting.push({
        eventName: 'learner.target.injected.v1',
        topic: 'platform.learner.v1',
        partitionKey: 'aggregateId',
        consumerGroups: ['cg.learning-from-learner.v1'],
      });
    }],
  ];
  for (const [label, mutateB26] of b26Mutations) {
    const result = runM1011PromotionWithMutation({ mutateB26 });
    assert.equal(result.compatible, false, `${label} unexpectedly passed`);
    assert.ok(result.b26Changes.length > 0, `${label} produced no B26 evidence`);
  }
});

test('M1-011 policy and full fixed-baseline chain fail closed while remaining static only', () => {
  for (const mutate of [
    (policy) => { policy.compatibilityPromotion.sourceContractBaseline = 'f'.repeat(40); },
    (policy) => { policy.compatibilityPromotion.previousPromotion = 'M1-009_MEDIA_CONTRACT_PROMOTION'; },
    (policy) => { policy.compatibilityPromotion.runtimeStatus = 'RUNTIME_VERIFIED'; },
    (policy) => { policy.compatibilityPromotion.scope = 'OPENAPI_ONLY'; },
    (policy) => { policy.compatibilityPromotion.eventCatalogDecision = 'PROMOTE_ALL_LEARNER_EVENTS'; },
    (policy) => { policy.compatibilityPromotion.canonicalFragment = 'packages/contracts/openapi/v1/openapi.json'; },
    (policy) => { policy.compatibilityPromotion.unexpectedPromotionFlag = true; },
    (policy) => { policy.planningInput.requiredFields = policy.planningInput.requiredFields.filter((field) => field !== 'eligibilitySnapshotVersion'); },
    (policy) => { policy.planningInput.eligibilitySnapshotDigest.maxLength = 128; },
    (policy) => { policy.planningInput.forbiddenFields = policy.planningInput.forbiddenFields.filter((field) => field !== 'adultGate'); },
    (policy) => { policy.concurrency.ifMatchParameter.schema.pattern = '^.*$'; },
    (policy) => { policy.canonicalRoutes.find((route) => route.operationId === 'putB9LearnerTarget').idempotencyPolicy.sameKeyDifferentPayload = 'ALLOW_NEW_COMMAND'; },
    (policy) => { policy.legacyCompatibility.find((route) => route.operationId === 'createB1FirstGoal').idempotencyPolicy.sameKeyDifferentPayload = 'ALLOW_NEW_COMMAND'; },
    (policy) => { policy.goalCatalog.legacyB1TargetMapping.expectedVersionSchema.minimum = 1; },
    (policy) => { delete policy.goalCatalog.profileTargetGoal.patchNot; },
    (policy) => { policy.goalCatalog.profileTargetGoal.patchResponseStatus = '409'; },
    (policy) => { policy.firstDay.statePolicies.find((state) => state.state === 'READY').tasks.minItems = 0; },
    (policy) => { policy.firstDay.statePolicies.find((state) => state.state === 'DEGRADED').required.push('reason'); },
  ]) {
    const mutated = structuredClone(learnerPlanningContractPolicy);
    mutate(mutated);
    assert.ok(validateM1011CompatibilityPolicy(mutated).length > 0);
  }

  const result = runGitBaselineCompatibility({
    ref: REQUIRED_CI_CONTRACT_BASELINE_REF,
    governanceRef: EXPECTED_EVENT_GOVERNANCE_BASELINE_REF,
    kind: 'all',
  });
  assert.equal(result.compatible, true);
  assert.equal(result.promotion.id, M1012_PLACEMENT_PROMOTION_ID);
  assert.equal(result.promotion.sourceContractBaseline, REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF);
  assert.equal(result.promotion.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(result.results.find((entry) => entry.kind === 'openapi').promotion.id, M1012_PLACEMENT_PROMOTION_ID);
  assert.equal(result.results.find((entry) => entry.kind === 'events').promotion.id, M1012_PLACEMENT_PROMOTION_ID);
  assert.deepEqual(result.results.flatMap((entry) => entry.breakingChanges), []);
});

const placementContractPolicy = JSON.parse(fs.readFileSync(placementContractPolicyPath, 'utf8'));
const m1012Allowance = placementContractPolicy.compatibilityPromotion;

function m1012ExpectedOpenApiProjection(approved = openApi) {
  const projection = buildM1012OpenApiExpectedProjection(m1012SourceOpenApi, approved, m1012Allowance);
  assert.ok(projection, 'frozen-source M1-012 OpenAPI projection must be constructible');
  return projection;
}

function m1012ExpectedEventProjection(approved = eventCatalog) {
  const projection = buildM1012EventExpectedProjection(m1012SourceEventCatalog, approved, m1012Allowance);
  assert.ok(projection, 'frozen-source M1-012 event projection must be constructible');
  return projection;
}

function m1012ExpectedB26Projection(approved = b26Runtime) {
  const projection = buildM1012B26ExpectedProjection(m1012SourceB26, approved, m1012Allowance);
  assert.ok(projection, 'frozen-source M1-012 B26 projection must be constructible');
  return projection;
}

function runM1012PromotionWithMutation({ mutateOpenApi, mutateCatalog, mutateB26 } = {}) {
  const mutatedOpenApi = m1012ExpectedOpenApiProjection();
  const mutatedCatalog = m1012ExpectedEventProjection();
  const mutatedB26 = m1012ExpectedB26Projection();
  mutateOpenApi?.(mutatedOpenApi);
  mutateCatalog?.(mutatedCatalog);
  mutateB26?.(mutatedB26);
  const openApiChanges = compareContracts('openapi', m1012SourceOpenApi, mutatedOpenApi, {
    allowance: m1012Allowance,
  });
  const eventChanges = compareContracts('events', m1012SourceEventCatalog, mutatedCatalog, {
    allowance: m1012Allowance,
  });
  const b26Changes = compareB26WorkflowGovernance(m1012SourceB26, mutatedB26, {
    allowance: m1012Allowance,
  });
  return {
    openApiChanges,
    eventChanges,
    b26Changes,
    compatible: openApiChanges.length === 0 && eventChanges.length === 0 && b26Changes.length === 0,
  };
}

test('M1-012 exact placement promotion rebuilds the only approved source-derived projection', () => {
  assert.deepEqual(validateM1012CompatibilityPolicy(placementContractPolicy), []);
  assert.equal(m1012Allowance.id, M1012_PLACEMENT_PROMOTION_ID);
  assert.equal(m1012Allowance.sourceContractBaseline, REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF);
  assert.equal(m1012Allowance.runtimeStatus, 'NOT_RUNTIME_VERIFIED');

  const sortDescriptor = (left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right));
  const openApiProjection = m1012ExpectedOpenApiProjection();
  assert.deepEqual(openApiProjection, openApi);
  assert.equal(stableGovernanceSha256(openApiProjection), M1012_OPENAPI_EXPECTED_SEMANTIC_SHA256);
  assert.equal(M1012_OPENAPI_EXPECTED_SEMANTIC_SHA256.length, 64);
  assert.deepEqual(
    compareM1012OpenApiDescriptors(m1012SourceOpenApi, openApi)
      .map((change) => [change.location, change.reason])
      .sort(sortDescriptor),
    [...M1012_OPENAPI_EXPECTED_CHANGE_DESCRIPTORS].sort(sortDescriptor),
  );

  const eventProjection = m1012ExpectedEventProjection();
  assert.deepEqual(eventProjection, eventCatalog);
  assert.equal(stableGovernanceSha256(eventProjection), M1012_EVENT_EXPECTED_SEMANTIC_SHA256);
  assert.equal(M1012_EVENT_EXPECTED_SEMANTIC_SHA256.length, 64);
  assert.deepEqual(
    compareM1012EventDescriptors(m1012SourceEventCatalog, eventCatalog)
      .map((change) => [change.location, change.reason])
      .sort(sortDescriptor),
    [...M1012_EVENT_EXPECTED_CHANGE_DESCRIPTORS].sort(sortDescriptor),
  );

  const b26Projection = m1012ExpectedB26Projection();
  assert.deepEqual(b26Projection, b26Runtime);
  assert.equal(stableGovernanceSha256(b26Projection), M1012_B26_EXPECTED_SEMANTIC_SHA256);
  assert.equal(M1012_B26_EXPECTED_SEMANTIC_SHA256.length, 64);
  assert.deepEqual(runM1012PromotionWithMutation(), {
    openApiChanges: [],
    eventChanges: [],
    b26Changes: [],
    compatible: true,
  });
});

test('M1-012 promotion rejects non-allowlisted placement OpenAPI, event and B26 drift', () => {
  const openApiMutations = [
    ['extra placement route', (document) => {
      document.paths['/api/v1/assessment/placement/injected'] = { get: { responses: { 200: { description: 'injected' } } } };
    }],
    ['extra placement schema', (document) => {
      document.components.schemas.B10PlacementInjected = { type: 'object', additionalProperties: false };
    }],
    ['canonical placement route operation drift', (document) => {
      document.paths['/api/v1/assessment/placement/sessions'].post.operationId = 'injectedPlacementSession';
    }],
    ['B1 adapter deprecation removed', (document) => {
      document.paths['/api/v1/assessment/placement/skip'].post.deprecated = false;
    }],
    ['B1 adapter service-side deny drift', (document) => {
      document.paths['/api/v1/assessment/placement/submit-step'].post['x-authorization'].defaultDecision = 'ALLOW';
    }],
    ['B10 requested-level authority drift', (document) => {
      document.components.schemas.B10RequestedStartingLevel.properties.authority.const = 'AUTHORITATIVE';
    }],
    ['B10 plan-effect key drift', (document) => {
      document.components.schemas.B10PlacementResult.allOf[0]['x-p1r-placement-plan-saga'].effectDedupeKey.pop();
    }],
    ['placement dimension order drift', (document) => {
      document.components.schemas.B10PlacementResult.allOf[0].properties.dimensionSummaries['x-p1r-exact-order'].reverse();
    }],
    ['placement dimension uniqueness drift', (document) => {
      delete document.components.schemas.B10PlacementResult.allOf[0].properties.dimensionSummaries['x-unique-by'];
    }],
    ['planning raw authority leak', (document) => {
      document.components.schemas.B9PlanningInputSnapshot['x-forbidden-fields'] = document.components.schemas.B9PlanningInputSnapshot['x-forbidden-fields']
        .filter((field) => field !== 'placementRaw');
    }],
    ['first-day degradedReason alias injected', (document) => {
      document.components.schemas.B9FirstDayProjection.allOf[1].oneOf[3].properties.reason = { type: 'string' };
    }],
  ];
  for (const [label, mutateOpenApi] of openApiMutations) {
    const result = runM1012PromotionWithMutation({ mutateOpenApi });
    assert.equal(result.compatible, false, `${label} unexpectedly passed`);
    assert.ok(result.openApiChanges.length > 0, `${label} produced no OpenAPI evidence`);
  }

  const eventMutations = [
    ['extra event', (catalog) => {
      catalog.events.push({ eventName: 'assessment.placement.injected.v1', version: 1 });
    }],
    ['payload lineage leak', (catalog) => {
      catalog.payloadSchemas.B10PlacementCompleted.properties.sourceEventId = { type: 'string' };
    }],
    ['SKIPPED score leak', (catalog) => {
      const skipped = catalog.payloadSchemas.B10PlacementCompleted.oneOf
        .find((branch) => branch.properties?.resultKind?.const === 'SKIPPED');
      skipped.properties.aggregateScore = { type: 'integer', minimum: 0, maximum: 100 };
    }],
    ['LOW dimension zero coverage rejected', (catalog) => {
      const coverage = catalog.payloadSchemas.B10PlacementCompleted.properties.dimensionSummaries
        .prefixItems[0].properties.coverageRatio;
      delete coverage.minimum;
      coverage.exclusiveMinimum = 0;
    }],
    ['AsyncAPI channel injection', (catalog) => {
      catalog.asyncapi.channels.m1012Injected = { address: 'assessment.placement.injected.v1', messages: {} };
    }],
    ['AsyncAPI operation injection', (catalog) => {
      catalog.asyncapi.operations.m1012Injected = structuredClone(catalog.asyncapi.operations.publish_assessment_placement_completed_v1);
    }],
  ];
  for (const [label, mutateCatalog] of eventMutations) {
    const result = runM1012PromotionWithMutation({ mutateCatalog });
    assert.equal(result.compatible, false, `${label} unexpectedly passed`);
    assert.ok(result.eventChanges.length > 0, `${label} produced no event evidence`);
  }

  for (const [label, mutateB26] of [
    ['assessment topic owner drift', (runtime) => {
      runtime.topics.find((topic) => topic.name === 'platform.assessment.v1').ownerService = 'workflow-service';
    }],
    ['placement route consumer drift', (runtime) => {
      runtime.eventRouting.find((route) => route.eventName === 'assessment.placement.completed.v1').consumerGroups.pop();
    }],
    ['extra placement route', (runtime) => {
      runtime.eventRouting.push({
        eventName: 'assessment.placement.injected.v1',
        topic: 'platform.assessment.v1',
        partitionKey: 'aggregateId',
        consumerGroups: ['cg.learning-from-assessment.v1'],
      });
    }],
  ]) {
    const result = runM1012PromotionWithMutation({ mutateB26 });
    assert.equal(result.compatible, false, `${label} unexpectedly passed`);
    assert.ok(result.b26Changes.length > 0, `${label} produced no B26 evidence`);
  }
});

test('M1-012 policy and full fixed-baseline chain remain fail-closed and static-only', () => {
  for (const mutate of [
    (policy) => { policy.compatibilityPromotion.sourceContractBaseline = 'f'.repeat(40); },
    (policy) => { policy.compatibilityPromotion.previousPromotion = 'M1-010_ASSESSMENT_CONTRACT_PROMOTION'; },
    (policy) => { policy.compatibilityPromotion.runtimeStatus = 'RUNTIME_VERIFIED'; },
    (policy) => { policy.compatibilityPromotion.eventFragment = 'packages/contracts/events/v1/catalog.json'; },
    (policy) => { policy.compatibilityPromotion.unexpectedPromotionFlag = true; },
    (policy) => { policy.completionEvent.status = 'RUNTIME_VERIFIED'; },
    (policy) => { policy.contractIntegration.canonicalRoutes[0].operationId = 'injectedPlacementRoute'; },
    (policy) => { policy.learnerPlanningSuccessor.placementBaselineSchema = 'UnpinnedPlacementBaseline'; },
  ]) {
    const mutated = structuredClone(placementContractPolicy);
    mutate(mutated);
    assert.ok(validateM1012CompatibilityPolicy(mutated).length > 0);
  }

  const result = runGitBaselineCompatibility({
    ref: REQUIRED_CI_CONTRACT_BASELINE_REF,
    governanceRef: EXPECTED_EVENT_GOVERNANCE_BASELINE_REF,
    kind: 'all',
  });
  assert.equal(result.compatible, true);
  assert.equal(result.promotion.id, M1012_PLACEMENT_PROMOTION_ID);
  assert.equal(result.promotion.sourceContractBaseline, REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF);
  assert.equal(result.promotion.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(result.results.find((entry) => entry.kind === 'openapi').promotion.id, M1012_PLACEMENT_PROMOTION_ID);
  assert.equal(result.results.find((entry) => entry.kind === 'events').promotion.id, M1012_PLACEMENT_PROMOTION_ID);
  assert.deepEqual(result.results.flatMap((entry) => entry.breakingChanges), []);
});

test('M1-008 source baseline reaches the current M1-012 projection with immutable governance attached', () => {
  const result = runM1008PromotionWithMutation();
  assert.equal(result.compatible, true);
  assert.equal(result.governanceBaseline.commit, EXPECTED_EVENT_GOVERNANCE_BASELINE_REF);
  assert.deepEqual(result.promotion, {
    id: M1012_PLACEMENT_PROMOTION_ID,
    sourceContractBaseline: REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    previousPromotion: M1011_LEARNER_PLANNING_PROMOTION_ID,
    previousPromotionSource: REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    immutableGovernanceBaseline: EXPECTED_EVENT_GOVERNANCE_BASELINE_REF,
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    scope: 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC',
  });
  assert.deepEqual(result.results[0].breakingChanges, []);
  assert.deepEqual(eventCatalog.payloadSchemas.B9ContentVersionReviewed, M1008_REVIEWED_EVENT_PAYLOAD_SCHEMA);
  assert.deepEqual(
    eventCatalog.events.find((event) => event.eventName === 'content.version.reviewed.v1').compatibility,
    M1008_REVIEWED_EVENT_COMPATIBILITY,
  );
});

test('default compareContracts remains strict for the M1-008 promotion', () => {
  const sourceCatalog = gitJson(
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/events/v1/catalog.json',
  );
  const changes = compareContracts('events', sourceCatalog, eventCatalog);
  assert.ok(changes.some((change) => change.location === 'content.version.submitted.v1.status'));
  assert.ok(changes.some((change) => change.location === 'content.version.published.v1.x-envelope-required'));
});

test('M1-008 promotion fails closed for extra event/status/topic/group/channel/operation/route', () => {
  const mutations = [
    ['extra event', (catalog) => {
      catalog.events.push({
        ...structuredClone(catalog.events[0]),
        eventName: 'content.version.injected.v1',
      });
    }],
    ['status drift', (catalog) => {
      catalog.events.find((event) => event.eventName === 'workflow.outbox.published.v1').status = 'HISTORICAL_CANDIDATE';
    }],
    ['topic drift', (catalog) => {
      catalog.events.find((event) => event.eventName === M1008_CONTENT_EVENT_NAMES[0])['x-p1r-governance'].transport.topic = 'platform.injected.v1';
    }],
    ['consumer group drift', (catalog) => {
      catalog.events.find((event) => event.eventName === M1008_CONTENT_EVENT_NAMES[0])['x-p1r-governance'].consumers.push({
        service: 'analytics-service',
        consumerGroup: 'cg.analytics-injected.v1',
        subscriptionOperationId: 'subscribe_injected',
      });
    }],
    ['extra channel', (catalog) => {
      catalog.asyncapi.channels.injected_channel = structuredClone(catalog.asyncapi.channels[M1008_CONTENT_EVENT_NAMES[0].replaceAll('.', '_')]);
    }],
    ['extra operation', (catalog) => {
      catalog.asyncapi.operations.injected_operation = structuredClone(catalog.asyncapi.operations.publish_content_version_submitted_v1);
    }],
    ['reviewed event content hash removed', (catalog) => {
      const payload = catalog.payloadSchemas.B9ContentVersionReviewed;
      payload.required = payload.required.filter((field) => field !== 'contentHash');
      delete payload.properties.contentHash;
    }],
    ['reviewed event content hash weakened', (catalog) => {
      catalog.payloadSchemas.B9ContentVersionReviewed.properties.contentHash.pattern = '^.*$';
    }],
    ['reviewed event audit binding removed', (catalog) => {
      const payload = catalog.payloadSchemas.B9ContentVersionReviewed;
      payload.required = payload.required.filter((field) => field !== 'auditId');
      delete payload.properties.auditId;
    }],
    ['extra route', (_catalog) => {
      // B26 is mutated by the paired mutator below; this branch is only a marker.
    }],
  ];
  for (const [label, mutateCatalog] of mutations) {
    const result = label === 'extra route'
      ? runM1008PromotionWithMutation({
        mutateB26: (runtime) => runtime.eventRouting.push({
          eventName: 'content.version.injected.v1',
          topic: 'platform.content.v1',
          partitionKey: 'aggregateId',
          consumerGroups: ['cg.admin-ops-from-content.v1'],
        }),
      })
      : runM1008PromotionWithMutation({ mutateCatalog });
    assert.equal(result.compatible, false, `${label} unexpectedly passed`);
    assert.ok(result.results[0].breakingChanges.length > 0, `${label} produced no evidence`);
  }
});

test('M1-008 promotion fails closed when policy values or shape are changed', () => {
  for (const mutatePolicy of [
    (policy) => { policy.eventGovernance.compatibilityPromotion.topic = 'platform.injected.v1'; },
    (policy) => { policy.eventGovernance.compatibilityPromotion.eventNames.push('content.version.injected.v1'); },
    (policy) => { policy.eventGovernance.compatibilityPromotion.allowAll = true; },
    (policy) => { policy.eventGovernance.compatibilityPromotion.immutableGovernanceBaseline = 'f'.repeat(40); },
    (policy) => { policy.reviewWorkflow.stageOrder.reverse(); },
    (policy) => { policy.reviewWorkflow.recordProjection.identityConstraint = 'BEST_EFFORT'; },
    (policy) => { policy.publishEligibility.clientFactSubmission = 'ALLOWED'; },
    (policy) => { policy.internalRetirement.externalCommand = 'ALLOWED'; },
    (policy) => { policy.unexpectedPromotionFlag = true; },
  ]) {
    assert.throws(
      () => runM1008PromotionWithMutation({ mutatePolicy }),
      /M1-008 compatibility policy is invalid \(fail closed\)/,
    );
  }
});

test('M1-008 immutable governance is still compared when the requested baseline already has governance', () => {
  const mutatedWorkflowCatalog = structuredClone(eventCatalog);
  mutatedWorkflowCatalog.events.find((event) => event.eventName === 'workflow.outbox.published.v1')['x-p1r-governance'].producer.service = 'audit-service';
  const result = runM1008PromotionWithMutation({
    mutateCatalog: (catalog) => Object.assign(catalog, mutatedWorkflowCatalog),
  });
  assert.equal(result.compatible, false);
  assert.ok(result.results[0].breakingChanges.some((change) => change.location.startsWith('m1-012.eventPromotion')));

  const b26Result = runM1008PromotionWithMutation({
    mutateB26: (runtime) => {
      runtime.topics.find((topic) => topic.name === 'platform.workflow.v1').ownerService = 'audit-service';
    },
  });
  assert.equal(b26Result.compatible, false);
  assert.ok(b26Result.results[0].breakingChanges.some((change) => change.location === 'b26.topics.platform.workflow.v1.ownerService'));
});

test('M1-008 immutable baseline integrity cannot be replaced by a mutable governance blob', () => {
  const sourceOpenApi = gitJson(
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/openapi/v1/openapi.json',
  );
  const sourceCatalog = gitJson(
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/events/v1/catalog.json',
  );
  const sourceB26 = gitJson(
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    'config/b26-event-runtime.json',
  );
  const mediaSourceOpenApi = gitJson(
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/openapi/v1/openapi.json',
  );
  const assessmentSourceOpenApi = gitJson(
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/openapi/v1/openapi.json',
  );
  const assessmentSourceCatalog = gitJson(
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/events/v1/catalog.json',
  );
  const learnerPlanningSourceOpenApi = gitJson(
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/openapi/v1/openapi.json',
  );
  const learnerPlanningSourceCatalog = gitJson(
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/events/v1/catalog.json',
  );
  const learnerPlanningSourceB26 = gitJson(
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    'config/b26-event-runtime.json',
  );
  const placementSourceOpenApi = gitJson(
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/openapi/v1/openapi.json',
  );
  const placementSourceCatalog = gitJson(
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    'packages/contracts/events/v1/catalog.json',
  );
  const placementSourceB26 = gitJson(
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    'config/b26-event-runtime.json',
  );
  const mutatedImmutableCatalog = structuredClone(sourceCatalog);
  mutatedImmutableCatalog.events.find((event) => event.eventName === 'workflow.outbox.published.v1')['x-p1r-governance'].producer.service = 'audit-service';
  const git = (args) => {
    if (args[0] === 'rev-parse') {
      if (args[2] === 'HEAD^{commit}') return 'current-commit';
      if (args[2] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF;
      if (args[2] === `${REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF;
      if (args[2] === `${REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF;
      if (args[2] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF;
      if (args[2] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF;
      if (args[2] === `${EXPECTED_EVENT_GOVERNANCE_BASELINE_REF}^{commit}`) return EXPECTED_EVENT_GOVERNANCE_BASELINE_REF;
    }
    if (args[0] === 'show') {
      if (args[1] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return JSON.stringify(sourceOpenApi);
      if (args[1] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return JSON.stringify(sourceCatalog);
      if (args[1] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}:config/b26-event-runtime.json`) return JSON.stringify(sourceB26);
      if (args[1] === `${REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return JSON.stringify(mediaSourceOpenApi);
      if (args[1] === `${REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return JSON.stringify(assessmentSourceOpenApi);
      if (args[1] === `${REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return JSON.stringify(assessmentSourceCatalog);
      if (args[1] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return JSON.stringify(learnerPlanningSourceOpenApi);
      if (args[1] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return JSON.stringify(learnerPlanningSourceCatalog);
      if (args[1] === `${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF}:config/b26-event-runtime.json`) return JSON.stringify(learnerPlanningSourceB26);
      if (args[1] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return JSON.stringify(placementSourceOpenApi);
      if (args[1] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return JSON.stringify(placementSourceCatalog);
      if (args[1] === `${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF}:config/b26-event-runtime.json`) return JSON.stringify(placementSourceB26);
      if (args[1] === `${EXPECTED_EVENT_GOVERNANCE_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return JSON.stringify(mutatedImmutableCatalog);
      if (args[1] === `${EXPECTED_EVENT_GOVERNANCE_BASELINE_REF}:config/b26-event-runtime.json`) return JSON.stringify(sourceB26);
    }
    throw new Error(`Unexpected git invocation: ${args.join(' ')}`);
  };
  const result = runGitBaselineCompatibility({
    ref: REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    kind: 'events',
    git,
  });
  assert.equal(result.compatible, false);
  assert.ok(result.results[0].breakingChanges.some((change) => change.location === 'workflow.outbox.published.v1.x-p1r-governance'));
});
