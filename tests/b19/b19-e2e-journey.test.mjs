import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadB19Fixtures, validateB19Fixtures, requireB19RuntimeGate, inspectB19RuntimeGate } from '../../scripts/runtime/validate-b19-test-fixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixtures = validateB19Fixtures({ rootDirectory: root }).fixture;
const catalog = JSON.parse(fs.readFileSync(path.join(root, fixtures.contract.eventCatalogPath), 'utf8'));
const eventByName = new Map(catalog.events.map((event) => [event.eventName, event]));
const forbidden = new Set(fixtures.forbiddenClientAuthorityFields.map((field) => field.toLowerCase()));

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const traceId = hash('b19-trace').slice(0, 32);

function resolveRef(document, schema) {
  let current = schema;
  while (current?.$ref) current = current.$ref.slice(2).split('/').reduce((value, key) => value[key.replaceAll('~1', '/').replaceAll('~0', '~')], document);
  return current;
}

function scalarFor(schema, field) {
  if (schema.const !== undefined) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.pattern?.includes('[a-f0-9]')) return 'a'.repeat(Math.max(32, Number(schema.pattern.match(/\{(\d+),?/i)?.[1] ?? 32)));
  if (schema.format === 'date-time') return '2026-08-23T00:00:00.000Z';
  if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 1;
  if (schema.type === 'boolean') return false;
  return `b19-${field}`;
}

function exampleFor(schema, field, document = catalog) {
  const resolved = resolveRef(document, schema ?? {});
  if (resolved.oneOf?.length || resolved.anyOf?.length) return exampleFor((resolved.oneOf ?? resolved.anyOf)[0], field, document);
  if (resolved.type === 'object' || resolved.properties) {
    const result = {};
    for (const name of resolved.required ?? Object.keys(resolved.properties ?? {})) result[name] = exampleFor(resolved.properties?.[name] ?? {}, name, document);
    return result;
  }
  if (resolved.type === 'array') return [exampleFor(resolved.items ?? {}, `${field}Item`, document)];
  return scalarFor(resolved, field);
}

function assertShape(value, schema, location, document = catalog) {
  const resolved = resolveRef(document, schema ?? {});
  if (resolved.enum) assert.ok(resolved.enum.includes(value), `${location} enum`);
  if (resolved.const !== undefined) assert.equal(value, resolved.const, location);
  if (resolved.type === 'object' || resolved.properties) {
    assert.equal(typeof value, 'object', location);
    for (const field of resolved.required ?? []) assert.ok(Object.hasOwn(value, field), `${location}.${field} required`);
    if (resolved.additionalProperties === false) for (const key of Object.keys(value)) assert.ok(resolved.properties?.[key], `${location}.${key} unknown`);
    for (const [key, child] of Object.entries(value)) if (resolved.properties?.[key]) assertShape(child, resolved.properties[key], `${location}.${key}`, document);
  } else if (resolved.type === 'array') {
    assert.ok(Array.isArray(value), location);
    for (const [index, child] of value.entries()) assertShape(child, resolved.items ?? {}, `${location}[${index}]`, document);
  } else if (resolved.type === 'integer') assert.equal(Number.isInteger(value), true, location);
  else if (resolved.type === 'number') assert.equal(typeof value, 'number', location);
  else if (resolved.type === 'boolean') assert.equal(typeof value, 'boolean', location);
  else if (resolved.type === 'string') assert.equal(typeof value, 'string', location);
}

function assertNoClientAuthority(value, location = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(forbidden.has(key.toLowerCase()), false, `${location}.${key} is client authority`);
    assertNoClientAuthority(child, `${location}.${key}`);
  }
}

function createJourney() {
  const state = {
    phase: 'ANONYMOUS',
    subject: null,
    tenantId: null,
    targetId: null,
    content: null,
    attempt: null,
    assessmentFact: null,
    projection: 'NOT_STARTED',
    review: null,
    report: null,
    notification: null,
    events: [],
    idempotency: new Map(),
    sequence: 1,
    compensation: null
  };

  function emit(eventName, aggregateId, overrides = {}) {
    const definition = eventByName.get(eventName);
    assert.ok(definition, `missing event ${eventName}`);
    const payloadSchema = resolveRef(catalog, definition.payloadSchema);
    const payload = exampleFor(payloadSchema, 'payload');
    Object.assign(payload, overrides);
    assertShape(payload, payloadSchema, `${eventName}.payload`);
    const event = {
      eventId: `evt-b19-${String(state.sequence).padStart(4, '0')}`,
      eventName,
      schema: definition.schema,
      version: definition.version,
      occurredAt: '2026-08-23T00:00:00.000Z',
      aggregateType: definition.aggregateType,
      aggregateId,
      actorId: state.subject ?? 'system-b19',
      traceId,
      requestId: `req-b19-${String(state.sequence).padStart(4, '0')}`,
      schemaVersion: definition.schema,
      dedupeKey: `dedupe-b19-${String(state.sequence).padStart(4, '0')}`,
      payload
    };
    state.events.push(event);
    state.sequence += 1;
    return event;
  }

  function login(input) {
    assertNoClientAuthority(input);
    assert.equal(input.accountId, 'learner-adult');
    state.phase = 'AUTHENTICATED';
    state.subject = fixtures.journey.subject;
    state.tenantId = fixtures.journey.tenantId;
    emit('auth.principal.mapped.v1', state.subject, { principalId: state.subject });
    return { status: 'AUTHENTICATED', subject: state.subject, tenantId: state.tenantId };
  }

  function setTarget(input) {
    assertNoClientAuthority(input);
    assert.equal(state.phase, 'AUTHENTICATED');
    state.targetId = input.targetId;
    emit('learner.target.updated.v1', state.targetId, { tenantId: state.tenantId, principalId: state.subject });
    return { status: 'TARGET_READY', targetId: state.targetId };
  }

  function startLearning(input) {
    assertNoClientAuthority(input);
    assert.equal(state.targetId, fixtures.journey.targetId);
    state.content = { contentId: input.contentId, contentVersion: input.contentVersion };
    state.phase = 'LEARNING';
    emit('learner.first_day.projected.v1', state.subject, { tenantId: state.tenantId, principalId: state.subject, readiness: 'READY', taskCount: 1 });
    return { status: 'READY', content: state.content };
  }

  function submit(input) {
    assertNoClientAuthority(input);
    assert.equal(typeof input.answerDigest, 'string');
    assert.equal(typeof input.idempotencyKey, 'string');
    const fingerprint = hash(JSON.stringify({ attemptId: input.attemptId, answerDigest: input.answerDigest }));
    const previous = state.idempotency.get(input.idempotencyKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error('idempotency conflict');
      return { ...previous.result, replayed: true };
    }
    assert.equal(state.phase, 'LEARNING');
    state.attempt = { attemptId: input.attemptId, answerDigest: input.answerDigest };
    state.phase = 'SUBMITTED';
    emit('assessment.attempt.submitted.v1', input.attemptId, { tenantId: state.tenantId, principalId: state.subject, attemptId: input.attemptId, submissionDigest: input.answerDigest });
    emit('workflow.assessment_learning.saga_started.v1', `saga-${input.attemptId}`, { tenantId: state.tenantId, sagaId: `saga-${input.attemptId}` });
    const result = { status: 'SUBMITTED', attemptId: input.attemptId, replayed: false };
    state.idempotency.set(input.idempotencyKey, { fingerprint, result });
    return result;
  }

  function assess({ failProjection = false } = {}) {
    assert.equal(state.phase, 'SUBMITTED');
    const assessed = emit('assessment.attempt.assessed.v1', state.attempt.attemptId, { tenantId: state.tenantId, principalId: state.subject, attemptId: state.attempt.attemptId });
    state.assessmentFact = { eventId: assessed.eventId, scoreBucket: 'PASS' };
    if (failProjection) {
      state.projection = 'COMPENSATION_REQUIRED';
      state.compensation = emit(fixtures.journey.compensationEvent, `saga-${state.attempt.attemptId}`, { tenantId: state.tenantId, sagaId: `saga-${state.attempt.attemptId}` });
      return { status: 'COMPENSATION_REQUIRED', assessmentFactPreserved: true };
    }
    return completeProjection();
  }

  function completeProjection() {
    state.projection = 'PROJECTED';
    emit('learning.mastery.projected.v1', state.attempt.attemptId, { tenantId: state.tenantId, principalId: state.subject, sourceAttemptId: state.attempt.attemptId, sourceAssessmentEventId: state.assessmentFact.eventId });
    state.review = { status: 'SCHEDULED', queueItemId: `queue-${state.attempt.attemptId}` };
    emit('learning.review.scheduled.v1', state.review.queueItemId, { tenantId: state.tenantId, principalId: state.subject, queueItemId: state.review.queueItemId });
    state.report = { status: 'READY', reportId: `report-${state.attempt.attemptId}` };
    emit('report.generated.v1', state.report.reportId, { status: 'READY' });
    state.notification = { status: 'REQUESTED', notificationId: `notification-${state.attempt.attemptId}` };
    emit('notification.requested.v1', state.notification.notificationId, { notificationId: state.notification.notificationId, subjectRef: state.subject, locale: 'zh-CN' });
    state.phase = 'COMPLETED';
    return { status: 'COMPLETED', scoreBucket: state.assessmentFact.scoreBucket };
  }

  function recover() {
    assert.equal(state.projection, 'COMPENSATION_REQUIRED');
    emit(fixtures.journey.replayEvent, state.attempt.attemptId, { tenantId: state.tenantId, sourceEventId: state.assessmentFact.eventId });
    return completeProjection();
  }

  function reconcile() {
    const assessedCount = state.events.filter((event) => event.eventName === 'assessment.attempt.assessed.v1').length;
    const projectionCount = state.events.filter((event) => event.eventName === 'learning.mastery.projected.v1').length;
    return {
      status: state.projection === 'PROJECTED' && assessedCount === 1 && projectionCount === 1 ? (state.compensation ? 'MATCHED_AFTER_COMPENSATION' : 'MATCHED') : 'COMPENSATION_REQUIRED',
      assessmentFactPreserved: Boolean(state.assessmentFact),
      duplicateAssessmentFacts: Math.max(0, assessedCount - 1),
      assessmentCount: assessedCount,
      projectionCount
    };
  }

  return { state, login, setTarget, startLearning, submit, assess, recover, reconcile };
}

function runHappyPath() {
  const journey = createJourney();
  journey.login({ accountId: 'learner-adult' });
  journey.setTarget({ targetId: fixtures.journey.targetId });
  journey.startLearning({ contentId: fixtures.journey.contentId, contentVersion: fixtures.journey.contentVersion });
  const first = journey.submit({ attemptId: fixtures.journey.attemptId, idempotencyKey: fixtures.journey.idempotencyKey, answerDigest: hash('synthetic-answer') });
  const replay = journey.submit({ attemptId: fixtures.journey.attemptId, idempotencyKey: fixtures.journey.idempotencyKey, answerDigest: hash('synthetic-answer') });
  const assessed = journey.assess();
  return { journey, first, replay, assessed };
}

test('B19 synthetic E2E covers login to notification and idempotent replay', () => {
  const { journey, first, replay, assessed } = runHappyPath();
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(assessed.status, 'COMPLETED');
  assert.equal(journey.state.review.status, 'SCHEDULED');
  assert.equal(journey.state.report.status, 'READY');
  assert.equal(journey.state.notification.status, 'REQUESTED');
  const names = journey.state.events.map((event) => event.eventName);
  let previous = -1;
  for (const expected of fixtures.journey.expectedEvents) {
    const index = names.indexOf(expected);
    assert.ok(index > previous, `${expected} is missing or out of order`);
    previous = index;
  }
  for (const event of journey.state.events) {
    assert.match(event.traceId, /^[a-f0-9]{32}$/);
    assert.match(event.schemaVersion, /\.v\d+$/);
    assert.ok(event.payload && typeof event.payload === 'object');
  }
  assert.deepEqual(journey.reconcile(), { status: 'MATCHED', assessmentFactPreserved: true, duplicateAssessmentFacts: 0, assessmentCount: 1, projectionCount: 1 });
});

test('B19 failure compensation preserves facts, replays safely and reconciles', () => {
  const journey = createJourney();
  journey.login({ accountId: 'learner-adult' });
  journey.setTarget({ targetId: fixtures.journey.targetId });
  journey.startLearning({ contentId: fixtures.journey.contentId, contentVersion: fixtures.journey.contentVersion });
  journey.submit({ attemptId: fixtures.journey.attemptId, idempotencyKey: fixtures.journey.idempotencyKey, answerDigest: hash('failure-answer') });
  const failed = journey.assess({ failProjection: true });
  assert.deepEqual(failed, { status: 'COMPENSATION_REQUIRED', assessmentFactPreserved: true });
  assert.equal(journey.reconcile().status, 'COMPENSATION_REQUIRED');
  const recovered = journey.recover();
  assert.equal(recovered.status, 'COMPLETED');
  assert.equal(journey.state.events.filter((event) => event.eventName === 'assessment.attempt.assessed.v1').length, 1);
  assert.equal(journey.reconcile().status, 'MATCHED_AFTER_COMPENSATION');
});

test('B19 client cannot provide tenant, owner, role, permission, score or answer authority', () => {
  const journey = createJourney();
  assert.throws(() => journey.login({ accountId: 'learner-adult', role: 'admin' }), /client authority/);
  journey.login({ accountId: 'learner-adult' });
  assert.throws(() => journey.setTarget({ targetId: fixtures.journey.targetId, tenantId: 'attacker-tenant' }), /client authority/);
  journey.setTarget({ targetId: fixtures.journey.targetId });
  journey.startLearning({ contentId: fixtures.journey.contentId, contentVersion: fixtures.journey.contentVersion });
  assert.throws(() => journey.submit({ attemptId: fixtures.journey.attemptId, idempotencyKey: fixtures.journey.idempotencyKey, answerDigest: hash('answer'), score: 100 }), /client authority/);
  assert.equal(journey.state.events.filter((event) => event.eventName === 'assessment.attempt.submitted.v1').length, 0);
});

test('B19 runtime gate is explicit and never treated as synthetic evidence', () => {
  const loaded = loadB19Fixtures(root);
  const gate = inspectB19RuntimeGate(loaded, process.env);
  assert.equal(gate.executed, false);
  if (process.env.B19_REQUIRE_RUNTIME === '1') requireB19RuntimeGate(loaded, process.env);
  else assert.equal(gate.mode, 'STATIC_ONLY');
});
