import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DECLARED_NOT_BUILT,
  PLATFORM_OWNERS,
  SELF_MIGRATING_OWNERS,
  credentialFor,
  readOwnerManifest,
  runtimeOwners,
} from '../../scripts/database/lib/owner-manifest.mjs';

const root = process.cwd();

test('owner manifest merges the platform owners without disturbing the B17 domain list', () => {
  const manifest = readOwnerManifest(root);
  assert.equal(manifest.phase, 'phase-1');
  assert.equal(manifest.services.length, 13, 'eleven domain owners plus audit-service and workflow-service');
  assert.deepEqual(manifest.services.slice(0, 11).map((service) => service.id), [
    'learner-service', 'content-service', 'learning-service', 'assessment-service', 'media-service',
    'notification-service', 'gamification-service', 'social-service', 'commerce-service',
    'admin-ops-service', 'analytics-service',
  ]);
  // The platform owners are appended after the domain list, in the order they were built.
  assert.deepEqual(manifest.services.slice(11).map((service) => service.id),
    ['audit-service', 'workflow-service']);
  const audit = manifest.services.find((service) => service.id === 'audit-service');
  assert.equal(audit.schema, 'audit_service');
  assert.equal(audit.dbCredential, 'svc_audit');
  const workflow = manifest.services.find((service) => service.id === 'workflow-service');
  assert.equal(workflow.schema, 'workflow_service');
  assert.equal(workflow.dbCredential, 'svc_workflow');
});

test('credential names match the MySQL and Redis principal convention', () => {
  // admin-ops is the only multi-word service; Redis and MySQL must agree on its principal.
  assert.equal(credentialFor('admin-ops-service'), 'svc_admin_ops');
  assert.equal(credentialFor('audit-service'), 'svc_audit');
  assert.equal(credentialFor('iam-service'), 'svc_iam');
  assert.equal(credentialFor('analytics-service'), 'svc_analytics');
});

test('runtime owners carry a migration mode and exclude services that have no runtime', () => {
  const owners = runtimeOwners(root);
  const byId = new Map(owners.map((owner) => [owner.id, owner]));
  assert.equal(owners.length, 14, 'thirteen provisioned owners plus the self-migrating IAM');
  for (const owner of owners) {
    assert.ok(['external', 'self'].includes(owner.migrationMode), `${owner.id} needs a migration mode`);
    assert.equal(typeof owner.credential, 'string', `${owner.id} needs a resolved credential`);
    assert.match(owner.credential, /^svc_[a-z0-9_]+$/u);
  }
  assert.equal(byId.get('iam-service').migrationMode, 'self');
  assert.equal(byId.get('audit-service').migrationMode, 'external');
  // workflow-service was declared but not built until P1R-M2-006 created it; it is a platform owner with
  // a migration path, so it is provisioned like audit-service rather than excluded.
  assert.equal(byId.get('workflow-service').migrationMode, 'external');
  assert.equal(byId.get('workflow-service').schema, 'workflow_service');
  assert.equal(byId.get('workflow-service').credential, 'svc_workflow');
  for (const id of DECLARED_NOT_BUILT) {
    assert.equal(byId.has(id), false, `${id} has no runtime and must stay out of runtime evidence`);
  }
  // Platform owners are declared but deliberately absent from the B17 manifest itself.
  assert.equal(PLATFORM_OWNERS.some((owner) => owner.id === 'audit-service'), true);
  assert.equal(SELF_MIGRATING_OWNERS.some((owner) => owner.id === 'iam-service'), true);
});
