import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { findCanonicalMergeDrift, mergeEvents, selectEventFragmentFiles } from '../../scripts/contracts/merge-b1-fragments.mjs';
import { buildGeneratedOutputs, findGeneratedOutputDrift } from '../../scripts/contracts/generate-contracts.mjs';
import { compareContracts, runCompatibilityDiff } from '../../scripts/contracts/compatibility-diff.mjs';
import {
  hasRequiredCiContractBaseline,
  inspectRequiredCiContractGate,
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
  assert.equal(canonicalEvents.length, 7);
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
    assert.ok(locations.includes(`${canonical.eventName}.x-p1r-governance.producer.service`));
    assert.ok(locations.includes(`${canonical.eventName}.x-p1r-governance.producer.dataOwner`));
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
    if (args[0] === 'rev-parse') return 'baseline-commit';
    if (args[0] === 'show') return currentText;
    throw new Error(`Unexpected git invocation: ${args.join(' ')}`);
  };
  const result = runGitBaselineCompatibility({ ref: 'accepted-contract', kind: 'openapi', git });
  assert.equal(result.compatible, true);
  assert.equal(result.results[0].breakingChanges.length, 0);

  const sameHeadGit = (args) => {
    if (args[0] === 'rev-parse') return 'current-commit';
    if (args[0] === 'show') return currentText;
    throw new Error(`Unexpected git invocation: ${args.join(' ')}`);
  };
  assert.throws(
    () => runGitBaselineCompatibility({ ref: 'HEAD', kind: 'openapi', git: sameHeadGit }),
    /resolves to the current HEAD and every selected contract is identical/,
  );
});
