import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('B32 runtime probes are present and use durable boundaries', () => {
  for (const file of [
    'scripts/runtime/b32-domain-runtime.mjs',
    'scripts/runtime/b32-kafka-runtime.mjs',
    'scripts/runtime/b32-redis-runtime.mjs',
    'docs/07-operations/b32-validation.md',
  ]) assert.equal(existsSync(file), true, `${file} must exist`);
  const domain = readFileSync('scripts/runtime/b32-domain-runtime.mjs', 'utf8');
  const kafka = readFileSync('scripts/runtime/b32-kafka-runtime.mjs', 'utf8');
  const redis = readFileSync('scripts/runtime/b32-redis-runtime.mjs', 'utf8');
  assert.match(domain, /b25_assessment_session/);
  assert.match(domain, /b25_learning_srs_state/);
  assert.match(domain, /notification_outbox_event/);
  assert.match(kafka, /platform\.events\.dlq\.v1/);
  assert.match(kafka, /duplicateDeliveries/);
  assert.match(redis, /sourceOfTruthIsRedis: false/);
  assert.match(redis, /docker.*restart/);
});

test('B32 Redis registry declares a rebuildable SRS projection', () => {
  const registry = JSON.parse(readFileSync('database/redis/keyspace.registry.json', 'utf8'));
  const entry = registry.entries.find(item => item.id === 'learning.srs.projection');
  assert.ok(entry);
  assert.equal(entry.sourceOfTruth, 'mysql.b25_learning_srs_state');
  assert.equal(entry.rebuildable, true);
  assert.equal(entry.security.rawSensitiveAllowed, false);
  assert.equal(entry.ttl.seconds, 86400);
});

test('B32 local OIDC registration cannot edit authority-bearing attributes', () => {
  const realm = JSON.parse(readFileSync('infra/docker/keycloak/realm/yuxuexing-local-realm.json', 'utf8'));
  assert.equal(realm.userProfile?.unmanagedAttributePolicy, 'ADMIN_EDIT');
  for (const attribute of realm.userProfile?.attributes ?? []) {
    if (!['tenant_id', 'device_id', 'permissions'].includes(attribute.name)) continue;
    assert.deepEqual(attribute.permissions, { view: ['admin'], edit: ['admin'] });
  }
});

test('B32 local OIDC claims match service-side canonical security facts', () => {
  const oidc = readFileSync('scripts/runtime/ensure-local-oidc-test-user.mjs', 'utf8');
  const social = readFileSync('services/social-service/src/main/java/com/englishflow/social/security/SocialJwtAuthenticationConverter.java', 'utf8');
  const learnerScope = readFileSync('services/learner-service/src/main/java/com/englishflow/learner/domain/LearnerTenantScope.java', 'utf8');
  const learnerFactory = readFileSync('services/learner-service/src/main/java/com/englishflow/learner/web/VerifiedLearnerPrincipalFactory.java', 'utf8');
  assert.match(oidc, /local-account-status/);
  assert.match(oidc, /account_status: \['ACTIVE'\]/);
  assert.match(social, /consent_state/);
  assert.match(social, /account_status/);
  assert.match(learnerScope, /VERIFIED_OIDC_SUBJECT/);
  assert.match(learnerFactory, /validExternalSubject/);
});
