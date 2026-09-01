import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  M1017_B26_DESCRIPTOR_SET_SHA256,
  M1017_B26_EXPECTED_SEMANTIC_SHA256,
  M1017_EVENT_DESCRIPTOR_SET_SHA256,
  M1017_EVENT_EXPECTED_SEMANTIC_SHA256,
  M1017_OPENAPI_DESCRIPTOR_SET_SHA256,
  M1017_OPENAPI_EXPECTED_SEMANTIC_SHA256,
  M1017_SOURCE_CONTRACT_BASELINE_REF,
  M1018_SOURCE_CONTRACT_BASELINE_REF,
  compareB26WorkflowGovernance,
  compareContracts,
  isValidM1017PromotionAllowance,
} from '../../scripts/contracts/compatibility-diff.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const currentArtifactPaths = Object.freeze({
  openapi: 'packages/contracts/openapi/v1/openapi.json',
  events: 'packages/contracts/events/v1/catalog.json',
  b26: 'config/b26-event-runtime.json',
});
const policyPath = 'config/p1r-privacy-analytics-audit-contract.v1.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, ...relativePath.split('/')), 'utf8'));
}

function readBaselineJson(relativePath) {
  return readCommitJson(M1017_SOURCE_CONTRACT_BASELINE_REF, relativePath);
}

function readCommitJson(ref, relativePath) {
  const output = execFileSync(
    'git',
    ['show', `${ref}:${relativePath}`],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true },
  );
  return JSON.parse(output);
}

function clone(value) {
  return structuredClone(value);
}

const baseline = Object.freeze({
  openapi: readBaselineJson(currentArtifactPaths.openapi),
  events: readBaselineJson(currentArtifactPaths.events),
  b26: readBaselineJson(currentArtifactPaths.b26),
});
const current = Object.freeze({
  // 97497af is the immutable M1-017 accepted projection and the source
  // checkpoint for M1-018.  Never feed the mutable M1-018 worktree into an
  // M1-017 acceptance test.
  openapi: readCommitJson(M1018_SOURCE_CONTRACT_BASELINE_REF, currentArtifactPaths.openapi),
  events: readCommitJson(M1018_SOURCE_CONTRACT_BASELINE_REF, currentArtifactPaths.events),
  b26: readCommitJson(M1018_SOURCE_CONTRACT_BASELINE_REF, currentArtifactPaths.b26),
});
const policy = readJson(policyPath);
const allowance = policy.compatibilityPromotion;

const frozenM1017Projection = [
  M1017_OPENAPI_EXPECTED_SEMANTIC_SHA256,
  M1017_EVENT_EXPECTED_SEMANTIC_SHA256,
  M1017_B26_EXPECTED_SEMANTIC_SHA256,
  M1017_OPENAPI_DESCRIPTOR_SET_SHA256,
  M1017_EVENT_DESCRIPTOR_SET_SHA256,
  M1017_B26_DESCRIPTOR_SET_SHA256,
].every((digest) => typeof digest === 'string' && !digest.startsWith('PENDING_'));
const mutationReady = frozenM1017Projection && isValidM1017PromotionAllowance(allowance);

function compareArtifact(kind, previous, next, nextAllowance = allowance) {
  if (kind === 'b26') {
    return compareB26WorkflowGovernance(previous, next, { allowance: nextAllowance });
  }
  return compareContracts(kind, previous, next, { allowance: nextAllowance });
}

function findM1017Event(catalog) {
  const event = catalog.events?.find((candidate) => candidate.eventName === 'privacy.export.requested.v2');
  assert.ok(event, 'canonical M1-017 privacy.export.requested.v2 event must exist');
  return event;
}

function findM1017Route(runtime) {
  const route = runtime.eventRouting?.find((candidate) => candidate.eventName === 'privacy.export.requested.v2');
  assert.ok(route, 'canonical M1-017 privacy.export.requested.v2 B26 route must exist');
  return route;
}

function findM1017Topic(runtime) {
  const route = findM1017Route(runtime);
  const topic = runtime.topics?.find((candidate) => candidate.name === route.topic);
  assert.ok(topic, `B26 topic ${route.topic} for M1-017 must exist`);
  return topic;
}

function findM1017OpenApiOperation(document) {
  const operation = document.paths?.['/api/v1/privacy/exports']?.post;
  assert.ok(operation, 'canonical M1-017 privacy export operation must exist');
  return operation;
}

function rejectArtifactMutation(name, kind, mutate) {
  test(`M1-017 source-bound compatibility mutation: ${name}`, { skip: !mutationReady }, () => {
    const next = clone(current[kind]);
    assert.doesNotThrow(() => mutate(next), `${name} mutation must be constructible`);
    const changes = compareArtifact(kind, baseline[kind], next);
    assert(changes.length > 0, `${name} must produce a compatibility change`);
  });
}

function rejectAllowanceMutation(name, mutate) {
  test(`M1-017 source-bound allowance mutation: ${name}`, { skip: !mutationReady }, () => {
    const nextPolicy = clone(policy);
    assert.doesNotThrow(() => mutate(nextPolicy), `${name} mutation must be constructible`);
    const nextAllowance = nextPolicy.compatibilityPromotion;
    assert.equal(isValidM1017PromotionAllowance(nextAllowance), false, `${name} must invalidate the allowance`);
    for (const kind of ['openapi', 'events', 'b26']) {
      const changes = compareArtifact(kind, baseline[kind], current[kind], nextAllowance);
      assert(changes.length > 0, `${name} must fail closed for ${kind}`);
    }
  });
}

test('M1-017 frozen source-bound compatibility accepts exactly the canonical OpenAPI, event and B26 projections', { skip: !frozenM1017Projection }, () => {
  assert.equal(isValidM1017PromotionAllowance(allowance), true);
  assert.deepEqual(compareArtifact('openapi', baseline.openapi, current.openapi), []);
  assert.deepEqual(compareArtifact('events', baseline.events, current.events), []);
  assert.deepEqual(compareArtifact('b26', baseline.b26, current.b26), []);
});

rejectArtifactMutation('extra OpenAPI path', 'openapi', (document) => {
  document.paths['/api/v1/m1017/forged'] = {
    get: {
      operationId: 'm1017ForgedRoute',
      responses: { '200': { description: 'forged' } },
    },
  };
});

rejectArtifactMutation('extra OpenAPI schema', 'openapi', (document) => {
  document.components.schemas.M1017ForgedSchema = {
    type: 'object',
    additionalProperties: false,
  };
});

rejectArtifactMutation('forged OpenAPI root extension', 'openapi', (document) => {
  document['x-m1017-forged-root'] = true;
});

rejectArtifactMutation('deleted OpenAPI operation', 'openapi', (document) => {
  delete document.paths['/api/v1/privacy/exports'].post;
});

rejectArtifactMutation('changed OpenAPI operation authority', 'openapi', (document) => {
  const operation = findM1017OpenApiOperation(document);
  operation['x-authorization'].clientAuthority = 'NONE; forged-client-authority';
});

rejectArtifactMutation('event producer drift', 'events', (catalog) => {
  findM1017Event(catalog)['x-p1r-governance'].producer.service = 'workflow-service';
});

rejectArtifactMutation('event consumer group drift', 'events', (catalog) => {
  findM1017Event(catalog)['x-p1r-governance'].consumers[0].consumerGroup = 'cg.forged-m1017.v1';
});

rejectArtifactMutation('event topic drift', 'events', (catalog) => {
  findM1017Event(catalog)['x-p1r-governance'].transport.topic = 'platform.forged-m1017.v1';
});

rejectArtifactMutation('event payload forbidden field', 'events', (catalog) => {
  catalog.payloadSchemas.M1017PrivacyExportRequested.properties.rawBody = { type: 'string' };
});

rejectArtifactMutation('AsyncAPI channel drift', 'events', (catalog) => {
  const channelKey = Object.keys(catalog.asyncapi?.channels ?? {})
    .find((key) => key === 'privacy_export_requested_v2' || key.includes('privacy_export_requested'));
  assert.ok(channelKey, 'M1-017 AsyncAPI privacy export channel must exist');
  catalog.asyncapi.channels[channelKey].address = 'platform.forged-m1017.v1';
});

rejectArtifactMutation('UI telemetry promoted into the Kafka catalog', 'events', (catalog) => {
  catalog.events.push({
    eventName: 'ui.page.viewed.v1',
    status: 'CANONICAL_D2',
  });
});

rejectArtifactMutation('B26 topic ACL drift', 'b26', (runtime) => {
  const topic = findM1017Topic(runtime);
  topic.acl[0].operation = 'READ';
});

rejectArtifactMutation('B26 topic consumer group drift', 'b26', (runtime) => {
  const topic = findM1017Topic(runtime);
  topic.consumerGroups[0].service = 'workflow-service';
});

rejectArtifactMutation('B26 route drift', 'b26', (runtime) => {
  findM1017Route(runtime).topic = 'platform.forged-m1017.v1';
});

rejectArtifactMutation('B26 M1-017 source reference removal', 'b26', (runtime) => {
  const sourceRef = 'packages/contracts/events/v1/fragments/m1-017-privacy-deletion-v2.events.json';
  runtime.sourceRefs = runtime.sourceRefs.filter((candidate) => candidate !== sourceRef);
});

rejectArtifactMutation('B26 runtime promotion', 'b26', (runtime) => {
  runtime.runtimeStatus = 'RUNTIME_VERIFIED';
});

rejectAllowanceMutation('unknown promotion key', (nextPolicy) => {
  nextPolicy.compatibilityPromotion.forgedPromotionKey = true;
});

rejectAllowanceMutation('approved source-file allowlist drift', (nextPolicy) => {
  nextPolicy.compatibilityPromotion.approvedSourceFiles.push('config/forged-m1017-source.json');
});

rejectAllowanceMutation('source baseline drift', (nextPolicy) => {
  nextPolicy.compatibilityPromotion.sourceContractBaseline = 'f'.repeat(40);
});
