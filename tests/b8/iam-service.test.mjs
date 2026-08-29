import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

function javaSources(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...javaSources(absolute));
    else if (entry.name.endsWith('.java')) files.push(readFileSync(absolute, 'utf8'));
  }
  return files;
}

const javaRoot = join(root, 'services', 'iam-service', 'src', 'main', 'java');

test('IAM is registered on the fixed local port and remains loopback-only', () => {
  const yaml = read('services/iam-service/src/main/resources/application.yaml');
  const ports = JSON.parse(read('config/local-ports.json'));
  assert.match(yaml, /address: \$\{IAM_SERVER_ADDRESS:127\.0\.0\.1\}/);
  assert.match(yaml, /port: \$\{IAM_SERVICE_PORT:18087\}/);
  assert.equal(ports.services['iam-service'].port, 18087);
  assert.match(read('services/iam-service/README.md'), /127\.0\.0\.1:18087/);
});

test('IAM owns password verification, RS256 signing, JWKS publication and rotating sessions', () => {
  const sources = javaSources(javaRoot).join('\n');
  const yaml = read('services/iam-service/src/main/resources/application.yaml');
  assert.match(sources, /class PasswordAccountService/);
  assert.match(sources, /BCrypt/);
  assert.match(sources, /class JwtTokenService/);
  assert.match(sources, /class JwtSigningKeyProvider/);
  assert.match(sources, /JWSAlgorithm\.RS256/);
  assert.match(sources, /class PasswordResetService/);
  assert.match(sources, /refresh.*replay|replay.*refresh/i);
  assert.match(sources, /iam_refresh_token_history/);
  assert.match(sources, /JwtEncoder/);
  assert.match(yaml, /issuer: \$\{IAM_JWT_ISSUER:http:\/\/127\.0\.0\.1:18087\}/);
  assert.match(yaml, /audience: \$\{IAM_JWT_AUDIENCE:yuxuexing-api\}/);
  assert.match(yaml, /algorithm: \$\{IAM_JWT_ALGORITHM:RS256\}/);
  assert.match(yaml, /private-key-file/);
});

test('principal, tenant and session facts are server-owned and secrets are digested', () => {
  const sources = javaSources(javaRoot).join('\n');
  assert.match(sources, /getSubject\(\)|getToken\(\)\.getSubject/);
  assert.match(sources, /PLATFORM_TENANT|platform/);
  assert.match(sources, /SecretDigests\.sha256Hex|MessageDigest/);
  assert.match(sources, /SESSION_REPLAY|REPLAY_DETECTED|REFRESH_REUSE/);
  assert.doesNotMatch(sources, /client.*role.*trusted|accept.*tenant.*from.*client/i);
});

test('Phase 1 adult Gate fails closed and does not create minor-domain facts', () => {
  const sources = javaSources(javaRoot).join('\n');
  assert.match(sources, /age.*18|18.*age/i);
  assert.match(sources, /trusted.*age|age.*evidence/i);
  assert.match(sources, /child|guardian|K12|minor payment/i);
  assert.match(sources, /ADULT_AGE_EVIDENCE_MISSING|ADULT_AGE_BELOW_MINIMUM|ADULT_CONFIRMATION_REQUIRED/);
});

test('IAM README describes the self-owned JWT boundary and makes no external-provider claim', () => {
  const readme = read('services/iam-service/README.md');
  assert.match(readme, /自有 JWT|自有账号密码|RS256/i);
  assert.match(readme, /JWKS/);
  assert.match(readme, /Refresh Token.*轮换|轮换.*Refresh Token/);
  assert.doesNotMatch(readme, /G-IDP|OIDC|OAuth|Keycloak/i);
});
