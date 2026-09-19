package com.englishflow.gateway.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.convert.DurationUnit;
import org.springframework.validation.annotation.Validated;

import java.net.URI;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Validated
@ConfigurationProperties(prefix = "gateway")
public record GatewayProperties(
        @Valid @NotNull Compatibility compatibility,
        @Valid @NotNull Identity identity,
        @Valid @NotNull B12Services b12,
        @Valid @NotNull B13Services b13,
        @Valid @NotNull B14Services b14,
        @Valid @NotNull WorkflowServices workflow,
        @Valid @NotNull Cors cors,
        @Valid @NotNull RateLimit rateLimit,
        @Valid @NotNull RequestContext requestContext,
        @Valid @NotNull Security security
) {

    public record Identity(
            @NotNull Boolean enabled,
            @NotBlank String iamBaseUrl
    ) {
        public URI iamUri() {
            URI uri = URI.create(iamBaseUrl);
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalStateException("gateway.identity.iam-base-url must use http or https");
            }
            if (uri.getUserInfo() != null || uri.getPath() != null && !uri.getPath().isBlank()) {
                throw new IllegalStateException("IAM base URL must not contain credentials or a path");
            }
            return uri;
        }
    }

    public record B12Services(
            @NotNull Boolean enabled,
            @NotBlank String gamificationBaseUrl,
            @NotBlank String socialBaseUrl,
            @NotBlank String notificationBaseUrl
    ) {
        public URI gamificationUri() { return baseUri(gamificationBaseUrl, "gamification"); }
        public URI socialUri() { return baseUri(socialBaseUrl, "social"); }
        public URI notificationUri() { return baseUri(notificationBaseUrl, "notification"); }

        private static URI baseUri(String value, String service) {
            URI uri = URI.create(value);
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalStateException("gateway.b12." + service + "-base-url must use http or https");
            }
            if (uri.getUserInfo() != null || uri.getPath() != null && !uri.getPath().isBlank()) {
                throw new IllegalStateException("gateway.b12 " + service + " base URL must not contain credentials or a path");
            }
            return uri;
        }
    }

    public record B13Services(
            @NotNull Boolean enabled,
            @NotBlank String commerceBaseUrl,
            @NotBlank String adminOpsBaseUrl,
            @NotBlank String analyticsBaseUrl
    ) {
        public URI commerceUri() { return baseUri(commerceBaseUrl, "commerce"); }
        public URI adminOpsUri() { return baseUri(adminOpsBaseUrl, "admin-ops"); }
        public URI analyticsUri() { return baseUri(analyticsBaseUrl, "analytics"); }

        private static URI baseUri(String value, String service) {
            URI uri = URI.create(value);
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalStateException("gateway.b13." + service + "-base-url must use http or https");
            }
            if (uri.getUserInfo() != null || uri.getPath() != null && !uri.getPath().isBlank()) {
                throw new IllegalStateException("gateway.b13 " + service + " base URL must not contain credentials or a path");
            }
            return uri;
        }
    }

    /**
     * P1R decision 1A: workflow recovery console route owner. Same shape as the
     * B12/B13 groups: an explicit enable flag plus a loopback-default base URL.
     */
    public record WorkflowServices(
            @NotNull Boolean enabled,
            @NotBlank String workflowBaseUrl
    ) {
        public URI workflowUri() { return baseUri(workflowBaseUrl, "workflow"); }

        private static URI baseUri(String value, String service) {
            URI uri = URI.create(value);
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalStateException("gateway.workflow." + service + "-base-url must use http or https");
            }
            if (uri.getUserInfo() != null || uri.getPath() != null && !uri.getPath().isBlank()) {
                throw new IllegalStateException("gateway.workflow " + service + " base URL must not contain credentials or a path");
            }
            return uri;
        }
    }

    public record Compatibility(
        @NotNull Boolean enabled,
        @NotBlank String coreApiBaseUrl,
        @NotNull Boolean anonymousReadEnabled
    ) {
        public URI coreApiUri() {
            URI uri = URI.create(coreApiBaseUrl);
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalStateException("gateway.compatibility.core-api-base-url must use http or https");
            }
            if (uri.getUserInfo() != null || uri.getPath() != null && !uri.getPath().isBlank()) {
                throw new IllegalStateException("core-api compatibility base URL must not contain credentials or a path");
            }
            return uri;
        }
    }

    /**
     * Phase 1 strangler controls. The map is deliberately configuration-only:
     * it selects a route owner and never carries tenant, role or subject facts.
     */
    public record B14Services(
            @NotNull Boolean enabled,
            @NotNull Boolean deprecationHeadersEnabled,
            @NotBlank String deprecationSunsetAt,
            @NotEmpty Map<String, @NotBlank String> serviceBaseUrls,
            @NotEmpty Map<String, @NotBlank String> routeModes
    ) {
        public static final Set<String> DOMAINS = Set.of(
                "learner", "content", "learning", "assessment", "media", "gamification", "social", "commerce");

        public B14Services {
            serviceBaseUrls = serviceBaseUrls == null ? Map.of() : Map.copyOf(serviceBaseUrls);
            routeModes = routeModes == null ? Map.of() : Map.copyOf(routeModes);
        }

        @AssertTrue(message = "gateway.b14 must configure all Phase 1 domain routes")
        public boolean isPhaseOneRouteMatrixComplete() {
            return DOMAINS.stream().allMatch(domain -> serviceBaseUrls.containsKey(domain)
                    && routeModes.containsKey(domain) && mode(domain) != null);
        }

        public boolean targets(String domain) {
            return mode(domain) == RouteMode.TARGET;
        }

        public RouteMode mode(String domain) {
            if (domain == null || !DOMAINS.contains(domain)) {
                throw new IllegalArgumentException("unsupported B14 domain: " + domain);
            }
            String configured = routeModes.get(domain);
            if (configured == null || configured.isBlank()) {
                throw new IllegalStateException("missing B14 route mode for " + domain);
            }
            return RouteMode.valueOf(configured.trim().toUpperCase(Locale.ROOT));
        }

        public URI serviceUri(String domain) {
            if (domain == null || !DOMAINS.contains(domain)) {
                throw new IllegalArgumentException("unsupported B14 domain: " + domain);
            }
            String value = serviceBaseUrls.get(domain);
            if (value == null || value.isBlank()) {
                throw new IllegalStateException("missing B14 service URL for " + domain);
            }
            URI uri = URI.create(value);
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalStateException("gateway.b14." + domain + "-base-url must use http or https");
            }
            if (uri.getUserInfo() != null || uri.getPath() != null && !uri.getPath().isBlank()) {
                throw new IllegalStateException("gateway.b14 " + domain + " base URL must not contain credentials or a path");
            }
            return uri;
        }

        public enum RouteMode { LEGACY, SHADOW, TARGET, FALLBACK }
    }

    public record Cors(
            @NotBlank String learnerWebOrigin,
            @NotBlank String adminWebOrigin,
            @NotBlank String mobileH5Origin,
            @NotBlank String officialSiteOrigin,
            @NotBlank String allowedMethods,
            @NotBlank String credentialedAllowedHeaders,
            @NotBlank String publicAllowedHeaders,
            @NotBlank String exposedHeaders,
            @NotBlank String refreshCookieName,
            @NotBlank String nativeAuthTransport,
            @NotNull @DurationUnit(ChronoUnit.SECONDS) Duration maxAge
    ) {
        public enum OriginProfile {
            LEARNER_WEB,
            ADMIN_WEB,
            MOBILE_H5,
            OFFICIAL_SITE,
            UNKNOWN
        }

        public OriginProfile profileFor(String origin) {
            String canonical = canonicalLoopbackOrigin(origin);
            if (learnerWebOrigin.equals(canonical)) return OriginProfile.LEARNER_WEB;
            if (adminWebOrigin.equals(canonical)) return OriginProfile.ADMIN_WEB;
            if (mobileH5Origin.equals(canonical)) return OriginProfile.MOBILE_H5;
            if (officialSiteOrigin.equals(canonical)) return OriginProfile.OFFICIAL_SITE;
            return OriginProfile.UNKNOWN;
        }

        private static String canonicalLoopbackOrigin(String origin) {
            if (origin == null) return null;
            try {
                java.net.URI uri = java.net.URI.create(origin.trim());
                String host = uri.getHost();
                if (host != null && (host.equalsIgnoreCase("localhost") || host.equals("127.0.0.1"))) {
                    int port = uri.getPort();
                    String scheme = uri.getScheme() == null ? "http" : uri.getScheme().toLowerCase(java.util.Locale.ROOT);
                    return scheme + "://127.0.0.1" + (port == -1 ? "" : ":" + port);
                }
            } catch (IllegalArgumentException ignored) {
            }
            return origin;
        }

        public boolean isCredentialedProfile(OriginProfile profile) {
            return profile == OriginProfile.LEARNER_WEB
                    || profile == OriginProfile.ADMIN_WEB
                    || profile == OriginProfile.MOBILE_H5;
        }

        public List<String> credentialedOrigins() {
            return List.of(learnerWebOrigin, adminWebOrigin, mobileH5Origin);
        }

        public List<String> allOrigins() {
            return List.of(learnerWebOrigin, adminWebOrigin, mobileH5Origin, officialSiteOrigin);
        }

        @AssertTrue(message = "Gateway browser origins must be exact, unique http(s) origins without a path")
        public boolean isOriginPolicySafe() {
            List<String> origins = allOrigins();
            return origins.stream().allMatch(Cors::isExactOrigin)
                    && origins.stream().distinct().count() == origins.size();
        }

        private static boolean isExactOrigin(String candidate) {
            try {
                URI uri = URI.create(candidate);
                return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                        && uri.getHost() != null
                        && uri.getUserInfo() == null
                        && (uri.getRawPath() == null || uri.getRawPath().isBlank())
                        && uri.getRawQuery() == null
                        && uri.getRawFragment() == null;
            } catch (IllegalArgumentException ignored) {
                return false;
            }
        }
    }

    public record RateLimit(
            @NotNull Boolean enabled,
            @NotBlank String backend,
            @Min(1) int maxKeys,
            @NotNull Boolean failOpen,
            @NotNull @DurationUnit(ChronoUnit.MILLIS) Duration backendTimeout,
            @NotEmpty Map<String, @Valid RateLimitPolicy> policies
    ) {
        public RateLimit {
            policies = policies == null ? Map.of() : Map.copyOf(policies);
        }

        public RateLimitPolicy policyFor(GatewayRoutePolicy.AuthClass authClass) {
            String required = authClass.rateLimitPolicyKey();
            for (Map.Entry<String, RateLimitPolicy> entry : policies.entrySet()) {
                if (normalizePolicyKey(entry.getKey()).equals(required)) {
                    return entry.getValue();
                }
            }
            throw new IllegalStateException("missing rate-limit policy for " + authClass);
        }

        @AssertTrue(message = "gateway.rate-limit.backend must be memory or redis")
        public boolean isBackendSupported() {
            return backend != null && Set.of("memory", "redis").contains(backend.trim().toLowerCase(Locale.ROOT));
        }

        @AssertTrue(message = "gateway.rate-limit must define a policy for every Gateway auth class")
        public boolean arePoliciesComplete() {
            return java.util.Arrays.stream(GatewayRoutePolicy.AuthClass.values())
                    .map(GatewayRoutePolicy.AuthClass::rateLimitPolicyKey)
                    .allMatch(required -> policies.keySet().stream()
                            .map(RateLimit::normalizePolicyKey)
                            .anyMatch(required::equals));
        }

        @AssertTrue(message = "gateway.rate-limit.fail-open must remain false for the security boundary")
        public boolean isFailClosed() {
            return !Boolean.TRUE.equals(failOpen);
        }

        @AssertTrue(message = "gateway.rate-limit.backend-timeout must be strictly positive")
        public boolean isBackendTimeoutStrictlyPositive() {
            return backendTimeout != null && !backendTimeout.isZero() && !backendTimeout.isNegative();
        }

        private static String normalizePolicyKey(String value) {
            return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replace('_', '-');
        }
    }

    public record RateLimitPolicy(
            @Min(1) int requestsPerWindow,
            @NotNull @DurationUnit(ChronoUnit.SECONDS) Duration window
    ) {
        @AssertTrue(message = "gateway.rate-limit policy window must be strictly positive")
        public boolean isWindowStrictlyPositive() {
            return window != null && !window.isZero() && !window.isNegative();
        }
    }

    public record RequestContext(
            @Min(16) int maxIdLength
    ) {
    }

    public record Security(
        @NotNull Boolean jwtPrevalidationEnabled,
        @NotNull Boolean resourceServerEnabled,
        @NotNull Boolean auditEnabled,
        String issuerUri,
        String audience,
        String jwkSetUri
    ) {
        @AssertTrue(message = "JWT issuer is required when verification is enabled")
        public boolean isIssuerConfiguredWhenEnabled() {
            return (!Boolean.TRUE.equals(jwtPrevalidationEnabled) && !Boolean.TRUE.equals(resourceServerEnabled))
                    || issuerUri != null && !issuerUri.isBlank();
        }

        @AssertTrue(message = "JWT JWKS endpoint is required when verification is enabled")
        public boolean isJwksConfiguredWhenEnabled() {
            return (!Boolean.TRUE.equals(jwtPrevalidationEnabled) && !Boolean.TRUE.equals(resourceServerEnabled))
                    || jwkSetUri != null && !jwkSetUri.isBlank();
        }

        @AssertTrue(message = "JWT audience is required when the resource server is enabled")
        public boolean isAudienceConfiguredWhenEnabled() {
            return !Boolean.TRUE.equals(resourceServerEnabled)
                    || audience != null && !audience.isBlank();
        }

        @AssertTrue(message = "JWT prevalidation requires the Resource Server to be enabled")
        public boolean isPrevalidationBackedByResourceServer() {
            return !Boolean.TRUE.equals(jwtPrevalidationEnabled)
                    || Boolean.TRUE.equals(resourceServerEnabled);
        }
    }
}
