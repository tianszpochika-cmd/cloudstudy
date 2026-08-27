import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  readB30Inputs,
  repositoryRoot,
  validateB30LocalOidc,
} from '../../scripts/runtime/b30-static-check.mjs';
import { validateB30RuntimeEvidence } from '../../scripts/runtime/b30-runtime-probe.mjs';

const inputs = readB30Inputs(repositoryRoot);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectedClientIds() {
  return inputs.oidc.clients.map((client) => client.clientId);
}

function passingEvidence(overrides = {}) {
  const checks = [
    'discovery-issuer-endpoints',
    'jwks-rs256-public-signing-key',
    'registration-policy-runtime',
    'dynamic-registration-not-public',
    'client-exact-redirects',
    'client-pkce-s256',
    'client-pkce-required',
    'client-redirect-allowlist',
    'client-logout-allowlist',
  ].map((id) => ({ id, status: 'PASS' }));
  return {
    batch: 'B30',
    status: 'PASS',
    evidenceClass: 'runtime-external',
    provenance: { external: true, synthetic: false },
    tokenMaterial: {
      tokenEndpointCalled: false,
      tokensCollected: false,
      jwtCreated: false,
      passwordsCollected: false,
    },
    checks,
    clients: inputs.oidc.clients.map((client) => ({
      clientId: client.clientId,
      login: { exactRedirectAccepted: true, registrationLink: true },
      pkce: { exactS256Accepted: true, plainRejected: true, missingChallengeRejected: true },
      redirectAllowlist: { exactMatch: true, wildcardRejected: true },
      logoutAllowlist: { exactMatch: true, wildcardRejected: true },
    })),
    ...overrides,
  };
}

test('B30 static contract covers the fixed realm, four clients, PKCE, registration, audience and JWKS policy', () => {
  const result = validateB30LocalOidc(inputs);
  assert.equal(result.result, 'PASS', result.errors.join('\n'));
  assert.equal(result.summary.clientCount, 4);
  assert.equal(result.summary.realmClientCount, 4);
  assert.equal(result.summary.redirectCount, 8);
});

test('B30 static contract rejects PKCE, redirect and audience drift', () => {
  const pkce = clone(inputs);
  pkce.oidc.protocol.pkce = 'plain';
  assert.equal(validateB30LocalOidc(pkce).result, 'FAIL');

  const redirect = clone(inputs);
  redirect.oidc.clients[0].redirectUris[0] = 'http://127.0.0.1:18180/*';
  const redirectResult = validateB30LocalOidc(redirect);
  assert.equal(redirectResult.result, 'FAIL');
  assert.ok(redirectResult.errors.some((error) => error.includes('client-learner-web-redirects')));

  const audience = clone(inputs);
  const audienceScope = audience.realm.clientScopes.find((scope) => scope.name === 'yuxuexing-api');
  audienceScope.protocolMappers.find((mapper) => mapper.name === 'yuxuexing-api-audience').config['included.custom.audience'] = 'wrong-audience';
  const audienceResult = validateB30LocalOidc(audience);
  assert.equal(audienceResult.result, 'FAIL');
  assert.ok(audienceResult.errors.some((error) => error.includes('realm-audience-mapper')));
});

test('B30 static contract rejects a non-public client or committed credential marker', () => {
  const client = clone(inputs);
  client.realm.clients[0].publicClient = false;
  const clientResult = validateB30LocalOidc(client);
  assert.equal(clientResult.result, 'FAIL');
  assert.ok(clientResult.errors.some((error) => error.includes('client-learner-web-realm-public-code')));

  const secret = clone(inputs);
  secret.realm.clients[0].secret = 'must-not-exist';
  const secretResult = validateB30LocalOidc(secret);
  assert.equal(secretResult.result, 'FAIL');
  assert.ok(secretResult.errors.some((error) => error.includes('realm-public-only')));
});

test('B30 evidence validator accepts external metadata without token material', () => {
  const result = validateB30RuntimeEvidence(passingEvidence(), expectedClientIds());
  assert.equal(result.result, 'PASS', result.errors.join('\n'));
});

test('B30 evidence validator rejects any token collection or incomplete runtime check', () => {
  const tokenEvidence = passingEvidence({ tokenMaterial: { tokenEndpointCalled: true, tokensCollected: false, jwtCreated: false } });
  const tokenResult = validateB30RuntimeEvidence(tokenEvidence, expectedClientIds());
  assert.equal(tokenResult.result, 'FAIL');
  assert.ok(tokenResult.errors.some((error) => error.includes('token endpoint')));

  const incomplete = passingEvidence();
  incomplete.checks = incomplete.checks.filter((item) => item.id !== 'client-pkce-required');
  const incompleteResult = validateB30RuntimeEvidence(incomplete, expectedClientIds());
  assert.equal(incompleteResult.result, 'FAIL');
  assert.ok(incompleteResult.errors.some((error) => error.includes('client-pkce-required')));
});

test('B30 static CLI is repeatable and performs no runtime/token operation', () => {
  const result = spawnSync(process.execPath, ['scripts/runtime/b30-static-check.mjs'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.result, 'PASS');
  assert.equal(output.summary.clientCount, 4);
});
