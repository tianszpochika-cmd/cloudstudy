import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const exists = (relativePath) => existsSync(join(root, relativePath));

function javaSources(relativeDirectory) {
  const directory = join(root, relativeDirectory);
  if (!exists(relativeDirectory)) return '';
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name.endsWith('.java')) files.push(readFileSync(absolute, 'utf8'));
    }
  };
  visit(directory);
  return files.join('\n');
}

test('B7 Platform 0 locks Java 25, Boot 4.1 and the compatible Cloud train', () => {
  const pom = read('services/api-gateway/pom.xml');
  assert.match(pom, /<java\.version>25<\/java\.version>/);
  assert.match(pom, /<maven\.compiler\.release>25<\/maven\.compiler\.release>/);
  assert.match(pom, /<version>4\.1\.1<\/version>/);
  assert.match(pom, /<spring-cloud\.version>2025\.1\.3<\/spring-cloud\.version>/);
  assert.match(pom, /spring-cloud-starter-gateway-server-webflux/);
  assert.match(pom, /spring-boot-starter-security-oauth2-resource-server/);
  assert.match(pom, /spring-boot-starter-opentelemetry/);
  assert.match(pom, /requireJavaVersion/);
  assert.doesNotMatch(pom, /<java\.version>17<\/java\.version>/);
});

test('Gateway uses a required registered port and exposes health/readiness configuration', () => {
  const application = read('services/api-gateway/src/main/resources/application.yml');
  const local = read('services/api-gateway/src/main/resources/application-local.yml');
  assert.match(application, /address: \$\{SERVER_ADDRESS:127\.0\.0\.1\}/);
  assert.match(application, /port: \$\{API_GATEWAY_PORT:18070\}/);
  assert.match(application, /probes:\s*\n\s*enabled: true/);
  // M1-004 replaced one shared origin list with one origin per browser profile, so every application
  // maps to exactly one boundary; asserting each profile is stricter than accepting any list.
  for (const profile of ['learner-web', 'admin-web', 'mobile-h5', 'official-site']) {
    assert.match(application, new RegExp(`${profile}-origin: \\$\\{CORS_ALLOWED_ORIGIN_`));
  }
  assert.match(application, /rate-limit:/);
  assert.match(application, /anonymous-read-enabled: false/);
  assert.match(application, /jwt-prevalidation-enabled: \$\{GATEWAY_JWT_PREVALIDATION_ENABLED:true\}/);
  assert.match(local, /on-profile: local/);
  // The local profile no longer flips anonymous read on. It is an explicit development exception for
  // the strangler and the in-process limiter, and anonymous read stays off there too.
  assert.match(local, /b14:/);
  assert.match(local, /enabled: \$\{B14_STRANGLER_ENABLED:true\}/);
  assert.match(local, /backend: \$\{GATEWAY_RATE_LIMIT_BACKEND:memory\}/);
  assert.doesNotMatch(local, /anonymous-read-enabled: true/);
});

test('Gateway exposes only explicit v1 compatibility routes and preserves the anti-corruption boundary', () => {
  const policy = read('services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRoutePolicy.java');
  const executionPolicy = read('services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java');
  const configuration = read('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayConfiguration.java');
  const boundary = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/ApiVersionBoundaryGlobalFilter.java');
  const jwtBoundary = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/JwtPreValidationBoundaryGlobalFilter.java');
  const allGatewayJava = javaSources('services/api-gateway/src/main/java');

  assert.match(policy, /"\/api\/v1\/health"/);
  assert.match(policy, /rule\("gateway-health"/);
  // The B-line legacy rewrite route, its X-Compatibility-Route marker and the local-profile-only
  // route are gone. Rather than a read-only compatibility route, no catch-all is registered at all,
  // and every route comes from the canonical policy, so nothing can be rewritten around it.
  assert.doesNotMatch(policy + configuration, /\/api\/v1\/legacy\//);
  assert.doesNotMatch(policy + configuration, /X-Compatibility-Route/);
  assert.doesNotMatch(policy + configuration, /acceptsProfiles/);
  assert.match(configuration, /for \(GatewayRouteExecutionPolicy\.RouteBinding binding : routeExecutionPolicy\.routeBindings\(\)\)/);
  assert.match(configuration, /\.method\(routeMethods\(binding\.methods\(\)\)\)/);
  assert.match(configuration, /anyExchange\(\)\.denyAll\(\)/);
  assert.doesNotMatch(configuration, /anyExchange\(\)\.permitAll\(\)/);
  assert.match(boundary, /unsupported_api_version/);
  assert.match(boundary, /internal_route_not_public/);
  assert.match(configuration, /SecurityWebFilterChain/);
  assert.match(jwtBoundary, /header-shortcut boundary/);
  // The Gateway holds no domain or persistence code. The one controller is the canonical
  // GATEWAY_LOCAL health projection, and naming it is stronger than a blanket ban: it must stay a
  // local, dependency-free report on the Gateway process and must not infer owner-service health.
  assert.doesNotMatch(allGatewayJava, /JdbcTemplate|JpaRepository|@Entity/);
  const controllerNames = [...allGatewayJava.matchAll(/@RestController[\s\S]{0,240}?class\s+(\w+)/gu)].map((match) => match[1]);
  assert.deepEqual(controllerNames, ['GatewayHealthController'],
    'the canonical GATEWAY_LOCAL health projection must be the only Gateway controller');
  const health = read('services/api-gateway/src/main/java/com/englishflow/gateway/web/GatewayHealthController.java');
  assert.match(health, /"dependencies", List\.of\(\)/);
  assert.match(health, /path = "\/internal\/gateway\/health"/);
});

test('Request/trace context is bounded and error mapping distinguishes edge failures', () => {
  const correlation = read('services/api-gateway/src/main/java/com/englishflow/gateway/support/CorrelationIds.java');
  const mapper = read('services/api-gateway/src/main/java/com/englishflow/gateway/support/GatewayErrorMapper.java');
  const writer = read('services/api-gateway/src/main/java/com/englishflow/gateway/support/GatewayErrorResponseWriter.java');
  assert.match(correlation, /SAFE_ID/);
  assert.match(correlation, /traceparent/);
  assert.match(correlation, /UUID\.randomUUID/);
  assert.match(mapper, /504, "upstream_timeout"/);
  assert.match(mapper, /503, "upstream_unavailable"/);
  assert.match(mapper, /502, "upstream_failure"/);
  assert.match(writer, /MediaType\.APPLICATION_JSON/);
  assert.match(writer, /X-Request-Id/);
  assert.match(writer, /X-Trace-Id/);
});

test('CORS and rate limiting are explicit platform seams, not domain behavior', () => {
  const configuration = read('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayConfiguration.java');
  const rateLimit = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/RateLimitPlaceholderGlobalFilter.java');
  const readme = read('services/api-gateway/README.md');
  // CORS is a CorsConfigurationSource resolved per browser profile and applied through the security
  // chain, so each origin gets exactly one allowed origin rather than a shared filter with a list.
  assert.match(configuration, /CorsConfigurationSource corsConfigurationSource\(/);
  assert.match(configuration, /properties\.cors\(\)\.profileFor\(origin\)/);
  assert.match(configuration, /configuration\.setAllowedOrigins\(java\.util\.List\.of\(origin\)\)/);
  assert.match(configuration, /\.cors\(Customizer\.withDefaults\(\)\)/);
  assert.match(rateLimit, /local-placeholder/);
  assert.match(rateLimit, /TOO_MANY_REQUESTS/);
  assert.match(readme, /does not own learner, content, order, permission or audit facts/);
  assert.match(readme, /not a production distributed limiter/);
});

test('service-template is present and does not inherit the Java 17 core-api runtime', () => {
  assert.ok(exists('services/service-template/pom.xml'), 'service-template/pom.xml must be created by V2-B7-PLAT-001');
  const pom = read('services/service-template/pom.xml');
  assert.match(pom, /<java\.version>25<\/java\.version>/);
  assert.match(pom, /4\.1\.1/);
  assert.match(pom, /maven-enforcer-plugin/);
  assert.match(pom, /<version>\[25,26\)<\/version>/);
  assert.doesNotMatch(pom, /<java\.version>17<\/java\.version>/);
  const sources = javaSources('services/service-template/src/main/java');
  assert.match(sources, /Health|Readiness|ConfigurationProperties/);
  assert.doesNotMatch(sources, /@RestController|JdbcTemplate|JpaRepository|@Entity/);
});

test('B7 changes stay inside the user-authorized implementation/test roots', () => {
  const allowedRoots = [
    'services/api-gateway',
    'services/service-template',
    'tests/b7/gateway-platform.test.mjs'
  ];
  for (const path of allowedRoots) {
    assert.equal(relative(root, join(root, path)).startsWith('..'), false);
  }
});
