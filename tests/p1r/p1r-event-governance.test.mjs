import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  validateEventGovernance,
  validateEventGovernanceData,
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
    totalEvents: 154,
    canonicalEvents: 7,
    historicalCandidates: 147,
    deprecatedEvents: 0,
    canonicalConsumerBindings: 14,
    plannedEventGaps: 16,
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    asyncApiChannels: 7,
    asyncApiOperations: 21,
  });
  assert.equal(baseline.b26Runtime.runtimeStatus, 'pending');
  assert.equal(baseline.b26Runtime.defaultDecision, 'NO-GO');
});

test('AsyncAPI is a deterministic catalog projection with one send and all governed receives', () => {
  const candidate = structuredClone(baseline.catalog);
  const projection = projectCanonicalAsyncApi(candidate);
  assert.deepEqual(projection, baseline.catalog.asyncapi);
  assert.equal(Object.keys(projection.channels).length, 7);
  assert.equal(Object.values(projection.operations).filter((operation) => operation.action === 'send').length, 7);
  assert.equal(Object.values(projection.operations).filter((operation) => operation.action === 'receive').length, 14);
  assert.deepEqual(validateAsyncApiProjection(candidate), { channelCount: 7, operationCount: 21 });
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
  assert.match(generated, /export type CanonicalPlatformEvent = WorkflowOutboxPublishedEvent/);
});

test('event governance fails closed on owner, routing, status, shape, projection, and fragment mutations', async (t) => {
  const cases = [
    ['unknown catalog runtime claim', (input) => { input.catalog.attestation = 'PASS'; }, /event catalog keys must be exactly/],
    ['platform runtime attestation', (input) => { input.catalog['x-v2-event-platform'].runtimeAttestation = 'RUNTIME VERIFIED'; }, /x-v2-event-platform must exactly match|runtime success claim/],
    ['envelope runtime proof', (input) => { input.catalog.envelope.runtimeProof = 'Kafka connected'; }, /event envelope must exactly match|runtime success claim/],
    ['compatibility runtime evidence', (input) => { input.catalog.compatibilityPolicy.runtimeEvidence = 'Kafka running'; }, /event compatibilityPolicy must exactly match|runtime success claim/],
    ['nested payload runtime proof', (input) => { input.catalog.payloadSchemas.B26WorkflowOutboxPublished.runtimeProof = true; }, /unknown runtime proof or attestation field/],
    ['runtime-success catalog description', (input) => { input.catalog.description = 'Kafka runtime verified and accepted'; }, /event catalog description must exactly match|runtime success claim/],
    ['camel-case runtime-success prose', (input) => { historical(input).compatibility.consumerRule = 'KafkaRuntimeVerified'; }, /runtime success claim/],
    ['weakened eventId envelope pattern', (input) => { input.catalog.envelope.properties.eventId.pattern = '^.*$'; }, /event envelope must exactly match/],
    ['wrong envelope schema field type', (input) => { input.catalog.envelope.properties.schema.type = 'number'; }, /event envelope must exactly match/],
    ['empty sensitive payload deny table', (input) => { input.catalog.forbiddenPayloadFieldPatterns = []; }, /forbiddenPayloadFieldPatterns must exactly match/],
    ['compatibility consumer drift', (input) => { input.catalog.compatibilityPolicy.consumer = 'accept every version'; }, /compatibilityPolicy must exactly match/],
    ['compatibility versioning drift', (input) => { input.catalog.compatibilityPolicy.versioning = 'in-place'; }, /compatibilityPolicy must exactly match/],
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
    ['extra B26 event route', (input) => { input.b26Runtime.eventRouting.push(structuredClone(input.b26Runtime.eventRouting[0])); }, /duplicates event routes|exact seven canonical seed events/],
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
    ['missing correlation field', (input) => { canonical(input)['x-p1r-governance'].correlation.pop(); }, /correlation fields must be exact/],
    ['historical Kafka promotion', (input) => { historical(input)['x-kafka'] = { topic: 'platform.fake.v1' }; }, /historical candidate cannot carry active Kafka metadata/],
    ['UI telemetry masquerades as canonical fact', (input) => { canonical(input).eventName = 'ui.page.clicked.v1'; }, /CANONICAL_D2 set must be the exact seven/],
    ['wrong planned closure family', (input) => { input.catalog['x-p1r-event-governance'].plannedClosures[0].family = 'WRONG'; }, /family must match the frozen gap registry/],
    ['incomplete planned closure task mapping', (input) => { input.catalog['x-p1r-event-governance'].plannedClosures[0].d2ClosureTasks.shift(); }, /D2 closure tasks must match the frozen task mapping/],
    ['planned closure order drift', (input) => { input.catalog['x-p1r-event-governance'].plannedClosures.reverse(); }, /canonical gap registry order/],
    ['duplicate event name', (input) => { input.catalog.events.push(structuredClone(input.catalog.events[0])); }, /duplicates event names/],
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
    ['fragment AsyncAPI source', (input) => { input.fragments[0].data.asyncapi = {}; }, /must not define a second AsyncAPI source/],
    ['fragment root governance', (input) => { input.fragments[0].data['x-p1r-event-governance'] = {}; }, /must not define root platform event governance/],
    ['fragment event status', (input) => { input.fragments[0].data.events[0].status = 'CANONICAL_D2'; }, /must not define catalog-owned status/],
    ['B26 runtime promotion', (input) => { input.b26Runtime.runtimeStatus = 'PASS'; }, /must remain static-only, pending and NO-GO/],
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
  const payload = sensitive.payloadSchemas.B26WorkflowOutboxPublished;
  payload.properties.password = { type: 'string' };
  assert.throws(() => validateEventCatalog(sensitive), /forbidden payload field/);

  const missingReceive = structuredClone(baseline.catalog);
  const receiveId = Object.keys(missingReceive.asyncapi.operations)
    .find((operationId) => missingReceive.asyncapi.operations[operationId].action === 'receive');
  delete missingReceive.asyncapi.operations[receiveId].bindings.kafka.groupId;
  assert.throws(() => validateAsyncApiProjection(missingReceive), /keys must be exactly|consumer group mismatch/);
});

test('contract validator freezes the envelope, platform, compatibility, deny table, and static-only claims', () => {
  const cases = [
    [(catalog) => { catalog.envelope.properties.eventId.pattern = '^.*$'; }, /event envelope must exactly match/],
    [(catalog) => { catalog.envelope.properties.schema.type = 'number'; }, /event envelope must exactly match/],
    [(catalog) => { catalog.forbiddenPayloadFieldPatterns = []; }, /forbiddenPayloadFieldPatterns must exactly match/],
    [(catalog) => { catalog.compatibilityPolicy.consumer = 'accept everything'; }, /compatibilityPolicy must exactly match/],
    [(catalog) => { catalog.compatibilityPolicy.versioning = 'in-place'; }, /compatibilityPolicy must exactly match/],
    [(catalog) => { catalog['x-v2-event-platform'].runtimeAttestation = 'RUNTIME VERIFIED'; }, /x-v2-event-platform must exactly match|runtime success claim/],
    [(catalog) => { catalog.payloadSchemas.B26WorkflowOutboxPublished.runtimeProof = true; }, /unknown runtime proof or attestation field/],
    [(catalog) => { catalog.description = 'Kafka runtime verified and accepted'; }, /event catalog description must exactly match|runtime success claim/],
    [(catalog) => { historical({ catalog }).compatibility.consumerRule = 'runtime_verified'; }, /runtime success claim/],
  ];
  for (const [mutate, expected] of cases) {
    const candidate = structuredClone(baseline.catalog);
    mutate(candidate);
    assert.throws(() => validateEventCatalog(candidate), expected);
  }
});
