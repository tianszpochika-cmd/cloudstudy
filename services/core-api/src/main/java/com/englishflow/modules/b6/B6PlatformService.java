package com.englishflow.modules.b6;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

/**
 * B6 code-layer state machine. The maps intentionally mirror the MySQL fact tables and
 * make replay/idempotency behaviour executable before real infrastructure is enabled.
 */
@Service
public final class B6PlatformService {
    private static final List<String> PLATFORMS = List.of("WEB", "H5", "ANDROID", "IOS", "IPAD", "WECHAT_MINI_PROGRAM", "WINDOWS_PWA");
    private static final Set<String> PERFORMANCE_LEVELS = Set.of("Ultra", "High", "Medium", "Performance");
    private static final Set<String> RELEASE_CHECKS = Set.of("COMPATIBILITY", "E2E", "SECURITY", "RELIABILITY", "BACKUP");

    private final Map<String, Map<String, Object>> builds = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> compatibilityChecks = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> e2eRuns = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> securityScans = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> reliabilityRuns = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> backupDrills = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> releaseGates = new ConcurrentHashMap<>();
    private final Map<String, String> idempotencyFingerprints = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> idempotencyResponses = new ConcurrentHashMap<>();

    public Map<String, Object> listReleaseMatrix() {
        List<Map<String, Object>> targets = new ArrayList<>();
        for (String platform : PLATFORMS) {
            Map<String, Object> target = new LinkedHashMap<>();
            target.put("platformCode", platform);
            target.put("priority", switch (platform) {
                case "WEB", "H5", "ANDROID", "IOS" -> "P0";
                case "IPAD" -> "P1";
                case "WECHAT_MINI_PROGRAM" -> "P1.5";
                default -> "P2";
            });
            target.put("implementation", platform.equals("WINDOWS_PWA") ? "learner-web + PWA" : platform.equals("WEB") ? "learner-web" : "mobile uni-app");
            target.put("buildStatus", builds.values().stream().anyMatch(item -> platform.equals(item.get("platformCode")) && "READY".equals(item.get("status"))) ? "READY" : "PENDING");
            target.put("installability", "TEST_STAGE_REQUIRED");
            target.put("sharedBusinessCode", platform.equals("WEB") || platform.equals("WINDOWS_PWA") ? "apps/learner-web" : "apps/mobile");
            targets.add(target);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("matrixVersion", "b6-platform-v1");
        data.put("targets", targets);
        data.put("releasePriority", List.of("WEB", "H5", "ANDROID", "IOS", "IPAD", "WECHAT_MINI_PROGRAM", "WINDOWS_PWA"));
        data.put("codeLayerStatus", "READY_FOR_TEST_STAGE");
        data.put("realDeviceEvidenceStatus", "PENDING_TEST_STAGE");
        return reply(data);
    }

    public Map<String, Object> registerBuild(Map<String, Object> body, String idempotencyKey) {
        String key = requireKey(idempotencyKey);
        String fingerprint = fingerprint(body);
        Map<String, Object> replay = replay(key, fingerprint);
        if (replay != null) return replay;
        String platform = required(body, "platformCode");
        if (!PLATFORMS.contains(platform)) throw bad("B6_PLATFORM_UNSUPPORTED", "平台不在发布矩阵中", false);
        String version = required(body, "buildVersion");
        String revision = required(body, "sourceRevision");
        String sha = required(body, "artifactSha256");
        if (!sha.matches("[a-f0-9]{64}")) throw bad("B6_ARTIFACT_HASH_INVALID", "构建产物哈希格式不正确", false);
        long size = number(body, "artifactSizeBytes", 1);
        String buildId = "b6-build-" + platform.toLowerCase() + "-" + version.replace('.', '-') + "-" + shortId(revision);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("buildId", buildId);
        data.put("platformCode", platform);
        data.put("buildVersion", version);
        data.put("sourceRevision", revision);
        data.put("artifactRef", required(body, "artifactRef"));
        data.put("artifactSha256", sha);
        data.put("artifactSizeBytes", size);
        data.put("status", enumValue(body, "status", Set.of("PENDING", "READY", "FAILED")));
        data.put("capabilities", stringList(body.get("capabilities")));
        data.put("createdAt", Instant.now().toString());
        builds.put(buildId, data);
        return remember(key, fingerprint, reply(data));
    }

    public Map<String, Object> getBuild(String buildId) { return reply(require(builds, buildId, "B6_BUILD_NOT_FOUND", "构建产物不存在")); }

    public Map<String, Object> recordCompatibilityCheck(Map<String, Object> body, String idempotencyKey) {
        String key = requireKey(idempotencyKey);
        String fingerprint = fingerprint(body);
        Map<String, Object> replay = replay(key, fingerprint);
        if (replay != null) return replay;
        String buildId = required(body, "buildId");
        Map<String, Object> build = require(builds, buildId, "B6_BUILD_NOT_FOUND", "兼容性检查关联的构建不存在");
        Map<String, Object> data = copy(body);
        data.put("checkId", "b6-compat-" + UUID.randomUUID());
        data.put("platformCode", required(body, "platformCode"));
        data.put("resultCode", enumValue(body, "resultCode", Set.of("PASS", "FAIL", "BLOCKED")));
        data.put("buildVersion", build.get("buildVersion"));
        data.put("createdAt", Instant.now().toString());
        compatibilityChecks.put(String.valueOf(data.get("checkId")), data);
        return remember(key, fingerprint, reply(data));
    }

    public Map<String, Object> performanceBudget() {
        List<Map<String, Object>> profiles = new ArrayList<>();
        profiles.add(profile("Ultra", 1.0, 100, 512, true, true, true));
        profiles.add(profile("High", 0.85, 64, 256, true, true, true));
        profiles.add(profile("Medium", 0.55, 24, 128, true, false, true));
        profiles.add(profile("Performance", 0.0, 0, 64, false, false, false));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("ruleVersion", "b6-performance-v1");
        data.put("levels", profiles);
        data.put("autoDegrade", true);
        data.put("autoUpgrade", false);
        data.put("fallbackOrder", List.of("Three.js", "2.5D", "SVG", "静态切片"));
        return reply(data);
    }

    public Map<String, Object> accessibilityChecklist() {
        List<Map<String, Object>> checks = new ArrayList<>();
        checks.add(check("TEXT_SCALE", "文字缩放至 200% 不裁切", "允许内容纵向增长，禁止固定高度裁切"));
        checks.add(check("KEYBOARD_FLOW", "键盘可完成关键流程", "所有主 CTA、表单和弹层拥有可见焦点"));
        checks.add(check("SCREEN_READER", "读屏可理解状态", "图标提供 aria-label，状态不只依赖颜色"));
        checks.add(check("REDUCED_MOTION", "动效可关闭", "prefers-reduced-motion 或 Performance 档关闭复杂动效"));
        checks.add(check("PERMISSION_FALLBACK", "权限拒绝仍可继续", "录音、通知、媒体权限拒绝时提供替代路径"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("ruleVersion", "b6-a11y-v1");
        data.put("checks", checks);
        data.put("releaseBlocking", true);
        return reply(data);
    }

    public Map<String, Object> responsiveChecklist() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("ruleVersion", "b6-responsive-v1");
        data.put("breakpoints", List.of(
            Map.of("code", "MOBILE", "minWidth", 320, "maxWidth", 639, "orientation", "BOTH"),
            Map.of("code", "TABLET", "minWidth", 640, "maxWidth", 1023, "orientation", "BOTH"),
            Map.of("code", "PAD", "minWidth", 1024, "maxWidth", 1279, "orientation", "BOTH"),
            Map.of("code", "DESKTOP", "minWidth", 1280, "maxWidth", 9999, "orientation", "LANDSCAPE")
        ));
        data.put("checks", List.of("NO_HORIZONTAL_OVERFLOW", "SAFE_AREA", "KEYBOARD_AND_TOUCH", "IPAD_RAIL_SWITCH", "SINGLE_SCROLL_CONTAINER"));
        data.put("evidenceStatus", "PENDING_TEST_STAGE");
        return reply(data);
    }

    public Map<String, Object> recordE2ERun(Map<String, Object> body, String idempotencyKey) {
        String key = requireKey(idempotencyKey);
        String fingerprint = fingerprint(body);
        Map<String, Object> replay = replay(key, fingerprint);
        if (replay != null) return replay;
        Map<String, Object> data = copy(body);
        data.put("runId", "b6-e2e-" + UUID.randomUUID());
        data.put("status", enumValue(body, "status", Set.of("PASSED", "FAILED", "SKIPPED")));
        data.put("passedCount", number(body, "passedCount", 0));
        data.put("failedCount", number(body, "failedCount", 0));
        data.put("createdAt", Instant.now().toString());
        e2eRuns.put(String.valueOf(data.get("runId")), data);
        return remember(key, fingerprint, reply(data));
    }

    public Map<String, Object> getE2ERun(String runId) { return reply(require(e2eRuns, runId, "B6_E2E_RUN_NOT_FOUND", "端到端运行记录不存在")); }

    public Map<String, Object> recordSecurityScan(Map<String, Object> body, String idempotencyKey) {
        String key = requireKey(idempotencyKey);
        String fingerprint = fingerprint(body);
        Map<String, Object> replay = replay(key, fingerprint);
        if (replay != null) return replay;
        Map<String, Object> data = copy(body);
        data.put("scanId", "b6-security-" + UUID.randomUUID());
        data.put("status", enumValue(body, "status", Set.of("PASS", "FAIL", "BLOCKED")));
        for (String field : List.of("criticalCount", "highCount", "mediumCount", "sensitiveFindingCount")) data.put(field, number(body, field, 0));
        data.put("createdAt", Instant.now().toString());
        securityScans.put(String.valueOf(data.get("scanId")), data);
        return remember(key, fingerprint, reply(data));
    }

    public Map<String, Object> getSecurityScan(String scanId) { return reply(require(securityScans, scanId, "B6_SECURITY_SCAN_NOT_FOUND", "安全扫描记录不存在")); }

    public Map<String, Object> recordReliabilityRun(Map<String, Object> body, String idempotencyKey) {
        String key = requireKey(idempotencyKey);
        String fingerprint = fingerprint(body);
        Map<String, Object> replay = replay(key, fingerprint);
        if (replay != null) return replay;
        Map<String, Object> data = copy(body);
        data.put("runId", "b6-reliability-" + UUID.randomUUID());
        data.put("status", enumValue(body, "status", Set.of("PASS", "FAIL", "BLOCKED")));
        data.put("duplicateWriteCount", number(body, "duplicateWriteCount", 0));
        data.put("lostWriteCount", number(body, "lostWriteCount", 0));
        data.put("retrySuccessRate", decimal(body, "retrySuccessRate", 0));
        data.put("p95LatencyMs", number(body, "p95LatencyMs", 0));
        data.put("createdAt", Instant.now().toString());
        reliabilityRuns.put(String.valueOf(data.get("runId")), data);
        return remember(key, fingerprint, reply(data));
    }

    public Map<String, Object> getReliabilityRun(String runId) { return reply(require(reliabilityRuns, runId, "B6_RELIABILITY_RUN_NOT_FOUND", "可靠性运行记录不存在")); }

    public Map<String, Object> observabilityDashboard() {
        long passedE2e = e2eRuns.values().stream().filter(item -> "PASSED".equals(item.get("status"))).count();
        long failedE2e = e2eRuns.values().stream().filter(item -> "FAILED".equals(item.get("status"))).count();
        long failedSecurity = securityScans.values().stream().filter(item -> !"PASS".equals(item.get("status"))).count();
        List<Map<String, Object>> alerts = new ArrayList<>();
        if (failedE2e > 0) alerts.add(alert("E2E_FAILURE", "HIGH", "OPEN", "B6_E2E_FAILED"));
        if (failedSecurity > 0) alerts.add(alert("SECURITY_SCAN_NOT_GREEN", "CRITICAL", "OPEN", "B6_SECURITY_NOT_GREEN"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("dashboardVersion", "b6-observability-v1");
        data.put("metrics", Map.of("e2ePassed", passedE2e, "e2eFailed", failedE2e, "securityNotGreen", failedSecurity, "releaseGates", releaseGates.size()));
        data.put("correlationFields", List.of("requestId", "traceId", "service", "environment", "eventName", "errorCode"));
        data.put("alerts", alerts);
        data.put("runbookRefs", List.of("docs/07-operations/b6-validation.md", "docs/07-operations/observability.md"));
        return reply(data);
    }

    public Map<String, Object> recordBackupDrill(Map<String, Object> body, String idempotencyKey) {
        String key = requireKey(idempotencyKey);
        String fingerprint = fingerprint(body);
        Map<String, Object> replay = replay(key, fingerprint);
        if (replay != null) return replay;
        Map<String, Object> data = copy(body);
        data.put("drillId", "b6-drill-" + UUID.randomUUID());
        data.put("status", enumValue(body, "status", Set.of("PASSED", "FAILED", "BLOCKED")));
        for (String field : List.of("rtoSeconds", "rpoSeconds", "restoredResourceCount", "failedResourceCount")) data.put(field, number(body, field, 0));
        data.put("createdAt", Instant.now().toString());
        backupDrills.put(String.valueOf(data.get("drillId")), data);
        return remember(key, fingerprint, reply(data));
    }

    public Map<String, Object> getBackupDrill(String drillId) { return reply(require(backupDrills, drillId, "B6_DRILL_NOT_FOUND", "数据可靠性演练记录不存在")); }

    public Map<String, Object> evaluateReleaseGate(Map<String, Object> body, String idempotencyKey) {
        String key = requireKey(idempotencyKey);
        String fingerprint = fingerprint(body);
        Map<String, Object> replay = replay(key, fingerprint);
        if (replay != null) return replay;
        List<String> candidateBuildIds = stringList(body.get("candidateBuildIds"));
        if (candidateBuildIds.isEmpty()) throw bad("B6_CANDIDATE_BUILD_REQUIRED", "发布 Gate 至少需要一个候选构建", false);
        List<String> requiredChecks = stringList(body.get("requiredChecks"));
        if (requiredChecks.isEmpty() || requiredChecks.stream().anyMatch(item -> !RELEASE_CHECKS.contains(item))) throw bad("B6_RELEASE_CHECK_INVALID", "发布检查项不完整", false);
        List<String> blockers = new ArrayList<>();
        for (String buildId : candidateBuildIds) {
            Map<String, Object> build = builds.get(buildId);
            if (build == null) blockers.add("BUILD_NOT_FOUND:" + buildId);
            else if (!"READY".equals(build.get("status"))) blockers.add("BUILD_NOT_READY:" + buildId);
        }
        if (requiredChecks.contains("COMPATIBILITY") && compatibilityChecks.values().stream().noneMatch(item -> candidateBuildIds.contains(String.valueOf(item.get("buildId"))) && "PASS".equals(item.get("resultCode")))) blockers.add("COMPATIBILITY_EVIDENCE_MISSING");
        if (requiredChecks.contains("E2E") && e2eRuns.values().stream().noneMatch(item -> "PASSED".equals(item.get("status")))) blockers.add("E2E_NOT_GREEN");
        if (requiredChecks.contains("SECURITY") && securityScans.values().stream().noneMatch(item -> "PASS".equals(item.get("status")) && number(item, "criticalCount", 0) == 0 && number(item, "highCount", 0) == 0)) blockers.add("SECURITY_NOT_GREEN");
        if (requiredChecks.contains("RELIABILITY") && reliabilityRuns.values().stream().noneMatch(item -> "PASS".equals(item.get("status")) && number(item, "duplicateWriteCount", 0) == 0 && number(item, "lostWriteCount", 0) == 0)) blockers.add("RELIABILITY_NOT_GREEN");
        if (requiredChecks.contains("BACKUP") && backupDrills.values().stream().noneMatch(item -> "PASSED".equals(item.get("status")) && number(item, "failedResourceCount", 0) == 0)) blockers.add("BACKUP_DRILL_NOT_GREEN");
        for (String compliance : List.of("privacyStatus", "copyrightStatus", "merchantStatus", "platformReviewStatus")) {
            String value = required(body, compliance);
            if (!("PASS".equals(value) || ("platformReviewStatus".equals(compliance) && "NOT_REQUIRED".equals(value)))) blockers.add("COMPLIANCE_NOT_GREEN:" + compliance);
        }
        String rollbackPlanRef = required(body, "rollbackPlanRef");
        if (rollbackPlanRef.length() < 8) blockers.add("ROLLBACK_PLAN_MISSING");
        Map<String, Object> data = copy(body);
        data.put("gateId", "b6-gate-" + required(body, "releaseVersion").replace('.', '-').toLowerCase() + "-" + shortId(UUID.randomUUID().toString()));
        data.put("decision", blockers.isEmpty() ? "PASS" : "BLOCKED");
        data.put("releaseAllowed", blockers.isEmpty());
        data.put("blockers", blockers);
        data.put("evaluatedAt", Instant.now().toString());
        releaseGates.put(String.valueOf(data.get("gateId")), data);
        return remember(key, fingerprint, reply(data));
    }

    public Map<String, Object> getReleaseGate(String gateId) { return reply(require(releaseGates, gateId, "B6_GATE_NOT_FOUND", "发布 Gate 记录不存在")); }

    private static Map<String, Object> profile(String level, double motionScale, int particles, int textureMb, boolean threeD, boolean waveform, boolean rive) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("level", level); value.put("motionScale", motionScale); value.put("particleBudget", particles); value.put("textureBudgetMb", textureMb);
        value.put("enableThreeD", threeD); value.put("enableWaveform", waveform); value.put("enableRive", rive); return value;
    }

    private static Map<String, Object> check(String code, String title, String fallback) { return Map.of("checkCode", code, "title", title, "fallbackRule", fallback, "requiredForRelease", true); }
    private static Map<String, Object> alert(String code, String severity, String status, String errorCode) { return Map.of("alertCode", code, "severity", severity, "status", status, "errorCode", errorCode); }

    private static Map<String, Object> require(Map<String, Map<String, Object>> source, String id, String code, String message) {
        Map<String, Object> value = source.get(id);
        if (value == null) throw bad(code, message, false);
        return value;
    }

    private static String requireKey(String key) { if (key == null || key.isBlank()) throw bad("B6_IDEMPOTENCY_REQUIRED", "需要幂等键", false); return key.trim(); }
    private static String required(Map<String, Object> body, String field) { Object value = body == null ? null : body.get(field); if (value == null || String.valueOf(value).isBlank()) throw bad("B6_FIELD_REQUIRED", field + " 不能为空", false); return String.valueOf(value); }
    private static String enumValue(Map<String, Object> body, String field, Set<String> allowed) { String value = required(body, field); if (!allowed.contains(value)) throw bad("B6_ENUM_INVALID", field + " 值不受支持", false); return value; }
    private static long number(Map<String, Object> body, String field, long fallback) { return number(body == null ? null : body.get(field), field, fallback); }
    private static long number(Object value, String field, long fallback) { if (value == null) return fallback; if (value instanceof Number number && number.longValue() >= 0) return number.longValue(); try { long parsed = Long.parseLong(String.valueOf(value)); if (parsed >= 0) return parsed; } catch (NumberFormatException ignored) { } throw bad("B6_NUMBER_INVALID", field + " 必须是非负数", false); }
    private static double decimal(Map<String, Object> body, String field, double fallback) { Object value = body == null ? null : body.get(field); if (value == null) return fallback; try { double parsed = Double.parseDouble(String.valueOf(value)); if (parsed >= 0 && parsed <= 1) return parsed; } catch (NumberFormatException ignored) { } throw bad("B6_DECIMAL_INVALID", field + " 必须是 0 到 1 之间的小数", false); }
    private static List<String> stringList(Object value) { if (!(value instanceof List<?> list)) return List.of(); return list.stream().filter(item -> item != null && !String.valueOf(item).isBlank()).map(String::valueOf).toList(); }
    private static Map<String, Object> copy(Map<String, Object> source) { return source == null ? new LinkedHashMap<>() : new LinkedHashMap<>(source); }
    private static String fingerprint(Map<String, Object> body) { return String.valueOf(body == null ? Map.of() : body); }
    private static String shortId(String value) { return value.replaceAll("[^a-zA-Z0-9]", "").toLowerCase().substring(0, Math.min(10, value.replaceAll("[^a-zA-Z0-9]", "").length())); }

    private Map<String, Object> replay(String key, String fingerprint) {
        String previous = idempotencyFingerprints.get(key);
        if (previous == null) return null;
        if (!previous.equals(fingerprint)) throw bad("B6_IDEMPOTENCY_KEY_REUSED", "幂等键已绑定其他请求", false);
        return idempotencyResponses.get(key);
    }

    private Map<String, Object> remember(String key, String fingerprint, Map<String, Object> response) { idempotencyFingerprints.put(key, fingerprint); idempotencyResponses.put(key, response); return response; }
    private static Map<String, Object> reply(Object data) { return Map.of("requestId", "req_b6_" + UUID.randomUUID(), "data", data); }
    private static B6Exception bad(String code, String message, boolean retryable) { return new B6Exception(code, message, 400, retryable); }
}
