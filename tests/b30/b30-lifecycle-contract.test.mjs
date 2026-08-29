import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const script = fs.readFileSync(path.join(root, 'scripts', 'runtime', 'b30-lifecycle-runtime.mjs'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'services', 'iam-service', 'src', 'main', 'resources', 'db', 'migration', 'V3__seed_b30_policy_version.sql'), 'utf8');

test('B30 lifecycle runtime covers the self-owned JWT auth lifecycle', () => {
  for (const marker of [
    'account-password-login', 'refresh-rotation', 'refresh-replay-rejected',
    'logout-revokes-session', 'wrong-password-rejected', 'account-lockout',
    'jwks-public-rs256', 'forged-authority-ignored',
    'tokenValuesEmitted: false', 'credentialsPersisted: false',
  ]) assert.ok(script.includes(marker), `missing lifecycle marker: ${marker}`);
  assert.doesNotMatch(script, /console\.log\([^\n]*(?:accessToken|refreshToken|password|authorizationCode|callback)/i);
  assert.doesNotMatch(script, /OIDC|OAuth|Keycloak|authorization.code|PKCE|nonce|state/i);
});

test('B30 policy version is an idempotent owner fact and not an in-memory label', () => {
  assert.match(migration, /INSERT INTO iam_policy_version/i);
  assert.match(migration, /b30-rbac-v1/);
  assert.match(migration, /ON DUPLICATE KEY UPDATE/i);
  assert.match(migration, /SHA2\(/i);
});
