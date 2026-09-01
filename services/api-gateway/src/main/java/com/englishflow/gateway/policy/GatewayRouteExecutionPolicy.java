package com.englishflow.gateway.policy;

import com.englishflow.gateway.config.GatewayProperties;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Resolves the frozen canonical Gateway policy into the routes that the
 * current Gateway configuration is allowed to execute.
 *
 * <p>This is intentionally a projection, not a second route list: each
 * decision starts from a {@link GatewayRoutePolicy.Rule}. B14 TARGET owners,
 * the configured B12 notification owner and the configured B13 analytics and
 * admin-ops owners receive their exact configured upstream URI. A disabled
 * feature or a non-TARGET B14 owner becomes unavailable rather than falling
 * through to a broad legacy/core-api route. Workflow has no configured target
 * in this module and therefore remains fail-closed. The local health rule is
 * executed by the Gateway's own handler, never proxied to core-api.</p>
 */
@Component
public final class GatewayRouteExecutionPolicy {

    public static final String METADATA_RULE_ID = "englishflow.gateway.canonical.rule-id";
    public static final String METADATA_OWNER = "englishflow.gateway.canonical.owner";
    public static final String METADATA_VISIBILITY = "englishflow.gateway.canonical.visibility";
    public static final String METADATA_AUTH_CLASS = "englishflow.gateway.canonical.auth-class";
    public static final String METADATA_INTERNAL_TARGET_CLASS = "englishflow.gateway.canonical.internal-target-class";
    public static final String METADATA_MATCH_TYPE = "englishflow.gateway.canonical.match-type";
    public static final String METADATA_PATH = "englishflow.gateway.canonical.path";
    public static final String METADATA_METHODS = "englishflow.gateway.canonical.methods";
    public static final String METADATA_EXECUTION_KIND = "englishflow.gateway.canonical.execution-kind";

    private static final URI LOCAL_HEALTH_FORWARD_URI = URI.create("forward:///internal/gateway/health");

    private final GatewayProperties properties;
    private final GatewayRoutePolicy routePolicy;

    public GatewayRouteExecutionPolicy(GatewayProperties properties, GatewayRoutePolicy routePolicy) {
        this.properties = properties;
        this.routePolicy = routePolicy;
    }

    public Resolution resolve(GatewayRoutePolicy.Rule rule) {
        if (rule == null) {
            return Resolution.unavailable(null, "unknown_canonical_rule");
        }
        if ("api-gateway".equals(rule.upstreamOwner())) {
            return "GATEWAY_LOCAL".equals(rule.internalTargetClass())
                    ? Resolution.local(rule, LOCAL_HEALTH_FORWARD_URI)
                    : Resolution.unavailable(rule, "gateway_local_target_class_invalid");
        }
        if (!"INTERNAL_V1".equals(rule.internalTargetClass())) {
            return Resolution.unavailable(rule, "canonical_target_class_unavailable");
        }

        URI target = switch (rule.upstreamOwner()) {
            case "iam-service" -> enabled(properties.identity().enabled()) ? properties.identity().iamUri() : null;
            case "learner-service" -> b14Target("learner");
            case "content-service" -> b14Target("content");
            case "learning-service" -> b14Target("learning");
            case "assessment-service" -> b14Target("assessment");
            case "media-service" -> b14Target("media");
            case "gamification-service" -> b14Target("gamification");
            case "social-service" -> b14Target("social");
            case "commerce-service" -> b14Target("commerce");
            case "notification-service" -> enabled(properties.b12().enabled())
                    ? properties.b12().notificationUri()
                    : null;
            case "analytics-service" -> enabled(properties.b13().enabled())
                    ? properties.b13().analyticsUri()
                    : null;
            case "admin-ops-service" -> enabled(properties.b13().enabled())
                    ? properties.b13().adminOpsUri()
                    : null;
            // workflow-service does not have a Gateway target configuration in
            // this module. It must not be silently routed to notification or
            // core-api merely because an older broad route happens to exist.
            default -> null;
        };
        return target == null
                ? Resolution.unavailable(rule, "canonical_owner_target_unavailable")
                : Resolution.upstream(rule, target);
    }

    public boolean isAvailable(GatewayRoutePolicy.Rule rule) {
        return resolve(rule).isAvailable();
    }

    public boolean isRoutable(GatewayRoutePolicy.Rule rule) {
        return resolve(rule).isUpstream();
    }

    public boolean isLocal(GatewayRoutePolicy.Rule rule) {
        return resolve(rule).isLocal();
    }

    /**
     * The sole RouteLocator source, including the canonical local forward
     * route. Route order is based on the same canonical priority used by
     * {@link GatewayRoutePolicy#resolve}.
     */
    public List<RouteBinding> routeBindings() {
        return routePolicy.rules().stream()
                .map(this::resolve)
                .filter(Resolution::isAvailable)
                .sorted(Comparator.comparingInt((Resolution resolution) -> resolution.rule().priority()).reversed()
                        .thenComparing(resolution -> resolution.rule().ruleId()))
                .map(resolution -> new RouteBinding(
                        "canonical-" + resolution.rule().ruleId(),
                        resolution.rule(),
                        resolution.kind(),
                        resolution.targetUri()
                ))
                .toList();
    }

    public List<RouteBinding> routableBindings() {
        return routeBindings().stream().filter(binding -> binding.kind() == ExecutionKind.UPSTREAM).toList();
    }

    public List<GatewayRoutePolicy.Rule> localRules() {
        return routePolicy.rules().stream()
                .filter(this::isLocal)
                .sorted(Comparator.comparingInt(GatewayRoutePolicy.Rule::priority).reversed()
                        .thenComparing(GatewayRoutePolicy.Rule::ruleId))
                .toList();
    }

    private URI b14Target(String domain) {
        GatewayProperties.B14Services b14 = properties.b14();
        return enabled(b14.enabled()) && b14.mode(domain) == GatewayProperties.B14Services.RouteMode.TARGET
                ? b14.serviceUri(domain)
                : null;
    }

    private static boolean enabled(Boolean value) {
        return Boolean.TRUE.equals(value);
    }

    public enum ExecutionKind {
        LOCAL,
        UPSTREAM,
        UNAVAILABLE
    }

    public record Resolution(
            GatewayRoutePolicy.Rule rule,
            ExecutionKind kind,
            URI targetUri,
            String unavailableReason
    ) {
        static Resolution local(GatewayRoutePolicy.Rule rule, URI targetUri) {
            return new Resolution(rule, ExecutionKind.LOCAL, targetUri, null);
        }

        static Resolution upstream(GatewayRoutePolicy.Rule rule, URI upstreamUri) {
            return new Resolution(rule, ExecutionKind.UPSTREAM, upstreamUri, null);
        }

        static Resolution unavailable(GatewayRoutePolicy.Rule rule, String reason) {
            return new Resolution(rule, ExecutionKind.UNAVAILABLE, null, reason);
        }

        public boolean isAvailable() {
            return kind != ExecutionKind.UNAVAILABLE;
        }

        public boolean isLocal() {
            return kind == ExecutionKind.LOCAL;
        }

        public boolean isUpstream() {
            return kind == ExecutionKind.UPSTREAM;
        }
    }

    public record RouteBinding(
            String routeId,
            GatewayRoutePolicy.Rule rule,
            ExecutionKind kind,
            URI targetUri
    ) {

        public Map<String, Object> metadata() {
            return Map.ofEntries(
                    Map.entry(METADATA_RULE_ID, rule.ruleId()),
                    Map.entry(METADATA_OWNER, rule.upstreamOwner()),
                    Map.entry(METADATA_VISIBILITY, rule.visibility()),
                    Map.entry(METADATA_AUTH_CLASS, rule.authClass().name()),
                    Map.entry(METADATA_INTERNAL_TARGET_CLASS, rule.internalTargetClass()),
                    Map.entry(METADATA_MATCH_TYPE, rule.matchType().name()),
                    Map.entry(METADATA_PATH, rule.path()),
                    Map.entry(METADATA_METHODS, rule.methods().stream().map(method -> method.name()).toList()),
                    Map.entry(METADATA_EXECUTION_KIND, kind.name())
            );
        }
    }
}
