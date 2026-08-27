import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

test('B8 canonical OpenAPI routes are IAM-owned and preserve legacy refresh compatibility', () => {
  const fragment = readJson('packages/contracts/fragments/b8/b8-auth-iam.openapi.json');
  const paths = fragment.paths;
  for (const route of [
    '/api/v1/auth/oidc/{provider}/authorization/start',
    '/api/v1/auth/oidc/{provider}/callback',
    '/api/v1/iam/session/refresh',
    '/api/v1/iam/session/logout',
    '/api/v1/iam/sessions/{sessionId}/revoke',
    '/api/v1/iam/principal/me',
    '/api/v1/iam/adult-gate',
    '/api/v1/auth/oidc/{provider}/metadata',
    '/api/v1/auth/oidc/{provider}/jwks',
    '/internal/v1/iam/authorization/decisions',
  ]) assert.ok(paths[route], `missing ${route}`);
  assert.equal(fragment['x-b8-idp-integration'].selfHostedTokenServer, false);
  assert.equal(fragment['x-b8-idp-integration'].tokenOwnership.iamMintsAccessTokens, false);
  assert.equal(fragment['x-b8-idp-integration'].tokenOwnership.iamMintsRefreshTokens, false);
  assert.equal(fragment['x-b8-idp-integration'].registrationLogin.mechanism, 'idp-hosted');
  assert.deepEqual(fragment['x-b8-idp-integration'].registrationLogin.intents, ['login', 'register']);
  assert.equal(fragment['x-b8-idp-integration'].productionProvider, 'pending-G-IDP');
  assert.equal(fragment['x-b8-compatibility'].legacyRoutes[0].canonical, '/api/v1/iam/session/refresh');
});

test('OIDC start and browser callback expose standard code-flow inputs without leaking transaction internals', () => {
  const fragment = readJson('packages/contracts/fragments/b8/b8-auth-iam.openapi.json');
  const start = fragment.paths['/api/v1/auth/oidc/{provider}/authorization/start'].get;
  const browserCallback = fragment.paths['/api/v1/auth/oidc/{provider}/callback'].get;
  const callback = fragment.components.schemas.B8OidcCallbackRequest;
  const startRefs = start.parameters.map((parameter) => parameter.$ref);
  assert.deepEqual(startRefs, [
    '#/components/parameters/B8Provider',
    '#/components/parameters/B8RedirectUri',
    '#/components/parameters/B8AuthIntent',
    '#/components/parameters/B8ReturnTo',
    '#/components/parameters/B8UiLocale',
    '#/components/parameters/B8Theme',
  ]);
  assert.deepEqual(callback.required, ['state', 'redirectUri']);
  assert.equal(callback.properties.code.minLength, 16);
  assert.deepEqual(callback['x-callback-validation'].mutuallyExclusive, ['code', 'error']);
  assert.equal(callback.properties.codeVerifier, undefined);
  assert.equal(callback.properties.nonce, undefined);
  assert.equal(callback.properties.transactionId, undefined);
  assert.deepEqual(browserCallback.parameters.map((parameter) => parameter.$ref), [
    '#/components/parameters/B8Provider',
    '#/components/parameters/B8CallbackCode',
    '#/components/parameters/B8State',
    '#/components/parameters/B8OidcCallbackError',
    '#/components/parameters/B8OidcCallbackErrorDescription',
    '#/components/parameters/B8OidcCallbackErrorUri',
  ]);
  assert.equal(browserCallback.responses['303'].headers.Location.$ref, '#/components/headers/B8CallbackLocation');
  assert.equal(browserCallback.responses['303'].headers['Set-Cookie'].$ref, '#/components/headers/B8SessionCookie');
  assert.equal(browserCallback['x-callback-semantics'].pkce.includes('server'), true);
  assert.equal(browserCallback['x-callback-semantics'].nonce.includes('server'), true);
  assert.match(fragment.components.schemas.B8AuthorizationStartResponse.properties.authorizationUrl.format, /uri/);
});

test('canonical refresh is an external-provider adapter boundary, not a local token endpoint', () => {
  const fragment = readJson('packages/contracts/fragments/b8/b8-auth-iam.openapi.json');
  const refresh = fragment.paths['/api/v1/iam/session/refresh'].post;
  const refreshRequest = fragment.components.schemas.B8SessionRefreshRequest;
  const tokenResponse = fragment.components.schemas.B8SessionTokenResponse;
  assert.equal(refresh['x-contract'].iamTokenServer, false);
  assert.equal(refresh['x-contract'].tokenIssuer, 'approved-external-oidc-idp');
  assert.equal(refresh.responses['503'].$ref, '#/components/responses/B8IdpUnavailable');
  assert.equal(refresh.responses['401'].$ref, '#/components/responses/B8SessionRefreshUnauthorized');
  assert.equal(tokenResponse['x-token-ownership'].mintedByIam, false);
  assert.equal(tokenResponse['x-token-ownership'].noLocalTokenEndpoint, true);
  assert.equal(refreshRequest.properties.refreshToken.description.includes('外部标准 OIDC IdP'), true);
  assert.equal(tokenResponse.properties.accessToken.description.includes('外部标准 OIDC IdP'), true);
  assert.equal(tokenResponse.properties.refreshToken.description.includes('本地 Token Endpoint'), true);
  assert.equal(Object.keys(fragment.paths).some((route) => /\/token(?:\/|$)/.test(route)), false);
});

test('authentication error responses use one envelope and distinguish provider unavailability, 401 and 403', () => {
  const fragment = readJson('packages/contracts/fragments/b8/b8-auth-iam.openapi.json');
  const responses = fragment.components.responses;
  for (const name of ['B8BadRequest', 'B8Unauthorized', 'B8Forbidden', 'B8SessionRefreshUnauthorized', 'B8PolicyDenied', 'B8IdpUnavailable']) {
    assert.equal(responses[name].content['application/json'].schema.$ref, '#/components/schemas/B8ErrorEnvelope');
  }
  const error = fragment.components.schemas.B8Error;
  for (const code of ['unauthorized', 'forbidden', 'idp_unavailable', 'session_revoked', 'policy_denied']) {
    assert.ok(error.properties.code.enum.includes(code), `missing error code ${code}`);
  }
  assert.equal(fragment.paths['/api/v1/auth/oidc/{provider}/jwks'].get.responses['503'].$ref, '#/components/responses/B8IdpUnavailable');
  assert.equal(fragment.paths['/api/v1/auth/oidc/{provider}/metadata'].get.responses['503'].$ref, '#/components/responses/B8IdpUnavailable');
  assert.equal(fragment.components.responses.B8IdpUnavailable.description.includes('HTTP 503'), true);
  assert.equal(fragment.components.responses.B8IdpUnavailable.description.includes('retryable=true'), true);
});

test('authorization decisions keep subject, tenant, owner, role and consent facts server-derived', () => {
  const fragment = readJson('packages/contracts/fragments/b8/b8-auth-iam.openapi.json');
  const schema = fragment.components.schemas.B8AuthorizationDecisionRequest;
  for (const forbidden of ['subject', 'tenant', 'tenantId', 'owner', 'ownerId', 'role', 'permission', 'consent']) {
    assert.equal(schema.properties[forbidden], undefined, `client field ${forbidden} must not exist`);
  }
  assert.deepEqual(schema['x-server-derived-authorization-facts'], [
    'subject', 'tenant', 'owner', 'role', 'permission', 'consent', 'policyVersion',
  ]);
});

test('IAM events cover mapping, rotation, replay, device, consent, adult Gate and policy changes', () => {
  const fragment = readJson('packages/contracts/events/v1/fragments/b8-auth-iam.events.json');
  const names = new Set(fragment.events.map((event) => event.eventName));
  for (const name of [
    'auth.oidc.authorization.started.v1',
    'auth.oidc.callback.completed.v1',
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
  assert.equal(fragment.payloadSchemas.AuthOidcAuthorizationStarted.properties.authorizationTransactionId !== undefined, true);
  assert.equal(fragment.payloadSchemas.AuthOidcCallbackCompleted.properties.principalId !== undefined, true);
  assert.equal(fragment.payloadSchemas.IamSessionRevoked.properties.providerRevocationStatus !== undefined, true);
});

test('generated contract and API client registries contain the B8 canonical operations', () => {
  const openapi = readFileSync(join(root, 'packages/contracts/openapi/v1/openapi.json'), 'utf8');
  const generated = readFileSync(join(root, 'packages/contracts/generated/openapi.ts'), 'utf8');
  const apiClient = readFileSync(join(root, 'packages/api-client/src/generated/index.ts'), 'utf8');
  for (const file of [openapi, generated, apiClient]) {
    assert.match(file, /refreshB8IamSession/);
    assert.match(file, /decideB8Authorization/);
    assert.match(file, /completeB8OidcBrowserCallback/);
  }
  assert.match(generated, /B8SessionEstablishedResponse/);
});
