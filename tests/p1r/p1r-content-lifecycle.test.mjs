import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readContentLifecycleInputs,
  validateContentLifecycle,
  validateContentLifecycleData,
} from '../../scripts/audit/p1r-content-lifecycle-check.mjs';

const baseline = readContentLifecycleInputs();

function candidate() {
  return structuredClone(baseline);
}

function evaluate(mutate) {
  const input = candidate();
  mutate(input);
  return validateContentLifecycleData(input);
}

function catalogEvent(input, eventName) {
  return input.catalog.events.find((event) => event.eventName === eventName);
}

function b9Schema(input, name) {
  return input.b9OpenApi.components.schemas[name] || input.b9SharedOpenApi.components.schemas[name];
}

function b9AdminReviewRecord(input) {
  const reviewRecords = b9Schema(input, 'B9AdminContentState').properties.reviewRecords;
  const items = reviewRecords.items;
  return items.$ref ? b9Schema(input, items.$ref.split('/').at(-1)) : items;
}

test('P1R-M1-008 content lifecycle, B9/B1 disposition, catalog, B26 and reliability governance pass as D2 only', () => {
  const report = validateContentLifecycle();
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.deepEqual(report.summary, {
    taskId: 'P1R-M1-008',
    maturity: 'D2_CONTRACT_READY',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    persistentStates: 5,
    commands: 11,
    actorClasses: 4,
    scheduleStates: 5,
    canonicalContentEvents: 5,
    historicalContentEvents: 7,
  });
  assert.equal(baseline.b26Runtime.mode, 'static-only');
  assert.equal(baseline.b26Runtime.runtimeStatus, 'pending');
  assert.equal(baseline.b26Runtime.defaultDecision, 'NO-GO');
});

test('content lifecycle rejects state, command, actor, schedule, projection, legacy and runtime promotion drift', () => {
  const cases = [
    ['unknown policy field', (input) => { input.policy.permission = 'CONTENT_ADMIN'; }, /policy keys|unknown runtime/],
    ['runtime attestation', (input) => { input.policy.attestation = 'PASS'; }, /policy keys|unknown runtime/],
    ['runtime promotion', (input) => { input.policy.runtimeStatus = 'RUNTIME_VERIFIED'; }, /must remain D2/],
    ['persistent state injection', (input) => { input.policy.persistentVersionStates.push('UNPUBLISHED'); }, /persistent content-version states/],
    ['legacy alias becomes persistent state', (input) => { input.policy.legacyWireAliases[0].persistentVersionState = 'UNPUBLISHED'; }, /legacy wire aliases/],
    ['ambiguous validate command', (input) => { input.policy.commands[2].name = 'VALIDATE'; }, /content command state machine/],
    ['command stage swap', (input) => { input.policy.commands[4].name = 'FIRST_REVIEW'; }, /content command state machine/],
    ['review stage swap', (input) => { input.policy.reviewStages[0] = 'REVIEW_FIRST'; }, /review stage names/],
    ['reviewer becomes release operator', (input) => { input.policy.commands[4].actorClass = 'RELEASE_OPERATOR'; }, /content command state machine/],
    ['role separation weakened', (input) => { input.policy.actorClasses[3].separation.pop(); }, /four content actor classes/],
    ['missing scheduled command', (input) => { input.policy.commands.splice(7, 1); }, /content command state machine/],
    ['schedule status injection', (input) => { input.policy.schedule.states.push('SUCCEEDED'); }, /content scheduling policy/],
    ['schedule uses local clock', (input) => { input.policy.schedule.clock.scheduledAt = 'LOCAL_TIME'; }, /content scheduling policy/],
    ['schedule client status binding', (input) => { input.policy.schedule.bindingFields.push('validationStatus'); }, /content scheduling policy/],
    ['due recheck weakened', (input) => { input.policy.schedule.dueRecheck.required.pop(); }, /content scheduling policy/],
    ['schedule recovery direct write', (input) => { input.policy.schedule.recovery.directDomainWrite = 'ALLOWED'; }, /content scheduling policy/],
    ['projection epoch fallback', (input) => { input.policy.projection.epoch.consumerRule = 'ACCEPT_OLDER'; }, /content projection policy/],
    ['projection public allow-list weakens', (input) => { input.policy.projection.allowLists[0].allowedFields.pop(); }, /content projection policy/],
    ['session pin silently falls back', (input) => { input.policy.projection.versionPin.emergencyRemoval.silentFallback = 'ALLOWED'; }, /content projection policy/],
    ['correlation loses trace id', (input) => { input.policy.projection.correlation.fields = input.policy.projection.correlation.fields.filter((field) => field !== 'traceId'); }, /content projection policy/],
    ['projection status promotion', (input) => { input.policy.projection.responseStatus.enum.push('RUNTIME_READY'); }, /content projection policy/],
    ['legacy B1 promoted', (input) => { input.policy.legacyB1.newV2Write = 'ALLOWED'; }, /legacy B1 disposition/],
    ['legacy B1 operation inventory loses a write', (input) => { input.policy.legacyB1.deprecatedLifecycleWrites.pop(); }, /legacy B1 disposition/],
    ['planned closure is falsely reopened', (input) => { input.policy.plannedClosureDisposition[0].status = 'PLANNED'; }, /planned-closure disposition/],
    ['planned closure claims runtime verification', (input) => { input.policy.plannedClosureDisposition[0].runtimeStatus = 'RUNTIME_VERIFIED'; }, /planned-closure disposition/],
    ['canonical runtime promotion', (input) => { input.policy.eventGovernance.canonicalRuntimeStatus = 'RUNTIME_VERIFIED'; }, /content event governance policy/],
    ['compatibility promotion baseline moves', (input) => { input.policy.eventGovernance.compatibilityPromotion.immutableGovernanceBaseline = '0000000000000000000000000000000000000000'; }, /content event governance policy/],
    ['compatibility promotion consumer scope widens', (input) => { input.policy.eventGovernance.compatibilityPromotion.addedConsumerGroups.push('cg.learner-from-content.v1'); }, /content event governance policy/],
  ];
  for (const [name, mutate, expected] of cases) {
    const report = evaluate(mutate);
    assert.equal(report.result, 'FAIL', name);
    assert.match(report.errors.join('\n'), expected, name);
  }
});

test('content lifecycle rejects B9 client authority, command/review-stage confusion, schedule shape and projection-status mutation', () => {
  const cases = [
    ['B9 command VALIDATE', (input) => {
      b9Schema(input, 'B9ContentCommandRequest').properties.command.enum[2] = 'VALIDATE';
    }, /B9 content command enum|VALIDATE_DRAFT/],
    ['B9 stage as command', (input) => {
      const request = b9Schema(input, 'B9ContentCommandRequest');
      delete request['x-command-field-policy'].REVIEW_FIRST;
      request['x-command-field-policy'].FIRST_REVIEW = { required: [], allowed: [] };
    }, /B9 command field policy keys|review commands/],
    ['B9 admin review record uses a legacy stage alias', (input) => {
      b9AdminReviewRecord(input).properties.reviewStage.enum[0] = 'FIRST_PENDING';
    }, /review record reviewStage enum/],
    ['B9 admin review decision mixes in a review stage', (input) => {
      b9AdminReviewRecord(input).properties.decision.enum[0] = 'FIRST_REVIEW';
    }, /review record decision enum/],
    ['B9 admin review record loses reviewVersion', (input) => {
      const record = b9AdminReviewRecord(input);
      record.required = record.required.filter((field) => field !== 'reviewVersion');
    }, /review record required fields/],
    ['B9 admin review record becomes client writable', (input) => {
      b9Schema(input, 'B9AdminContentState').properties.reviewRecords.readOnly = false;
    }, /reviewRecords must be a read-only array/],
    ['B9 admin review item becomes client writable', (input) => {
      b9AdminReviewRecord(input).readOnly = false;
    }, /review record must be a closed read-only object/],
    ['B9 admin review record accepts an unknown field', (input) => {
      b9AdminReviewRecord(input).properties.clientReviewer = { type: 'string' };
    }, /review record field set/],
    ['B9 admin state restores legacy reviewStages aliases', (input) => {
      b9Schema(input, 'B9AdminContentState').properties.reviewStages = { type: 'array' };
    }, /must not retain legacy reviewStages aliases/],
    ['B9 command metadata lets UNPUBLISH target a version', (input) => {
      b9Schema(input, 'B9ContentCommandRequest')['x-command-field-policy'].UNPUBLISH.allowed.push('targetVersionNumber');
    }, /B9 command field policy/],
    ['B9 VALIDATE_DRAFT schema loses its field denial', (input) => {
      const branch = b9Schema(input, 'B9ContentCommandRequest').oneOf.find((item) => item.properties.command.const === 'VALIDATE_DRAFT');
      delete branch.not;
    }, /B9 command oneOf branch VALIDATE_DRAFT/],
    ['B9 UNPUBLISH schema accepts targetVersionNumber', (input) => {
      const branch = b9Schema(input, 'B9ContentCommandRequest').oneOf.find((item) => item.properties.command.const === 'UNPUBLISH');
      branch.not.anyOf = branch.not.anyOf.filter((item) => item.required[0] !== 'targetVersionNumber');
    }, /B9 command oneOf branch UNPUBLISH forbidden fields/],
    ['B9 SCHEDULE_PUBLISH schema accepts a review decision', (input) => {
      const branch = b9Schema(input, 'B9ContentCommandRequest').oneOf.find((item) => item.properties.command.const === 'SCHEDULE_PUBLISH');
      branch.not.anyOf = branch.not.anyOf.filter((item) => item.required[0] !== 'reviewDecision');
    }, /B9 command oneOf branch SCHEDULE_PUBLISH forbidden fields/],
    ['B9 client actor injection', (input) => {
      b9Schema(input, 'B9ContentCommandRequest').properties.actorId = { type: 'string' };
    }, /must not accept client actorId/],
    ['B9 command loses optimistic state version', (input) => {
      const request = b9Schema(input, 'B9ContentCommandRequest');
      request.required = request.required.filter((field) => field !== 'expectedStateVersion');
    }, /base required fields/],
    ['B9 client validation status', (input) => {
      b9Schema(input, 'B9PublishScheduleInput').properties.validationStatus = { type: 'string' };
    }, /must not accept client validationStatus/],
    ['B9 schedule state old alias', (input) => {
      b9Schema(input, 'B9ScheduledPublishTask').properties.status.enum[2] = 'SUCCEEDED';
    }, /scheduled task state machine/],
    ['B9 schedule loses audit id', (input) => {
      const task = b9Schema(input, 'B9ScheduledPublishTask');
      task.required = task.required.filter((field) => field !== 'auditId');
    }, /must require auditId|correlation field auditId/],
    ['B9 schedule loses trace correlation', (input) => {
      const task = b9Schema(input, 'B9ScheduledPublishTask');
      task.required = task.required.filter((field) => field !== 'traceId');
    }, /correlation field traceId/],
    ['B9 scheduled task lets SCHEDULED carry completedAt', (input) => {
      const branch = b9Schema(input, 'B9ScheduledPublishTask').oneOf.find((item) => item.properties.status.const === 'SCHEDULED');
      branch.not.anyOf = branch.not.anyOf.filter((item) => item.required[0] !== 'completedAt');
    }, /B9 scheduled task oneOf branch SCHEDULED forbidden fields/],
    ['B9 scheduled task lets RECOVERY_REQUIRED omit recoveryTaskId', (input) => {
      const branch = b9Schema(input, 'B9ScheduledPublishTask').oneOf.find((item) => item.properties.status.const === 'RECOVERY_REQUIRED');
      branch.required = branch.required.filter((field) => field !== 'recoveryTaskId');
    }, /B9 scheduled task oneOf branch RECOVERY_REQUIRED required fields/],
    ['B9 projection status required breaking change', (input) => {
      b9Schema(input, 'B9PublicContentProjection').required.push('projectionStatus');
    }, /must remain optional and additive/],
    ['B9 projection status enum drift', (input) => {
      b9Schema(input, 'B9LearnerContentProjection').properties.projectionStatus.enum.push('UNKNOWN');
    }, /projectionStatus enum/],
    ['B9 public projection leaks rights evidence', (input) => {
      b9Schema(input, 'B9PublicContentProjection').properties.rightsEvidence = { type: 'string' };
    }, /must not expose draft, review, rights-evidence, scheduling, or answer-rule bodies/],
    ['B9 session pin accepts an unapproved emergency reason', (input) => {
      const sessionPin = b9Schema(input, 'B9SessionContentPin');
      sessionPin.properties.reasonCode.enum.push('OUTAGE');
    }, /emergency reason codes/],
    ['B9 session pin loses alternative action', (input) => {
      const sessionPin = b9Schema(input, 'B9SessionContentPin');
      const unavailable = sessionPin.oneOf.find((item) => item.properties.status.const === 'UNAVAILABLE');
      unavailable.required = unavailable.required.filter((field) => field !== 'alternativeAction');
    }, /must expose reasonCode and alternativeAction/],
    ['B9 available session pin permits removal detail', (input) => {
      const sessionPin = b9Schema(input, 'B9SessionContentPin');
      const available = sessionPin.oneOf.find((item) => item.properties.status.const === 'AVAILABLE');
      available.not.anyOf = available.not.anyOf.filter((item) => item.required[0] !== 'reasonCode');
    }, /removal-detail denial/],
  ];
  for (const [name, mutate, expected] of cases) {
    const report = evaluate(mutate);
    assert.equal(report.result, 'FAIL', name);
    assert.match(report.errors.join('\n'), expected, name);
  }
});

test('content lifecycle rejects legacy B1 reactivation and authority-header acceptance', () => {
  const cases = [
    ['B1 write no longer deprecated', (input) => {
      input.b1OpenApi.paths['/api/v1/content'].post.deprecated = false;
    }, /must be deprecated/],
    ['B1 wrong canonical replacement', (input) => {
      input.b1OpenApi.paths['/api/v1/content'].post['x-canonical-replacement'].operationId = 'publishContentVersion';
    }, /must point to B9 command replacement/],
    ['B1 authority header no longer ignored', (input) => {
      input.b1OpenApi.components.parameters.B1ContentRole['x-authority-input-ignored'] = false;
    }, /ignored historical compatibility input/],
    ['B1 deprecated write operation is renamed', (input) => {
      input.b1OpenApi.paths['/api/v1/content'].post.operationId = 'newContentWrite';
    }, /deprecated lifecycle\/write operation set/],
  ];
  for (const [name, mutate, expected] of cases) {
    const report = evaluate(mutate);
    assert.equal(report.result, 'FAIL', name);
    assert.match(report.errors.join('\n'), expected, name);
  }
});

test('content lifecycle rejects canonical owner, topic, group, binding, fragment and historical-event promotion drift', () => {
  const cases = [
    ['aggregate identity mutation', (input) => {
      catalogEvent(input, 'content.version.rolled_back.v1').aggregateIdField = 'contentVersionId';
    }, /aggregateIdField must preserve/],
    ['owner mutation', (input) => {
      catalogEvent(input, 'content.version.published.v1')['x-p1r-governance'].producer.service = 'learning-service';
    }, /producer must be content-service|event governance/],
    ['topic mutation', (input) => {
      catalogEvent(input, 'content.version.published.v1')['x-p1r-governance'].transport.topic = 'platform.learning.v1';
    }, /must use platform.content.v1|event governance/],
    ['content consumer group mutation', (input) => {
      catalogEvent(input, 'content.version.submitted.v1')['x-p1r-governance'].consumers.pop();
    }, /governed consumer groups|event governance/],
    ['B26 route group mutation', (input) => {
      input.b26Runtime.eventRouting.find((route) => route.eventName === 'content.version.published.v1').consumerGroups.pop();
    }, /B26 route consumers|event governance/],
    ['B26 content owner mutation', (input) => {
      input.b26Runtime.topics.find((topic) => topic.name === 'platform.content.v1').ownerService = 'assessment-service';
    }, /content topic owner binding|event governance/],
    ['compatibility promotion admin group has wrong service', (input) => {
      input.b26Runtime.topics.find((topic) => topic.name === 'platform.content.v1').consumerGroups.find((group) => group.name === 'cg.admin-ops-from-content.v1').service = 'learning-service';
    }, /compatibility-promotion B26 group binding|event governance/],
    ['content D2 closure falsely becomes runtime pass', (input) => {
      const closure = input.catalog['x-p1r-event-governance'].plannedClosures.find((item) => item.gapId === 'EVENT-GAP-CONTENT-DUPLICATE');
      closure.status = 'PASS';
    }, /must be D2_CONTRACT_CLOSED|D2 closed gap set|planned closure/],
    ['unrelated event gap is falsely marked D2 closed', (input) => {
      const closure = input.catalog['x-p1r-event-governance'].plannedClosures.find((item) => item.gapId === 'EVENT-GAP-IAM-001');
      closure.status = 'D2_CONTRACT_CLOSED';
    }, /catalog D2 closed gap set|exactly fourteen unrelated event gaps/],
    ['fragment envelope stale', (input) => {
      const fragment = input.eventFragments.find((item) => item.path.endsWith('b9-learner-content.events.json'));
      fragment.data.events.find((event) => event.eventName === 'content.version.submitted.v1')['x-envelope-required'].pop();
    }, /fragment canonical envelope/],
    ['invalidated event promoted', (input) => {
      catalogEvent(input, 'content.public_projection.invalidated.v1').status = 'CANONICAL_D2';
    }, /must remain HISTORICAL_CANDIDATE|exact twelve/],
    ['cms event promoted', (input) => {
      catalogEvent(input, 'cms.content.published.v1').status = 'CANONICAL_D2';
    }, /must remain HISTORICAL_CANDIDATE|exact twelve/],
    ['historical invalidated Kafka binding', (input) => {
      catalogEvent(input, 'content.public_projection.invalidated.v1')['x-kafka'] = { topic: 'platform.content.v1' };
    }, /historical event must not carry|historical candidate/],
    ['invalidated B26 route injection', (input) => {
      input.b26Runtime.eventRouting.push({
        eventName: 'content.public_projection.invalidated.v1',
        topic: 'platform.content.v1',
        partitionKey: 'aggregateId',
        consumerGroups: ['cg.learner-from-content.v1'],
      });
    }, /must not gain a B26 Kafka route|exact twelve/],
    ['reliability omits canonical content event', (input) => {
      input.reliabilityPolicy.catalog.currentCanonicalEvents = input.reliabilityPolicy.catalog.currentCanonicalEvents.filter((eventName) => eventName !== 'content.version.published.v1');
    }, /must be covered by reliability policy|canonical event set/],
  ];
  for (const [name, mutate, expected] of cases) {
    const report = evaluate(mutate);
    assert.equal(report.result, 'FAIL', name);
    assert.match(report.errors.join('\n'), expected, name);
  }
});
