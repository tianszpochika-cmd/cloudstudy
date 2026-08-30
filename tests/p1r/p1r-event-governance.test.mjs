import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  validateEventGovernance,
  validateEventGovernanceData,
  listEventFragments,
} from '../../scripts/audit/p1r-event-governance-check.mjs';
import { projectCanonicalAsyncApi } from '../../scripts/contracts/event-governance-projection.mjs';
import { validateAsyncApiProjection, validateEventCatalog } from '../../scripts/contracts/validate-contracts.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8'));
const fragmentDirectory = path.join(root, 'packages', 'contracts', 'events', 'v1', 'fragments');

const baseline = {
  catalog: readJson('packages/contracts/events/v1/catalog.json'),
  ownerPolicy: readJson('config/p1r-data-ownership.v1.json'),
  b26Runtime: readJson('config/b26-event-runtime.json'),
  fragments: fs.readdirSync(fragmentDirectory)
    .filter((name) => name.endsWith('.events.json'))
    .sort()
    .map((name) => ({
      path: `packages/contracts/events/v1/fragments/${name}`,
      data: JSON.parse(fs.readFileSync(path.join(fragmentDirectory, name), 'utf8')),
    })),
};

function canonical(input, index = 0) {
  return input.catalog.events.filter((event) => event.status === 'CANONICAL_D2')[index];
}

function historical(input) {
  return input.catalog.events.find((event) => event.status === 'HISTORICAL_CANDIDATE');
}

function evaluate(mutate) {
  const input = structuredClone(baseline);
  mutate(input);
  return validateEventGovernanceData(input);
}

test('canonical P1R event governance and generated AsyncAPI projection pass with no runtime promotion', () => {
  const report = validateEventGovernance({ root });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.deepEqual(report.summary, {
    totalEvents: 155,
    canonicalEvents: 14,
    historicalCandidates: 141,
    deprecatedEvents: 0,
    canonicalConsumerBindings: 37,
    plannedEventGaps: 11,
    d2ContractClosedEventGaps: 5,
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    asyncApiChannels: 14,
    asyncApiOperations: 51,
  });
  assert.equal(baseline.b26Runtime.runtimeStatus, 'pending');
  assert.equal(baseline.b26Runtime.defaultDecision, 'NO-GO');
});

test('AsyncAPI is a deterministic catalog projection with one send and all governed receives', () => {
  const candidate = structuredClone(baseline.catalog);
  const projection = projectCanonicalAsyncApi(candidate);
  assert.deepEqual(projection, baseline.catalog.asyncapi);
  assert.equal(Object.keys(projection.channels).length, 14);
  assert.equal(Object.values(projection.operations).filter((operation) => operation.action === 'send').length, 14);
  assert.equal(Object.values(projection.operations).filter((operation) => operation.action === 'receive').length, 37);
  assert.deepEqual(validateAsyncApiProjection(candidate), { channelCount: 14, operationCount: 51 });
});

test('generated TypeScript separates canonical publishers from historical catalog candidates', () => {
  const generated = fs.readFileSync(path.join(root, 'packages', 'contracts', 'generated', 'events.ts'), 'utf8');
  assert.match(generated, /platformEventEnvelopeContractSchema = "platform\.event\.v1" as const/);
  assert.match(generated, /PlatformEventEnvelope<TPayload, TEventSchema extends string = string>/);
  assert.match(generated, /WorkflowOutboxPublishedEvent extends PlatformEventEnvelope<B26WorkflowOutboxPublished, "workflow\.event\.v1">/);
  assert.match(generated, /WorkflowSagaCompensationRequestedEvent extends PlatformEventEnvelope<B26WorkflowCompensationRequested, "workflow\.saga\.v1">/);
  assert.match(generated, /schemaVersion: "workflow\.event\.v1"/);
  assert.match(generated, /export type EventCatalogCandidate =/);
  assert.match(generated, /@deprecated Use CanonicalPlatformEvent for new v2 event publication/);
  assert.match(generated, /export type CanonicalEventName = keyof typeof canonicalEventGovernance/);
  const canonicalUnion = generated.match(/export type CanonicalPlatformEvent = ([^;]+);/);
  assert.ok(canonicalUnion, 'generated TypeScript must declare CanonicalPlatformEvent');
  assert.deepEqual(canonicalUnion[1].split(' | '), [
    'LearnerTargetUpdatedEvent',
    'ContentVersionSubmittedEvent',
    'ContentVersionReviewedEvent',
    'ContentVersionPublishedEvent',
    'ContentVersionUnpublishedEvent',
    'ContentVersionRolledBackEvent',
    'AssessmentPlacementCompletedEvent',
    'WorkflowOutboxPublishedEvent',
    'WorkflowEventDeliveryFailedEvent',
    'WorkflowEventDeadLetteredEvent',
    'WorkflowEventReplayRequestedEvent',
    'WorkflowEventOrderingDeferredEvent',
    'WorkflowSagaCompensationRequestedEvent',
    'WorkflowSagaManualRecoveryRequestedEvent',
  ], 'CanonicalPlatformEvent must exactly preserve the fourteen canonical event interfaces in catalog order');
  for (const historicalInterface of [
    'ContentPublicProjectionInvalidatedEvent',
    'CmsContentPublishedEvent',
    'LearningSrsBatchCreatedEvent',
  ]) {
    assert.equal(canonicalUnion[1].split(' | ').includes(historicalInterface), false, `${historicalInterface} must remain outside CanonicalPlatformEvent`);
  }

  const eventInterfaces = [...generated.matchAll(/export interface [A-Za-z0-9_]+Event extends PlatformEventEnvelope<[^\n]+> \{\n([\s\S]*?)\n\}/g)];
  assert.equal(eventInterfaces.length, baseline.catalog.events.length, 'every catalog event must have one generated concrete interface');
  for (const event of baseline.catalog.events) {
    const eventLine = `eventName: ${JSON.stringify(event.eventName)};`;
    const matchingInterfaces = eventInterfaces.filter(([, body]) => body.includes(eventLine));
    assert.equal(matchingInterfaces.length, 1, `${event.eventName} must map to exactly one generated interface`);
    assert.ok(
      matchingInterfaces[0][1].includes(`schemaVersion: ${JSON.stringify(event.schema)};`),
      `${event.eventName} must explicitly require schemaVersion in its generated interface`,
    );
  }
});

test('event fragment discovery recurses and preserves path casing for frozen-inventory validation', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p1r-event-fragments-'));
  try {
    const directory = path.join(temporaryRoot, 'packages', 'contracts', 'events', 'v1', 'fragments');
    fs.mkdirSync(path.join(directory, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'B26-RELIABILITY.EVENTS.JSON'), '{"events":[],"payloadSchemas":{}}\n');
    fs.writeFileSync(path.join(directory, 'nested', 'z-unknown.events.json'), '{"events":[],"payloadSchemas":{}}\n');
    assert.deepEqual(
      listEventFragments(temporaryRoot).map((fragment) => fragment.path),
      [
        'packages/contracts/events/v1/fragments/B26-RELIABILITY.EVENTS.JSON',
        'packages/contracts/events/v1/fragments/nested/z-unknown.events.json',
      ],
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('event governance fails closed on owner, routing, status, shape, projection, and fragment mutations', async (t) => {
  const cases = [
    ['unknown catalog runtime claim', (input) => { input.catalog.attestation = 'PASS'; }, /event catalog keys must be exactly/],
    ['platform runtime attestation', (input) => { input.catalog['x-v2-event-platform'].runtimeAttestation = 'RUNTIME VERIFIED'; }, /x-v2-event-platform must exactly match|runtime success claim/],
    ['envelope runtime proof', (input) => { input.catalog.envelope.runtimeProof = 'Kafka connected'; }, /event envelope must exactly match|runtime success claim/],
    ['compatibility runtime evidence', (input) => { input.catalog.compatibilityPolicy.runtimeEvidence = 'Kafka running'; }, /event compatibilityPolicy must exactly match|runtime success claim/],
    ['nested payload runtime proof', (input) => { input.catalog.payloadSchemas.B26WorkflowOutboxPublished.runtimeProof = true; }, /unknown runtime proof or attestation field/],
    ['payload schema runtime description', (input) => { input.catalog.payloadSchemas.B26WorkflowOutboxPublished.description = 'KafkaBrokerOnline'; }, /not an allowed M1-006 payload schema keyword|runtime success claim/],
    ['payload schema unknown connection claim', (input) => { input.catalog.payloadSchemas.B26WorkflowOutboxPublished.connectionConfirmed = true; }, /not an allowed M1-006 payload schema keyword/],
    ['payload schema broker-up property', (input) => { input.catalog.payloadSchemas.B26WorkflowOutboxPublished.properties.brokerUp = { type: 'boolean' }; }, /frozen B26 canonical payload digest/],
    ['canonical payload optional-field drift', (input) => { input.catalog.payloadSchemas.B26WorkflowOutboxPublished.properties.migrationNote = { type: 'string', maxLength: 64 }; }, /frozen B26 canonical payload digest/],
    ['canonical payload constraint drift', (input) => { input.catalog.payloadSchemas.B26WorkflowOutboxPublished.properties.outboxId.maxLength = 64; }, /frozen B26 canonical payload digest/],
    ['canonical payload invalid uniqueItems type', (input) => { input.catalog.payloadSchemas.B9LearnerTargetUpdated.properties.weeklyStudyDays.uniqueItems = 'yes'; }, /uniqueItems must be boolean/],
    ['placement completion duplicates envelope identity in payload', (input) => { input.catalog.payloadSchemas.B10PlacementCompleted.properties.eventId = { type: 'string' }; }, /must not duplicate envelope-only eventId/],
    ['placement completion result pin drifts', (input) => { input.catalog.payloadSchemas.B10PlacementCompleted.properties.placementResultId.pattern = '^[A-Za-z].*$'; }, /assessment\.placement\.completed\.v1 payload\.placementResultId must exactly match/],
    ['placement completion manifest pin drifts', (input) => { input.catalog.payloadSchemas.B10PlacementCompleted.properties.totalItemCount.const = 9; }, /assessment\.placement\.completed\.v1 payload\.totalItemCount must exactly match/],
    ['placement completion dimension order drifts', (input) => { input.catalog.payloadSchemas.B10PlacementCompleted.properties.dimensionSummaries.prefixItems.reverse(); }, /assessment\.placement\.completed\.v1 payload\.dimensionSummaries\.prefixItems\[0\]\.dimensionId must exactly match/],
    ['placement completion dimension coverage forbids excluding zero', (input) => {
      const coverage = input.catalog.payloadSchemas.B10PlacementCompleted.properties.dimensionSummaries.prefixItems[0].properties.coverageRatio;
      delete coverage.minimum;
      coverage.exclusiveMinimum = 0;
    }, /assessment\.placement\.completed\.v1 payload\.dimensionSummaries\.prefixItems\[0\]\.coverageRatio must exactly match/],
    ['placement completion skipped confidence drifts', (input) => { input.catalog.payloadSchemas.B10PlacementCompleted.oneOf[1].properties.confidence.const = 'LOW'; }, /assessment\.placement\.completed\.v1 payload\.SKIPPED\.confidence must exactly match/],
    ['placement completion assessed branch permits requested start level', (input) => { input.catalog.payloadSchemas.B10PlacementCompleted.oneOf[0].not = { required: [] }; }, /assessment\.placement\.completed\.v1 payload\.ASSESSED\.not must exactly match/],
    ['runtime-success catalog description', (input) => { input.catalog.description = 'Kafka runtime verified and accepted'; }, /event catalog description must exactly match|runtime success claim/],
    ['camel-case runtime-success prose', (input) => { historical(input).compatibility.consumerRule = 'KafkaRuntimeVerified'; }, /runtime success claim/],
    ['weakened eventId envelope pattern', (input) => { input.catalog.envelope.properties.eventId.pattern = '^.*$'; }, /event envelope must exactly match/],
    ['wrong envelope schema field type', (input) => { input.catalog.envelope.properties.schema.type = 'number'; }, /event envelope must exactly match/],
    ['empty sensitive payload deny table', (input) => { input.catalog.forbiddenPayloadFieldPatterns = []; }, /forbiddenPayloadFieldPatterns must exactly match/],
    ['compatibility consumer drift', (input) => { input.catalog.compatibilityPolicy.consumer = 'accept every version'; }, /compatibilityPolicy must exactly match/],
    ['compatibility versioning drift', (input) => { input.catalog.compatibilityPolicy.versioning = 'in-place'; }, /compatibilityPolicy must exactly match/],
    ['unknown nested event compatibility field', (input) => { historical(input).compatibility.extra = 'x'; }, /compatibility keys must be exactly/],
    ['platform runtime promotion', (input) => { input.catalog['x-p1r-event-governance'].runtimeStatus = 'RUNTIME_VERIFIED'; }, /runtimeStatus must remain NOT_RUNTIME_VERIFIED/],
    ['Redis event-source promotion', (input) => { input.catalog['x-p1r-event-governance'].transportPolicy.redisStreams = 'ALLOWED'; }, /Redis Streams must be prohibited/],
    ['unknown canonical governance field', (input) => { canonical(input)['x-p1r-governance'].runtimeProof = true; }, /x-p1r-governance keys must be exactly/],
    ['unknown event attestation', (input) => { canonical(input).certified = true; }, /keys must be exactly/],
    ['wrong producer owner', (input) => {
      canonical(input)['x-p1r-governance'].producer.service = 'iam-service';
      canonical(input)['x-p1r-governance'].producer.dataOwner = 'iam-service';
    }, /producer must match the B26 topic owner/],
    ['undeclared routed topic', (input) => {
      const event = canonical(input);
      input.b26Runtime.eventRouting.find((route) => route.eventName === event.eventName).topic = 'platform.unknown.v1';
      event['x-p1r-governance'].transport.topic = 'platform.unknown.v1';
    }, /route must reference a declared B26 topic/],
    ['consumer group moved off routed topic', (input) => {
      const workflow = input.b26Runtime.topics.find((topic) => topic.name === 'platform.workflow.v1');
      const moved = workflow.consumerGroups.pop();
      input.b26Runtime.topics.find((topic) => topic.name === 'platform.learning.v1').consumerGroups.push(moved);
    }, /must belong to <unknown>/],
    ['topic owner drift', (input) => {
      input.b26Runtime.topics.find((topic) => topic.name === 'platform.workflow.v1').ownerService = 'audit-service';
    }, /producer must match the B26 topic owner/],
    ['extra B26 event route', (input) => { input.b26Runtime.eventRouting.push(structuredClone(input.b26Runtime.eventRouting[0])); }, /duplicates event routes|exact fourteen canonical governance events/],
    ['consumer order drift', (input) => { canonical(input)['x-p1r-governance'].consumers.reverse(); }, /consumers and order must match/],
    ['client consumer group', (input) => { canonical(input)['x-p1r-governance'].consumers[0].consumerGroup = 'cg.browser-client.v1'; }, /cannot represent a client/],
    ['duplicate consumer group', (input) => {
      const consumers = canonical(input)['x-p1r-governance'].consumers;
      consumers[1].consumerGroup = consumers[0].consumerGroup;
    }, /duplicates consumer groups/],
    ['noncanonical channel ID', (input) => { canonical(input)['x-p1r-governance'].transport.channelId = 'wrong_but_valid'; }, /channelId must be canonical and deterministic/],
    ['noncanonical publish operation ID', (input) => { canonical(input)['x-p1r-governance'].producer.publishOperationId = 'publish_wrong'; }, /publishOperationId must be canonical and deterministic/],
    ['noncanonical subscribe operation ID', (input) => { canonical(input)['x-p1r-governance'].consumers[0].subscriptionOperationId = 'subscribe_wrong'; }, /subscriptionOperationId must be canonical and deterministic/],
    ['topic drift', (input) => { canonical(input)['x-p1r-governance'].transport.topic = 'platform.learning.v1'; }, /topic must match the B26 static routing seed/],
    ['partition drift', (input) => { canonical(input)['x-p1r-governance'].transport.partitionKey = 'eventId'; }, /partitionKey must be aggregateId/],
    ['binding drift', (input) => { canonical(input)['x-p1r-governance'].transport.bindingVersion = '0.4.0'; }, /bindingVersion must be 0.5.0/],
    ['payload governance drift', (input) => { canonical(input)['x-p1r-governance'].schema.payloadRef = '#/payloadSchemas/Unknown'; }, /governed payloadRef must match/],
    ['synchronized canonical payload ref swap', (input) => {
      const failed = input.catalog.events.find((event) => event.eventName === 'workflow.event.delivery_failed.v1');
      const dead = input.catalog.events.find((event) => event.eventName === 'workflow.event.dead_lettered.v1');
      const failedRef = failed.payloadSchema.$ref;
      failed.payloadSchema.$ref = dead.payloadSchema.$ref;
      dead.payloadSchema.$ref = failedRef;
      failed['x-p1r-governance'].schema.payloadRef = failed.payloadSchema.$ref;
      dead['x-p1r-governance'].schema.payloadRef = dead.payloadSchema.$ref;
      const fragment = input.fragments.find((candidate) => candidate.path.endsWith('b26-reliability.events.json'));
      const fragmentFailed = fragment.data.events.find((event) => event.eventName === failed.eventName);
      const fragmentDead = fragment.data.events.find((event) => event.eventName === dead.eventName);
      const fragmentFailedRef = fragmentFailed.payloadSchema.$ref;
      fragmentFailed.payloadSchema.$ref = fragmentDead.payloadSchema.$ref;
      fragmentDead.payloadSchema.$ref = fragmentFailedRef;
      projectCanonicalAsyncApi(input.catalog);
    }, /frozen M1-006 event-to-payload mapping/],
    ['missing correlation field', (input) => { canonical(input)['x-p1r-governance'].correlation.pop(); }, /correlation fields must be exact/],
    ['historical Kafka promotion', (input) => { historical(input)['x-kafka'] = { topic: 'platform.fake.v1' }; }, /historical candidate cannot carry active Kafka metadata/],
    ['UI telemetry masquerades as canonical fact', (input) => { canonical(input).eventName = 'ui.page.clicked.v1'; }, /CANONICAL_D2 set must be the exact fourteen/],
    ['wrong planned closure family', (input) => { input.catalog['x-p1r-event-governance'].plannedClosures[0].family = 'WRONG'; }, /family must match the frozen gap registry/],
    ['closed content gap regresses to planned', (input) => {
      input.catalog['x-p1r-event-governance'].plannedClosures
        .find((closure) => closure.gapId === 'EVENT-GAP-CONTENT-DUPLICATE').status = 'PLANNED';
    }, /status must remain D2_CONTRACT_CLOSED/],
    ['planned gap is falsely reported closed', (input) => {
      input.catalog['x-p1r-event-governance'].plannedClosures
        .find((closure) => closure.gapId === 'EVENT-GAP-IAM-001').status = 'D2_CONTRACT_CLOSED';
    }, /status must remain PLANNED/],
    ['incomplete planned closure task mapping', (input) => { input.catalog['x-p1r-event-governance'].plannedClosures[0].d2ClosureTasks.shift(); }, /D2 closure tasks must match the frozen task mapping/],
    ['planned closure order drift', (input) => { input.catalog['x-p1r-event-governance'].plannedClosures.reverse(); }, /canonical gap registry order/],
    ['duplicate event name', (input) => { input.catalog.events.push(structuredClone(input.catalog.events[0])); }, /duplicates event names/],
    ['synchronized fragment inventory rename', (input) => {
      const inventory = input.catalog['x-p1r-event-governance'].fragmentInventory[0];
      const fragment = input.fragments.find((candidate) => candidate.path === inventory.path);
      const renamedPath = 'packages/contracts/events/v1/fragments/renamed.events.json';
      inventory.path = renamedPath;
      fragment.path = renamedPath;
    }, /frozen M1-006 (policy|source inventory)/],
    ['synchronized fragment inventory casing rewrite', (input) => {
      const inventory = input.catalog['x-p1r-event-governance'].fragmentInventory[0];
      const fragment = input.fragments.find((candidate) => candidate.path === inventory.path);
      const rewrittenPath = 'packages/contracts/events/v1/fragments/B1-ASSESSMENT-PRIVACY.EVENTS.JSON';
      inventory.path = rewrittenPath;
      fragment.path = rewrittenPath;
    }, /frozen M1-006 (policy|source inventory)/],
    ['synchronized nested fragment relocation', (input) => {
      const inventory = input.catalog['x-p1r-event-governance'].fragmentInventory[0];
      const fragment = input.fragments.find((candidate) => candidate.path === inventory.path);
      const nestedPath = 'packages/contracts/events/v1/fragments/nested/b1-assessment-privacy.events.json';
      inventory.path = nestedPath;
      fragment.path = nestedPath;
    }, /frozen M1-006 (policy|source inventory)/],
    ['synchronized cross-fragment event move', (input) => {
      const source = input.fragments.find((candidate) => candidate.path.endsWith('b26-reliability.events.json'));
      const target = input.fragments.find((candidate) => candidate.path.endsWith('b1-assessment-privacy.events.json'));
      const sourceInventory = input.catalog['x-p1r-event-governance'].fragmentInventory.find((candidate) => candidate.path === source.path);
      const targetInventory = input.catalog['x-p1r-event-governance'].fragmentInventory.find((candidate) => candidate.path === target.path);
      const moved = source.data.events.pop();
      target.data.events.push(moved);
      sourceInventory.eventNames.pop();
      targetInventory.eventNames.push(moved.eventName);
    }, /frozen M1-006 (policy|source inventory)/],
    ['missing fragment', (input) => { input.fragments.pop(); }, /must exactly match catalog fragmentInventory/],
    ['unknown fragment', (input) => {
      input.fragments.push({
        path: 'packages/contracts/events/v1/fragments/z-unknown.events.json',
        data: { version: '1.0.0', events: [], payloadSchemas: {} },
      });
    }, /must exactly match catalog fragmentInventory/],
    ['fragment event removed behind stale catalog', (input) => {
      input.fragments.find((fragment) => fragment.path.endsWith('b26-reliability.events.json')).data.events.pop();
    }, /events must exactly match fragmentInventory/],
    ['fragment event duplicated behind stale catalog', (input) => {
      const fragment = input.fragments.find((candidate) => candidate.path.endsWith('b26-reliability.events.json'));
      fragment.data.events.push(structuredClone(fragment.data.events[0]));
    }, /duplicates event names|events must exactly match fragmentInventory/],
    ['fragment local payload schema removed behind catalog', (input) => {
      const fragment = input.fragments.find((candidate) => candidate.path.endsWith('b2-vocabulary-srs.events.json'));
      delete fragment.data.payloadSchemas.VocabularyReviewAccepted;
    }, /payloadSchema references missing payload schema VocabularyReviewAccepted/],
    ['fragment local payload schema is unreferenced', (input) => {
      const fragment = input.fragments.find((candidate) => candidate.path.endsWith('b2-vocabulary-srs.events.json'));
      fragment.data.payloadSchemas.UnreferencedLocalPayload = { type: 'object', additionalProperties: false, properties: {} };
    }, /local payload schema UnreferencedLocalPayload must be referenced by an event in the same fragment/],
    ['fragment AsyncAPI source', (input) => { input.fragments[0].data.asyncapi = {}; }, /must not define a second AsyncAPI source/],
    ['fragment root governance', (input) => { input.fragments[0].data['x-p1r-event-governance'] = {}; }, /must not define root platform event governance/],
    ['fragment event status', (input) => { input.fragments[0].data.events[0].status = 'CANONICAL_D2'; }, /must not define catalog-owned status/],
    ['B26 runtime promotion', (input) => { input.b26Runtime.runtimeStatus = 'PASS'; }, /must remain static-only, pending and NO-GO/],
    ['historical payload reference has extra metadata', (input) => { historical(input).payloadSchema.source = 'fragment'; }, /payloadSchema must be exactly/],
    ['historical payload reference is non-local', (input) => { historical(input).payloadSchema.$ref = 'https://example.test/schema.json'; }, /payloadSchema must reference one local/],
    ['historical payload runtime-like field', (input) => {
      input.catalog.payloadSchemas.LearningSrsBatchCreated.properties.connectionConfirmed = { type: 'boolean' };
    }, /forbidden runtime-like payload field/],
    ['unreferenced catalog payload schema', (input) => {
      input.catalog.payloadSchemas.UnreferencedCatalogPayload = { type: 'object', additionalProperties: false, properties: {} };
    }, /must be referenced by at least one catalog event/],
    ['missing receive operation', (input) => {
      const entry = Object.entries(input.catalog.asyncapi.operations).find(([, operation]) => operation.action === 'receive');
      delete input.catalog.asyncapi.operations[entry[0]];
    }, /exact canonical governance projection/],
    ['unknown AsyncAPI runtime proof', (input) => { input.catalog.asyncapi.runtimeProof = 'PASS'; }, /exact canonical governance projection/],
  ];

  for (const [name, mutate, expected] of cases) {
    await t.test(name, () => {
      const report = evaluate(mutate);
      assert.equal(report.result, 'FAIL');
      assert.match(report.errors.join('\n'), expected);
    });
  }
});

test('contract validator rejects sensitive event payload fields and malformed receive bindings', () => {
  const sensitive = structuredClone(baseline.catalog);
  const payload = sensitive.payloadSchemas.LearningSrsBatchCreated;
  payload.properties.password = { type: 'string' };
  assert.throws(() => validateEventCatalog(sensitive), /forbidden sensitive payload field|forbidden payload field/);

  const missingReceive = structuredClone(baseline.catalog);
  const receiveId = Object.keys(missingReceive.asyncapi.operations)
    .find((operationId) => missingReceive.asyncapi.operations[operationId].action === 'receive');
  delete missingReceive.asyncapi.operations[receiveId].bindings.kafka.groupId;
  assert.throws(() => validateAsyncApiProjection(missingReceive), /keys must be exactly|consumer group mismatch/);
});

test('contract validator fails closed on exact payload references, runtime-like fields, and catalog orphans', () => {
  const cases = [
    [(catalog) => { historical({ catalog }).payloadSchema.annotation = 'not allowed'; }, /payloadSchema must be exactly/],
    [(catalog) => { historical({ catalog }).payloadSchema.$ref = '#/payloadSchemas/DoesNotExist'; }, /references missing payload schema DoesNotExist/],
    [(catalog) => {
      catalog.payloadSchemas.LearningSrsBatchCreated.properties.executionSucceeded = { type: 'boolean' };
    }, /forbidden runtime-like payload field/],
    [(catalog) => {
      catalog.payloadSchemas.UnreferencedCatalogPayload = { type: 'object', additionalProperties: false, properties: {} };
    }, /must be referenced by at least one catalog event/],
  ];
  for (const [mutate, expected] of cases) {
    const candidate = structuredClone(baseline.catalog);
    mutate(candidate);
    assert.throws(() => validateEventCatalog(candidate), expected);
  }
});

test('contract validator freezes the envelope, platform, compatibility, deny table, and static-only claims', () => {
  const cases = [
    [(catalog) => { catalog.envelope.properties.eventId.pattern = '^.*$'; }, /event envelope must exactly match/],
    [(catalog) => { catalog.envelope.properties.schema.type = 'number'; }, /event envelope must exactly match/],
    [(catalog) => { catalog.forbiddenPayloadFieldPatterns = []; }, /forbiddenPayloadFieldPatterns must exactly match/],
    [(catalog) => { catalog.compatibilityPolicy.consumer = 'accept everything'; }, /compatibilityPolicy must exactly match/],
    [(catalog) => { catalog.compatibilityPolicy.versioning = 'in-place'; }, /compatibilityPolicy must exactly match/],
    [(catalog) => { historical({ catalog }).compatibility.extra = 'x'; }, /compatibility keys must be exactly/],
    [(catalog) => { catalog['x-v2-event-platform'].runtimeAttestation = 'RUNTIME VERIFIED'; }, /x-v2-event-platform must exactly match|runtime success claim/],
    [(catalog) => { catalog.payloadSchemas.B26WorkflowOutboxPublished.runtimeProof = true; }, /unknown runtime proof or attestation field/],
    [(catalog) => { catalog.payloadSchemas.B26WorkflowOutboxPublished.description = 'Kafka broker reachable'; }, /not an allowed M1-006 payload schema keyword|runtime success claim/],
    [(catalog) => { catalog.payloadSchemas.B26WorkflowOutboxPublished.connectionConfirmed = true; }, /not an allowed M1-006 payload schema keyword/],
    [(catalog) => { catalog.payloadSchemas.B26WorkflowOutboxPublished.properties.deliveryState = { type: 'string', enum: ['BROKER_UP'] }; }, /frozen B26 canonical payload digest/],
    [(catalog) => { catalog.payloadSchemas.LearningSrsBatchCreated.properties.brokerUp = { type: 'boolean' }; }, /forbidden runtime-like payload field/],
    [(catalog) => { catalog.payloadSchemas.LearningSrsBatchCreated.properties.deliveryState = { type: 'string', enum: ['BROKER_UP'] }; }, /cannot encode Kafka or broker runtime facts/],
    [(catalog) => { catalog.description = 'Kafka runtime verified and accepted'; }, /event catalog description must exactly match|runtime success claim/],
    [(catalog) => { historical({ catalog }).compatibility.consumerRule = 'runtime_verified'; }, /runtime success claim/],
  ];
  for (const [mutate, expected] of cases) {
    const candidate = structuredClone(baseline.catalog);
    mutate(candidate);
    assert.throws(() => validateEventCatalog(candidate), expected);
  }
});
