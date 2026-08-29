import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { validateAuthContract, validateAuthContractData } from '../../scripts/audit/p1r-auth-contract-check.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const fragment = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'contracts', 'fragments', 'b8', 'b8-auth-iam.openapi.json'), 'utf8'));

function passingFixture() {
  const document = structuredClone(fragment);
  document['x-b8-authentication'].refreshToken.replay.errorCode = 'AUTH_REFRESH_REUSE_DETECTED';
  document.paths['/api/v1/auth/token/refresh'].post['x-auth-transport'].replay.errorCode = 'AUTH_REFRESH_REUSE_DETECTED';
  return document;
}

function assertMutationFails(mutate, expected) {
  const document = passingFixture();
  mutate(document);
  const report = validateAuthContractData({ document });
  assert.equal(report.result, 'FAIL', report.errors.join('\n'));
  assert(report.errors.some((error) => expected.test(error)), `missing ${expected}; got ${report.errors.join('\n')}`);
}

test('auth audit defaults to the mutable B8 fragment and honors the canonical replay code', () => {
  const report = validateAuthContract({ root });
  assert.equal(report.summary.coveredPathCount, 15);
  if (report.result === 'FAIL') {
    assert.equal(report.errors.length, 2);
    assert(report.errors.every((error) => error.includes('AUTH_REFRESH_REUSE_DETECTED')));
  } else {
    assert.deepEqual(report.errors, []);
  }
});

test('normalized in-memory B8 auth contract passes without writing the fragment', () => {
  const report = validateAuthContractData({ document: passingFixture() });
  assert.deepEqual(report.errors, []);
  assert.equal(report.result, 'PASS');
  assert.equal(report.summary.requiredPathCount, 15);
});

test('Web auth response cannot gain a JSON refreshToken', () => {
  assertMutationFails((document) => {
    document.components.schemas.B8WebAuthTokenResponse.properties.refreshToken = { type: 'string' };
  }, /Web auth JSON.*refreshToken/);
});

test('Native auth response refreshToken cannot become optional', () => {
  assertMutationFails((document) => {
    document.components.schemas.B8NativeAuthTokenResponse.required = document.components.schemas.B8NativeAuthTokenResponse.required.filter((field) => field !== 'refreshToken');
  }, /B8NativeAuthTokenResponse must require refreshToken/);
});

test('authentication and JWKS algorithms cannot drift to ES256', () => {
  assertMutationFails((document) => {
    document['x-b8-authentication'].accessToken.algorithm = 'ES256';
  }, /accessToken\.algorithm must be RS256/);
});

test('refresh cookie security attributes cannot be weakened', () => {
  assertMutationFails((document) => {
    document.components.headers.B8RefreshCookie['x-cookie'].secure = false;
  }, /B8RefreshCookie must be HttpOnly, Secure/);
});

test('refresh replay must revoke the token family and associated session', () => {
  assertMutationFails((document) => {
    document['x-b8-authentication'].refreshToken.replay.differentIdempotencyKeyOrReuse = 'accept-and-continue';
  }, /refresh reuse must revoke token family/);
});

test('legacy lowercase refresh replay code cannot replace canonical ErrorCode', () => {
  assertMutationFails((document) => {
    document['x-b8-authentication'].refreshToken.replay.errorCode = 'refresh_token_reused';
    document.paths['/api/v1/auth/token/refresh'].post['x-auth-transport'].replay.errorCode = 'refresh_token_reused';
  }, /errorCode must be AUTH_REFRESH_REUSE_DETECTED/);
});

test('password reset must revoke all prior sessions', () => {
  assertMutationFails((document) => {
    document.paths['/api/v1/auth/password-reset/confirm'].post['x-password-reset'].successEffect = 'change-password-only';
  }, /password reset must revoke all prior sessions/);
});

test('session lifecycle responses must retain correlation headers', () => {
  assertMutationFails((document) => {
    delete document.paths['/api/v1/auth/logout'].post.responses['200'].headers['X-Trace-Id'];
  }, /POST \/api\/v1\/auth\/logout responses\.200 must expose X-Trace-Id/);
});
