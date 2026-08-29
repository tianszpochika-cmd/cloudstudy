import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('Gateway points IAM to the registered loopback port and requires explicit JWT validation', () => {
  const yaml = read('services/api-gateway/src/main/resources/application.yaml');
  const properties = read('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayProperties.java');
  const env = read('.env.example');
  assert.match(yaml, /iam-base-url: \$\{IAM_SERVICE_BASE_URL:http:\/\/127\.0\.0\.1:18087\}/);
  assert.match(yaml, /resource-server-enabled: \$\{GATEWAY_RESOURCE_SERVER_ENABLED:true\}/);
  assert.match(yaml, /audit-enabled: \$\{GATEWAY_SECURITY_AUDIT_ENABLED:true\}/);
  assert.match(properties, /record Identity/);
  assert.match(properties, /jwkSetUri|issuerUri/);
  assert.match(env, /IAM_SERVICE_PORT=18087/);
  assert.match(env, /GATEWAY_RESOURCE_SERVER_ENABLED=true/);
});

test('Gateway security uses the explicit IAM JWKS decoder and fails closed otherwise', () => {
  const config = read('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayConfiguration.java');
  const decoder = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/JwtPreValidationBoundaryGlobalFilter.java');
  assert.match(config, /oauth2ResourceServer/);
  assert.match(config, /anyExchange\(\)\.authenticated\(\)/);
  assert.match(config, /anyExchange\(\)\.denyAll\(\)/);
  assert.match(config, /NimbusReactiveJwtDecoder\.withJwkSetUri/);
  assert.match(decoder, /resourceServerEnabled/);
  assert.match(decoder, /auth\/jwks/);
  assert.doesNotMatch(decoder, /Bearer.*authenticated|presence.*auth/i);
});

test('Gateway routes canonical IAM paths, preserves explicit legacy rewrites and strips forged authority headers', () => {
  const routes = read('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayConfiguration.java');
  const sanitizer = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/ClientAuthorizationContextSanitizerGlobalFilter.java');
  assert.match(routes, /iam-auth/);
  assert.match(routes, /\/api\/v1\/iam\/\*\*/);
  assert.match(routes, /auth\/token\/refresh/);
  assert.match(routes, /\/api\/v1\/auth\/\*\*/);
  assert.match(routes, /core-api-legacy-compat/);
  for (const header of ['X-B5-Role', 'X-Role', 'X-Tenant-Id', 'X-Owner-Id']) assert.match(sanitizer, new RegExp(header));
  assert.doesNotMatch(sanitizer, /remove.*Authorization/);
});

test('Gateway security audit is bounded and does not persist query/body/token or client authority facts', () => {
  const filter = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/SecurityAuditGlobalFilter.java');
  const record = read('services/api-gateway/src/main/java/com/englishflow/gateway/support/SecurityAuditRecord.java');
  const sink = read('services/api-gateway/src/main/java/com/englishflow/gateway/support/BoundedSecurityAuditSink.java');
  assert.match(filter, /status != 401 && status != 403/);
  assert.match(filter, /getPath\(\)\.value/);
  assert.match(record, /String path/);
  assert.match(sink, /capacity/);
  assert.match(sink, /ConcurrentLinkedDeque/);
  assert.doesNotMatch(record, /String (query|body|token|role)/i);
});

test('Gateway maps authentication and authorization failures to distinct statuses', () => {
  const mapper = read('services/api-gateway/src/main/java/com/englishflow/gateway/support/GatewayErrorMapper.java');
  assert.match(mapper, /AuthenticationException/);
  assert.match(mapper, /AccessDeniedException/);
  assert.match(mapper, /new GatewayError\(401/);
  assert.match(mapper, /new GatewayError\(403/);
});
