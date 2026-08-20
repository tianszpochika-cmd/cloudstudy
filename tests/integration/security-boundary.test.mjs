import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  authorize,
  authorizeExport,
  evaluateAccess,
  maskExportFields,
} from '../../packages/telemetry/src/index.mjs';

const actors = JSON.parse(readFileSync(new URL('../fixtures/b0-security/actors.json', import.meta.url), 'utf8'));
const exportRecord = JSON.parse(readFileSync(new URL('../fixtures/b0-security/export-record.json', import.meta.url), 'utf8'));

const ownProfile = {
  type: 'profile',
  tenantId: actors.learnerA.tenantId,
  ownerId: actors.learnerA.id,
};

test('learner can access own profile but cannot access another learner in the same tenant', () => {
  assert.equal(evaluateAccess({ actor: actors.learnerA, resource: ownProfile, action: 'read' }).allowed, true);
  assert.equal(evaluateAccess({
    actor: actors.learnerA,
    resource: { ...ownProfile, ownerId: actors.learnerB.id },
    action: 'read',
  }).allowed, false);
});

test('learner cannot cross tenant boundary even when role is valid', () => {
  const crossTenantRecord = {
    type: 'learning-record',
    tenantId: 'tenant_test_0002',
    ownerId: actors.learnerA.id,
  };
  assert.equal(evaluateAccess({ actor: actors.learnerA, resource: crossTenantRecord, action: 'read' }).allowed, false);
});

test('admin is tenant-scoped and content editor cannot use user permissions', () => {
  assert.equal(evaluateAccess({
    actor: actors.tenantAdmin,
    resource: { type: 'user', tenantId: actors.tenantAdmin.tenantId, userId: actors.learnerA.id },
    action: 'read',
  }).allowed, true);
  assert.equal(evaluateAccess({
    actor: actors.tenantAdmin,
    resource: { type: 'user', tenantId: 'tenant_test_0002', userId: 'user_test_1000' },
    action: 'read',
  }).allowed, false);
  assert.equal(evaluateAccess({
    actor: actors.contentEditor,
    resource: { type: 'user', tenantId: actors.contentEditor.tenantId, userId: actors.learnerA.id },
    action: 'read',
  }).allowed, false);
  assert.equal(evaluateAccess({
    actor: actors.contentEditor,
    resource: { type: 'content', tenantId: actors.contentEditor.tenantId, resourceId: 'content_test_0001' },
    action: 'update',
  }).allowed, true);
});

test('finance auditor reads commerce/audit data but cannot mutate content', () => {
  assert.equal(evaluateAccess({
    actor: actors.financeAuditor,
    resource: { type: 'payment', tenantId: actors.financeAuditor.tenantId, resourceId: 'payment_test_0001' },
    action: 'read',
  }).allowed, true);
  assert.equal(evaluateAccess({
    actor: actors.financeAuditor,
    resource: { type: 'audit-log', tenantId: actors.financeAuditor.tenantId, resourceId: 'audit_test_0001' },
    action: 'read',
  }).allowed, true);
  assert.equal(evaluateAccess({
    actor: actors.financeAuditor,
    resource: { type: 'content', tenantId: actors.financeAuditor.tenantId, resourceId: 'content_test_0001' },
    action: 'update',
  }).allowed, false);
});

test('unknown role, missing tenant and unknown resource are denied by default', () => {
  assert.equal(evaluateAccess({
    actor: { id: 'unknown_test_0001', tenantId: 'tenant_test_0001', roles: ['unknown-role'] },
    resource: ownProfile,
    action: 'read',
  }).allowed, false);
  assert.equal(evaluateAccess({
    actor: { id: actors.tenantAdmin.id, roles: ['admin'] },
    resource: { type: 'user', userId: actors.learnerA.id },
    action: 'read',
  }).allowed, false);
  assert.equal(evaluateAccess({ actor: actors.tenantAdmin, resource: { type: 'unknown', tenantId: actors.tenantAdmin.tenantId }, action: 'read' }).allowed, false);
  assert.throws(
    () => authorize({ actor: actors.learnerA, resource: ownProfile, action: 'delete' }),
    (error) => error.code === 'ACCESS_DENIED',
  );
});

test('learner export is self-scoped and masks identifiers and contact fields', () => {
  authorizeExport({
    actor: actors.learnerA,
    subjectId: actors.learnerA.id,
    tenantId: actors.learnerA.tenantId,
    policyName: 'learner-self',
  });

  const masked = maskExportFields(exportRecord, { policyName: 'learner-self' });
  assert.match(masked.actorId, /^sha256:/);
  assert.equal(masked.email, 's***@example.test');
  assert.equal(masked.phone, '*******1234');
  assert.equal(masked.ipAddress, '192.0.2.*');
  assert.equal(masked.goalCode, 'cet4');
  assert.equal(masked.userAgent, undefined);
});

test('cross-tenant or cross-subject exports are denied and sensitive export fields are dropped', () => {
  assert.throws(
    () => authorizeExport({
      actor: actors.learnerA,
      subjectId: actors.learnerB.id,
      tenantId: actors.learnerA.tenantId,
      policyName: 'learner-self',
    }),
    (error) => error.code === 'EXPORT_SUBJECT_DENIED' || error.code === 'EXPORT_DENIED',
  );
  assert.throws(
    () => authorizeExport({
      actor: actors.tenantAdmin,
      subjectId: actors.learnerA.id,
      tenantId: 'tenant_test_0002',
      policyName: 'admin-tenant',
    }),
    (error) => error.code === 'EXPORT_TENANT_DENIED' || error.code === 'EXPORT_DENIED',
  );

  const masked = maskExportFields({
    ...exportRecord,
    password: 'synthetic-password',
    accessToken: 'synthetic-access-token',
    rawAudio: 'synthetic-audio-placeholder',
    paymentCredential: 'synthetic-payment-placeholder',
  }, { policyName: 'learner-self' });
  assert.equal(masked.password, undefined);
  assert.equal(masked.accessToken, undefined);
  assert.equal(masked.rawAudio, undefined);
  assert.equal(masked.paymentCredential, undefined);
});
