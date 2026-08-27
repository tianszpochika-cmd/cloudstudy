import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('B23 local IdP is a standard external OIDC runtime and uses the fixed port authority', () => {
  const manifest = JSON.parse(read('config/b23-auth-runtime.json'));
  const oidc = JSON.parse(read('config/local-oidc.json'));
  const ports = JSON.parse(read('config/local-ports.json'));

  assert.equal(manifest.batch, 'B23');
  assert.equal(manifest.phase, 'phase-1');
  assert.equal(manifest.defaultDecision, 'deny');
  assert.equal(manifest.idp.protocol, 'OIDC/OAuth2.1');
  assert.equal(manifest.idp.registrationEnabled, true);
  assert.equal(manifest.idp.pkceMethod, 'S256');
  assert.equal(manifest.idp.platformTokenServer, false);
  assert.equal(manifest.idp.audience, oidc.audience);
  assert.equal(ports.services['oidc-idp'].port, 18099);
  assert.match(manifest.idp.issuer, /^http:\/\/127\.0\.0\.1:18099\/realms\//);
});

test('B23 Keycloak realm import is concrete and aligned with the local OIDC manifest', () => {
  const oidc = JSON.parse(read('config/local-oidc.json'));
  const realm = JSON.parse(read('infra/docker/keycloak/realm/yuxuexing-local-realm.json'));
  assert.equal(realm.realm, oidc.realm);
  assert.doesNotMatch(read('infra/docker/keycloak/realm/yuxuexing-local-realm.json'), /\$\{[^}]+\}/);
  assert.deepEqual(
    realm.clients.map((client) => client.clientId),
    oidc.clients.map((client) => client.clientId)
  );
  const audienceMapper = realm.clientScopes
    .flatMap((scope) => scope.protocolMappers ?? [])
    .find((mapper) => mapper.name === 'yuxuexing-api-audience');
  assert.equal(audienceMapper?.config?.['included.custom.audience'], oidc.audience);
});

test('B23 requires server-owned IAM facts and fail-closed authorization', () => {
  const manifest = JSON.parse(read('config/b23-auth-runtime.json'));
  assert.equal(manifest.iam.principalPersistence, 'mysql-iam-owner');
  assert.equal(manifest.iam.sessionPersistence, 'mysql-iam-owner');
  assert.equal(manifest.iam.refreshCredentialStorage, 'sha256-digest-only');
  assert.equal(manifest.iam.tenantDerivation, 'server-owned-principal');
  assert.equal(manifest.iam.adultGateDecision, 'fail-closed');
  assert.equal(manifest.iam.revocationDecision, 'fail-closed');
  assert.equal(manifest.gateway.protectedApiDefault, 'authenticated');
  assert.deepEqual(manifest.gateway.forbiddenClientAuthorityHeaders, [
    'X-Role',
    'X-B5-Role',
    'X-Tenant-Id',
    'X-Owner-Id'
  ]);
});

test('B23 runtime evidence covers registration through revocation and provider failure', () => {
  const evidence = JSON.parse(read('config/b23-auth-runtime.json')).runtimeEvidence;
  for (const item of [
    'registration',
    'authorization-code-callback',
    'principal-me',
    'valid-jwt-to-protected-api',
    'invalid-jwt-401',
    'revoked-jwt-401',
    'client-authority-header-rejected',
    'provider-unavailable-fail-closed'
  ]) {
    assert.ok(evidence.runtime.includes(item), 'missing B23 runtime evidence: ' + item);
  }
});
