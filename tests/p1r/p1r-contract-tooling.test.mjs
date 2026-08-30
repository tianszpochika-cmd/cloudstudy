import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { findCanonicalMergeDrift, mergeEvents, selectEventFragmentFiles } from '../../scripts/contracts/merge-b1-fragments.mjs';
import { buildGeneratedOutputs, findGeneratedOutputDrift } from '../../scripts/contracts/generate-contracts.mjs';
import {
  buildM1008OpenApiExpectedProjection,
  compareContracts,
  M1008_OPENAPI_EXPECTED_SEMANTIC_SHA256,
  M1008_CONTENT_EVENT_NAMES,
  M1008_REVIEWED_EVENT_COMPATIBILITY,
  M1008_REVIEWED_EVENT_PAYLOAD_SCHEMA,
  runCompatibilityDiff,
  stableGovernanceSha256,
} from '../../scripts/contracts/compatibility-diff.mjs';
import {
  hasRequiredCiContractBaseline,
  inspectRequiredCiContractGate,
  REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
  REQUIRED_CI_CONTRACT_COMPATIBILITY_COMMAND,
  REQUIRED_CI_CONTRACT_BASELINE_REF,
  REQUIRED_EVENT_GOVERNANCE_BASELINE_REF,
  runGitBaselineCompatibility,
} from '../../scripts/contracts/compatibility-git-baseline.mjs';
import { validateEventCatalog } from '../../scripts/contracts/validate-contracts.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const openApiPath = path.join(root, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json');
const eventCatalogPath = path.join(root, 'packages', 'contracts', 'events', 'v1', 'catalog.json');
const b26RuntimePath = path.join(root, 'config', 'b26-event-runtime.json');
const contentLifecyclePolicyPath = path.join(root, 'config', 'p1r-content-lifecycle.v1.json');
const openApi = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
const eventCatalog = JSON.parse(fs.readFileSync(eventCatalogPath, 'utf8'));
const b26Runtime = JSON.parse(fs.readFileSync(b26RuntimePath, 'utf8'));
const ciWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const EXPECTED_EVENT_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';

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
    .some((change) => change.location === 'x-p1r-event-governance'));
  assert.ok(deletedGovernance.results[0].breakingChanges
    .some((change) => change.location === `${eventCatalog.events[0].eventName}.status`));

  const synchronizedCatalogDrift = structuredClone(eventCatalog);
  const canonicalEvents = synchronizedCatalogDrift.events.filter((event) => event.status === 'CANONICAL_D2');
  assert.equal(canonicalEvents.length, 7 + M1008_CONTENT_EVENT_NAMES.length);
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
  synchronizedB26Drift.eventRouting[0].partitionKey = 'eventId';
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
  for (const canonical of canonicalEvents) {
    assert.ok(locations.includes(`${canonical.eventName}.x-p1r-governance`));
  }
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
  const git = (args) => {
    if (args[0] === 'rev-parse' && args[2] === 'HEAD^{commit}') return 'current-commit';
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse') return 'baseline-commit';
    if (args[0] === 'show') return currentText;
    throw new Error(`Unexpected git invocation: ${args.join(' ')}`);
  };
  const result = runGitBaselineCompatibility({ ref: 'accepted-contract', kind: 'openapi', git });
  assert.equal(result.compatible, true);
  assert.equal(result.results[0].breakingChanges.length, 0);

  const sameHeadGit = (args) => {
    if (args[0] === 'rev-parse' && args[2] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF;
    if (args[0] === 'rev-parse') return 'current-commit';
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

function m1008ExpectedOpenApiProjection(approved) {
  const projection = buildM1008OpenApiExpectedProjection(m1008SourceOpenApi, approved);
  assert.ok(projection, 'frozen-source M1-008 OpenAPI projection must be constructible');
  return projection;
}

function runM1008OpenApiPromotionWithMutation({ mutateOpenApi } = {}) {
  const mutatedOpenApi = m1008ExpectedOpenApiProjection(openApi);
  mutateOpenApi?.(mutatedOpenApi);
  const readFile = (filePath) => {
    if (path.resolve(filePath) === path.resolve(openApiPath)) return JSON.stringify(mutatedOpenApi);
    return fs.readFileSync(filePath, 'utf8');
  };
  return runGitBaselineCompatibility({
    ref: REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    kind: 'openapi',
    readFile,
  });
}

test('M1-008 exact OpenAPI promotion passes with the frozen projection', () => {
  const expectedProjection = m1008ExpectedOpenApiProjection(openApi);
  assert.deepEqual(expectedProjection, openApi);
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
  const changes = compareContracts('openapi', sourceOpenApi, m1008ExpectedOpenApiProjection(openApi));
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

test('M1-008 exact source-baseline promotion passes with immutable governance attached', () => {
  const result = runM1008PromotionWithMutation();
  assert.equal(result.compatible, true);
  assert.equal(result.governanceBaseline.commit, EXPECTED_EVENT_GOVERNANCE_BASELINE_REF);
  assert.deepEqual(result.promotion, {
    id: 'M1-008_CONTENT_LIFECYCLE_PROMOTION',
    sourceContractBaseline: REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    immutableGovernanceBaseline: EXPECTED_EVENT_GOVERNANCE_BASELINE_REF,
    scope: 'explicit-additive-only',
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
  assert.ok(result.results[0].breakingChanges.some((change) => change.location === 'workflow.outbox.published.v1.x-p1r-governance'));

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
  const mutatedImmutableCatalog = structuredClone(sourceCatalog);
  mutatedImmutableCatalog.events.find((event) => event.eventName === 'workflow.outbox.published.v1')['x-p1r-governance'].producer.service = 'audit-service';
  const git = (args) => {
    if (args[0] === 'rev-parse') {
      if (args[2] === 'HEAD^{commit}') return 'current-commit';
      if (args[2] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}^{commit}`) return REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF;
      if (args[2] === `${EXPECTED_EVENT_GOVERNANCE_BASELINE_REF}^{commit}`) return EXPECTED_EVENT_GOVERNANCE_BASELINE_REF;
    }
    if (args[0] === 'show') {
      if (args[1] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/openapi/v1/openapi.json`) return JSON.stringify(sourceOpenApi);
      if (args[1] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}:packages/contracts/events/v1/catalog.json`) return JSON.stringify(sourceCatalog);
      if (args[1] === `${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF}:config/b26-event-runtime.json`) return JSON.stringify(sourceB26);
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
