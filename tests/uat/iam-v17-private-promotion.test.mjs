import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountPermissionEvidence,
  assertDrainSnapshot,
  assertPostMigrationHistory,
  assertPostPermissionEvidence,
  assertPreMigrationHistory,
  assertPrivateSnapshot,
  assertRestoredSnapshot,
  assertRestoreProgressSnapshot,
  activeReadinessTargets,
  iamReadinessTargets,
  learnerScopes,
  parseMysqlJsonRows,
  promotionComposeArgs,
  restoreContainerIdsToStart
} from '../../scripts/runtime/iam-v17-private-promotion.mjs';

const trustedEventScopes = ['gamification.trusted-event.write', 'social.trusted-event.write'];

function accountRows({ includeCanonical = false, mutateCoarse = false, grantToInactive = false } = {}) {
  const learner = [
    'principal-learner', 'ACTIVE', 'learner',
    mutateCoarse ? 'learner.profile.read' : 'learner.profile.read,gamification.read'
  ];
  if (includeCanonical) learner[3] += `,${learnerScopes.join(',')}`;
  const inactive = ['principal-inactive', 'DISABLED', 'learner', 'learner.profile.read'];
  const nonLearner = ['principal-admin', 'ACTIVE', 'admin', 'admin.dashboard.read'];
  if (grantToInactive) inactive[3] += ',gamification.read.self';
  return [learner, inactive, nonLearner];
}

function catalogRows(keys = learnerScopes) {
  return keys.map((key) => [key, 'ACTIVE']);
}

function roleRows() {
  return [['learner', 'ACTIVE']];
}

function roleBindings(extra = []) {
  return extra.map((key) => ['role-learner', key, null]);
}

function permissionEvidence({
  beforeCatalog = [], afterCatalog = learnerScopes, beforeBindings = [], afterBindings = learnerScopes,
  beforeAccounts = accountRows(), afterAccounts = accountRows({ includeCanonical: true }), roleStatus = roleRows()
} = {}) {
  return assertPostPermissionEvidence({
    beforeCatalogKeys: beforeCatalog,
    afterCatalogRows: catalogRows(afterCatalog),
    beforeRoleBindings: roleBindings(beforeBindings),
    afterRoleBindings: roleBindings(afterBindings),
    roleRows: roleStatus,
    beforeAccountEvidence: accountPermissionEvidence(beforeAccounts),
    afterAccountRows: afterAccounts
  });
}

function privateSnapshot() {
  const services = [
    'mysql', 'redis', 'minio', 'kafka', 'mysql-init', 'minio-init', 'mysql-migrate',
    'iam-service', 'api-gateway', 'official-site', 'learner-web', 'admin-web', 'mobile-h5',
    'audit-service', 'workflow-service', 'learner-service', 'content-service', 'learning-service',
    'assessment-service', 'media-service', 'notification-service', 'gamification-service',
    'social-service', 'commerce-service', 'admin-ops-service', 'analytics-service'
  ];
  return Object.fromEntries(services.map((service, index) => [service, {
    containerId: `container-${service}-${index}`,
    imageId: `sha256:${String(index + 1).padStart(64, '0')}`,
    status: ['mysql-init', 'minio-init', 'mysql-migrate'].includes(service) ? 'exited' : 'running',
    project: 'cloudstudy-uat-isolated-3c94b27160',
    networks: ['cloudstudy-uat-isolated-3c94b27160'],
    portBindings: {}
  }]));
}

test('V17 preflight requires exactly successful IAM V16 and no V17 row', () => {
  assert.deepEqual(assertPreMigrationHistory([
    { version: '16', success: '1' }
  ]), { currentVersion: 16, pendingVersion: 17 });
  assert.throws(() => assertPreMigrationHistory([
    { version: '16', success: '1' }, { version: '17', success: '1' }
  ]), /V17 is already recorded/u);
  assert.throws(() => assertPreMigrationHistory([
    { version: '16', success: '0' }
  ]), /V16 must be successful/u);
  assert.throws(() => assertPreMigrationHistory([]), /exactly one IAM V16/u);
});

test('V17 verification requires the successful migration script and description', () => {
  assert.deepEqual(assertPostMigrationHistory([
    { version: '16', success: '1' },
    { version: '17', success: '1', description: 'grant canonical b12 learner permissions',
      script: 'V17__grant_canonical_b12_learner_permissions.sql' }
  ]), { currentVersion: 17, successful: true });
  assert.throws(() => assertPostMigrationHistory([
    { version: '16', success: '1' },
    { version: '17', success: '0', description: 'grant canonical b12 learner permissions',
      script: 'V17__grant_canonical_b12_learner_permissions.sql' }
  ]), /did not complete successfully/u);
  assert.throws(() => assertPostMigrationHistory([
    { version: '16', success: '1' },
    { version: '17', success: '1', description: 'unexpected', script: 'unexpected.sql' }
  ]));
});

test('MySQL JSON_ARRAY rows preserve CSV commas inside account roles and permissions', () => {
  const parsed = parseMysqlJsonRows([
    '["principal-a","ACTIVE","learner,admin","learner.profile.read,gamification.read"]',
    '["principal-b","DISABLED","learner","learner.profile.read"]'
  ].join('\n'));
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], [
    'principal-a', 'ACTIVE', 'learner,admin', 'learner.profile.read,gamification.read'
  ]);
  assert.equal(accountPermissionEvidence(parsed).activeLearnerCount, 1);
  assert.equal(accountPermissionEvidence(parsed).accountCount, 2);
  assert.throws(() => parseMysqlJsonRows('not-json'), SyntaxError);
});

test('successful V17 evidence allows only the 14 canonical learner scopes and preserves coarse permissions', () => {
  const result = permissionEvidence();
  assert.deepEqual(result.catalogKeysAdded, [...learnerScopes].sort());
  assert.equal(result.learnerRoleBindingsAdded, 14);
  assert.equal(result.activeLearnerCount, 1);
  assert.equal(result.activeLearnerScopesMissing, 0);
  assert.equal(learnerScopes.length, 14);
});

test('V17 evidence remains valid when the additive grants are already present', () => {
  const result = permissionEvidence({
    beforeCatalog: learnerScopes,
    afterCatalog: learnerScopes,
    beforeBindings: learnerScopes,
    afterBindings: learnerScopes,
    beforeAccounts: accountRows({ includeCanonical: true }),
    afterAccounts: accountRows({ includeCanonical: true })
  });
  assert.deepEqual(result.catalogKeysAdded, []);
  assert.equal(result.learnerRoleBindingsAdded, 0);
  assert.equal(result.activeLearnerScopesMissing, 0);
});

test('V17 evidence rejects trusted-event, admin, moderation, and non-learner role bindings', () => {
  for (const forbidden of [...trustedEventScopes, 'admin.audit.read', 'social.moderation.queue.read']) {
    assert.throws(() => permissionEvidence({
      afterCatalog: [...learnerScopes, forbidden],
      afterBindings: [...learnerScopes, forbidden]
    }), /non-learner, trusted-event, admin, or moderation catalog permission/u);
  }
  assert.throws(() => permissionEvidence({
    afterCatalog: learnerScopes,
    afterBindings: [...learnerScopes, 'admin.audit.read']
  }), /non-learner role binding/u);
  assert.throws(() => permissionEvidence({
    afterCatalog: learnerScopes,
    afterBindings: [...learnerScopes, 'gamification.trusted-event.write']
  }), /non-learner role binding/u);
});

test('V17 evidence rejects changes to inactive and non-learner accounts', () => {
  assert.throws(() => permissionEvidence({
    afterAccounts: accountRows({ includeCanonical: true, grantToInactive: true })
  }), /inactive or non-learner account permission changed/u);
  assert.throws(() => permissionEvidence({
    afterAccounts: accountRows({ includeCanonical: true, mutateCoarse: true })
  }), /coarse permission changed/u);
});

test('V17 evidence requires every canonical learner catalog key and active role binding', () => {
  assert.throws(() => permissionEvidence({ afterCatalog: learnerScopes.slice(1) }),
    /exact 14 canonical learner scopes/u);
  assert.throws(() => permissionEvidence({ afterBindings: learnerScopes.slice(1) }),
    /exactly the 14 canonical B12 bindings/u);
  assert.throws(() => permissionEvidence({ roleStatus: [['learner', 'DISABLED']] }),
    /active learner role/u);
});

test('private drain preserves all unrelated containers and requires writer/Gateway containers stopped in place', () => {
  const before = privateSnapshot();
  assert.doesNotThrow(() => assertPrivateSnapshot(before));
  const stopped = structuredClone(before);
  for (const service of [
    'iam-service', 'audit-service', 'workflow-service', 'learner-service', 'content-service',
    'learning-service', 'assessment-service', 'media-service', 'notification-service',
    'gamification-service', 'social-service', 'commerce-service', 'admin-ops-service',
    'analytics-service', 'api-gateway'
  ]) stopped[service].status = 'exited';
  assert.doesNotThrow(() => assertDrainSnapshot(before, stopped));
  const unrelatedChanged = structuredClone(stopped);
  unrelatedChanged['mobile-h5'].imageId = 'sha256:' + 'f'.repeat(64);
  assert.throws(() => assertDrainSnapshot(before, unrelatedChanged), /mobile-h5 changed outside/u);
  const writerStillUp = structuredClone(stopped);
  writerStillUp['iam-service'].status = 'running';
  assert.throws(() => assertDrainSnapshot(before, writerStillUp), /writer is still running/u);
});

test('restore requires original non-IAM writer IDs/images and the new IAM candidate only', () => {
  const before = privateSnapshot();
  const after = structuredClone(before);
  const candidate = 'sha256:' + 'f'.repeat(64);
  after['iam-service'].containerId = 'new-iam-container';
  after['iam-service'].imageId = candidate;
  assert.doesNotThrow(() => assertRestoredSnapshot(before, after, candidate));
  const changedWriter = structuredClone(after);
  changedWriter['content-service'].containerId = 'replacement-content-container';
  assert.throws(() => assertRestoredSnapshot(before, changedWriter, candidate), /original container ID/u);
  const changedUnrelated = structuredClone(after);
  changedUnrelated['mobile-h5'].status = 'exited';
  assert.throws(() => assertRestoredSnapshot(before, changedUnrelated, candidate), /changed outside/u);
});

test('interrupted restore resumes only exact original writer containers that remain stopped', () => {
  const before = privateSnapshot();
  const current = structuredClone(before);
  const candidate = 'sha256:' + 'f'.repeat(64);
  current['iam-service'].containerId = 'new-iam-container';
  current['iam-service'].imageId = candidate;
  current['api-gateway'].status = 'running';
  current['content-service'].status = 'exited';
  current['analytics-service'].status = 'created';

  assert.doesNotThrow(() => assertRestoreProgressSnapshot(before, current, candidate));
  assert.deepEqual(restoreContainerIdsToStart(before, current, candidate), [
    before['content-service'].containerId,
    before['analytics-service'].containerId
  ]);

  const replacedWriter = structuredClone(current);
  replacedWriter['content-service'].containerId = 'unexpected-container';
  assert.throws(() => restoreContainerIdsToStart(before, replacedWriter, candidate),
    /original container changed during restore/u);
});

test('promotion probes IAM alone before restoring the 15 drained endpoints', () => {
  assert.deepEqual(iamReadinessTargets, [['iam-service', 18087, '/actuator/health/readiness']]);
  assert.equal(activeReadinessTargets.length, 19);
  assert(activeReadinessTargets.some(([service]) => service === 'api-gateway'));
  assert(activeReadinessTargets.some(([service]) => service === 'iam-service'));
});

test('Compose promotion is pinned to one IAM service, with no dependencies, builds, or pulls', () => {
  assert.deepEqual(promotionComposeArgs(), [
    'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'iam-service'
  ]);
});
