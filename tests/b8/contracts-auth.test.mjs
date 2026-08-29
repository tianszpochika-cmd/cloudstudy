import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

test('B8 canonical OpenAPI routes are owned by the platform JWT auth center', () => {
  const fragment = readJson('packages/contracts/fragments/b8/b8-auth-iam.openapi.json');
  const paths = fragment.paths;
  for (const route of [
    '/api/v1/auth/register',
    '/api/v1/auth/login',
    '/api/v1/auth/token/refresh',
    '/api/v1/auth/logout',
    '/api/v1/auth/sessions/{sessionId}/revoke',
    '/api/v1/auth/jwks',
    '/api/v1/auth/password-reset/request',
    '/api/v1/auth/password-reset/confirm',
    '/api/v1/iam/principal/me',
    '/api/v1/iam/permissions',
    '/api/v1/iam/devices',
    '/api/v1/iam/adult-gate',
    '/api/v1/iam/consents',
    '/internal/v1/iam/authorization/decisions',
  ]) assert.ok(paths[route], `missing ${route}`);
  assert.equal(fragment['x-b8-authentication'].mode, 'self-owned-jwt-authentication-center');
  assert.equal(fragment['x-b8-authentication'].signer, 'iam-service');
  assert.equal(fragment['x-b8-authentication'].accessToken.algorithm, 'RS256');
  assert.equal(fragment['x-b8-authentication'].accessToken.audience, 'yuxuexing-api');
  assert.deepEqual(fragment['x-b8-authentication'].accessToken.requiredClaims, [
    'iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti', 'token_type', 'scope',
  ]);
  assert.equal(fragment['x-b8-authentication'].accessToken.jwksUri, '/api/v1/auth/jwks');
});

test('login and refresh are direct account-password JWT operations', () => {
  const fragment = readJson('packages/contracts/fragments/b8/b8-auth-iam.openapi.json');
  const login = fragment.paths['/api/v1/auth/login'].post;
  const refresh = fragment.paths['/api/v1/auth/token/refresh'].post;
  const loginRequest = fragment.components.schemas.B8LoginRequest;
  const tokenResponse = fragment.components.schemas.B8AuthTokenResponse;
  assert.equal(login.operationId, 'loginB8Account');
  assert.deepEqual(loginRequest.required, ['identifier', 'password', 'device']);
  assert.equal(loginRequest.properties.role, undefined);
  assert.equal(loginRequest.properties.tenantId, undefined);
  assert.equal(loginRequest.properties.ownerId, undefined);
  assert.equal(refresh.operationId, 'refreshB8JwtSession');
  assert.equal(fragment['x-b8-authentication'].refreshToken.rotation, 'every-use');
  assert.equal(fragment['x-b8-authentication'].refreshToken.reuseDetection, 'revoke-token-family');
  assert.deepEqual(tokenResponse['x-sensitive-fields'], ['accessToken', 'refreshToken']);
  assert.equal(fragment['x-b8-authentication'].refreshToken.storage.web, 'HttpOnly-Secure-SameSite-cookie');
  assert.equal(fragment['x-b8-authentication'].refreshToken.storage.mobile, 'Keychain-or-Keystore-only');
});

test('authentication errors distinguish 401 and 403 and never expose a third-party availability branch', () => {
  const fragment = readJson('packages/contracts/fragments/b8/b8-auth-iam.openapi.json');
  const responses = fragment.components.responses;
  for (const name of ['B8BadRequest', 'B8Unauthorized', 'B8Forbidden', 'B8AccountLocked', 'B8RateLimited']) {
    assert.equal(responses[name].content['application/json'].schema.$ref, '#/components/schemas/B8ErrorEnvelope');
  }
  const error = fragment.components.schemas.B8Error;
  for (const code of ['unauthorized', 'forbidden', 'account_locked', 'rate_limited', 'session_revoked', 'policy_denied']) {
    assert.ok(error.properties.code.enum.includes(code), `missing error code ${code}`);
  }
  assert.equal(responses.B8Unauthorized.description.includes('401'), true);
  assert.equal(responses.B8Forbidden.description.includes('403'), true);
  assert.equal(fragment.components.responses.B8Unauthorized.description.includes('issuer'), true);
});

test('authorization decisions keep identity and authorization facts server-derived', () => {
  const fragment = readJson('packages/contracts/fragments/b8/b8-auth-iam.openapi.json');
  const schema = fragment.components.schemas.B8AuthorizationDecisionRequest;
  for (const forbidden of ['subject', 'tenant', 'tenantId', 'owner', 'ownerId', 'role', 'permission', 'consent']) {
    assert.equal(schema.properties[forbidden], undefined, `client field ${forbidden} must not exist`);
  }
  assert.deepEqual(schema['x-server-derived-authorization-facts'], [
    'subject', 'tenant', 'owner', 'role', 'permission', 'consent', 'policyVersion',
  ]);
});

test('IAM events cover account, login, rotation, replay, device, consent, adult Gate and policy changes', () => {
  const fragment = readJson('packages/contracts/events/v1/fragments/b8-auth-iam.events.json');
  const names = new Set(fragment.events.map((event) => event.eventName));
  for (const name of [
    'auth.account.registered.v1',
    'auth.login.succeeded.v1',
    'auth.principal.mapped.v1',
    'auth.session.rotated.v1',
    'auth.session.replay_detected.v1',
    'auth.device.revoked.v1',
    'iam.session.revoked.v1',
    'auth.consent.updated.v1',
    'auth.adult_gate.rejected.v1',
    'iam.policy.version_changed.v1',
  ]) assert.ok(names.has(name), `missing ${name}`);
  assert.ok(fragment.events.every((event) => event['x-envelope-required']?.includes('eventId')));
  const sensitiveNames = /^(accessToken|refreshToken|idToken|authorizationCode|codeVerifier|nonce|state|clientSecret|privateKey)$/i;
  for (const schema of Object.values(fragment.payloadSchemas)) {
    for (const propertyName of Object.keys(schema.properties ?? {})) {
      assert.equal(sensitiveNames.test(propertyName), false, `sensitive event field leaked: ${propertyName}`);
    }
  }
  assert.equal(fragment.payloadSchemas.AuthAccountRegistered.properties.principalId !== undefined, true);
  assert.equal(fragment.payloadSchemas.AuthLoginSucceeded.properties.sessionId !== undefined, true);
  assert.equal(fragment.payloadSchemas.IamSessionRevoked.properties.providerRevocationStatus, undefined);
});

test('generated contract and API client registries contain the B8 JWT operations', () => {
  const openapi = readFileSync(join(root, 'packages/contracts/openapi/v1/openapi.json'), 'utf8');
  const generated = readFileSync(join(root, 'packages/contracts/generated/openapi.ts'), 'utf8');
  const apiClient = readFileSync(join(root, 'packages/api-client/src/generated/index.ts'), 'utf8');
  for (const file of [openapi, generated, apiClient]) {
    assert.match(file, /refreshB8JwtSession/);
    assert.match(file, /revokeB8JwtSession/);
    assert.match(file, /getB8JwtJwks/);
    assert.doesNotMatch(file, /Oidc|oidc|authorization\/start|auth\/callback/i);
  }
  assert.match(generated, /B8AuthTokenResponse/);
});
