import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildM1018OpenApiExpectedProjection,
  M2001_SOURCE_CONTRACT_BASELINE_REF,
  M1018_SOURCE_CONTRACT_BASELINE_REF,
  compareB26WorkflowGovernance,
  compareContracts,
  isValidM1018PromotionAllowance,
} from '../../scripts/contracts/compatibility-diff.mjs';
import { validateM1018CompatibilityPolicy } from '../../scripts/contracts/compatibility-git-baseline.mjs';
import { mergeEvents, projectCanonicalAsyncApi } from '../../scripts/contracts/merge-b1-fragments.mjs';
import {
  EXPECTED_EVENT_FRAGMENT_INVENTORY,
  M1018_IAM_GAP_D2_CLOSURE_TASKS,
  M1018_SOURCE_D2_CLOSED_EVENT_GAPS,
} from '../../scripts/contracts/event-catalog-policy.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const policyPath = 'config/p1r-iam-event-contract.v1.json';
const fragmentPath = 'packages/contracts/events/v1/fragments/m1-018-iam-v2.events.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, ...relativePath.split('/')), 'utf8'));
}

function readBaselineJson(relativePath, ref = M1018_SOURCE_CONTRACT_BASELINE_REF) {
  return JSON.parse(execFileSync(
    'git',
    ['show', `${ref}:${relativePath}`],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true },
  ));
}

function buildExpectedCatalog() {
  const catalog = structuredClone(readBaselineJson('packages/contracts/events/v1/catalog.json'));
  catalog['x-p1r-event-governance'].fragmentInventory = structuredClone(EXPECTED_EVENT_FRAGMENT_INVENTORY);
  catalog['x-p1r-event-governance'].plannedClosures = catalog['x-p1r-event-governance'].plannedClosures.map((closure) => {
    const d2ClosureTasks = M1018_IAM_GAP_D2_CLOSURE_TASKS[closure?.gapId];
    return {
      ...closure,
      status: M1018_SOURCE_D2_CLOSED_EVENT_GAPS.includes(closure?.gapId)
        ? 'D2_CONTRACT_CLOSED'
        : closure.status,
      ...(d2ClosureTasks === undefined ? {} : { d2ClosureTasks: [...d2ClosureTasks] }),
    };
  });
  mergeEvents(catalog, readJson(fragmentPath), fragmentPath);
  projectCanonicalAsyncApi(catalog);
  return catalog;
}

const policy = readJson(policyPath);
const allowance = policy.compatibilityPromotion;
const baseline = Object.freeze({
  openapi: readBaselineJson('packages/contracts/openapi/v1/openapi.json'),
  events: readBaselineJson('packages/contracts/events/v1/catalog.json'),
  b26: readBaselineJson('config/b26-event-runtime.json'),
});
const expected = Object.freeze({
  // M2-001 adds the Gateway execution-target root extension after the M1-018
  // checkpoint. Keep this M1-only test bound to that immutable handoff; the
  // M2 successor is tested by the dedicated gateway compatibility projection.
  openapi: readBaselineJson('packages/contracts/openapi/v1/openapi.json', M2001_SOURCE_CONTRACT_BASELINE_REF),
  events: buildExpectedCatalog(),
  b26: readJson('config/b26-event-runtime.json'),
});

function clone(value) {
  return structuredClone(value);
}

function findEvent(catalog, name) {
  const event = catalog.events.find((candidate) => candidate.eventName === name);
  assert.ok(event, `${name} must exist`);
  return event;
}

function findRoute(runtime, name) {
  const route = runtime.eventRouting.find((candidate) => candidate.eventName === name);
  assert.ok(route, `${name} B26 route must exist`);
  return route;
}

test('M1-018 IAM compatibility allowance is frozen, source-bound and static only', () => {
  assert.deepEqual(validateM1018CompatibilityPolicy(policy), []);
  assert.equal(isValidM1018PromotionAllowance(allowance), true);
  assert.deepEqual(
    buildM1018OpenApiExpectedProjection(baseline.openapi, expected.openapi, allowance),
    expected.openapi,
  );
  assert.deepEqual(compareContracts('openapi', baseline.openapi, expected.openapi, { allowance }), []);
  assert.deepEqual(compareContracts('events', baseline.events, expected.events, { allowance }), []);
  assert.deepEqual(compareB26WorkflowGovernance(baseline.b26, expected.b26, { allowance }), []);
});

for (const [name, kind, mutate] of [
  ['IAM producer drift', 'events', (catalog) => { findEvent(catalog, 'iam.account.bootstrap.created.v2')['x-p1r-governance'].producer.service = 'workflow-service'; }],
  ['IAM B8 v1 historical promotion', 'events', (catalog) => { findEvent(catalog, 'auth.session.rotated.v1').status = 'CANONICAL_D2'; }],
  ['IAM dual-publish v1 route', 'events', (catalog) => { catalog.events.push({ eventName: 'iam.session.revoked.v2', status: 'CANONICAL_D2' }); }],
  ['IAM B26 Gateway consumer', 'b26', (runtime) => { findRoute(runtime, 'iam.policy.security_state_changed.v2').consumerGroups.push('cg.gateway-from-iam.v1'); }],
  ['IAM B26 runtime promotion', 'b26', (runtime) => { runtime.runtimeStatus = 'RUNTIME_VERIFIED'; }],
]) {
  test(`M1-018 IAM compatibility rejects ${name}`, () => {
    const next = clone(expected[kind]);
    mutate(next);
    const changes = kind === 'b26'
      ? compareB26WorkflowGovernance(baseline.b26, next, { allowance })
      : compareContracts('events', baseline.events, next, { allowance });
    assert(changes.length > 0, `${name} must be rejected`);
  });
}

test('M1-018 IAM compatibility rejects any allowance expansion', () => {
  const nextAllowance = clone(allowance);
  nextAllowance.allowsDualPublish = true;
  assert.equal(isValidM1018PromotionAllowance(nextAllowance), false);
  assert(compareContracts('events', baseline.events, expected.events, { allowance: nextAllowance }).length > 0);
  assert(compareB26WorkflowGovernance(baseline.b26, expected.b26, { allowance: nextAllowance }).length > 0);
});
