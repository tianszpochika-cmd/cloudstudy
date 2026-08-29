import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('B23 uses the platform-owned account/password JWT center and fixed ports', () => {
  const manifest = JSON.parse(read('config/b23-auth-runtime.json'));
  const jwt = JSON.parse(read('config/local-jwt-auth.json'));
  const ports = JSON.parse(read('config/local-ports.json'));

  assert.equal(manifest.batch, 'B23');
  assert.equal(manifest.phase, 'phase-1');
  assert.equal(manifest.defaultDecision, 'deny');
  assert.equal(manifest.authentication.mode, 'self-owned-jwt');
  assert.equal(manifest.authentication.algorithm, 'RS256');
  assert.equal(manifest.authentication.audience, 'yuxuexing-api');
  assert.equal(manifest.authentication.noExternalIdentityProvider, true);
  assert.equal(jwt.jwksUri, manifest.authentication.jwksUri);
  assert.equal(ports.services['iam-service'].port, 18087);
  assert.equal(ports.services['api-gateway'].port, 18070);
});

test('B23 exposes canonical login, refresh, logout and reset contracts', () => {
  const manifest = JSON.parse(read('config/b23-auth-runtime.json'));
  assert.equal(manifest.authentication.login, 'POST /api/v1/auth/login');
  assert.equal(manifest.authentication.registration, 'POST /api/v1/auth/register');
  assert.equal(manifest.sessions.refreshEndpoint, 'POST /api/v1/auth/token/refresh');
  assert.equal(manifest.sessions.logoutEndpoint, 'POST /api/v1/auth/logout');
  assert.equal(manifest.sessions.revokeEndpoint, 'POST /api/v1/auth/sessions/{sessionId}/revoke');
  assert.equal(manifest.passwordSecurity.resetRequestEndpoint, 'POST /api/v1/auth/password-reset/request');
  assert.equal(manifest.passwordSecurity.resetConfirmEndpoint, 'POST /api/v1/auth/password-reset/confirm');
  assert.equal(manifest.sessions.rotation, 'every-use');
  assert.equal(manifest.sessions.replay.includes('revoke'), true);
  assert.equal(manifest.sessions.nativeStorage, 'Keychain-or-Keystore-only');
});

test('B23 requires server-owned authority facts and fail-closed Gateway access', () => {
  const manifest = JSON.parse(read('config/b23-auth-runtime.json'));
  assert.equal(manifest.iam.principalPersistence, 'mysql-iam-owner');
  assert.equal(manifest.iam.sessionPersistence, 'mysql-iam-owner');
  assert.equal(manifest.iam.tenantDerivation, 'server-owned-principal');
  assert.equal(manifest.iam.adultGateDecision, 'fail-closed');
  assert.equal(manifest.gateway.protectedApiDefault, 'authenticated');
  assert.deepEqual(manifest.gateway.forbiddenClientAuthorityHeaders.slice(0, 4), [
    'X-Role', 'X-B5-Role', 'X-Tenant-Id', 'X-Owner-Id',
  ]);
});

test('B23 runtime evidence names JWT positive and negative lifecycle checks', () => {
  const evidence = JSON.parse(read('config/b23-auth-runtime.json')).runtimeEvidence;
  for (const item of [
    'registration', 'password-login', 'principal-me', 'valid-jwt-to-protected-api',
    'invalid-jwt-401', 'expired-token-refresh', 'refresh-rotation', 'refresh-replay-401',
    'logout-revocation', 'device-revocation', 'client-authority-header-rejected',
    'wrong-issuer-audience-signature-algorithm-rejected', 'password-lockout', 'password-reset',
  ]) assert.ok(evidence.runtime.includes(item), `missing B23 runtime evidence: ${item}`);
});
