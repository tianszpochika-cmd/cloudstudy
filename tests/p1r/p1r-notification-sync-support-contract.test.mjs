import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FROZEN_POLICY_SHA256,
  policyDigest,
  readNotificationSyncSupportContractInputs,
  validateNotificationSyncSupportContractData,
  validateNotificationSyncSupportContractFiles,
} from '../../scripts/audit/p1r-notification-sync-support-contract-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseline = readNotificationSyncSupportContractInputs({ root });
const ready = baseline.readErrors.length === 0;

function cloneInputs() {
  return structuredClone(baseline);
}

function rejectMutation(name, mutate) {
  test(`adversarial mutation: ${name}`, { skip: !ready }, () => {
    const input = cloneInputs();
    mutate(input);
    const report = validateNotificationSyncSupportContractData(input);
    assert.equal(report.result, 'FAIL', `${name} must fail closed; got ${report.errors.join(' | ')}`);
    assert(report.errors.length > 0, `${name} must emit a diagnostic`);
  });
}

test('M1-016 repository contract is a D2/static fail-closed boundary', { skip: !ready }, () => {
  const report = validateNotificationSyncSupportContractFiles({ root });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(report.policyDigest, FROZEN_POLICY_SHA256);
  assert.equal(policyDigest(baseline.policy), FROZEN_POLICY_SHA256);
  assert.equal(report.summary.canonicalNotificationRoutes, 7);
  assert.equal(report.summary.canonicalNotificationSchemas, 10);
  assert.equal(report.summary.canonicalEvents, 8);
  assert.equal(report.summary.b26, 'STATIC_ONLY_PENDING_NO_GO');
});

test('M1-016 checker CLI emits JSON D2 evidence', { skip: !ready }, () => {
  const result = spawnSync(process.execPath, ['scripts/audit/p1r-notification-sync-support-contract-check.mjs', '--json'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.result, 'PASS');
  assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(report.policyDigest, FROZEN_POLICY_SHA256);
});

rejectMutation('unknown policy root field', (input) => { input.policy.unknownRoot = true; });
rejectMutation('runtime promotion', (input) => { input.policy.runtimeStatus = 'RUNTIME_VERIFIED'; });
rejectMutation('unknown collection decision', (input) => { input.policy.collectionPolicy.unknownFieldDecision = 'ALLOW'; });
rejectMutation('notification SMS removed', (input) => { input.policy.notification.channels = input.policy.notification.channels.filter((channel) => channel !== 'SMS'); });
rejectMutation('notification subscription template drift', (input) => { input.policy.notification.exactSubscriptions[0].templateKey = 'arbitrary.template'; });
rejectMutation('notification preference CAS removed', (input) => { input.policy.notification.preference.compareAndSet.required = false; });
rejectMutation('notification retry sixth attempt', (input) => { input.policy.notification.retry.maxAttemptsIncludingFirst = 6; });
rejectMutation('notification unknown failure retry', (input) => { input.policy.notification.retry.unknownFailureDecision = 'RETRY'; });
rejectMutation('sync required payload hash removed', (input) => { input.policy.sync.requiredFields = input.policy.sync.requiredFields.filter((field) => field !== 'payloadHash'); });
rejectMutation('sync generic writer allowed', (input) => { input.policy.sync.centralWriter = 'ALLOWED'; });
rejectMutation('sync mastery merge allowed', (input) => { input.policy.sync.conflict.clientMerge = 'ALLOW'; });
rejectMutation('sync unknown entity owner', (input) => { input.policy.sync.ownerMap.UNKNOWN = 'learning-service'; });
rejectMutation('support state injected', (input) => { input.policy.support.states.push('ARCHIVED'); });
rejectMutation('support category removed', (input) => { input.policy.support.categories.pop(); });
rejectMutation('support client priority injection', (input) => { input.policy.support.ticket.clientWritableFields.push('priority'); });
rejectMutation('support expected CAS removed', (input) => { input.policy.support.ticket.expectedVersion.staleDecision = 'ALLOW'; });
rejectMutation('support legal hold unknown allowed', (input) => { input.policy.support.retention.unknownLegalHoldDecision = 'ALLOW'; });
rejectMutation('support attachment raw bytes allowed', (input) => { input.policy.support.attachmentReference.forbiddenFields = input.policy.support.attachmentReference.forbiddenFields.filter((field) => field !== 'rawBytes'); });
rejectMutation('support dual publish', (input) => { input.policy.support.events.dualPublish = true; });
rejectMutation('legacy v1 promotion', (input) => { input.policy.legacyCompatibility.notification.B11 = 'CANONICAL'; });
rejectMutation('event dual publish', (input) => { input.policy.events.dualPublish = true; });
rejectMutation('old sync event name returns to canonical plan', (input) => { input.policy.events.canonicalPlanned = input.policy.events.canonicalPlanned.map((name) => name === 'sync.command_receipted.v2' ? 'sync.enqueued.v2' : name); });
rejectMutation('event governance binding producer drift', (input) => { input.policy.events.governanceBindings[0].producer = 'learning-service'; });
rejectMutation('event governance binding unknown field', (input) => { input.policy.events.governanceBindings[0].unknownField = true; });
rejectMutation('event source subscription binding drift', (input) => { input.policy.events.sourceSubscriptionBindings[0].consumerGroup = 'cg.forged.v1'; });
rejectMutation('event source subscription unknown field', (input) => { input.policy.events.sourceSubscriptionBindings[0].unknownField = true; });
rejectMutation('event source subscription ungoverned catalog source', (input) => { const event = input.eventCatalog.events.find((item) => item.eventName === 'learning.review.scheduled.v2'); delete event['x-p1r-governance']; });
rejectMutation('B26 static projection owner drift', (input) => { input.policy.events.b26StaticProjection.newTopic.ownerService = 'workflow-service'; });
rejectMutation('B26 static projection unknown field', (input) => { input.policy.events.b26StaticProjection.unknownField = true; });
rejectMutation('B12 canonical operation runtime claim', (input) => { input.b12OpenApi.paths['/api/v1/notifications/preferences'].get['x-contract'].runtimeStatus = 'RUNTIME_VERIFIED'; });
rejectMutation('B12 preference expectedVersion removal', (input) => { input.b12OpenApi.components.schemas.M1016NotificationPreferenceCommand.required = input.b12OpenApi.components.schemas.M1016NotificationPreferenceCommand.required.filter((field) => field !== 'expectedVersion'); });
rejectMutation('B12 canonical owner spoof', (input) => { input.b12OpenApi.paths['/api/v1/notifications/preferences'].get['x-owner'] = 'learning-service'; });
rejectMutation('B12 unknown notification type', (input) => { const parameter = input.b12OpenApi.paths['/api/v1/notifications/preferences/{notificationType}/{channel}'].put.parameters.find((entry) => entry.name === 'notificationType'); const schema = parameter.schema.$ref ? input.b12OpenApi.components.schemas[parameter.schema.$ref.split('/').at(-1)] : parameter.schema; schema.enum = ['NOT_A_CANONICAL_NOTIFICATION_TYPE']; });
rejectMutation('B12 body category drift', (input) => { input.b12OpenApi.components.schemas.M1016NotificationPreferenceCommand.properties.category.enum = ['LEARNING']; });
rejectMutation('B12 path and body category relation weakened', (input) => { input.b12OpenApi.paths['/api/v1/notifications/preferences/{notificationType}/{channel}'].put['x-notification-policy'].pathBodyRelation = 'SAME_STRING_ONLY'; });
rejectMutation('B12 SMS allowlist weakened', (input) => { input.b12OpenApi.paths['/api/v1/notifications/preferences/{notificationType}/{channel}'].put['x-notification-policy'].sms.allowedTypes = ['ACCOUNT_VERIFICATION', 'MARKETING']; });
rejectMutation('B12 locale broadened', (input) => { input.b12OpenApi.components.schemas.M1016NotificationPreferenceCommand.properties.locale.enum = ['zh-CN', 'en-US']; });
rejectMutation('B11 out of order conflict removed', (input) => { input.b11OpenApi.components.schemas.M1016SyncConflict.properties.reasonCode.enum = input.b11OpenApi.components.schemas.M1016SyncConflict.properties.reasonCode.enum.filter((value) => value !== 'OUT_OF_ORDER'); });
rejectMutation('historical fragment AsyncAPI second source', (input) => { input.b11OpenApi.asyncapi = {}; });
rejectMutation('historical support operation promoted', (input) => { input.b13OpenApi.paths['/api/v1/admin/ops/tickets'].post.deprecated = false; delete input.b13OpenApi.paths['/api/v1/admin/ops/tickets'].post['x-migration']; });
rejectMutation('support assigned branch allows null assignee', (input) => { const branch = input.b13OpenApi.components.schemas.M1016SupportTicket.oneOf.find((entry) => entry.properties.state.enum?.includes('ASSIGNED')); branch.properties.assignment.properties.assigneeRef.nullable = true; });
rejectMutation('support permissive duplicate assigned branch', (input) => { const schema = input.b13OpenApi.components.schemas.M1016SupportTicket; const branch = structuredClone(schema.oneOf[0]); branch.properties.state.enum = ['ASSIGNED']; schema.oneOf.push(branch); });
rejectMutation('support OPEN/ASSIGNED state machine removed', (input) => { input.b13OpenApi.components.schemas.M1016SupportTicket.oneOf = []; });
rejectMutation('support usable content accepts uncleared scan', (input) => { const schema = input.b13OpenApi.components.schemas.M1016SupportUsableContentRef; const scanBranch = schema.allOf.find((entry) => entry.properties?.scanStatus); scanBranch.properties.scanStatus.enum = ['PENDING']; });
rejectMutation('support refinement unknown schema keyword', (input) => { const schema = input.b13OpenApi.components.schemas.M1016SupportUsableContentRef; const scanBranch = schema.allOf.find((entry) => entry.properties?.scanStatus); scanBranch.unknownKeyword = true; });
rejectMutation('support command branch removed', (input) => { input.b13OpenApi.components.schemas.M1016SupportAdminCommandRequest.properties.command.oneOf.pop(); });
rejectMutation('event raw payload field', (input) => { input.eventFragment.events[0].payloadSchema = { $ref: '#/payloadSchemas/Unsafe' }; input.eventFragment.payloadSchemas.Unsafe = { type: 'object', additionalProperties: false, properties: { rawAudio: { type: 'string' } } }; });
rejectMutation('synchronized event payload required field removal', (input) => { const eventName = 'notification.requested.v2'; const fragment = input.eventFragment.payloadSchemas.M1016NotificationRequested; const catalog = input.eventCatalog.payloadSchemas?.M1016NotificationRequested; if (fragment && catalog) { delete fragment.properties.contentVersionId; fragment.required = fragment.required.filter((field) => field !== 'contentVersionId'); delete catalog.properties.contentVersionId; catalog.required = catalog.required.filter((field) => field !== 'contentVersionId'); } });
rejectMutation('event catalog producer owner drift', (input) => { const event = input.eventCatalog.events.find((item) => item.eventName === 'notification.requested.v2') ?? input.eventCatalog.events.find((item) => item.status === 'CANONICAL_D2'); if (event?.['x-p1r-governance']?.producer) event['x-p1r-governance'].producer.service = 'learning-service'; });
rejectMutation('event projection topic drift', (input) => { const event = input.eventCatalog.events.find((item) => item.eventName === 'notification.requested.v2') ?? input.eventCatalog.events.find((item) => item.status === 'CANONICAL_D2'); const topic = event?.['x-p1r-governance']?.transport?.topic; const channel = Object.values(input.eventCatalog.asyncapi?.channels ?? {}).find((candidate) => candidate.address === topic); if (channel?.bindings?.kafka) channel.bindings.kafka.topic = 'platform.forged.v1'; });
rejectMutation('event consumer operation id drift', (input) => { const event = input.eventCatalog.events.find((item) => item.eventName === 'notification.requested.v2') ?? input.eventCatalog.events.find((item) => item.status === 'CANONICAL_D2'); const operationId = event?.['x-p1r-governance']?.consumers?.[0]?.subscriptionOperationId; const operation = operationId && input.eventCatalog.asyncapi?.operations?.[operationId]; if (operation) { delete input.eventCatalog.asyncapi.operations[operationId]; input.eventCatalog.asyncapi.operations.forged_receive_operation = operation; } });
rejectMutation('catalog historical event promoted', (input) => { const event = input.eventCatalog.events.find((item) => item.eventName === 'notification.requested.v1'); event.status = 'CANONICAL_D2'; });
rejectMutation('catalog duplicate event', (input) => { input.eventCatalog.events.push(structuredClone(input.eventCatalog.events[0])); });
rejectMutation('B26 runtime promoted', (input) => { input.b26Runtime.runtimeStatus = 'RUNTIME_VERIFIED'; });
rejectMutation('B26 ACL wildcard', (input) => { input.b26Runtime.broker.aclWildcardAllowed = true; });
rejectMutation('B26 static topic owner drift', (input) => { const topic = input.b26Runtime.topics.find((entry) => entry.name === 'platform.admin-ops.v1'); topic.ownerService = 'workflow-service'; });
rejectMutation('Gateway domain owner spoof', (input) => { const route = input.canonicalOpenApi['x-p1r-gateway-boundary'].routeRules.find((item) => item.ruleId === 'notifications-domain'); route.upstreamOwner = 'learning-service'; });

rejectMutation('OpenAPI unknown response ref', (input) => {
  const schema = input.b12OpenApi.paths['/api/v1/notifications/preferences'].get.responses['200'].content['application/json'].schema;
  schema.allOf[0].$ref = '#/components/schemas/ApiCursorPageEnvelopeForged';
});
rejectMutation('OpenAPI forged request ref with valid-name prefix', (input) => {
  input.b5OpenApi.paths['/api/v1/support/tickets'].post.requestBody.content['application/json'].schema.$ref = '#/components/schemas/M1016SupportTicketCreateRequestForged';
});
rejectMutation('OpenAPI external ref is rejected', (input) => {
  input.b11OpenApi.paths['/api/v1/learning/sync/conflicts/{conflictId}/recovery'].post.requestBody.content['application/json'].schema.$ref = 'https://attacker.invalid/forged.json';
});
rejectMutation('OpenAPI request oneOf extra branch is rejected', (input) => {
  const requestBody = input.b12OpenApi.paths['/internal/v1/notifications/retry'].post.requestBody.content['application/json'];
  requestBody.schema = {
    oneOf: [
      { $ref: '#/components/schemas/M1016NotificationRetryCommand' },
      { $ref: '#/components/schemas/M1016NotificationRecoveryCommand' },
    ],
  };
});
rejectMutation('OpenAPI malformed allOf child is rejected', (input) => {
  input.b12OpenApi.components.schemas.M1016NotificationRecoveryCommand.allOf = ['forged-schema-branch'];
});
rejectMutation('OpenAPI malformed properties map is rejected', (input) => {
  input.b11OpenApi.components.schemas.M1016SyncRecoveryRequest.properties = ['tenantId'];
});
rejectMutation('clientAuthority prefix suffix is rejected', (input) => {
  input.b12OpenApi.paths['/api/v1/notifications/preferences'].get['x-authorization'].clientAuthority = 'NONE; forged owner policy';
});
rejectMutation('contract clientAuthority prefix suffix is rejected', (input) => {
  input.b13OpenApi.paths['/api/v1/admin/ops/tickets'].get['x-contract'].clientAuthority = 'NONE; forged tenant policy';
});
rejectMutation('notification retry nested tenant authority', (input) => {
  input.b12OpenApi.components.schemas.M1016NotificationRetryCommand.properties.tenantId = { type: 'string' };
});
rejectMutation('notification recovery allOf owner authority', (input) => {
  input.b12OpenApi.components.schemas.M1016NotificationRecoveryCommand.allOf = [{
    type: 'object',
    properties: { owner: { type: 'string' } },
  }];
});
rejectMutation('sync recovery anyOf role authority', (input) => {
  input.b11OpenApi.components.schemas.M1016SyncRecoveryRequest.anyOf = [{
    type: 'object',
    properties: { role: { type: 'string' } },
  }];
});
rejectMutation('sync recovery not principal authority', (input) => {
  input.b11OpenApi.components.schemas.M1016SyncRecoveryRequest.not = {
    type: 'object',
    properties: { principalId: { type: 'string' } },
  };
});
rejectMutation('support command oneOf tenant authority', (input) => {
  input.b13OpenApi.components.schemas.M1016SupportAssignCommand.properties.tenantId = { type: 'string' };
});
rejectMutation('support transition state authority', (input) => {
  input.b13OpenApi.components.schemas.M1016SupportTransitionCommand.properties.state = { type: 'string' };
});
rejectMutation('support message body field is forbidden', (input) => {
  input.b13OpenApi.components.schemas.M1016SupportMessageCreateRequest.properties.body = { type: 'object' };
});
rejectMutation('notification retry nested description field is forbidden', (input) => {
  input.b12OpenApi.components.schemas.M1016NotificationRetryCommand.allOf = [{
    type: 'object',
    properties: { description: { type: 'integer' } },
  }];
});
rejectMutation('sync recovery rawBody field is forbidden', (input) => {
  input.b11OpenApi.components.schemas.M1016SyncRecoveryRequest.properties.rawBody = { type: 'array' };
});
rejectMutation('event payload property type drift', (input) => {
  input.eventFragment.payloadSchemas.M1016NotificationRequested.properties.notificationId.type = 'integer';
  input.eventCatalog.payloadSchemas.M1016NotificationRequested.properties.notificationId.type = 'integer';
});
rejectMutation('B26 sourceRefs drift', (input) => {
  input.b26Runtime.sourceRefs = [...input.b26Runtime.sourceRefs, 'config/forged-source.json'];
});
rejectMutation('B26 notification topic ACL drift', (input) => {
  const topic = input.b26Runtime.topics.find((entry) => entry.name === 'platform.notification.v1');
  topic.acl.find((entry) => entry.principal === 'cg.workflow-from-notification.v1').effect = 'DENY';
});
rejectMutation('B26 learning topic consumer principal drift', (input) => {
  const topic = input.b26Runtime.topics.find((entry) => entry.name === 'platform.learning.v1');
  topic.consumerGroups.find((entry) => entry.name === 'cg.notification-from-learning.v1').principal = 'cg.forged.v1';
});
rejectMutation('B26 event routing consumer projection drift', (input) => {
  const route = input.b26Runtime.eventRouting.find((entry) => entry.eventName === 'notification.requested.v2');
  route.consumerGroups = ['cg.forged.v1'];
});
rejectMutation('B13 historical create owner spoof', (input) => {
  input.b13OpenApi.paths['/api/v1/admin/ops/tickets'].post['x-owner'] = 'workflow-service';
});
rejectMutation('B13 historical create canonical request ref drift', (input) => {
  input.b13OpenApi.paths['/api/v1/admin/ops/tickets'].post.requestBody.content['application/json'].schema.$ref = '#/components/schemas/B13SupportTicketCreateRequest';
});

test('policy digest is stable and source-bound', { skip: !ready }, () => {
  assert.equal(policyDigest(baseline.policy), FROZEN_POLICY_SHA256);
  assert.match(baseline.policy.sourceBaseline, /^[0-9a-f]{40}$/i);
  assert.match(baseline.policy.startCommit, /^[0-9a-f]{40}$/i);
});

test('malformed contract input fails closed without throwing', { skip: !ready }, () => {
  const input = cloneInputs();
  input.b11OpenApi = { paths: [] };
  let report;
  assert.doesNotThrow(() => { report = validateNotificationSyncSupportContractData(input); });
  assert.equal(report.result, 'FAIL');
  assert(report.errors.length > 0);
});
