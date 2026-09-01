package com.englishflow.gateway.policy;

import org.springframework.http.HttpMethod;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Runtime projection of the frozen P1R Gateway boundary.
 *
 * <p>The source policy remains
 * {@code packages/contracts/fragments/p1r-gateway-boundary.openapi.json}.
 * {@code GatewayRoutePolicyContractParityTest} keeps this executable projection
 * exact with that contract before it can be relied on by the security, CORS,
 * CSRF and rate-limit boundaries.</p>
 */
@Component
public final class GatewayRoutePolicy {

    public enum MatchType {
        EXACT,
        PREFIX
    }

    public enum AuthClass {
        PUBLIC_READ,
        AUTH_REGISTER,
        AUTH_LOGIN,
        AUTH_REFRESH,
        PASSWORD_RESET,
        AUTHENTICATED_READ,
        AUTHENTICATED_WRITE,
        HIGH_RISK_ADMIN,
        PROVIDER_CALLBACK;

        public boolean permitsAnonymousAtGateway() {
            return switch (this) {
                case PUBLIC_READ, AUTH_REGISTER, AUTH_LOGIN, AUTH_REFRESH, PASSWORD_RESET, PROVIDER_CALLBACK -> true;
                case AUTHENTICATED_READ, AUTHENTICATED_WRITE, HIGH_RISK_ADMIN -> false;
            };
        }

        public String rateLimitPolicyKey() {
            return name().toLowerCase(Locale.ROOT).replace('_', '-');
        }
    }

    public enum ResolutionStatus {
        MATCHED,
        NO_MATCH,
        AMBIGUOUS
    }

    public record Rule(
            String ruleId,
            int priority,
            MatchType matchType,
            String path,
            List<HttpMethod> methods,
            String upstreamOwner,
            String internalTargetClass,
            String visibility,
            AuthClass authClass,
            String compatibilityMode
    ) {
        public Rule {
            methods = List.copyOf(methods);
        }

        boolean matches(HttpMethod requestMethod, String requestPath) {
            HttpMethod normalizedMethod = normalizeMethod(requestMethod);
            if (normalizedMethod == null || !methods.contains(normalizedMethod)) {
                return false;
            }
            return switch (matchType) {
                case EXACT -> path.equals(requestPath);
                case PREFIX -> path.equals(requestPath) || requestPath.startsWith(path + "/");
            };
        }

        /**
         * Provider callbacks are named by frozen canonical rule IDs such as
         * {@code wechat-callback}; no request-provided header or body field is
         * allowed to select the provider admission bucket.
         */
        public String providerId() {
            if (authClass != AuthClass.PROVIDER_CALLBACK) {
                throw new IllegalStateException("Only provider callback rules have a provider identity");
            }
            int separator = ruleId.indexOf('-');
            if (separator <= 0) {
                throw new IllegalStateException("Invalid canonical provider callback rule: " + ruleId);
            }
            return ruleId.substring(0, separator);
        }

        private static HttpMethod normalizeMethod(HttpMethod method) {
            // Spring WebFlux handles HEAD through GET handlers. The D2 policy records
            // canonical OpenAPI GET operations, so HEAD inherits the corresponding GET rule.
            return HttpMethod.HEAD.equals(method) ? HttpMethod.GET : method;
        }
    }

    public record Resolution(ResolutionStatus status, Rule rule) {
        public boolean matched() {
            return status == ResolutionStatus.MATCHED && rule != null;
        }
    }

    private static final List<Rule> RULES = List.of(
            rule("gateway-health", 1000, MatchType.EXACT, "/api/v1/health", "api-gateway", "GATEWAY_LOCAL", "ANONYMOUS_PUBLIC", AuthClass.PUBLIC_READ, "NONE", HttpMethod.GET),
            rule("iam-jwks-public", 1000, MatchType.EXACT, "/api/v1/auth/jwks", "iam-service", "INTERNAL_V1", "ANONYMOUS_PUBLIC", AuthClass.PUBLIC_READ, "NONE", HttpMethod.GET),
            rule("iam-register", 1000, MatchType.EXACT, "/api/v1/auth/register", "iam-service", "INTERNAL_V1", "ANONYMOUS_PUBLIC", AuthClass.AUTH_REGISTER, "NONE", HttpMethod.POST),
            rule("iam-login", 1000, MatchType.EXACT, "/api/v1/auth/login", "iam-service", "INTERNAL_V1", "ANONYMOUS_PUBLIC", AuthClass.AUTH_LOGIN, "NONE", HttpMethod.POST),
            rule("iam-refresh", 1000, MatchType.EXACT, "/api/v1/auth/token/refresh", "iam-service", "INTERNAL_V1", "ANONYMOUS_PUBLIC", AuthClass.AUTH_REFRESH, "NONE", HttpMethod.POST),
            rule("iam-password-reset", 900, MatchType.PREFIX, "/api/v1/auth/password-reset", "iam-service", "INTERNAL_V1", "ANONYMOUS_PUBLIC", AuthClass.PASSWORD_RESET, "NONE", HttpMethod.POST),
            rule("public-content", 900, MatchType.PREFIX, "/api/v1/public/content", "content-service", "INTERNAL_V1", "ANONYMOUS_PUBLIC", AuthClass.PUBLIC_READ, "NONE", HttpMethod.GET),
            rule("public-commerce", 900, MatchType.PREFIX, "/api/v1/public/commerce", "commerce-service", "INTERNAL_V1", "ANONYMOUS_PUBLIC", AuthClass.PUBLIC_READ, "NONE", HttpMethod.GET),
            rule("public-site", 900, MatchType.PREFIX, "/api/v1/public/site", "admin-ops-service", "INTERNAL_V1", "ANONYMOUS_PUBLIC", AuthClass.PUBLIC_READ, "NONE", HttpMethod.GET),
            rule("wechat-callback", 1000, MatchType.EXACT, "/api/v1/commerce/wechat/callback", "commerce-service", "INTERNAL_V1", "SIGNED_EXTERNAL_CALLBACK", AuthClass.PROVIDER_CALLBACK, "NONE", HttpMethod.POST),
            rule("alipay-callback", 1000, MatchType.EXACT, "/api/v1/commerce/alipay/notify", "commerce-service", "INTERNAL_V1", "SIGNED_EXTERNAL_CALLBACK", AuthClass.PROVIDER_CALLBACK, "NONE", HttpMethod.POST),
            rule("apple-notification", 1000, MatchType.EXACT, "/api/v1/commerce/apple/notifications", "commerce-service", "INTERNAL_V1", "SIGNED_EXTERNAL_CALLBACK", AuthClass.PROVIDER_CALLBACK, "NONE", HttpMethod.POST),
            rule("admin-content", 800, MatchType.PREFIX, "/api/v1/admin/content-commands", "content-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.HIGH_RISK_ADMIN, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("admin-content-publish-tasks", 800, MatchType.PREFIX, "/api/v1/admin/content-publish-tasks", "content-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.HIGH_RISK_ADMIN, "NONE", HttpMethod.GET),
            rule("admin-recovery", 800, MatchType.PREFIX, "/api/v1/admin/recovery", "workflow-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.HIGH_RISK_ADMIN, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("admin-analytics", 800, MatchType.EXACT, "/api/v1/admin/ops/metrics", "analytics-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.HIGH_RISK_ADMIN, "NONE", HttpMethod.GET),
            rule("analytics-telemetry", 800, MatchType.EXACT, "/api/v1/analytics/telemetry", "analytics-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.POST),
            rule("learning-content-snapshot", 800, MatchType.PREFIX, "/api/v1/learning/content-snapshots", "content-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_READ, "NONE", HttpMethod.GET),
            rule("speaking-recordings", 800, MatchType.PREFIX, "/api/v1/speaking/recordings", "media-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.DELETE),
            rule("speaking-shadowing-completion", 900, MatchType.EXACT, "/api/v1/speaking/shadowing/completions", "assessment-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.POST),
            rule("auth-domain", 100, MatchType.PREFIX, "/api/v1/auth", "iam-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("iam-domain", 100, MatchType.PREFIX, "/api/v1/iam", "iam-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.HIGH_RISK_ADMIN, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT),
            rule("iam-account-deletions", 800, MatchType.PREFIX, "/api/v1/iam/account-deletions", "iam-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("learner-domain", 100, MatchType.PREFIX, "/api/v1/learner", "learner-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.PATCH, HttpMethod.PUT),
            rule("onboarding-domain", 100, MatchType.PREFIX, "/api/v1/onboarding", "learner-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.PATCH, HttpMethod.POST),
            rule("privacy-domain", 100, MatchType.PREFIX, "/api/v1/privacy", "learner-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.HIGH_RISK_ADMIN, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("privacy-exports", 800, MatchType.PREFIX, "/api/v1/privacy/exports", "learner-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("content-domain", 100, MatchType.PREFIX, "/api/v1/content", "content-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("vocabulary-domain", 100, MatchType.PREFIX, "/api/v1/vocab", "learning-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE),
            rule("learning-domain", 100, MatchType.PREFIX, "/api/v1/learning", "learning-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT),
            rule("mastery-domain", 100, MatchType.PREFIX, "/api/v1/mastery", "learning-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("offline-domain", 100, MatchType.PREFIX, "/api/v1/offline", "learning-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("sync-domain", 100, MatchType.PREFIX, "/api/v1/sync", "learning-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH),
            rule("assessment-domain", 100, MatchType.PREFIX, "/api/v1/assessment", "assessment-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT),
            rule("exam-domain", 100, MatchType.PREFIX, "/api/v1/exam", "assessment-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT),
            rule("grammar-domain", 100, MatchType.PREFIX, "/api/v1/grammar", "assessment-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("listening-domain", 100, MatchType.PREFIX, "/api/v1/listening", "assessment-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT),
            rule("reading-domain", 100, MatchType.PREFIX, "/api/v1/reading", "assessment-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT),
            rule("writing-domain", 100, MatchType.PREFIX, "/api/v1/writing", "assessment-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("phonetics-domain", 100, MatchType.PREFIX, "/api/v1/phonetics", "assessment-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_READ, "NONE", HttpMethod.GET),
            rule("speaking-domain", 100, MatchType.PREFIX, "/api/v1/speaking", "assessment-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.DELETE),
            rule("media-domain", 100, MatchType.PREFIX, "/api/v1/media", "media-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("multimodal-domain", 100, MatchType.PREFIX, "/api/v1/multimodal", "media-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.POST),
            rule("gamification-domain", 100, MatchType.PREFIX, "/api/v1/gamification", "gamification-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT),
            rule("games-domain", 100, MatchType.PREFIX, "/api/v1/games", "gamification-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("avatar-domain", 100, MatchType.PREFIX, "/api/v1/avatar", "gamification-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT),
            rule("social-domain", 100, MatchType.PREFIX, "/api/v1/social", "social-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.PATCH),
            rule("commerce-domain", 100, MatchType.PREFIX, "/api/v1/commerce", "commerce-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST, HttpMethod.DELETE),
            rule("notifications-domain", 100, MatchType.PREFIX, "/api/v1/notifications", "notification-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.PUT),
            rule("messages-domain", 100, MatchType.PREFIX, "/api/v1/messages", "notification-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("settings-domain", 100, MatchType.PREFIX, "/api/v1/settings", "notification-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.PUT),
            rule("support-domain", 100, MatchType.PREFIX, "/api/v1/support", "admin-ops-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.AUTHENTICATED_WRITE, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("admin-domain", 100, MatchType.PREFIX, "/api/v1/admin", "admin-ops-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.HIGH_RISK_ADMIN, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("data-reliability-domain", 100, MatchType.PREFIX, "/api/v1/data-reliability", "workflow-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.HIGH_RISK_ADMIN, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("release-domain", 100, MatchType.PREFIX, "/api/v1/release", "workflow-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.HIGH_RISK_ADMIN, "NONE", HttpMethod.GET, HttpMethod.POST),
            rule("quality-domain", 100, MatchType.PREFIX, "/api/v1/quality", "admin-ops-service", "INTERNAL_V1", "AUTHENTICATED", AuthClass.HIGH_RISK_ADMIN, "NONE", HttpMethod.GET, HttpMethod.POST)
    );

    private final List<Rule> rules;

    public GatewayRoutePolicy() {
        this(RULES);
    }

    // Package-visible so policy tests can prove that equal canonical priorities
    // are denied without allowing production code to supply a second source.
    GatewayRoutePolicy(List<Rule> rules) {
        this.rules = List.copyOf(rules);
    }

    public List<Rule> rules() {
        return rules;
    }

    public Resolution resolve(ServerHttpRequest request) {
        return resolve(request.getMethod(), request.getPath().pathWithinApplication().value());
    }

    public Resolution resolvePreflight(ServerHttpRequest request) {
        if (!HttpMethod.OPTIONS.equals(request.getMethod())) {
            return new Resolution(ResolutionStatus.NO_MATCH, null);
        }
        String requestedMethod = request.getHeaders().getFirst("Access-Control-Request-Method");
        if (requestedMethod == null || requestedMethod.isBlank()) {
            return new Resolution(ResolutionStatus.NO_MATCH, null);
        }
        try {
            return resolve(HttpMethod.valueOf(requestedMethod.trim().toUpperCase(Locale.ROOT)),
                    request.getPath().pathWithinApplication().value());
        } catch (IllegalArgumentException ignored) {
            return new Resolution(ResolutionStatus.NO_MATCH, null);
        }
    }

    public Resolution resolve(HttpMethod method, String path) {
        List<Rule> matches = rules.stream()
                .filter(rule -> rule.matches(method, path))
                .toList();
        if (matches.isEmpty()) {
            return new Resolution(ResolutionStatus.NO_MATCH, null);
        }
        int highestPriority = matches.stream().map(Rule::priority).max(Comparator.naturalOrder()).orElseThrow();
        List<Rule> winners = matches.stream().filter(rule -> rule.priority() == highestPriority).toList();
        if (winners.size() != 1) {
            return new Resolution(ResolutionStatus.AMBIGUOUS, null);
        }
        return new Resolution(ResolutionStatus.MATCHED, winners.getFirst());
    }

    public boolean permitsAnonymous(ServerHttpRequest request) {
        Resolution resolution = resolve(request);
        return resolution.matched() && resolution.rule().authClass().permitsAnonymousAtGateway();
    }

    public boolean isKnownPreflight(ServerHttpRequest request) {
        return resolvePreflight(request).matched();
    }

    private static Rule rule(
            String ruleId,
            int priority,
            MatchType matchType,
            String path,
            String upstreamOwner,
            String internalTargetClass,
            String visibility,
            AuthClass authClass,
            String compatibilityMode,
            HttpMethod... methods
    ) {
        return new Rule(
                ruleId,
                priority,
                matchType,
                path,
                List.of(methods),
                upstreamOwner,
                internalTargetClass,
                visibility,
                authClass,
                compatibilityMode
        );
    }
}
