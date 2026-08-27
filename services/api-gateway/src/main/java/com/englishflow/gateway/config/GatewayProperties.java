package com.englishflow.gateway.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
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
            @NotEmpty List<@NotBlank String> allowedOrigins,
            @NotBlank String allowedMethods,
            @NotBlank String allowedHeaders,
            @NotBlank String exposedHeaders,
            @NotNull Boolean allowCredentials,
            @NotNull @DurationUnit(ChronoUnit.SECONDS) Duration maxAge
    ) {
        @AssertTrue(message = "credentialed CORS cannot use wildcard origins")
        public boolean isOriginPolicySafe() {
            return !Boolean.TRUE.equals(allowCredentials) || allowedOrigins.stream().noneMatch("*"::equals);
        }
    }

    public record RateLimit(
            @NotNull Boolean enabled,
            @Min(1) int requestsPerWindow,
            @NotNull @DurationUnit(ChronoUnit.SECONDS) Duration window,
            @NotBlank String keyStrategy,
            @NotBlank String backend,
            @Min(1) int maxKeys,
            @NotNull Boolean failOpen
    ) {
        @AssertTrue(message = "gateway.rate-limit.backend must be memory or redis")
        public boolean isBackendSupported() {
            return backend != null && Set.of("memory", "redis").contains(backend.trim().toLowerCase(Locale.ROOT));
        }

        @AssertTrue(message = "gateway.rate-limit.key-strategy must be remote-address or principal")
        public boolean isKeyStrategySupported() {
            return keyStrategy != null
                    && Set.of("remote-address", "principal")
                    .contains(keyStrategy.trim().toLowerCase(Locale.ROOT));
        }

        @AssertTrue(message = "gateway.rate-limit.fail-open must remain false for the security boundary")
        public boolean isFailClosed() {
            return !Boolean.TRUE.equals(failOpen);
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
        String audience
    ) {
        @AssertTrue(message = "OIDC issuer-uri is required when JWT prevalidation is enabled")
        public boolean isIssuerConfiguredWhenEnabled() {
            return (!Boolean.TRUE.equals(jwtPrevalidationEnabled) && !Boolean.TRUE.equals(resourceServerEnabled))
                    || issuerUri != null && !issuerUri.isBlank();
        }

        @AssertTrue(message = "OIDC audience is required when the resource server is enabled")
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
