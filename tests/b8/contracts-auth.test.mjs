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
    '/api/v1/iam/principal/me',
    '/api/v1/iam/adult-gate',
    '/internal/v1/iam/authorization/decisions',
  ]) assert.ok(paths[route], `missing ${route}`);
  assert.equal(fragment['x-b8-idp-integration'].selfHostedTokenServer, false);
  assert.equal(fragment['x-b8-idp-integration'].productionProvider, 'pending-G-IDP');
  assert.equal(fragment['x-b8-compatibility'].legacyRoutes[0].canonical, '/api/v1/iam/session/refresh');
});

test('PKCE verifier, nonce and transaction internals never become callback client inputs', () => {
  const fragment = readJson('packages/contracts/fragments/b8/b8-auth-iam.openapi.json');
  const start = fragment.paths['/api/v1/auth/oidc/{provider}/authorization/start'].get;
  const callback = fragment.components.schemas.B8OidcCallbackRequest;
  const startRefs = start.parameters.map((parameter) => parameter.$ref);
  assert.deepEqual(startRefs, [
    '#/components/parameters/B8Provider',
    '#/components/parameters/B8RedirectUri',
    '#/components/parameters/B8ReturnTo',
    '#/components/parameters/B8UiLocale',
    '#/components/parameters/B8Theme',
  ]);
  assert.deepEqual(callback.required, ['code', 'state', 'redirectUri']);
  assert.equal(callback.properties.codeVerifier, undefined);
  assert.equal(callback.properties.nonce, undefined);
  assert.equal(callback.properties.transactionId, undefined);
  assert.match(fragment.components.schemas.B8AuthorizationStartResponse.properties.authorizationUrl.format, /uri/);
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
    'auth.principal.mapped.v1',
    'auth.session.rotated.v1',
    'auth.session.replay_detected.v1',
    'auth.device.revoked.v1',
    'auth.consent.updated.v1',
    'auth.adult_gate.rejected.v1',
    'iam.policy.version_changed.v1',
  ]) assert.ok(names.has(name), `missing ${name}`);
  assert.ok(fragment.events.every((event) => event['x-envelope-required']?.includes('eventId')));
});

test('generated contract and API client registries contain the B8 canonical operations', () => {
  const openapi = readFileSync(join(root, 'packages/contracts/openapi/v1/openapi.json'), 'utf8');
  const generated = readFileSync(join(root, 'packages/contracts/generated/openapi.ts'), 'utf8');
  const apiClient = readFileSync(join(root, 'packages/api-client/src/generated/index.ts'), 'utf8');
  for (const file of [openapi, generated, apiClient]) {
    assert.match(file, /refreshB8IamSession/);
    assert.match(file, /decideB8Authorization/);
  }
});
