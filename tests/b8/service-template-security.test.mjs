import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const javaRoot = join(root, 'services', 'service-template', 'src', 'main', 'java');

function javaSources(directory = javaRoot) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...javaSources(absolute));
    else if (entry.name.endsWith('.java')) files.push(readFileSync(absolute, 'utf8'));
  }
  return files;
}

test('service template keeps the Java 25/Boot 4.1.1 Resource Server seam', () => {
  const pom = read('services/service-template/pom.xml');
  assert.match(pom, /<java\.version>25<\/java\.version>/);
  assert.match(pom, /<maven\.compiler\.release>25<\/maven\.compiler\.release>/);
  assert.match(pom, /<version>4\.1\.1<\/version>/);
  assert.match(pom, /spring-boot-starter-security/);
  assert.match(pom, /spring-boot-starter-oauth2-resource-server/);
  assert.match(pom, /spring-boot-starter-validation/);
  assert.match(pom, /spring-boot-starter-opentelemetry/);
  assert.match(pom, /flyway-core/);
  assert.match(pom, /requireJavaVersion/);
  assert.match(pom, /\[25,26\)/);
});

test('platform JWT verification is enabled by default and non-actuator traffic fails closed when disabled', () => {
  const yaml = read('services/service-template/src/main/resources/application.yml');
  const config = read('services/service-template/src/main/java/com/englishflow/platform/template/security/SecurityConfiguration.java');
  const props = read('services/service-template/src/main/java/com/englishflow/platform/template/config/ResourceServerProperties.java');
  assert.match(yaml, /enabled: \$\{SERVICE_RESOURCE_SERVER_ENABLED:true\}/);
  assert.match(yaml, /issuer-uri: \$\{SERVICE_SECURITY_ISSUER_URI:/);
  assert.match(yaml, /jwk-set-uri: \$\{SERVICE_SECURITY_JWK_SET_URI:/);
  assert.match(props, /issuer-uri and jwk-set-uri are required/);
  assert.match(config, /NimbusJwtDecoder\.withJwkSetUri/);
  assert.match(config, /auth\.anyRequest\(\)\.denyAll\(\)/);
  assert.match(config, /auth\.requestMatchers\("\/actuator\/\*\*"\)\.permitAll\(\)/);
  assert.match(config, /oauth2ResourceServer/);
});

test('PEP covers verified principal, tenant scope, policy cache and fail-closed reasons', () => {
  const sources = javaSources().join('\n');
  for (const marker of [
    'record VerifiedPrincipal',
    'TenantScope.platform',
    'record AuthorizationContext',
    'class PolicyCache',
    'class LocalPolicyEvaluator',
    'interface PdpPort',
    'class PepGuard',
    'PDP_TIMEOUT',
    'REVOCATION_UNKNOWN',
    'POLICY_STALE',
    'UNTRUSTED_CLIENT_FACTS',
    'MISSING_CONTENT_RIGHTS',
    'MISSING_CONSENT',
  ]) assert.match(sources, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const header of ['X-Role', 'X-B5-Role', 'X-Tenant-Id', 'X-Owner-Id']) {
    assert.match(sources, new RegExp(header, 'i'));
  }
  assert.doesNotMatch(sources, /@RestController|@Entity|JpaRepository|JdbcTemplate/);
});

test('401 and 403 use distinct bounded error envelopes and README records the B8 gate', () => {
  const config = read('services/service-template/src/main/java/com/englishflow/platform/template/security/SecurityConfiguration.java');
  const writer = read('services/service-template/src/main/java/com/englishflow/platform/template/security/SecurityErrorWriter.java');
  const readme = read('services/service-template/README.md');
  assert.match(config, /"UNAUTHENTICATED"/);
  assert.match(config, /"FORBIDDEN"/);
  assert.match(writer, /MediaType\.APPLICATION_JSON_VALUE/);
  assert.match(readme, /自有 JWT|平台 JWT|JWT/i);
  assert.match(readme, /运行态|生产环境/);
  assert.match(readme, /mvn -o validate test/);
});

test('B8 security tests remain independently runnable inside the shared B8 suite', () => {
  assert.ok(readdirSync(join(root, 'tests', 'b8')).includes('service-template-security.test.mjs'));
});
