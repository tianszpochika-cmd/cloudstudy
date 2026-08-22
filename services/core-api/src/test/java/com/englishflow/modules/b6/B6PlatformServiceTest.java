package com.englishflow.modules.b6;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class B6PlatformServiceTest {
    private static final String HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    @Test
    void buildRegistrationIsIdempotentAndRejectsKeyReuse() {
        B6PlatformService service = new B6PlatformService();
        Map<String, Object> request = buildRequest("WEB", "6.0.0", "rev-b6-001");
        Map<String, Object> first = service.registerBuild(request, "b6-build-key-001");
        Map<String, Object> replay = service.registerBuild(request, "b6-build-key-001");
        assertEquals(first, replay);

        Map<String, Object> changed = buildRequest("WEB", "6.0.1", "rev-b6-002");
        B6Exception reused = assertThrows(B6Exception.class, () -> service.registerBuild(changed, "b6-build-key-001"));
        assertEquals("B6_IDEMPOTENCY_KEY_REUSED", reused.code());
    }

    @Test
    @SuppressWarnings("unchecked")
    void releaseGateBlocksMissingEvidenceAndPassesAfterAllRequiredChecks() {
        B6PlatformService service = new B6PlatformService();
        Map<String, Object> buildResponse = service.registerBuild(buildRequest("WEB", "6.0.0", "rev-b6-gate"), "b6-gate-build-001");
        Map<String, Object> build = (Map<String, Object>) buildResponse.get("data");
        String buildId = String.valueOf(build.get("buildId"));
        Map<String, Object> gateRequest = gateRequest(buildId);

        Map<String, Object> blockedResponse = service.evaluateReleaseGate(gateRequest, "b6-gate-evaluate-blocked");
        Map<String, Object> blocked = (Map<String, Object>) blockedResponse.get("data");
        assertEquals("BLOCKED", blocked.get("decision"));
        assertEquals(false, blocked.get("releaseAllowed"));

        service.recordCompatibilityCheck(Map.of("buildId", buildId, "platformCode", "WEB", "viewportCode", "DESKTOP", "orientation", "LANDSCAPE", "overflowCount", 0, "keyboardReachable", true, "touchTargetFailures", 0, "resultCode", "PASS", "evidenceRef", "evidence/b6-web"), "b6-gate-compat-001");
        service.recordE2ERun(Map.of("scenarioCode", "learning-loop", "surface", "LEARNING_LOOP", "platformCode", "WEB", "sourceRevision", "rev-b6-gate", "status", "PASSED", "passedCount", 4, "failedCount", 0, "evidenceRef", "evidence/b6-e2e"), "b6-gate-e2e-001");
        service.recordSecurityScan(Map.of("scanType", "CONTRACT", "sourceRevision", "rev-b6-gate", "ruleVersion", "b6-security-v1", "status", "PASS", "criticalCount", 0, "highCount", 0, "mediumCount", 0, "sensitiveFindingCount", 0, "reportRef", "reports/b6-security"), "b6-gate-security-001");
        service.recordReliabilityRun(Map.of("runType", "IDEMPOTENCY", "sourceRevision", "rev-b6-gate", "status", "PASS", "duplicateWriteCount", 0, "lostWriteCount", 0, "retrySuccessRate", 1, "p95LatencyMs", 120, "reportRef", "reports/b6-reliability"), "b6-gate-reliability-001");
        service.recordBackupDrill(Map.of("drillType", "MYSQL_RESTORE", "sourceRevision", "rev-b6-gate", "status", "PASSED", "rtoSeconds", 300, "rpoSeconds", 60, "restoredResourceCount", 10, "failedResourceCount", 0, "backupRef", "backups/b6", "rollbackRef", "runbooks/b6"), "b6-gate-backup-001");

        Map<String, Object> passedResponse = service.evaluateReleaseGate(gateRequest, "b6-gate-evaluate-passed");
        Map<String, Object> passed = (Map<String, Object>) passedResponse.get("data");
        assertEquals("PASS", passed.get("decision"));
        assertEquals(true, passed.get("releaseAllowed"));
        assertEquals(List.of(), passed.get("blockers"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void performanceAndAccessibilityContractsExposeSafeFallbacks() {
        B6PlatformService service = new B6PlatformService();
        Map<String, Object> performance = (Map<String, Object>) service.performanceBudget().get("data");
        Map<String, Object> accessibility = (Map<String, Object>) service.accessibilityChecklist().get("data");
        assertEquals(true, performance.get("autoDegrade"));
        assertEquals(false, performance.get("autoUpgrade"));
        assertEquals(true, accessibility.get("releaseBlocking"));
    }

    private static Map<String, Object> buildRequest(String platform, String version, String revision) {
        return Map.of("platformCode", platform, "buildVersion", version, "sourceRevision", revision, "artifactRef", "artifacts/" + platform.toLowerCase(), "artifactSha256", HASH, "artifactSizeBytes", 1024, "status", "READY", "capabilities", List.of("responsive", "a11y", "performance-fallback"));
    }

    private static Map<String, Object> gateRequest(String buildId) {
        return Map.of("releaseVersion", "6.0.0", "candidateBuildIds", List.of(buildId), "requiredChecks", List.of("COMPATIBILITY", "E2E", "SECURITY", "RELIABILITY", "BACKUP"), "privacyStatus", "PASS", "copyrightStatus", "PASS", "merchantStatus", "PASS", "platformReviewStatus", "NOT_REQUIRED", "rollbackPlanRef", "runbooks/b6-release-rollback");
    }
}
