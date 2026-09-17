package com.englishflow.gateway.policy;

import com.englishflow.gateway.config.GatewayProperties;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The only executable projection of the frozen Gateway admission policy.
 *
 * <p>The policy provides public admission and owner identity. This projection
 * supplies finite, source-verified public-to-target mappings. It deliberately
 * does not infer a target path from a public prefix: every available mapping
 * is an exact canonical operation path or one finite path template. A
 * canonical rule lacking an owner-consistent current Controller mapping is
 * denied before route lookup.</p>
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
    public static final String METADATA_PATH_STRATEGY = "englishflow.gateway.execution.path-strategy";
    public static final String METADATA_PUBLIC_TEMPLATE = "englishflow.gateway.execution.public-template";
    public static final String METADATA_PUBLIC_PATTERNS = "englishflow.gateway.execution.public-patterns";
    public static final String METADATA_TARGET_PATH = "englishflow.gateway.execution.target-path";
    public static final String METADATA_TARGET_URI_CONFIG = "englishflow.gateway.execution.target-uri-config";
    public static final String METADATA_REWRITE_REGEX = "englishflow.gateway.execution.rewrite-regex";
    public static final String METADATA_CONTROLLER_EVIDENCE = "englishflow.gateway.execution.controller-evidence";

    public static final String DEFAULT_UNAVAILABLE_REASON = "no_exact_canonical_execution_target";
    private static final URI LOCAL_HEALTH_FORWARD_URI = URI.create("forward:///internal/gateway/health");
    private static final Pattern TEMPLATE_PARAMETER = Pattern.compile("\\{(?<name>[A-Za-z][A-Za-z0-9]*)}");

    private static final ControllerEvidence GATEWAY_HEALTH = evidence("api-gateway",
            "services/api-gateway/src/main/java/com/englishflow/gateway/web/GatewayHealthController.java", "/internal/gateway/health");
    private static final ControllerEvidence IAM_PUBLIC = evidence("iam-service",
            "services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java", "/api/v1");
    private static final ControllerEvidence IAM_POLICY_CONTROL = evidence("iam-service",
            "services/iam-service/src/main/java/com/englishflow/iam/web/IamPolicyControlController.java", "/api/v1/iam/policy-versions");
    private static final ControllerEvidence LEARNER_PUBLIC = evidence("learner-service",
            "services/learner-service/src/main/java/com/englishflow/learner/web/LearnerHttpController.java", "/api/v1/learner");
    private static final ControllerEvidence LEARNER_INTERNAL = evidence("learner-service",
            "services/learner-service/src/main/java/com/englishflow/learner/web/B25LearnerJdbcController.java", "/internal/v1/learner");
    private static final ControllerEvidence CONTENT_PUBLIC_CATALOG = evidence("content-service",
            "services/content-service/src/main/java/com/englishflow/content/web/ContentHttpController.java", "/api/v1/public/content/catalog");
    private static final ControllerEvidence CONTENT_PUBLIC_DETAIL = evidence("content-service",
            "services/content-service/src/main/java/com/englishflow/content/web/ContentHttpController.java", "/api/v1/public/content/{contentCode}");
    private static final ControllerEvidence CONTENT_PUBLIC_SITE_PROJECTION = evidence("content-service",
            "services/content-service/src/main/java/com/englishflow/content/web/ContentHttpController.java", "/api/v1/public/site/projection");
    private static final ControllerEvidence CONTENT_LEARNER_CATALOG = evidence("content-service",
            "services/content-service/src/main/java/com/englishflow/content/web/ContentHttpController.java", "/api/v1/content/learner/catalog");
    private static final ControllerEvidence CONTENT_LEARNER_DETAIL = evidence("content-service",
            "services/content-service/src/main/java/com/englishflow/content/web/ContentHttpController.java", "/api/v1/content/learner/{contentCode}");
    private static final ControllerEvidence CONTENT_LEARNER_SUBSTITUTE = evidence("content-service",
            "services/content-service/src/main/java/com/englishflow/content/web/ContentHttpController.java", "/api/v1/content/learner/substitute");
    private static final ControllerEvidence CONTENT_LEARNER = evidence("content-service",
            "services/content-service/src/main/java/com/englishflow/content/web/B25ContentJdbcController.java", "/internal/v1/content/learner");
    private static final ControllerEvidence CONTENT_ADMIN = evidence("content-service",
            "services/content-service/src/main/java/com/englishflow/content/web/B9ContentAdminController.java", "/internal/v1/content/admin-commands");
    private static final ControllerEvidence LEARNING_B25 = evidence("learning-service",
            "services/learning-service/src/main/java/com/englishflow/learning/web/B25LearningJdbcController.java", "/internal/v1/learning");
    private static final ControllerEvidence LEARNING_B3 = evidence("learning-service",
            "services/learning-service/src/main/java/com/englishflow/learning/web/B3LearningJdbcController.java", "/internal/v1/learning/experiences");
    /**
     * P1-LIVE-002: M4-008 added the v2 first-day projection adapter serving its canonical
     * paths directly, but no gateway execution admitted them, so both failed closed with
     * "route not available" for every user.
     */
    private static final ControllerEvidence LEARNING_V2 = evidence("learning-service",
            "services/learning-service/src/main/java/com/englishflow/learning/web/V2LearningController.java", "/api/v1/learning");
    private static final ControllerEvidence ASSESSMENT_B10 = evidence("assessment-service",
            "services/assessment-service/src/main/java/com/englishflow/assessment/web/B10AssessmentJdbcController.java", "/internal/v1/assessment");
    private static final ControllerEvidence ASSESSMENT_B25 = evidence("assessment-service",
            "services/assessment-service/src/main/java/com/englishflow/assessment/web/B25AssessmentJdbcController.java", "/internal/v1/assessment");
    private static final ControllerEvidence MEDIA = evidence("media-service",
            "services/media-service/src/main/java/com/englishflow/media/web/MediaController.java", "/internal/v1/media");
    private static final ControllerEvidence GAMIFICATION_LOCAL = evidence("gamification-service",
            "services/gamification-service/src/main/java/com/englishflow/gamification/adapter/http/GamificationLocalFeatureController.java", "/internal/v1/gamification");
    private static final ControllerEvidence GAMIFICATION_CORE = evidence("gamification-service",
            "services/gamification-service/src/main/java/com/englishflow/gamification/adapter/http/GamificationController.java", "/internal/v1/gamification");
    private static final ControllerEvidence SOCIAL_PUBLIC = evidence("social-service",
            "services/social-service/src/main/java/com/englishflow/social/web/SocialLocalRealController.java", "/api/v1/social");
    private static final ControllerEvidence COMMERCE = evidence("commerce-service",
            "services/commerce-service/src/main/java/com/englishflow/commerce/adapter/http/CommerceController.java", "/internal/v1/commerce");
    private static final ControllerEvidence NOTIFICATION = evidence("notification-service",
            "services/notification-service/src/main/java/com/englishflow/notification/adapter/http/NotificationController.java", "/internal/v1/notifications");
    private static final ControllerEvidence NOTIFICATION_READ = evidence("notification-service",
            "services/notification-service/src/main/java/com/englishflow/notification/adapter/http/NotificationReadJdbcController.java", "/internal/v1/notifications");
    private static final ControllerEvidence ANALYTICS = evidence("analytics-service",
            "services/analytics-service/src/main/java/com/englishflow/analytics/web/AnalyticsController.java", "/internal/v1/analytics");
    private static final ControllerEvidence ADMIN_OPS = evidence("admin-ops-service",
            "services/admin-ops-service/src/main/java/com/englishflow/adminops/web/AdminOpsController.java", "/internal/v1/admin-ops");
    private static final ControllerEvidence SUPPORT_ADMIN = evidence("admin-ops-service",
            "services/admin-ops-service/src/main/java/com/englishflow/adminops/web/SupportController.java", "/internal/v1/admin-ops");
    private static final ControllerEvidence SUPPORT_SCOPED = evidence("admin-ops-service",
            "services/admin-ops-service/src/main/java/com/englishflow/adminops/web/SupportController.java", "/internal/v1/admin-ops/support");
    // P1R decision 1A: recovery console route owner.
    private static final ControllerEvidence WORKFLOW_RECOVERY = evidence("workflow-service",
            "services/workflow-service/src/main/java/com/englishflow/workflow/adapter/http/ManualRecoveryController.java", "/internal/v1/workflow/recoveries");
    private static final ControllerEvidence WORKFLOW_SAGA = evidence("workflow-service",
            "services/workflow-service/src/main/java/com/englishflow/workflow/adapter/http/SagaController.java", "/internal/v1/workflow/sagas");

    private static final Map<String, List<PathProjection>> EXECUTABLE_PROJECTIONS = executableProjections();
    private static final Map<String, String> FAIL_CLOSED_REASONS = Map.ofEntries(
            Map.entry("wechat-callback", "commerce_provider_callback_signature_boundary_not_implemented"),
            Map.entry("alipay-callback", "commerce_provider_callback_signature_boundary_not_implemented"),
            Map.entry("apple-notification", "commerce_provider_callback_signature_boundary_not_implemented"),
            Map.entry("admin-content-publish-tasks", "content_owner_controller_mapping_not_present"),
            Map.entry("learning-content-snapshot", "content_owner_controller_mapping_not_present"),
            Map.entry("speaking-recordings", "canonical_media_owner_conflicts_with_current_learning_controller"),
            Map.entry("speaking-shadowing-completion", "canonical_assessment_owner_conflicts_with_current_learning_controller"),
            Map.entry("iam-account-deletions", "iam_owner_controller_mapping_not_present"),
            Map.entry("privacy-exports", "learner_owner_plural_export_controller_mapping_not_present"),
            Map.entry("sync-domain", "canonical_learning_owner_conflicts_with_current_notification_controller"),
            Map.entry("exam-domain", "assessment_owner_controller_mapping_not_present"),
            Map.entry("grammar-domain", "canonical_assessment_owner_conflicts_with_current_learning_or_content_controller"),
            Map.entry("listening-domain", "canonical_assessment_owner_conflicts_with_current_learning_or_content_controller"),
            Map.entry("reading-domain", "canonical_assessment_owner_conflicts_with_current_learning_or_content_controller"),
            Map.entry("writing-domain", "canonical_assessment_owner_conflicts_with_current_learning_or_content_controller"),
            Map.entry("phonetics-domain", "canonical_assessment_owner_conflicts_with_current_content_controller"),
            Map.entry("speaking-domain", "canonical_assessment_owner_conflicts_with_current_learning_controller"),
            Map.entry("multimodal-domain", "media_owner_controller_mapping_not_present"),
            Map.entry("messages-domain", "canonical_notification_owner_method_mapping_not_present"),
            Map.entry("data-reliability-domain", "workflow_owner_has_no_configured_gateway_target"),
            Map.entry("release-domain", "workflow_owner_has_no_configured_gateway_target"),
            Map.entry("quality-domain", "admin_ops_owner_controller_mapping_not_present")
    );

    private final GatewayProperties properties;
    private final GatewayRoutePolicy routePolicy;

    public GatewayRouteExecutionPolicy(GatewayProperties properties, GatewayRoutePolicy routePolicy) {
        this.properties = properties;
        this.routePolicy = routePolicy;
        verifyExecutionDefinitions();
    }

    public Resolution resolve(GatewayRoutePolicy.Rule rule) {
        if (rule == null) {
            return Resolution.unavailable(null, "unknown_canonical_rule");
        }
        List<PathProjection> projections = EXECUTABLE_PROJECTIONS.get(rule.ruleId());
        if (projections == null) {
            return Resolution.unavailable(rule, FAIL_CLOSED_REASONS.get(rule.ruleId()));
        }
        if ("api-gateway".equals(rule.upstreamOwner())) {
            return "GATEWAY_LOCAL".equals(rule.internalTargetClass())
                    ? Resolution.local(rule, LOCAL_HEALTH_FORWARD_URI, projections)
                    : Resolution.unavailable(rule, "gateway_local_target_class_invalid");
        }
        if (!"INTERNAL_V1".equals(rule.internalTargetClass())) {
            return Resolution.unavailable(rule, "canonical_target_class_unavailable");
        }
        URI target = targetForOwner(rule.upstreamOwner());
        return target == null
                ? Resolution.unavailable(rule, "canonical_owner_target_unavailable")
                : Resolution.upstream(rule, target, projections);
    }

    public boolean isAvailable(GatewayRoutePolicy.Rule rule) {
        return resolve(rule).isAvailable();
    }

    /** Reject a coarse rule unless an exact source-verified projection admits it. */
    public boolean canExecute(GatewayRoutePolicy.Rule rule, HttpMethod method, String publicPath) {
        Resolution resolution = resolve(rule);
        return resolution.isAvailable() && resolution.projections().stream()
                .anyMatch(projection -> projection.accepts(method, publicPath));
    }

    public List<RouteBinding> routeBindings() {
        return routePolicy.rules().stream()
                .map(this::resolve)
                .filter(Resolution::isAvailable)
                .flatMap(resolution -> resolution.projections().stream()
                        .map(projection -> new RouteBinding(
                                "canonical-" + resolution.rule().ruleId() + "-" + projection.bindingId(),
                                resolution.rule(), resolution.kind(), resolution.targetUri(),
                                targetUriConfig(resolution.rule()), projection)))
                .sorted(Comparator.comparingInt((RouteBinding binding) -> binding.rule().priority()).reversed()
                        .thenComparing(RouteBinding::routeId))
                .toList();
    }

    public List<RouteBinding> routableBindings() {
        return routeBindings().stream().filter(binding -> binding.kind() == ExecutionKind.UPSTREAM).toList();
    }

    public List<GatewayRoutePolicy.Rule> localRules() {
        return routePolicy.rules().stream()
                .filter(rule -> resolve(rule).isLocal())
                .sorted(Comparator.comparingInt(GatewayRoutePolicy.Rule::priority).reversed()
                        .thenComparing(GatewayRoutePolicy.Rule::ruleId))
                .toList();
    }

    public Map<String, String> failClosedReasons() {
        return FAIL_CLOSED_REASONS;
    }

    /**
     * Each frozen rule starts unavailable. Whole-rule conflicts retain their
     * concrete diagnosis; partially projected rules retain the generic reason
     * for every operation not explicitly admitted by a finite projection.
     */
    public String defaultUnavailableReason(GatewayRoutePolicy.Rule rule) {
        if (rule == null) {
            return "unknown_canonical_rule";
        }
        return FAIL_CLOSED_REASONS.getOrDefault(rule.ruleId(), DEFAULT_UNAVAILABLE_REASON);
    }

    /** Source-owned configuration selector mirrored by the contract parity gate. */
    public String targetUriConfig(GatewayRoutePolicy.Rule rule) {
        if (rule == null) {
            return "UNAVAILABLE";
        }
        if ("api-gateway".equals(rule.upstreamOwner())) {
            return "GATEWAY_LOCAL_FORWARD";
        }
        return switch (rule.upstreamOwner()) {
            case "iam-service" -> "gateway.identity.iam-base-url";
            case "learner-service" -> "gateway.b14.service-base-urls.learner";
            case "content-service" -> "gateway.b14.service-base-urls.content";
            case "learning-service" -> "gateway.b14.service-base-urls.learning";
            case "assessment-service" -> "gateway.b14.service-base-urls.assessment";
            case "media-service" -> "gateway.b14.service-base-urls.media";
            case "gamification-service" -> "gateway.b14.service-base-urls.gamification";
            case "social-service" -> "gateway.b14.service-base-urls.social";
            case "commerce-service" -> "gateway.b14.service-base-urls.commerce";
            case "notification-service" -> "gateway.b12.notification-base-url";
            case "analytics-service" -> "gateway.b13.analytics-base-url";
            case "admin-ops-service" -> "gateway.b13.admin-ops-base-url";
            case "workflow-service" -> "gateway.workflow.workflow-base-url";
            default -> "UNAVAILABLE";
        };
    }

    private URI targetForOwner(String owner) {
        return switch (owner) {
            case "iam-service" -> enabled(properties.identity().enabled()) ? properties.identity().iamUri() : null;
            case "learner-service" -> b14Target("learner");
            case "content-service" -> b14Target("content");
            case "learning-service" -> b14Target("learning");
            case "assessment-service" -> b14Target("assessment");
            case "media-service" -> b14Target("media");
            case "gamification-service" -> b14Target("gamification");
            case "social-service" -> b14Target("social");
            case "commerce-service" -> b14Target("commerce");
            case "notification-service" -> enabled(properties.b12().enabled()) ? properties.b12().notificationUri() : null;
            case "analytics-service" -> enabled(properties.b13().enabled()) ? properties.b13().analyticsUri() : null;
            case "admin-ops-service" -> enabled(properties.b13().enabled()) ? properties.b13().adminOpsUri() : null;
            case "workflow-service" -> enabled(properties.workflow().enabled()) ? properties.workflow().workflowUri() : null;
            default -> null;
        };
    }

    private URI b14Target(String domain) {
        GatewayProperties.B14Services b14 = properties.b14();
        return enabled(b14.enabled()) && b14.mode(domain) == GatewayProperties.B14Services.RouteMode.TARGET
                ? b14.serviceUri(domain)
                : null;
    }

    private void verifyExecutionDefinitions() {
        Map<String, GatewayRoutePolicy.Rule> rulesById = routePolicy.rules().stream()
                .collect(java.util.stream.Collectors.toUnmodifiableMap(GatewayRoutePolicy.Rule::ruleId, rule -> rule));
        Set<String> defined = new java.util.LinkedHashSet<>(EXECUTABLE_PROJECTIONS.keySet());
        defined.addAll(FAIL_CLOSED_REASONS.keySet());
        // Synthetic unit-test policies intentionally contain only a subset.
        if (!rulesById.keySet().containsAll(defined)) {
            return;
        }
        if (!defined.equals(rulesById.keySet())) {
            throw new IllegalStateException("Canonical route execution definitions are incomplete or stale: " + defined);
        }
        for (Map.Entry<String, List<PathProjection>> entry : EXECUTABLE_PROJECTIONS.entrySet()) {
            GatewayRoutePolicy.Rule rule = rulesById.get(entry.getKey());
            Set<String> projectionIds = new java.util.HashSet<>();
            for (PathProjection projection : entry.getValue()) {
                if (!rule.upstreamOwner().equals(projection.controllerEvidence().ownerService())) {
                    throw new IllegalStateException("Projection owner drift for " + rule.ruleId());
                }
                if (!rule.methods().containsAll(projection.methods())) {
                    throw new IllegalStateException("Projection method broadening for " + rule.ruleId());
                }
                if (!projectionIds.add(projection.bindingId())) {
                    throw new IllegalStateException("Duplicate projection id for " + rule.ruleId());
                }
            }
        }
    }

    private static boolean enabled(Boolean value) {
        return Boolean.TRUE.equals(value);
    }

    public enum ExecutionKind { LOCAL, UPSTREAM, UNAVAILABLE }
    public enum PathStrategy { FORWARD_LOCAL, PRESERVE_PUBLIC_PATH, REWRITE_PATH }

    public record ControllerEvidence(String ownerService, String sourceRelativePath, String requestMapping) {
        public ControllerEvidence {
            ownerService = require(ownerService, "ownerService");
            sourceRelativePath = require(sourceRelativePath, "sourceRelativePath");
            requestMapping = require(requestMapping, "requestMapping");
        }

        public String rendered() { return sourceRelativePath + "#" + requestMapping; }
    }

    public record PathProjection(
            String bindingId,
            String publicPathTemplate,
            List<HttpMethod> methods,
            PathStrategy strategy,
            String admissionRegex,
            String rewriteReplacement,
            String targetPathTemplate,
            ControllerEvidence controllerEvidence
    ) {
        public PathProjection {
            bindingId = require(bindingId, "bindingId");
            publicPathTemplate = require(publicPathTemplate, "publicPathTemplate");
            methods = List.copyOf(methods);
            strategy = Objects.requireNonNull(strategy, "strategy");
            admissionRegex = require(admissionRegex, "admissionRegex");
            targetPathTemplate = require(targetPathTemplate, "targetPathTemplate");
            controllerEvidence = Objects.requireNonNull(controllerEvidence, "controllerEvidence");
            if (methods.isEmpty()) {
                throw new IllegalArgumentException("A path projection requires methods");
            }
            Pattern.compile(admissionRegex);
            if (strategy == PathStrategy.REWRITE_PATH && (rewriteReplacement == null || rewriteReplacement.isBlank())) {
                throw new IllegalArgumentException("A rewrite projection requires a replacement");
            }
        }

        public List<String> externalPathPatterns() {
            return List.of(toAntPattern(publicPathTemplate));
        }

        public boolean rewritesPath() { return strategy == PathStrategy.REWRITE_PATH; }

        public boolean accepts(HttpMethod requestMethod, String publicPath) {
            return requestMethod != null && methods.contains(requestMethod)
                    && Pattern.compile(admissionRegex).matcher(publicPath == null ? "" : publicPath).matches();
        }

        public String transformedTargetPath(String publicPath) {
            if (strategy == PathStrategy.PRESERVE_PUBLIC_PATH) {
                return publicPath;
            }
            if (strategy == PathStrategy.FORWARD_LOCAL) {
                return targetPathTemplate;
            }
            return Pattern.compile(admissionRegex).matcher(publicPath).replaceFirst(rewriteReplacement);
        }
    }

    public record Resolution(
            GatewayRoutePolicy.Rule rule,
            ExecutionKind kind,
            URI targetUri,
            List<PathProjection> projections,
            String unavailableReason
    ) {
        static Resolution local(GatewayRoutePolicy.Rule rule, URI targetUri, List<PathProjection> projections) {
            return new Resolution(rule, ExecutionKind.LOCAL, targetUri, List.copyOf(projections), null);
        }
        static Resolution upstream(GatewayRoutePolicy.Rule rule, URI targetUri, List<PathProjection> projections) {
            return new Resolution(rule, ExecutionKind.UPSTREAM, targetUri, List.copyOf(projections), null);
        }
        static Resolution unavailable(GatewayRoutePolicy.Rule rule, String reason) {
            return new Resolution(rule, ExecutionKind.UNAVAILABLE, null, List.of(),
                    reason == null ? "canonical_rule_mapping_not_verified" : reason);
        }
        public boolean isAvailable() { return kind != ExecutionKind.UNAVAILABLE; }
        public boolean isLocal() { return kind == ExecutionKind.LOCAL; }
        public boolean isUpstream() { return kind == ExecutionKind.UPSTREAM; }
    }

    public record RouteBinding(
            String routeId,
            GatewayRoutePolicy.Rule rule,
            ExecutionKind kind,
            URI targetUri,
            String targetUriConfig,
            PathProjection pathProjection
    ) {
        public List<String> externalPathPatterns() { return pathProjection.externalPathPatterns(); }
        public List<HttpMethod> methods() { return pathProjection.methods(); }

        public Map<String, Object> metadata() {
            Map<String, Object> metadata = new LinkedHashMap<>();
            metadata.put(METADATA_RULE_ID, rule.ruleId());
            metadata.put(METADATA_OWNER, rule.upstreamOwner());
            metadata.put(METADATA_VISIBILITY, rule.visibility());
            metadata.put(METADATA_AUTH_CLASS, rule.authClass().name());
            metadata.put(METADATA_INTERNAL_TARGET_CLASS, rule.internalTargetClass());
            metadata.put(METADATA_MATCH_TYPE, rule.matchType().name());
            metadata.put(METADATA_PATH, rule.path());
            metadata.put(METADATA_METHODS, methods().stream().map(HttpMethod::name).toList());
            metadata.put(METADATA_EXECUTION_KIND, kind.name());
            metadata.put(METADATA_TARGET_URI_CONFIG, targetUriConfig());
            metadata.put(METADATA_PATH_STRATEGY, pathProjection.strategy().name());
            metadata.put(METADATA_PUBLIC_TEMPLATE, pathProjection.publicPathTemplate());
            metadata.put(METADATA_PUBLIC_PATTERNS, externalPathPatterns());
            metadata.put(METADATA_TARGET_PATH, pathProjection.targetPathTemplate());
            metadata.put(METADATA_REWRITE_REGEX, pathProjection.admissionRegex());
            metadata.put(METADATA_CONTROLLER_EVIDENCE, pathProjection.controllerEvidence().rendered());
            return Map.copyOf(metadata);
        }
    }

    private static Map<String, List<PathProjection>> executableProjections() {
        Map<String, List<PathProjection>> definitions = new LinkedHashMap<>();
        add(definitions, "gateway-health", forward("health", "/api/v1/health", "/internal/gateway/health", GATEWAY_HEALTH, HttpMethod.GET));

        add(definitions, "iam-jwks-public", preserve("jwks", "/api/v1/auth/jwks", IAM_PUBLIC, HttpMethod.GET));
        add(definitions, "iam-register", preserve("register", "/api/v1/auth/register", IAM_PUBLIC, HttpMethod.POST));
        add(definitions, "iam-login", preserve("login", "/api/v1/auth/login", IAM_PUBLIC, HttpMethod.POST));
        add(definitions, "iam-refresh", preserve("refresh", "/api/v1/auth/token/refresh", IAM_PUBLIC, HttpMethod.POST));
        add(definitions, "iam-password-reset",
                preserve("password-reset-request", "/api/v1/auth/password-reset/request", IAM_PUBLIC, HttpMethod.POST),
                preserve("password-reset-confirm", "/api/v1/auth/password-reset/confirm", IAM_PUBLIC, HttpMethod.POST));
        add(definitions, "auth-domain",
                preserve("logout", "/api/v1/auth/logout", IAM_PUBLIC, HttpMethod.POST),
                preserve("revoke-session", "/api/v1/auth/sessions/{sessionId}/revoke", IAM_PUBLIC, HttpMethod.POST));
        add(definitions, "iam-domain",
                preserve("principal", "/api/v1/iam/principal/me", IAM_PUBLIC, HttpMethod.GET),
                preserve("devices", "/api/v1/iam/devices", IAM_PUBLIC, HttpMethod.GET),
                preserve("kickout", "/api/v1/iam/devices/{deviceId}/kickout", IAM_PUBLIC, HttpMethod.POST),
                preserve("adult-gate", "/api/v1/iam/adult-gate", IAM_PUBLIC, HttpMethod.POST),
                preserve("consents", "/api/v1/iam/consents", IAM_PUBLIC, HttpMethod.GET, HttpMethod.PUT),
                preserve("permissions", "/api/v1/iam/permissions", IAM_PUBLIC, HttpMethod.GET),
                preserve("policy-versions", "/api/v1/iam/policy-versions", IAM_POLICY_CONTROL, HttpMethod.GET, HttpMethod.POST),
                preserve("policy-version", "/api/v1/iam/policy-versions/{policyVersionId}", IAM_POLICY_CONTROL, HttpMethod.GET, HttpMethod.PUT),
                preserve("policy-submit", "/api/v1/iam/policy-versions/{policyVersionId}/submit", IAM_POLICY_CONTROL, HttpMethod.POST),
                preserve("policy-approval", "/api/v1/iam/policy-versions/{policyVersionId}/approvals", IAM_POLICY_CONTROL, HttpMethod.POST),
                preserve("policy-activate", "/api/v1/iam/policy-versions/{policyVersionId}/activate", IAM_POLICY_CONTROL, HttpMethod.POST),
                preserve("policy-revoke", "/api/v1/iam/policy-versions/{policyVersionId}/revoke", IAM_POLICY_CONTROL, HttpMethod.POST));

        add(definitions, "public-content",
                preserve("catalog", "/api/v1/public/content/catalog", CONTENT_PUBLIC_CATALOG, HttpMethod.GET),
                preserve("content", "/api/v1/public/content/{contentCode}", CONTENT_PUBLIC_DETAIL, HttpMethod.GET));
        add(definitions, "public-site",
                preserve("projection", "/api/v1/public/site/projection", CONTENT_PUBLIC_SITE_PROJECTION, HttpMethod.GET));
        add(definitions, "public-commerce", rewrite("catalog", "/api/v1/public/commerce/catalog", "/internal/v1/commerce/public/catalog", COMMERCE, HttpMethod.GET));
        add(definitions, "admin-content",
                rewrite("command-detail", "/api/v1/admin/content-commands/{contentCode}", "/internal/v1/content/admin-commands/{contentCode}", CONTENT_ADMIN, HttpMethod.GET),
                rewrite("commands", "/api/v1/admin/content-commands", "/internal/v1/content/admin-commands", CONTENT_ADMIN, HttpMethod.GET, HttpMethod.POST),
                // M3-002 live duel: idempotent batch import round-trip.
                rewrite("import-batch", "/api/v1/admin/content-commands/import/batch", "/internal/v1/content/admin-commands/import/batch", CONTENT_ADMIN, HttpMethod.POST),
                // M3-003 live: read-only auto validation report.
                rewrite("validate-auto", "/api/v1/admin/content-commands/validate/auto", "/internal/v1/content/admin-commands/validate/auto", CONTENT_ADMIN, HttpMethod.POST));
        add(definitions, "admin-analytics", rewrite("metrics", "/api/v1/admin/ops/metrics", "/internal/v1/analytics/metrics", ANALYTICS, HttpMethod.GET));
        // P1R decision 1A: recovery console routes (request/approve/reject/execute + saga views).
        // NOTE: projection order is significant — parity sorts by projectionId.
        add(definitions, "admin-recovery",
                rewrite("recovery-approve", "/api/v1/admin/recovery/recoveries/{recoveryId}/approve", "/internal/v1/workflow/recoveries/{recoveryId}/approve", WORKFLOW_RECOVERY, HttpMethod.POST),
                rewrite("recovery-execute", "/api/v1/admin/recovery/recoveries/{recoveryId}/execute", "/internal/v1/workflow/recoveries/{recoveryId}/execute", WORKFLOW_RECOVERY, HttpMethod.POST),
                rewrite("recovery-reject", "/api/v1/admin/recovery/recoveries/{recoveryId}/reject", "/internal/v1/workflow/recoveries/{recoveryId}/reject", WORKFLOW_RECOVERY, HttpMethod.POST),
                rewrite("recovery-request", "/api/v1/admin/recovery/recoveries", "/internal/v1/workflow/recoveries", WORKFLOW_RECOVERY, HttpMethod.POST),
                rewrite("saga-compensate", "/api/v1/admin/recovery/sagas/{sagaId}/compensate", "/internal/v1/workflow/sagas/{sagaId}/compensate", WORKFLOW_SAGA, HttpMethod.POST),
                rewrite("saga-detail", "/api/v1/admin/recovery/sagas/{sagaId}", "/internal/v1/workflow/sagas/{sagaId}", WORKFLOW_SAGA, HttpMethod.GET),
                rewrite("sagas-unfinished", "/api/v1/admin/recovery/sagas/unfinished", "/internal/v1/workflow/sagas/unfinished", WORKFLOW_SAGA, HttpMethod.GET));
        add(definitions, "analytics-telemetry", rewrite("events", "/api/v1/analytics/telemetry", "/internal/v1/analytics/events", ANALYTICS, HttpMethod.POST));

        add(definitions, "learner-domain",
                preserve("profile", "/api/v1/learner/profile", LEARNER_PUBLIC, HttpMethod.GET, HttpMethod.PATCH),
                preserve("targets", "/api/v1/learner/targets", LEARNER_PUBLIC, HttpMethod.GET, HttpMethod.PUT),
                preserve("preferences", "/api/v1/learner/preferences", LEARNER_PUBLIC, HttpMethod.GET, HttpMethod.PATCH),
                preserve("first-day", "/api/v1/learner/first-day", LEARNER_PUBLIC, HttpMethod.GET),
                preserve("home", "/api/v1/learner/home", LEARNER_PUBLIC, HttpMethod.GET));
        add(definitions, "onboarding-domain",
                rewrite("options", "/api/v1/onboarding/options", "/internal/v1/learner/onboarding/options", LEARNER_INTERNAL, HttpMethod.GET),
                rewrite("daily-tasks-today", "/api/v1/onboarding/daily-tasks/today", "/internal/v1/learner/onboarding/daily-tasks/today", LEARNER_INTERNAL, HttpMethod.GET),
                rewrite("daily-tasks-ensure", "/api/v1/onboarding/daily-tasks/ensure", "/internal/v1/learner/onboarding/daily-tasks/ensure", LEARNER_INTERNAL, HttpMethod.POST),
                rewrite("daily-task-complete", "/api/v1/onboarding/daily-tasks/{taskId}/complete", "/internal/v1/learner/onboarding/daily-tasks/{taskId}/complete", LEARNER_INTERNAL, HttpMethod.POST));
        add(definitions, "privacy-domain",
                rewrite("export", "/api/v1/privacy/export", "/internal/v1/learner/privacy/export", LEARNER_INTERNAL, HttpMethod.POST),
                // M6-007 live: status + download in projectionId order (parity sorts).
                rewrite("export-download", "/api/v1/privacy/export/{exportId}/download", "/internal/v1/learner/privacy/export/{exportId}/download", LEARNER_INTERNAL, HttpMethod.GET),
                rewrite("export-status", "/api/v1/privacy/export/{exportId}", "/internal/v1/learner/privacy/export/{exportId}", LEARNER_INTERNAL, HttpMethod.GET));

        add(definitions, "content-domain",
                preserve("learner-catalog", "/api/v1/content/learner/catalog", CONTENT_LEARNER_CATALOG, HttpMethod.GET),
                preserve("learner-content", "/api/v1/content/learner/{contentCode}", CONTENT_LEARNER_DETAIL, HttpMethod.GET),
                // P1R decision 7B: session-pin substitute resolution for assessment.
                preserve("learner-substitute", "/api/v1/content/learner/substitute", CONTENT_LEARNER_SUBSTITUTE, HttpMethod.GET),
                rewrite("learner-vocabulary", "/api/v1/content/learner/vocabulary/{vocabularyId}", "/internal/v1/content/learner/vocabulary/{vocabularyId}", CONTENT_LEARNER, HttpMethod.GET));
        add(definitions, "vocabulary-domain",
                rewrite("expressions", "/api/v1/vocab/expressions", "/internal/v1/learning/vocab/expressions", LEARNING_B25, HttpMethod.GET, HttpMethod.POST),
                rewrite("expression", "/api/v1/vocab/expressions/{expressionId}", "/internal/v1/learning/vocab/expressions/{expressionId}", LEARNING_B25, HttpMethod.PATCH, HttpMethod.DELETE),
                rewrite("library", "/api/v1/vocab/library", "/internal/v1/learning/vocab/library", LEARNING_B25, HttpMethod.GET),
                rewrite("library-entry", "/api/v1/vocab/library/entries", "/internal/v1/learning/vocab/library/entries", LEARNING_B25, HttpMethod.POST),
                rewrite("library-entry-delete", "/api/v1/vocab/library/entries/{entryId}", "/internal/v1/learning/vocab/library/entries/{entryId}", LEARNING_B25, HttpMethod.DELETE));
        add(definitions, "learning-domain",
                rewrite("continue-context", "/api/v1/learning/continue-context", "/internal/v1/learning/continue-context", LEARNING_B25, HttpMethod.GET, HttpMethod.PUT),
                rewrite("daily-report", "/api/v1/learning/stats/daily-report", "/internal/v1/learning/stats/daily-report", LEARNING_B25, HttpMethod.GET),
                rewrite("weekly-report", "/api/v1/learning/stats/weekly-report", "/internal/v1/learning/stats/weekly-report", LEARNING_B25, HttpMethod.GET),
                rewrite("daily-summary", "/api/v1/learning/stats/daily-summary", "/internal/v1/learning/stats/daily-summary", LEARNING_B25, HttpMethod.GET),
                rewrite("srs-batches", "/api/v1/learning/srs/batches", "/internal/v1/learning/srs/batches", LEARNING_B25, HttpMethod.POST),
                rewrite("srs-batch", "/api/v1/learning/srs/batches/{snapshotId}", "/internal/v1/learning/srs/batches/{snapshotId}", LEARNING_B25, HttpMethod.GET),
                rewrite("srs-reviews", "/api/v1/learning/srs/reviews", "/internal/v1/learning/srs/reviews", LEARNING_B25, HttpMethod.POST),
                rewrite("srs-reviews-sync", "/api/v1/learning/srs/reviews:sync", "/internal/v1/learning/srs/reviews:sync", LEARNING_B25, HttpMethod.POST),
                rewrite("srs-states", "/api/v1/learning/srs/states", "/internal/v1/learning/srs/states", LEARNING_B25, HttpMethod.GET),
                rewrite("srs-overview", "/api/v1/learning/srs/overview", "/internal/v1/learning/srs/overview", LEARNING_B25, HttpMethod.GET),
                rewrite("plan-current", "/api/v1/learning/plan/current", "/internal/v1/learning/plan/current", LEARNING_B25, HttpMethod.GET),
                rewrite("stream-today", "/api/v1/learning/stream/today", "/internal/v1/learning/stream/today", LEARNING_B25, HttpMethod.GET),
                rewrite("mistakes-queue", "/api/v1/learning/mistakes/queue", "/internal/v1/learning/mistakes/queue", LEARNING_B25, HttpMethod.GET),
                rewrite("review-queue", "/api/v1/learning/review-queue", "/internal/v1/learning/review-queue", LEARNING_B25, HttpMethod.GET),
                rewrite("review-queue-complete", "/api/v1/learning/review-queue/{queueItemId}/complete", "/internal/v1/learning/review-queue/{queueItemId}/complete", LEARNING_B25, HttpMethod.POST),
                rewrite("media-progress", "/api/v1/learning/media-progress", "/internal/v1/learning/experiences/media-progress", LEARNING_B3, HttpMethod.PUT),
                preserve("today-v2", "/api/v1/learning/today", LEARNING_V2, HttpMethod.GET));
        add(definitions, "mastery-domain",
                rewrite("overview", "/api/v1/mastery/overview", "/internal/v1/learning/experiences/mastery/overview", LEARNING_B3, HttpMethod.GET),
                rewrite("mistakes", "/api/v1/mastery/mistakes", "/internal/v1/learning/experiences/mastery/mistakes", LEARNING_B3, HttpMethod.GET),
                rewrite("mistake-retry", "/api/v1/mastery/mistakes/{mistakeId}/retry", "/internal/v1/learning/experiences/mastery/mistakes/{mistakeId}/retry", LEARNING_B3, HttpMethod.POST),
                rewrite("verifications", "/api/v1/mastery/verifications", "/internal/v1/learning/experiences/mastery/verifications", LEARNING_B3, HttpMethod.GET),
                rewrite("verification-submit", "/api/v1/mastery/verifications/{verificationId}/submit", "/internal/v1/learning/experiences/mastery/verifications/{verificationId}/submit", LEARNING_B3, HttpMethod.POST));
        add(definitions, "offline-domain",
                rewrite("sync-push", "/api/v1/offline/sync/push", "/internal/v1/learning/experiences/offline/sync/push", LEARNING_B3, HttpMethod.POST),
                rewrite("sync-pull", "/api/v1/offline/sync/pull", "/internal/v1/learning/experiences/offline/sync/pull", LEARNING_B3, HttpMethod.GET));

        add(definitions, "assessment-domain",
                rewrite("placement-start", "/api/v1/assessment/placement/start", "/internal/v1/assessment/placement/start", ASSESSMENT_B25, HttpMethod.GET, HttpMethod.POST),
                rewrite("placement-submit-step", "/api/v1/assessment/placement/submit-step", "/internal/v1/assessment/placement/submit-step", ASSESSMENT_B25, HttpMethod.POST),
                rewrite("placement-skip", "/api/v1/assessment/placement/skip", "/internal/v1/assessment/placement/skip", ASSESSMENT_B25, HttpMethod.POST),
                rewrite("placement-report", "/api/v1/assessment/placement/report/{sessionId}", "/internal/v1/assessment/placement/report/{sessionId}", ASSESSMENT_B25, HttpMethod.GET),
                rewrite("daily-stream", "/api/v1/assessment/daily-stream", "/internal/v1/assessment/daily-stream", ASSESSMENT_B25, HttpMethod.GET),
                rewrite("session-create", "/api/v1/assessment/sessions", "/internal/v1/assessment/sessions", ASSESSMENT_B10, HttpMethod.POST),
                rewrite("session", "/api/v1/assessment/sessions/{sessionId}", "/internal/v1/assessment/sessions/{sessionId}", ASSESSMENT_B10, HttpMethod.GET),
                rewrite("attempt-create", "/api/v1/assessment/sessions/{sessionId}/attempts", "/internal/v1/assessment/sessions/{sessionId}/attempts", ASSESSMENT_B10, HttpMethod.POST),
                rewrite("attempt-checkpoint", "/api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint", "/internal/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint", ASSESSMENT_B10, HttpMethod.PUT),
                rewrite("report", "/api/v1/assessment/reports/{reportId}", "/internal/v1/assessment/reports/{reportId}", ASSESSMENT_B10, HttpMethod.GET),
                // M5-009 live: mistake queue + verify + variant in projectionId order (parity sorts).
                rewrite("mistake-queue", "/api/v1/assessment/mistakes", "/internal/v1/assessment/mistakes", ASSESSMENT_B10, HttpMethod.GET),
                rewrite("mistake-variant", "/api/v1/assessment/mistakes/{mistakeId}/variant", "/internal/v1/assessment/mistakes/{mistakeId}/variant", ASSESSMENT_B10, HttpMethod.POST),
                rewrite("mistake-verify", "/api/v1/assessment/mistakes/{mistakeId}/verify", "/internal/v1/assessment/mistakes/{mistakeId}/verify", ASSESSMENT_B10, HttpMethod.POST));
        add(definitions, "media-domain",
                rewrite("asset", "/api/v1/media/assets/{assetId}", "/internal/v1/media/assets/{assetId}", MEDIA, HttpMethod.GET),
                rewrite("asset-activate", "/api/v1/media/assets/{assetId}/active", "/internal/v1/media/assets/{assetId}/active", MEDIA, HttpMethod.PUT),
                rewrite("asset-manifest", "/api/v1/media/assets/{assetId}/manifest", "/internal/v1/media/assets/{assetId}/manifest", MEDIA, HttpMethod.GET),
                // M3-004 live: workbench write paths in projectionId order (parity sorts).
                rewrite("asset-register", "/api/v1/media/assets", "/internal/v1/media/assets", MEDIA, HttpMethod.POST),
                rewrite("asset-retry", "/api/v1/media/assets/{assetId}/retry", "/internal/v1/media/assets/{assetId}/retry", MEDIA, HttpMethod.POST),
                rewrite("asset-signed-url", "/api/v1/media/assets/{assetId}/signed-url", "/internal/v1/media/assets/{assetId}/signed-url", MEDIA, HttpMethod.POST),
                rewrite("asset-subtitles", "/api/v1/media/assets/{assetId}/subtitles", "/internal/v1/media/assets/{assetId}/subtitles", MEDIA, HttpMethod.POST),
                rewrite("asset-tasks", "/api/v1/media/assets/{assetId}/tasks", "/internal/v1/media/assets/{assetId}/tasks", MEDIA, HttpMethod.GET),
                rewrite("asset-upload-url", "/api/v1/media/assets/{assetId}/upload-url", "/internal/v1/media/assets/{assetId}/upload-url", MEDIA, HttpMethod.POST));
        add(definitions, "gamification-domain",
                rewrite("streak", "/api/v1/gamification/streak", "/internal/v1/gamification/streak", GAMIFICATION_CORE, HttpMethod.GET),
                rewrite("streak-settings", "/api/v1/gamification/streak/settings", "/internal/v1/gamification/streak/settings", GAMIFICATION_LOCAL, HttpMethod.PUT),
                rewrite("streak-rescue", "/api/v1/gamification/streak/rescue", "/internal/v1/gamification/streak/rescue", GAMIFICATION_LOCAL, HttpMethod.POST),
                rewrite("quests", "/api/v1/gamification/quests", "/internal/v1/gamification/quests", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("quest-claim", "/api/v1/gamification/quests/{questId}/claim", "/internal/v1/gamification/quests/{questId}/claim", GAMIFICATION_LOCAL, HttpMethod.POST),
                rewrite("achievements", "/api/v1/gamification/achievements", "/internal/v1/gamification/achievements", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("achievement-showcase", "/api/v1/gamification/achievements/{achievementCode}/showcase", "/internal/v1/gamification/achievements/{achievementCode}/showcase", GAMIFICATION_LOCAL, HttpMethod.PUT),
                rewrite("chests", "/api/v1/gamification/chests", "/internal/v1/gamification/chests", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("chest-probability", "/api/v1/gamification/chests/{chestGrantId}/probability", "/internal/v1/gamification/chests/{chestGrantId}/probability", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("chest-open", "/api/v1/gamification/chests/{chestGrantId}/open", "/internal/v1/gamification/chests/{chestGrantId}/open", GAMIFICATION_LOCAL, HttpMethod.POST),
                rewrite("collection", "/api/v1/gamification/collection", "/internal/v1/gamification/collection", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("catalog", "/api/v1/gamification/catalog", "/internal/v1/gamification/catalog", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("catalog-redeem", "/api/v1/gamification/catalog/{catalogItemId}/redeem", "/internal/v1/gamification/catalog/{catalogItemId}/redeem", GAMIFICATION_LOCAL, HttpMethod.POST),
                rewrite("season-rewards", "/api/v1/gamification/seasons/{seasonId}/rewards", "/internal/v1/gamification/seasons/{seasonId}/rewards", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("me-summary", "/api/v1/gamification/me/summary", "/internal/v1/gamification/summary", GAMIFICATION_CORE, HttpMethod.GET),
                rewrite("me-ledger", "/api/v1/gamification/me/ledger", "/internal/v1/gamification/ledger", GAMIFICATION_CORE, HttpMethod.GET),
                rewrite("me-rewards", "/api/v1/gamification/me/rewards", "/internal/v1/gamification/rewards", GAMIFICATION_CORE, HttpMethod.GET),
                rewrite("me-reward-probability", "/api/v1/gamification/me/rewards/{grantId}/probability", "/internal/v1/gamification/rewards/{grantId}/probability", GAMIFICATION_CORE, HttpMethod.GET),
                rewrite("me-reward-claim", "/api/v1/gamification/me/rewards/{grantId}/claim", "/internal/v1/gamification/rewards/{grantId}/claim", GAMIFICATION_CORE, HttpMethod.POST),
                rewrite("season", "/api/v1/gamification/season", "/internal/v1/gamification/season", GAMIFICATION_CORE, HttpMethod.GET));
        add(definitions, "games-domain",
                rewrite("catalog", "/api/v1/games/catalog", "/internal/v1/gamification/games/catalog", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("sessions", "/api/v1/games/sessions", "/internal/v1/gamification/games/sessions", GAMIFICATION_LOCAL, HttpMethod.POST),
                rewrite("session", "/api/v1/games/sessions/{sessionId}", "/internal/v1/gamification/games/sessions/{sessionId}", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("events", "/api/v1/games/sessions/{sessionId}/events", "/internal/v1/gamification/games/sessions/{sessionId}/events", GAMIFICATION_LOCAL, HttpMethod.POST),
                rewrite("pause", "/api/v1/games/sessions/{sessionId}/pause", "/internal/v1/gamification/games/sessions/{sessionId}/pause", GAMIFICATION_LOCAL, HttpMethod.POST),
                rewrite("resume", "/api/v1/games/sessions/{sessionId}/resume", "/internal/v1/gamification/games/sessions/{sessionId}/resume", GAMIFICATION_LOCAL, HttpMethod.POST),
                rewrite("finish", "/api/v1/games/sessions/{sessionId}/finish", "/internal/v1/gamification/games/sessions/{sessionId}/finish", GAMIFICATION_LOCAL, HttpMethod.POST));
        add(definitions, "avatar-domain",
                rewrite("profile", "/api/v1/avatar/profile", "/internal/v1/gamification/avatar/profile", GAMIFICATION_LOCAL, HttpMethod.GET, HttpMethod.PUT),
                rewrite("items", "/api/v1/avatar/items", "/internal/v1/gamification/avatar/items", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("loadouts", "/api/v1/avatar/loadouts", "/internal/v1/gamification/avatar/loadouts", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("loadout", "/api/v1/avatar/loadouts/{loadoutId}", "/internal/v1/gamification/avatar/loadouts/{loadoutId}", GAMIFICATION_LOCAL, HttpMethod.PUT),
                rewrite("loadout-equip", "/api/v1/avatar/loadouts/{loadoutId}/equip", "/internal/v1/gamification/avatar/loadouts/{loadoutId}/equip", GAMIFICATION_LOCAL, HttpMethod.POST),
                rewrite("resources", "/api/v1/avatar/resources", "/internal/v1/gamification/avatar/resources", GAMIFICATION_LOCAL, HttpMethod.GET),
                rewrite("study-space", "/api/v1/avatar/study-space", "/internal/v1/gamification/avatar/study-space", GAMIFICATION_LOCAL, HttpMethod.GET, HttpMethod.PUT));
        add(definitions, "social-domain",
                preserve("rooms", "/api/v1/social/rooms", SOCIAL_PUBLIC, HttpMethod.GET),
                preserve("room", "/api/v1/social/rooms/{roomId}", SOCIAL_PUBLIC, HttpMethod.GET),
                preserve("join", "/api/v1/social/rooms/{roomId}/join", SOCIAL_PUBLIC, HttpMethod.POST),
                preserve("leave", "/api/v1/social/rooms/{roomId}/leave", SOCIAL_PUBLIC, HttpMethod.POST),
                preserve("interactions", "/api/v1/social/rooms/{roomId}/interactions", SOCIAL_PUBLIC, HttpMethod.POST),
                preserve("leaderboards", "/api/v1/social/leaderboards", SOCIAL_PUBLIC, HttpMethod.GET),
                preserve("ws-ticket", "/api/v1/social/ws-ticket", SOCIAL_PUBLIC, HttpMethod.POST),
                preserve("moderation-report", "/api/v1/social/moderation/reports", SOCIAL_PUBLIC, HttpMethod.POST),
                preserve("moderation-appeal", "/api/v1/social/moderation/reports/{reportId}/appeal", SOCIAL_PUBLIC, HttpMethod.POST),
                preserve("focus", "/api/v1/social/rooms/{roomId}/focus", SOCIAL_PUBLIC, HttpMethod.POST, HttpMethod.PATCH),
                preserve("visibility", "/api/v1/social/me/visibility", SOCIAL_PUBLIC, HttpMethod.PATCH),
                preserve("room-report", "/api/v1/social/rooms/{roomId}/reports", SOCIAL_PUBLIC, HttpMethod.POST),
                preserve("report", "/api/v1/social/reports/{reportId}", SOCIAL_PUBLIC, HttpMethod.GET));
        add(definitions, "commerce-domain",
                rewrite("skus", "/api/v1/commerce/skus", "/internal/v1/commerce/skus", COMMERCE, HttpMethod.GET),
                rewrite("orders", "/api/v1/commerce/orders", "/internal/v1/commerce/orders", COMMERCE, HttpMethod.GET, HttpMethod.POST),
                rewrite("order", "/api/v1/commerce/orders/{orderId}", "/internal/v1/commerce/orders/{orderId}", COMMERCE, HttpMethod.GET),
                rewrite("payment-intent", "/api/v1/commerce/orders/{orderId}/payment-intents", "/internal/v1/commerce/orders/{orderId}/payment-intents", COMMERCE, HttpMethod.POST),
                rewrite("entitlements", "/api/v1/commerce/entitlements/me", "/internal/v1/commerce/entitlements/me", COMMERCE, HttpMethod.GET),
                rewrite("activation-redeem", "/api/v1/commerce/activation-codes/redeem", "/internal/v1/commerce/activation-codes/redeem", COMMERCE, HttpMethod.POST),
                rewrite("refunds", "/api/v1/commerce/orders/{orderId}/refunds", "/internal/v1/commerce/orders/{orderId}/refunds", COMMERCE, HttpMethod.POST),
                rewrite("readiness", "/api/v1/commerce/readiness", "/internal/v1/commerce/readiness", COMMERCE, HttpMethod.GET));
        add(definitions, "notifications-domain",
                rewrite("preferences", "/api/v1/notifications/preferences", "/internal/v1/notifications/preferences", NOTIFICATION, HttpMethod.GET),
                rewrite("preference", "/api/v1/notifications/preferences/{notificationType}/{channel}", "/internal/v1/notifications/preferences/{notificationType}/{channel}", NOTIFICATION, HttpMethod.PUT),
                rewrite("messages", "/api/v1/notifications/messages", "/internal/v1/notifications/messages", NOTIFICATION, HttpMethod.GET),
                rewrite("message-read", "/api/v1/notifications/messages/{messageId}/read", "/internal/v1/notifications/messages/{messageId}/read", NOTIFICATION_READ, HttpMethod.PUT),
                rewrite("messages-read-all", "/api/v1/notifications/messages/read-all", "/internal/v1/notifications/messages/read-all", NOTIFICATION_READ, HttpMethod.PUT));
        // The source owns GET /preferences but PUT is parameterized by
        // notificationType/channel. The coarse canonical settings PUT cannot
        // safely be guessed into that handler, so it remains unavailable.
        add(definitions, "settings-domain", rewrite("notifications", "/api/v1/settings/notifications", "/internal/v1/notifications/preferences", NOTIFICATION, HttpMethod.GET));
        add(definitions, "support-domain",
                rewrite("tickets", "/api/v1/support/tickets", "/internal/v1/admin-ops/support/tickets", SUPPORT_SCOPED, HttpMethod.GET, HttpMethod.POST),
                rewrite("ticket", "/api/v1/support/tickets/{ticketId}", "/internal/v1/admin-ops/support/tickets/{ticketId}", SUPPORT_SCOPED, HttpMethod.GET));
        add(definitions, "admin-domain",
                rewrite("commerce-orders", "/api/v1/admin/ops/commerce/orders", "/internal/v1/admin-ops/commerce/orders", ADMIN_OPS, HttpMethod.GET),
                rewrite("tickets", "/api/v1/admin/ops/tickets", "/internal/v1/admin-ops/tickets", SUPPORT_ADMIN, HttpMethod.GET, HttpMethod.POST),
                rewrite("ticket", "/api/v1/admin/ops/tickets/{ticketId}", "/internal/v1/admin-ops/tickets/{ticketId}", SUPPORT_ADMIN, HttpMethod.GET),
                rewrite("commands", "/api/v1/admin/ops/commands", "/internal/v1/admin-ops/commands", ADMIN_OPS, HttpMethod.POST),
                rewrite("commands-prepare", "/api/v1/admin/ops/commands/prepare", "/internal/v1/admin-ops/commands/prepare", ADMIN_OPS, HttpMethod.POST),
                rewrite("audit", "/api/v1/admin/ops/audit", "/internal/v1/admin-ops/audit", ADMIN_OPS, HttpMethod.GET));
        return Map.copyOf(definitions);
    }

    private static void add(Map<String, List<PathProjection>> definitions, String ruleId, PathProjection... projections) {
        if (definitions.put(ruleId, List.of(projections)) != null) {
            throw new IllegalStateException("Duplicate execution projection for " + ruleId);
        }
    }

    private static PathProjection forward(String id, String publicTemplate, String internalPath, ControllerEvidence evidence, HttpMethod... methods) {
        return new PathProjection(id, publicTemplate, List.of(methods), PathStrategy.FORWARD_LOCAL,
                templateRegex(publicTemplate), null, internalPath, evidence);
    }

    private static PathProjection preserve(String id, String publicTemplate, ControllerEvidence evidence, HttpMethod... methods) {
        return new PathProjection(id, publicTemplate, List.of(methods), PathStrategy.PRESERVE_PUBLIC_PATH,
                templateRegex(publicTemplate), null, publicTemplate, evidence);
    }

    private static PathProjection rewrite(
            String id, String publicTemplate, String targetTemplate, ControllerEvidence evidence, HttpMethod... methods
    ) {
        return new PathProjection(id, publicTemplate, List.of(methods), PathStrategy.REWRITE_PATH,
                templateRegex(publicTemplate), templateReplacement(targetTemplate), targetTemplate, evidence);
    }

    private static String templateRegex(String template) {
        Matcher matcher = TEMPLATE_PARAMETER.matcher(template);
        StringBuilder regex = new StringBuilder("^");
        int cursor = 0;
        while (matcher.find()) {
            regex.append(Pattern.quote(template.substring(cursor, matcher.start())));
            regex.append("(?<").append(matcher.group("name")).append(">[^/]+)");
            cursor = matcher.end();
        }
        regex.append(Pattern.quote(template.substring(cursor))).append('$');
        return regex.toString();
    }

    private static String templateReplacement(String template) {
        Matcher matcher = TEMPLATE_PARAMETER.matcher(template);
        StringBuilder replacement = new StringBuilder();
        int cursor = 0;
        while (matcher.find()) {
            replacement.append(template, cursor, matcher.start());
            replacement.append("${").append(matcher.group("name")).append('}');
            cursor = matcher.end();
        }
        return replacement.append(template.substring(cursor)).toString();
    }

    private static String toAntPattern(String template) {
        return TEMPLATE_PARAMETER.matcher(template).replaceAll("*");
    }

    private static ControllerEvidence evidence(String owner, String file, String mapping) {
        return new ControllerEvidence(owner, file, mapping);
    }

    private static String require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value;
    }
}
