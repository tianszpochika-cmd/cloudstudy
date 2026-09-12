import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (relative) => readFileSync(join(root, relative), 'utf8');

test('B16 security manifest keeps Phase 1 default-deny and self-owned JWT signing', () => {
  const manifest = JSON.parse(read('config/b16-security-runtime.json'));
  assert.equal(manifest.phase, 'phase-1');
  assert.equal(manifest.defaultDecision, 'deny');
  assert.equal(manifest.gateway.directConnectAllowed, false);
  assert.equal(manifest.jwt.mode, 'self-owned-jwt');
  assert.equal(manifest.jwt.algorithm, 'RS256');
  assert.equal(manifest.jwt.audience, 'yuxuexing-api');
  assert.equal(manifest.jwt.privateKeyOutsideRepository, true);
  assert.equal(manifest.iam.adultMinimumAge, 18);
  assert.equal(manifest.iam.minorDomainEnabled, false);
});

test('B16 Gateway has fixed loopback boundary, CORS, rate-limit and security facts', () => {
  const yaml = read('services/api-gateway/src/main/resources/application.yml');
  const rateLimit = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/RateLimitGlobalFilter.java');
  const legacyRateLimit = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/RateLimitPlaceholderGlobalFilter.java');
  assert.match(yaml, /address: \$\{SERVER_ADDRESS:127\.0\.0\.1\}/);
  assert.match(yaml, /port: \$\{API_GATEWAY_PORT:18070\}/);
  assert.match(yaml, /allowed-origins:/);
  assert.match(yaml, /rate-limit:/);
  assert.match(yaml, /requests-per-window:/);
  assert.match(yaml, /backend: \$\{GATEWAY_RATE_LIMIT_BACKEND:memory\}/);
  assert.match(yaml, /fail-open: \$\{GATEWAY_RATE_LIMIT_FAIL_OPEN:false\}/);
  assert.match(rateLimit, /RateLimitBackend/);
  assert.match(rateLimit, /TOO_MANY_REQUESTS/);
  assert.doesNotMatch(legacyRateLimit, /@Component/);
  assert.match(yaml, /X-Request-Id/);
  assert.match(yaml, /X-Trace-Id/);
  for (const header of ['X-Role', 'X-B5-Role', 'X-Tenant-Id', 'X-Owner-Id']) {
    assert.match(yaml + read('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayConfiguration.java'), new RegExp(header));
  }
});

test('B16 IAM signs short-lived JWTs and keeps account/session secrets server-side', () => {
  const sources = read('services/iam-service/src/main/java/com/englishflow/iam/auth/JwtTokenService.java')
    + read('services/iam-service/src/main/java/com/englishflow/iam/auth/JwtSigningKeyProvider.java')
    + read('services/iam-service/src/main/java/com/englishflow/iam/domain/PasswordAccountService.java')
    + read('services/iam-service/src/main/java/com/englishflow/iam/domain/SessionService.java')
    + read('services/iam-service/src/main/java/com/englishflow/iam/config/IamRuntimeConfiguration.java');
  const props = read('services/iam-service/src/main/java/com/englishflow/iam/config/IamServiceProperties.java');
  const yaml = read('services/iam-service/src/main/resources/application.yaml');
  const controller = read('services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java');
  const security = read('services/iam-service/src/main/java/com/englishflow/iam/config/IamSecurityConfiguration.java');
  assert.match(sources, /JwtEncoder/);
  assert.match(sources, /token_type/);
  assert.match(sources, /refresh.*replay/i);
  assert.match(sources, /BCrypt|bcrypt/i);
  assert.match(props, /ephemeralKeysAllowed/);
  assert.match(props, /@Pattern\(regexp = "RS256"\)/);
  assert.doesNotMatch(props, /RS256\|ES256/);
  assert.match(yaml, /issuer: \$\{IAM_JWT_ISSUER:/);
  assert.match(yaml + controller + security, /jwks|public/i);
});

test('B16 all Phase 1 domain services retain Resource Server and service-side security seams', () => {
  const runtime = JSON.parse(read('config/v2-runtime-services.json'));
  const security = JSON.parse(read('config/b16-security-runtime.json'));
  for (const id of security.pep.domainServices) {
    const service = runtime.services.find((item) => item.id === id);
    assert.ok(service, `${id} must be in runtime manifest`);
    const pom = read(join(service.project, 'pom.xml'));
    assert.match(pom, /spring-boot-starter-security/);
    assert.match(pom, /oauth2-resource-server/);
    const securityPackage = read(join(service.project, 'src', 'main', 'java', id === 'assessment-service'
      ? 'com/englishflow/assessment/security/AssessmentSecurityConfiguration.java'
      : id === 'learner-service'
        ? 'com/englishflow/learner/security/SecurityConfiguration.java'
        : id === 'learning-service'
          ? 'com/englishflow/learning/security/SecurityConfiguration.java'
          : id === 'content-service'
            ? 'com/englishflow/content/security/ContentSecurityConfiguration.java'
            : id === 'media-service'
              ? 'com/englishflow/media/security/MediaSecurityConfiguration.java'
              : id === 'social-service'
                ? 'com/englishflow/social/security/SocialSecurityConfiguration.java'
                : id === 'gamification-service'
                  ? 'com/englishflow/gamification/adapter/http/GamificationSecurityConfiguration.java'
                  : id === 'commerce-service'
                    ? 'com/englishflow/commerce/adapter/http/CommerceSecurityConfiguration.java'
                    : id === 'notification-service'
                      ? 'com/englishflow/notification/config/NotificationSecurityConfiguration.java'
                      : id === 'analytics-service'
                        ? 'com/englishflow/analytics/security/AnalyticsSecurityConfiguration.java'
                        : 'com/englishflow/adminops/security/AdminOpsSecurityConfiguration.java'));
    assert.match(securityPackage, /SecurityFilterChain|oauth2ResourceServer/);
  }
  assert.equal(runtime.services.find((item) => item.id === 'core-api').profile, 'legacy-compatibility');
});

test('B16 runtime evidence explicitly separates static pass from real environment prerequisites', () => {
  const manifest = JSON.parse(read('config/b16-security-runtime.json'));
  assert.ok(manifest.runtimeEvidence.static.length >= 4);
  assert.ok(manifest.runtimeEvidence.runtime.includes('gateway-to-domain-pep'));
  assert.ok(manifest.runtimeEvidence.runtimePrerequisites.includes('java-25'));
  assert.ok(manifest.runtimeEvidence.runtimePrerequisites.includes('iam-jwt-jwks-and-test-account-fixture'));
});

test('B16 service template includes mTLS/workload identity and bound PDP decisions', () => {
  const yaml = read('services/service-template/src/main/resources/application.yml');
  const security = read('services/service-template/src/main/java/com/englishflow/platform/template/security/SecurityConfiguration.java');
  const workload = read('services/service-template/src/main/java/com/englishflow/platform/template/security/WorkloadIdentityFilter.java');
  const pdp = read('services/service-template/src/main/java/com/englishflow/platform/template/security/PdpDecision.java');
  assert.match(yaml, /SERVICE_MTLS_ENABLED:false/);
  assert.match(yaml, /workload-identity:/);
  assert.match(security, /WorkloadIdentityFilter/);
  assert.match(workload, /UNTRUSTED_WORKLOAD_IDENTITY/);
  assert.match(workload, /WORKLOAD_IDENTITY_REQUIRED/);
  assert.match(pdp, /requestFingerprint/);
  assert.match(read('services/service-template/src/main/java/com/englishflow/platform/template/security/PepGuard.java'), /POLICY_VERSION_MISMATCH/);
});
