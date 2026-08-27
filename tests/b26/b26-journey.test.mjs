import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createB26JourneyPreview, loadB26JourneyConfig } from '../../scripts/runtime/replay-b26-journey.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));

test('B26 EVT-003 manifest is preview/static and remains runtime-pending', () => {
  const config = json('config/b26-journey.json');
  assert.equal(config.batch, 'B26');
  assert.equal(config.scope, 'V2-B26-EVT-003');
  assert.equal(config.phase, 'phase-1');
  assert.equal(config.mode, 'preview-static');
  assert.equal(config.runtimeStatus, 'pending');
  assert.equal(config.defaultDecision, 'deny');
  assert.equal(config.execution.writesDatabase, false);
  assert.equal(config.execution.publishesKafka, false);
  assert.equal(config.execution.networkCalls, false);
  assert.equal(config.execution.mintsJwt, false);
  assert.equal(config.execution.usesProvidedJwt, false);
  assert.equal(config.execution.claimsApiDbKafkaSuccess, false);
  assert.equal(config.execution.runtimeEvidence, null);
  assert.ok(config.execution.blockers.length >= 3);
});

test('journey contains the complete registration-to-notification slice', () => {
  const config = loadB26JourneyConfig();
  assert.deepEqual(config.steps.map((step) => step.id), [
    'register',
    'login',
    'adult-gate',
    'goal',
    'course',
    'practice',
    'grading',
    'mastery-srs',
    'report',
    'notification'
  ]);
  for (const step of config.steps) {
    assert.ok(step.owner.service);
    assert.ok(step.owner.schema);
    assert.ok(step.owner.tables.length > 0);
    assert.ok(step.api.gateway.length > 0);
    assert.ok(step.api.owner.length > 0);
    assert.ok(Object.hasOwn(step, 'writeSet'));
    assert.ok(Object.hasOwn(step, 'readSet'));
    for (const field of ['api', 'db', 'kafka', 'blockers']) assert.ok(Object.hasOwn(step.reconciliation, field), `${step.id} missing reconciliation.${field}`);
  }
});

test('every preview step separates request, trace, event and dedupe identities', () => {
  const preview = createB26JourneyPreview({ runId: 'run-b26-test-identities' });
  const requestIds = new Set();
  const eventIds = new Set();
  for (const step of preview.steps) {
    const correlation = step.correlation;
    assert.ok(correlation.requestId);
    assert.equal(correlation.traceId, preview.run.traceId);
    assert.ok(correlation.dedupeKey);
    assert.equal(typeof correlation.eventId, step.event.required ? 'string' : 'object');
    assert.equal(step.status, 'preview-only-not-executed');
    assert.equal(step.api.gateway.every((call) => call.authorization === 'not-supplied-static-preview'), true);
    assert.equal(step.api.owner.every((call) => call.authorization === 'not-supplied-static-preview'), true);
    assert.equal(requestIds.has(correlation.requestId), false);
    requestIds.add(correlation.requestId);
    if (correlation.eventId) {
      assert.equal(eventIds.has(correlation.eventId), false);
      eventIds.add(correlation.eventId);
      assert.equal(step.event.emissionStatus, 'planned-not-emitted');
    }
  }
  assert.ok(eventIds.size >= 4);
  assert.equal(preview.correlation.previewOnly, true);
});

test('owner boundaries forbid shared-table and cross-service writes', () => {
  const config = loadB26JourneyConfig();
  assert.equal(config.dataOwnership.oneSchemaOneServiceOwner, true);
  assert.equal(config.dataOwnership.crossServiceSqlJoins, false);
  assert.equal(config.dataOwnership.crossServiceWrites, false);
  assert.equal(config.dataOwnership.sharedTableWrites, false);
  assert.equal(config.dataOwnership.gatewayMayWriteDomainTables, false);
  const tableOwners = new Map();
  for (const owner of config.dataOwnership.ownerServices) {
    for (const table of owner.tables) {
      assert.equal(tableOwners.has(table), false, `shared owner table: ${table}`);
      tableOwners.set(table, owner.service);
    }
  }
  const owners = new Map(config.dataOwnership.ownerServices.map((owner) => [owner.service, new Set(owner.tables)]));
  for (const step of config.steps) {
    const owned = owners.get(step.owner.service);
    assert.ok(owned, `missing owner service ${step.owner.service}`);
    for (const table of step.writeSet) assert.equal(owned.has(table), true, `${step.id} writes outside ${step.owner.service}: ${table}`);
    assert.deepEqual(step.reconciliation.db.schema, step.owner.schema);
  }
});

test('event transport is outbox based and explicitly forbids Kafka RPC', () => {
  const config = loadB26JourneyConfig();
  assert.equal(config.eventTransport.outboxRequired, true);
  assert.equal(config.eventTransport.delivery, 'at-least-once');
  assert.equal(config.eventTransport.rpc, false);
  assert.equal(config.eventTransport.requestReply, false);
  assert.equal(config.dataOwnership.allowKafkaRpc, false);
  for (const step of config.steps) {
    assert.equal(step.event.rpc, false);
    assert.equal(step.reconciliation.kafka.rpc, false);
    if (step.event.required) assert.ok(step.event.outboxTable);
  }
  const source = read('scripts/runtime/replay-b26-journey.mjs');
  assert.doesNotMatch(source, /sendAndWait|KafkaTemplate|kafkaTemplate/i);
  assert.doesNotMatch(source, /jsonwebtoken|privateKey|sign\s*\(/i);
});

test('static replay performs zero network/database/Kafka effects and cannot claim runtime success', () => {
  const preview = createB26JourneyPreview({ runId: 'run-b26-static-no-effects' });
  assert.equal(preview.mode, 'preview-static');
  assert.equal(preview.runtimeStatus, 'pending');
  assert.equal(preview.decision, 'DENY_RUNTIME_CLAIM');
  assert.equal(preview.auth.tokenProvided, false);
  assert.equal(preview.auth.syntheticJwt, false);
  assert.equal(preview.counters.networkRequests, 0);
  assert.equal(preview.counters.databaseWrites, 0);
  assert.equal(preview.counters.kafkaPublishes, 0);
  assert.equal(preview.counters.kafkaConsumes, 0);
  assert.equal(preview.reconciliation.api, 'pending-no-network-request');
  assert.equal(preview.reconciliation.db, 'pending-no-database-write');
  assert.equal(preview.reconciliation.kafka, 'pending-no-publish-or-consume');
  assert.equal(preview.runtimeEvidence, null);
  assert.ok(preview.blockers.length >= 3);
  const serialized = JSON.stringify(preview);
  assert.doesNotMatch(serialized, /accessToken|refreshToken|authorizationCode|privateKey|clientSecret|password/i);
});

test('static replay is deterministic for the same run identity and rejects supplied JWT material', () => {
  const first = createB26JourneyPreview({ runId: 'run-b26-deterministic' });
  const second = createB26JourneyPreview({ runId: 'run-b26-deterministic' });
  assert.deepEqual(first.steps.map((step) => step.correlation), second.steps.map((step) => step.correlation));
  assert.deepEqual(first.events, second.events);
  assert.throws(() => createB26JourneyPreview({ accessToken: 'must-not-be-accepted' }), /rejects supplied JWT/);
});
