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

test('IAM is registered on the single local port authority and remains loopback-only', () => {
  const yaml = read('services/iam-service/src/main/resources/application.yaml');
  const ports = JSON.parse(read('config/local-ports.json'));
  assert.match(yaml, /address: \$\{IAM_SERVER_ADDRESS:127\.0\.0\.1\}/);
  assert.match(yaml, /port: \$\{IAM_SERVICE_PORT:18087\}/);
  assert.equal(ports.services['iam-service'].port, 18087);
  assert.match(read('services/iam-service/README.md'), /127\.0\.0\.1:18087/);
});

test('OIDC seam owns server-side state, nonce and PKCE verifier without becoming a token server', () => {
  const sources = javaSources(javaRoot).join('\n');
  const yaml = read('services/iam-service/src/main/resources/application.yaml');
  assert.match(sources, /class ProviderNeutralOidcClient/);
  assert.match(sources, /server-generated state, nonce and verifier/i);
  assert.match(sources, /PkceSupport\.s256Challenge/);
  assert.match(sources, /transactions\.consume\(callback\.state\(\)\)/);
  assert.doesNotMatch(sources, /@RestController|JwtEncoder|NimbusJwtEncoder|AuthorizationServerConfiguration/);
  assert.match(yaml, /provider-mode: provider-neutral/);
  assert.match(yaml, /real-provider-enabled: false/);
});

test('principal, tenant and session facts are server-owned and secret-minimal', () => {
  const sources = javaSources(javaRoot).join('\n');
  assert.match(sources, /issuer.*subject/i);
  assert.match(sources, /TenantScope\.derive|PLATFORM_TENANT/);
  assert.match(sources, /client.*tenant|tenant.*client/i);
  assert.match(sources, /SecretDigests\.sha256Hex/);
  assert.match(sources, /SESSION_REPLAY|REPLAY_DETECTED/);
  assert.doesNotMatch(sources, /client.*role.*trusted|accept.*tenant.*from.*client/i);
});

test('Phase 1 adult Gate fails closed and does not create minor-domain facts', () => {
  const sources = javaSources(javaRoot).join('\n');
  assert.match(sources, /age.*18|18.*age/i);
  assert.match(sources, /trusted.*age|age.*evidence/i);
  assert.match(sources, /child|guardian|K12|minor payment/i);
  assert.match(sources, /ADULT_AGE_EVIDENCE_MISSING|ADULT_AGE_BELOW_MINIMUM|ADULT_CONFIRMATION_REQUIRED/);
});

test('IAM README keeps the unapproved G-IDP boundary explicit', () => {
  const readme = read('services/iam-service/README.md');
  assert.match(readme, /G-IDP.*尚未通过/);
  assert.match(readme, /未实现 OAuth\/OIDC token server/);
  assert.match(readme, /不能被描述为生产级 IAM\/RBAC/);
});
