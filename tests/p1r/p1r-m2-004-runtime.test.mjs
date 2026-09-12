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
  assert.equal(manifest.services.length, 12, 'eleven domain owners plus audit-service');
  assert.deepEqual(manifest.services.slice(0, 11).map((service) => service.id), [
    'learner-service', 'content-service', 'learning-service', 'assessment-service', 'media-service',
    'notification-service', 'gamification-service', 'social-service', 'commerce-service',
    'admin-ops-service', 'analytics-service',
  ]);
  assert.equal(manifest.services.at(-1).id, 'audit-service');
  assert.equal(manifest.services.at(-1).schema, 'audit_service');
  assert.equal(manifest.services.at(-1).dbCredential, 'svc_audit');
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
  assert.equal(owners.length, 13, 'twelve provisioned owners plus the self-migrating IAM');
  for (const owner of owners) {
    assert.ok(['external', 'self'].includes(owner.migrationMode), `${owner.id} needs a migration mode`);
    assert.equal(typeof owner.credential, 'string', `${owner.id} needs a resolved credential`);
    assert.match(owner.credential, /^svc_[a-z0-9_]+$/u);
  }
  assert.equal(byId.get('iam-service').migrationMode, 'self');
  assert.equal(byId.get('audit-service').migrationMode, 'external');
  for (const id of DECLARED_NOT_BUILT) {
    assert.equal(byId.has(id), false, `${id} has no runtime and must stay out of runtime evidence`);
  }
  // Platform owners are declared but deliberately absent from the B17 manifest itself.
  assert.equal(PLATFORM_OWNERS.some((owner) => owner.id === 'audit-service'), true);
  assert.equal(SELF_MIGRATING_OWNERS.some((owner) => owner.id === 'iam-service'), true);
});
