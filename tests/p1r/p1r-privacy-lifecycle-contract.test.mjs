import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FROZEN_POLICY_SHA256,
  policyDigest,
  readPrivacyLifecycleContractInputs,
  validatePrivacyLifecycleContractData,
  validatePrivacyLifecycleContractFiles,
} from '../../scripts/audit/p1r-privacy-lifecycle-contract-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseline = readPrivacyLifecycleContractInputs({ root });
const ready = baseline.readErrors.length === 0;

function cloneInputs() {
  return structuredClone(baseline);
}

function rejectMutation(name, mutate) {
  test(`adversarial mutation: ${name}`, { skip: !ready }, () => {
    const input = cloneInputs();
    mutate(input);
    const report = validatePrivacyLifecycleContractData(input);
    assert.equal(report.result, 'FAIL', `${name} must fail closed; got ${report.errors.join(' | ')}`);
    assert(report.errors.length > 0, `${name} must emit a diagnostic`);
  });
}

test('M1-017 privacy lifecycle source is a D2/static fail-closed boundary', { skip: !ready }, () => {
  const report = validatePrivacyLifecycleContractFiles({ root });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.equal(report.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(report.policyDigest, FROZEN_POLICY_SHA256);
  assert.equal(policyDigest(baseline.policy), FROZEN_POLICY_SHA256);
  assert.equal(report.summary.canonicalPrivacyOperations, 6);
  assert.equal(report.summary.canonicalDeletionOperations, 6);
  assert.equal(report.summary.coolingOffHours, 168);
  assert.equal(report.summary.eventIntegration, 'COORDINATOR_OWNED_PENDING_PROJECTION');
});

test('M1-017 checker CLI emits JSON D2 evidence', { skip: !ready }, () => {
  const result = spawnSync(process.execPath, ['scripts/audit/p1r-privacy-lifecycle-contract-check.mjs', '--json'], {
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

rejectMutation('public export request accepts a client subject', (input) => {
  input.openApi.components.schemas.M1017PrivacyExportRequest.properties.subjectId = { type: 'string' };
});

rejectMutation('public deletion request accepts a client status', (input) => {
  input.openApi.components.schemas.M1017AccountDeletionRequest.properties.status = { type: 'string' };
});

rejectMutation('public deletion cancellation accepts tenant authority', (input) => {
  input.openApi.components.schemas.M1017AccountDeletionCancelRequest.properties.tenantId = { type: 'string' };
});

rejectMutation('internal owner receipt accepts a forged owner', (input) => {
  input.openApi.components.schemas.M1017OwnerReceiptSubmission.properties.ownerService = { type: 'string' };
});

rejectMutation('delete execute accepts an end-user bearer token', (input) => {
  input.openApi.paths['/internal/v1/iam/account-deletions/{deletionRequestId}/execute'].post.security = [{ bearerAuth: [] }];
});

rejectMutation('delete cancel defaults to allow', (input) => {
  input.openApi.paths['/api/v1/iam/account-deletions/{deletionRequestId}/cancel'].post['x-authorization'].defaultDecision = 'ALLOW';
});

rejectMutation('cooling-off period is shortened', (input) => {
  input.policy.deletion.coolingOffHours = 24;
});

rejectMutation('unknown legal hold is allowed', (input) => {
  input.policy.deletion.legalHold.unknownDecision = 'ALLOW';
});

rejectMutation('session revocation is no longer required before final state', (input) => {
  input.policy.deletion.sessionRevocation.requiredBeforeFinalState = false;
});

rejectMutation('partial deletion may claim anonymized', (input) => {
  input.policy.deletion.recovery.partialSuccessDoesNotClaimAnonymized = false;
});

rejectMutation('deletion status receives an unsafe terminal state', (input) => {
  input.openApi.components.schemas.M1017AccountDeletion.properties.status.enum.push('DELETED');
});

rejectMutation('download grant becomes cacheable', (input) => {
  input.openApi.components.schemas.M1017PrivacyDownloadGrant.properties.cacheControl.const = 'public, max-age=3600';
});

rejectMutation('legacy B1 request reintroduces client subject authority', (input) => {
  input.legacyB1OpenApi.components.schemas.B1PrivacyExportRequest.properties.subjectId = { type: 'integer' };
});

rejectMutation('E1 event-fragment prohibition is weakened', (input) => {
  input.policy.eventIntegration.e1MayCreateOrModifyEventFragment = true;
});

rejectMutation('runtime status is promoted without runtime evidence', (input) => {
  input.policy.runtimeStatus = 'RUNTIME_VERIFIED';
});

test('malformed contract input fails closed without throwing', { skip: !ready }, () => {
  const input = cloneInputs();
  input.openApi = { paths: [] };
  let report;
  assert.doesNotThrow(() => { report = validatePrivacyLifecycleContractData(input); });
  assert.equal(report.result, 'FAIL');
  assert(report.errors.length > 0);
});
