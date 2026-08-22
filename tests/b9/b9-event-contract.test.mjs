import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function javaSources(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  const result = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'target' || entry.name.startsWith('.compile-check')) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name.endsWith('.java')) result.push(absolute);
    }
  };
  visit(directory);
  return result;
}

test('B9 Java outbox event names stay inside the registered AsyncAPI set', () => {
  const contract = JSON.parse(fs.readFileSync(
    path.join(root, 'packages/contracts/events/v1/fragments/b9-learner-content.events.json'),
    'utf8',
  ));
  const registered = new Set(contract.events.map((event) => event.eventName));
  const source = [...javaSources('services/learner-service'), ...javaSources('services/content-service')]
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  const emitted = new Set([...source.matchAll(/"((?:learner|content)\.[a-z0-9_.]+\.v\d+)"/g)]
    .map((match) => match[1]));

  const schemaNames = new Set(['learner.event.v1', 'content.event.v1']);
  assert.deepEqual([...emitted].filter((event) => !registered.has(event) && !schemaNames.has(event)), [],
    'B9 services must not emit unregistered integration events');
  assert.ok(emitted.has('learner.profile.updated.v1'));
  assert.ok(emitted.has('learner.target.updated.v1'));
  assert.ok(emitted.has('content.version.submitted.v1'));
  assert.ok(emitted.has('content.version.reviewed.v1'));
  assert.ok(emitted.has('content.version.published.v1'));
  assert.ok(emitted.has('content.version.unpublished.v1'));
  assert.ok(emitted.has('content.version.rolled_back.v1'));
  assert.ok(emitted.has('content.public_projection.invalidated.v1'));
});

test('B9 Java content version identity and event payloads use the numeric contract', () => {
  const idSource = fs.readFileSync(
    path.join(root, 'services/content-service/src/main/java/com/englishflow/content/domain/ContentVersionId.java'),
    'utf8',
  );
  const payloadSource = fs.readFileSync(
    path.join(root, 'services/content-service/src/main/java/com/englishflow/content/application/ContentEventPayloads.java'),
    'utf8',
  );
  assert.match(idSource, /record ContentVersionId\(long value\)/);
  assert.match(payloadSource, /number\("contentVersionId",/);
  assert.match(payloadSource, /number\("fromVersionId",/);
  assert.match(payloadSource, /number\("targetVersionId",/);
});

test('B9 Outbox envelope keeps schema/version/actor/correlation fields server-owned', () => {
  const contentEnvelope = fs.readFileSync(
    path.join(root, 'services/content-service/src/main/java/com/englishflow/content/domain/ContentOutboxEvent.java'),
    'utf8',
  );
  const learnerEnvelope = fs.readFileSync(
    path.join(root, 'services/learner-service/src/main/java/com/englishflow/learner/domain/LearnerOutboxEvent.java'),
    'utf8',
  );
  const learnerCommand = fs.readFileSync(
    path.join(root, 'services/learner-service/src/main/java/com/englishflow/learner/application/DefaultLearnerProfileCommandService.java'),
    'utf8',
  );
  assert.match(contentEnvelope, /int version/);
  assert.match(contentEnvelope, /String actorId/);
  assert.match(contentEnvelope, /content\.event\.v1/);
  assert.match(contentEnvelope, /requestId/);
  assert.match(contentEnvelope, /traceId/);
  assert.match(learnerCommand, /learner\.event\.v1/);
  assert.match(learnerEnvelope, /requireRequestId/);
  assert.match(learnerEnvelope, /requireTraceId/);
  assert.match(learnerEnvelope, /actorId\(\)/);
});
