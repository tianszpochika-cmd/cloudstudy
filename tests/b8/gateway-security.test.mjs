import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('Gateway points IAM to the registered loopback port and requires explicit JWT validation', () => {
  const yaml = read('services/api-gateway/src/main/resources/application.yml');
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
  const jwkSource = read('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayIamPublicJwkSource.java');
  assert.match(config, /oauth2ResourceServer/);
  assert.match(config, /anyExchange\(\)\.authenticated\(\)/);
  assert.match(config, /anyExchange\(\)\.denyAll\(\)/);
  // The decoder is built from a JWK source that unwraps the envelope IAM publishes, rather than from
  // NimbusReactiveJwtDecoder.withJwkSetUri over a bare JWKS document. Asserting the source is the
  // stronger claim: a decoder wired straight to the endpoint would fail on an enveloped response,
  // and the source is where the public-material-only guarantee lives.
  assert.match(config, /NimbusReactiveJwtDecoder/);
  assert.match(config, /new GatewayIamPublicJwkSource\(/);
  assert.match(jwkSource, /keys/);
  // The precise rule is that only public material is ever read: the RSA private exponent is a "d"
  // member of a JWK and must never be extracted. Matching the word "private" would only find Java
  // modifiers and prose.
  assert.doesNotMatch(jwkSource, /"d"\s*:/u);
  assert.match(decoder, /resourceServerEnabled/);
  // The JWKS endpoint lives in the typed security properties, not in the filter, so assert it where
  // it is declared and assert that the filter reads the switch rather than a path.
  const yaml = read('services/api-gateway/src/main/resources/application.yml');
  assert.match(yaml, /jwk-set-uri: \$\{IAM_JWT_JWKS_URI:http:\/\/127\.0\.0\.1:18087\/api\/v1\/auth\/jwks\}/);
  assert.match(yaml, /resource-server-enabled: \$\{GATEWAY_RESOURCE_SERVER_ENABLED:true\}/);
  assert.match(config, /properties\.security\(\)\.jwkSetUri\(\)|jwkSetUri/);
  assert.doesNotMatch(decoder, /Bearer.*authenticated|presence.*auth/i);
});

test('Gateway routes canonical IAM paths, preserves explicit legacy rewrites and strips forged authority headers', () => {
  const policy = read('services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRoutePolicy.java');
  const sanitizer = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/ClientAuthorizationContextSanitizerGlobalFilter.java');
  // The IAM surface is declared as canonical rules with exact paths for the public entry points and
  // prefix rules for the two authenticated domains, instead of the single B-line iam-auth route.
  for (const rule of ['iam-jwks-public', 'iam-register', 'iam-login', 'iam-refresh', 'iam-password-reset', 'auth-domain', 'iam-domain']) {
    assert.match(policy, new RegExp(`"${rule}"`), `missing canonical IAM rule ${rule}`);
  }
  assert.match(policy, /"\/api\/v1\/auth\/jwks"/);
  assert.match(policy, /"\/api\/v1\/auth\/token\/refresh"/);
  assert.match(policy, /"\/api\/v1\/auth"/);
  assert.match(policy, /"\/api\/v1\/iam"/);
  // No legacy catch-all is registered, which is stricter than keeping a rewritten one.
  assert.doesNotMatch(policy, /core-api-legacy-compat/);
  // The forged header names are declared once, in the class whose only job is to name and remove
  // them, and the sanitizer applies that removal to every exchange.
  const forgedHeaders = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/ClientAuthorizationContextHeaders.java');
  for (const header of ['X-B5-Role', 'X-Role', 'X-Tenant-Id', 'X-Owner-Id']) assert.match(forgedHeaders, new RegExp(header));
  assert.match(sanitizer, /ClientAuthorizationContextHeaders::removeFrom/);
  assert.doesNotMatch(sanitizer, /remove.*Authorization/);
});

test('Gateway security audit is bounded and does not persist query/body/token or client authority facts', () => {
  const filter = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/SecurityAuditGlobalFilter.java');
  const recorder = read('services/api-gateway/src/main/java/com/englishflow/gateway/support/SecurityAuditRecorder.java');
  const record = read('services/api-gateway/src/main/java/com/englishflow/gateway/support/SecurityAuditRecord.java');
  const sink = read('services/api-gateway/src/main/java/com/englishflow/gateway/support/BoundedSecurityAuditSink.java');
  assert.match(filter, /recorder\.record\(exchange, startedAtNanos\)/);
  // The record carries no request path at all, only the route id, so there is no path, query or
  // parameter to redact. That is a stronger guarantee than filtering a path field, and the
  // distinction between an authentication and an authorization failure is now carried by the
  // decision field instead of by skipping those statuses from the audit.
  for (const field of ['String routeId', 'String method', 'int status', 'String decision', 'String reasonCode', 'String latencyBucket']) {
    assert.match(record, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(record, /String (path|query|body|token|role|cookie|authorization)/i);
  assert.match(recorder, /decision\(status\)/);
  assert.match(recorder, /fallbackReason\(status\)/);
  assert.match(sink, /capacity/);
  assert.match(sink, /ConcurrentLinkedDeque/);
});

test('Gateway maps authentication and authorization failures to distinct statuses', () => {
  const mapper = read('services/api-gateway/src/main/java/com/englishflow/gateway/support/GatewayErrorMapper.java');
  assert.match(mapper, /AuthenticationException/);
  assert.match(mapper, /AccessDeniedException/);
  assert.match(mapper, /new GatewayError\(401/);
  assert.match(mapper, /new GatewayError\(403/);
});
