import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const boundary = readJson('config/b17-platform-boundaries.json');
const catalog = readJson('packages/contracts/events/v1/catalog.json');
const catalogNames = new Set((catalog.events ?? catalog.eventDefinitions ?? []).map((event) => event.eventName ?? event.name));

test('B17 platform boundary matrix is Phase 1, closed by default and has one offline/workflow owner', () => {
  assert.equal(boundary.phase, 'phase-1');
  assert.equal(boundary.defaults.crossDomainWrite, 'deny');
  assert.equal(boundary.defaults.clientAuthorityFacts, 'deny');
  assert.equal(boundary.defaults.workflowMayWriteDomainTables, false);
  assert.equal(boundary.offlineOwner, 'notification-service');
  assert.equal(boundary.workflowOwner, 'workflow-service/job-runner');
  assert.equal(boundary.domains.length, 7);
  assert.equal(new Set(boundary.domains.map((domain) => domain.id)).size, 7);
});

test('B17 every platform domain has an owner, private schema, projection consumers and trusted event allowlist', () => {
  for (const domain of boundary.domains) {
    assert.match(domain.id, /^[a-z-]+-service$/);
    assert.match(domain.schema, /^[a-z0-9_]+$/);
    assert.ok(domain.factOwner.length > 0, `${domain.id} must declare facts`);
    assert.equal(domain.commandOwner, domain.id, `${domain.id} must own its commands`);
    assert.ok(Array.isArray(domain.readProjectionConsumers));
    assert.ok(domain.trustedEventInputs.length > 0);
    for (const eventName of domain.trustedEventInputs) {
      assert.ok(catalogNames.has(eventName), `${domain.id} references unknown event ${eventName}`);
    }
    assert.ok(!domain.forbiddenDirectWrites.includes(domain.id), `${domain.id} cannot forbid itself as a direct writer`);
  }
});

test('B17 platform domains cannot become cross-domain table writers or client-authoritative facts', () => {
  const source = fs.readFileSync(path.join(root, 'config/b17-platform-boundaries.json'), 'utf8');
  assert.doesNotMatch(source, /shared[_-](schema|table)|cross[_-]domain[_-]write\s*:\s*['"]allow/i);
  assert.doesNotMatch(source, /client.*(role|tenant|owner).*authorit(y|ative)/i);
  for (const domain of boundary.domains) {
    assert.ok(domain.forbiddenDirectWrites.length >= 0);
    assert.ok(!domain.forbiddenDirectWrites.includes('core-api'), `${domain.id} must not write legacy core-api`);
  }
});

test('B17 platform evidence distinguishes static ownership from Kafka/adapter runtime evidence', () => {
  assert.deepEqual(boundary.runtimeEvidence.static, [
    'owner-matrix',
    'projection-only-admin',
    'trusted-event-allowlist',
    'sensitive-payload-boundary',
    'offline-owner'
  ]);
  assert.ok(boundary.runtimeEvidence.runtime.includes('Kafka-at-least-once'));
  assert.ok(boundary.runtimeEvidence.runtime.includes('DLQ-replay'));
});
