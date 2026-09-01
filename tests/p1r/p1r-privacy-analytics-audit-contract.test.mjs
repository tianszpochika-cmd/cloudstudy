import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FROZEN_POLICY_SHA256,
  readM1017Inputs,
  validatePrivacyAnalyticsAuditContractData,
} from '../../scripts/audit/p1r-privacy-analytics-audit-contract-check.mjs';

const baseline = readM1017Inputs();
const baselineReport = validatePrivacyAnalyticsAuditContractData(baseline);
const ready = baseline.errors.length === 0
  && FROZEN_POLICY_SHA256 !== 'PENDING_M1017_POLICY_SHA256'
  && baselineReport.result === 'PASS';

function clone(value) {
  return structuredClone(value);
}

function cloneInputs() {
  return clone(baseline);
}

function rejectMutation(name, mutate) {
  test(`M1-017 integration mutation: ${name}`, { skip: !ready }, () => {
    const input = cloneInputs();
    assert.doesNotThrow(() => mutate(input), `${name} mutation must be constructible`);
    const report = validatePrivacyAnalyticsAuditContractData(input);
    assert.equal(report.result, 'FAIL', `${name} must fail closed; got ${report.errors.join(' | ')}`);
    assert(report.errors.length > 0, `${name} must emit a diagnostic`);
  });
}

test('M1-017 privacy/analytics/audit integration is canonical D2 and runtime-honest', { skip: !ready }, () => {
  const report = validatePrivacyAnalyticsAuditContractData(cloneInputs());
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.equal(report.task, 'P1R-M1-017');
  assert.equal(report.maturity, 'D2_CONTRACT_READY');
  assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(report.summary.canonicalOperations, 17);
  assert.equal(report.summary.canonicalEvents, 5);
  assert.equal(report.summary.uiTelemetryKafkaEvents, 0);
  assert.equal(report.summary.coolingOffHours, 168);
  assert.equal(report.summary.b26RuntimeStatus, 'pending');
});

rejectMutation('runtime status promotion', (input) => {
  input.policy.runtimeStatus = 'RUNTIME_VERIFIED';
});

rejectMutation('promotion runtime status promotion', (input) => {
  input.policy.compatibilityPromotion.runtimeStatus = 'RUNTIME_VERIFIED';
});

rejectMutation('unknown policy root shape', (input) => {
  input.policy.forgedPolicyField = true;
});

rejectMutation('unknown policy collection decision', (input) => {
  input.policy.collectionPolicy.unknownFieldDecision = 'ALLOW';
});

rejectMutation('analytics consent missing fail-open', (input) => {
  input.analyticsPolicy.consent.missingEffect = 'ACCEPT';
});

rejectMutation('analytics consent revoked fail-open', (input) => {
  input.analyticsPolicy.consent.revokedEffect = 'ACCEPT';
});

rejectMutation('analytics unknown consent fail-open', (input) => {
  input.analyticsPolicy.consent.unknownEffect = 'ALLOW';
});

rejectMutation('analytics deletion allows cancelled state', (input) => {
  input.analyticsPolicy.deletion.allowedStatus.push('CANCELLED');
});

rejectMutation('analytics deletion suppression state removed', (input) => {
  input.analyticsPolicy.deletion.suppressedStatuses = input.analyticsPolicy.deletion.suppressedStatuses
    .filter((status) => status !== 'ANONYMIZED');
});

rejectMutation('analytics cancelled deletion fail-open', (input) => {
  input.analyticsPolicy.deletion.cancelledEffect = 'ALLOW';
});

rejectMutation('audit policy exposes a public route', (input) => {
  input.auditOpenApi.paths['/api/v1/audit/exports'] = {
    get: {
      operationId: 'forgedPublicAuditExport',
      responses: { '200': { description: 'forged' } },
    },
  };
});

rejectMutation('audit OpenAPI raw body bypass', (input) => {
  input.auditOpenApi.components.schemas.M1017AuditExportCreateRequest.properties.rawBody = { type: 'string' };
});

rejectMutation('synchronized audit raw body bypass', (input) => {
  const rawBody = { type: 'string' };
  input.auditOpenApi.components.schemas.M1017AuditExportCreateRequest.properties.rawBody = rawBody;
  input.canonicalOpenApi.components.schemas.M1017AuditExportCreateRequest.properties.rawBody = clone(rawBody);
});

rejectMutation('synchronized audit subject authority bypass', (input) => {
  const subjectId = { type: 'string' };
  input.auditOpenApi.components.schemas.M1017AuditExportCreateRequest.properties.subjectId = subjectId;
  input.canonicalOpenApi.components.schemas.M1017AuditExportCreateRequest.properties.subjectId = clone(subjectId);
});

rejectMutation('synchronized unversioned audit route bypass', (input) => {
  const forged = clone(input.auditOpenApi.paths['/internal/v1/audit/exports']);
  forged.post.operationId = 'forgedUnversionedAuditExport';
  delete forged.post['x-contract'];
  input.auditOpenApi.paths['/v1/audit/exports'] = forged;
  input.canonicalOpenApi.paths['/v1/audit/exports'] = clone(forged);
});

rejectMutation('audit source root runtime promotion', (input) => {
  input.auditOpenApi['x-m1017-audit-export'].runtimeStatus = 'RUNTIME_VERIFIED';
});

rejectMutation('analytics source root runtime promotion', (input) => {
  input.analyticsOpenApi['x-m1017-contract'].runtimeStatus = 'RUNTIME_VERIFIED';
});

rejectMutation('synchronized analytics raw body bypass', (input) => {
  const rawBody = { type: 'string' };
  input.analyticsOpenApi.components.schemas.M1017AnalyticsTelemetryRequest.properties.rawBody = rawBody;
  input.canonicalOpenApi.components.schemas.M1017AnalyticsTelemetryRequest.properties.rawBody = clone(rawBody);
});

rejectMutation('audit redaction policy allows raw body', (input) => {
  input.auditPolicy.redaction.forbiddenPropertyNames = input.auditPolicy.redaction.forbiddenPropertyNames
    .filter((field) => field !== 'rawBody');
});

rejectMutation('canonical operation is deleted from policy', (input) => {
  input.policy.canonicalOperations.analytics = [];
});

rejectMutation('canonical operation is deleted from projected OpenAPI', (input) => {
  delete input.canonicalOpenApi.paths['/api/v1/analytics/telemetry'].post;
});

rejectMutation('canonical operation authority drifts', (input) => {
  input.canonicalOpenApi.paths['/api/v1/privacy/exports'].post['x-authorization'].clientAuthority = 'NONE; forged tenant';
});

rejectMutation('canonical operation default decision becomes allow', (input) => {
  input.canonicalOpenApi.paths['/api/v1/privacy/exports'].post['x-authorization'].defaultDecision = 'ALLOW';
});

rejectMutation('event producer owner drifts', (input) => {
  const event = input.eventCatalog.events.find((candidate) => candidate.eventName === 'privacy.export.requested.v2');
  event['x-p1r-governance'].producer.service = 'workflow-service';
});

rejectMutation('event consumer group drifts', (input) => {
  const event = input.eventCatalog.events.find((candidate) => candidate.eventName === 'privacy.export.requested.v2');
  event['x-p1r-governance'].consumers[0].consumerGroup = 'cg.forged.v1';
});

rejectMutation('event topic drifts', (input) => {
  const event = input.eventCatalog.events.find((candidate) => candidate.eventName === 'privacy.export.requested.v2');
  event['x-p1r-governance'].transport.topic = 'platform.forged.v1';
});

rejectMutation('event payload contains a forbidden raw field', (input) => {
  input.eventCatalog.payloadSchemas.M1017PrivacyExportRequested.properties.rawBody = { type: 'string' };
});

rejectMutation('UI telemetry is promoted into the Kafka catalog', (input) => {
  input.eventCatalog.events.push({
    eventName: 'ui.page.viewed.v1',
    status: 'CANONICAL_D2',
  });
});

rejectMutation('B26 route event binding drifts', (input) => {
  const route = input.b26.eventRouting.find((candidate) => candidate.eventName === 'privacy.export.requested.v2');
  route.eventName = 'privacy.export.requested.forged.v2';
});

rejectMutation('B26 route topic drifts', (input) => {
  const route = input.b26.eventRouting.find((candidate) => candidate.eventName === 'privacy.export.requested.v2');
  route.topic = 'platform.forged.v1';
});

rejectMutation('B26 source reference is removed', (input) => {
  input.b26.sourceRefs = input.b26.sourceRefs.filter((sourceRef) =>
    sourceRef !== 'packages/contracts/events/v1/fragments/m1-017-privacy-deletion-v2.events.json');
});

rejectMutation('Gateway route projection owner drifts', (input) => {
  const route = input.gatewayOpenApi['x-p1r-gateway-boundary'].routeRules
    .find((candidate) => candidate.ruleId === 'analytics-telemetry');
  route.upstreamOwner = 'workflow-service';
});

rejectMutation('B26 runtime is promoted', (input) => {
  input.b26.runtimeStatus = 'PASS';
});

test('M1-017 integration malformed input remains fail-closed', { skip: !ready }, () => {
  const input = cloneInputs();
  input.eventCatalog = { events: [] };
  let report;
  assert.doesNotThrow(() => { report = validatePrivacyAnalyticsAuditContractData(input); });
  assert.equal(report.result, 'FAIL');
  assert(report.errors.length > 0);
});
