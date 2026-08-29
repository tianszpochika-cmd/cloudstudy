import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { readB30Inputs, repositoryRoot, validateB30LocalJwt } from '../../scripts/runtime/b30-static-check.mjs';

const inputs = readB30Inputs(repositoryRoot);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('B30 static contract covers self-owned JWT, JWKS, four clients and session lifecycle', () => {
  const result = validateB30LocalJwt(inputs);
  assert.equal(result.result, 'PASS', result.errors.join('\n'));
  assert.equal(result.summary.total, 11);
});

test('B30 static contract rejects issuer, audience, algorithm and storage drift', () => {
  const wrongIssuer = clone(inputs);
  wrongIssuer.jwt.issuer = 'https://wrong.example';
  assert.equal(validateB30LocalJwt(wrongIssuer).result, 'FAIL');

  const wrongAudience = clone(inputs);
  wrongAudience.jwt.audience = 'wrong-api';
  assert.equal(validateB30LocalJwt(wrongAudience).result, 'FAIL');

  const wrongAlgorithm = clone(inputs);
  wrongAlgorithm.jwt.algorithm = 'HS256';
  assert.equal(validateB30LocalJwt(wrongAlgorithm).result, 'FAIL');

  const insecureStorage = clone(inputs);
  insecureStorage.jwt.clients.mobile.refreshTokenStorage = 'localStorage';
  assert.equal(validateB30LocalJwt(insecureStorage).result, 'FAIL');
});

test('B30 runtime probe has no callback, external provider or token logging boundary', () => {
  const probe = readFileSync(path.join(repositoryRoot, 'scripts/runtime/b30-runtime-probe.mjs'), 'utf8');
  assert.doesNotMatch(probe, /oidc|oauth|keycloak|pkce|authorization[_ -]?code|external.?idp/i);
  assert.doesNotMatch(probe, /console\.log\([^\n]*(?:accessToken|refreshToken|password)/i);
  assert.match(probe, /refresh-replay/);
  assert.match(probe, /x-role/);
});

test('B30 static CLI is repeatable and does not call the network', () => {
  const result = spawnSync(process.execPath, ['scripts/runtime/b30-static-check.mjs'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.result, 'PASS');
  assert.equal(output.summary.total, 11);
});
