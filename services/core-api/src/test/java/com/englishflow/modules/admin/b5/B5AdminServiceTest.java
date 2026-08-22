package com.englishflow.modules.admin.b5;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;

import com.englishflow.modules.b5.B5Exception;
import org.junit.jupiter.api.Test;

class B5AdminServiceTest {
    private static final String HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    @Test
    void contentRequiresValidationAndDistinctFirstFinalReviewers() {
        B5AdminService service = new B5AdminService();
        Map<String, Object> created = service.createContentDraft(1L, Map.of("contentCode", "b5-test-content", "contentType", "UNIT", "title", "Test content", "contentHash", HASH, "payload", Map.of("schemaVersion", "b5-v1")), "b5-content-create-001");
        String contentId = String.valueOf(created.get("contentId"));
        service.validateContentDraft(contentId, 1L, "b5-content-validate-001");
        service.submitContentReview(contentId, 1L, "b5-content-submit-001");
        List<?> tasks = (List<?>) service.listReviewTasks(null, 20).get("items");
        assertEquals(2, tasks.size());
        Map<?, ?> first = (Map<?, ?>) tasks.get(0);
        Map<?, ?> second = (Map<?, ?>) tasks.get(1);
        String firstId = String.valueOf(first.get("reviewTaskId"));
        String finalId = String.valueOf(second.get("reviewTaskId"));
        service.decideReviewTask(firstId, Map.of("stage", "FIRST", "decision", "APPROVED"), 2L, "CONTENT_REVIEW_L1", "b5-review-first-001");
        B5Exception sameReviewer = assertThrows(B5Exception.class, () -> service.decideReviewTask(finalId, Map.of("stage", "FINAL", "decision", "APPROVED"), 2L, "CONTENT_REVIEW_L2", "b5-review-final-001"));
        assertEquals("REVIEW_ROLE_CONFLICT", sameReviewer.code());
        service.decideReviewTask(finalId, Map.of("stage", "FINAL", "decision", "APPROVED"), 3L, "CONTENT_REVIEW_L2", "b5-review-final-002");
        assertEquals("PUBLISHED", service.publishContent(contentId, 4L, "b5-publish-001").get("status"));
    }

    @Test
    void sensitiveValidationFailsClosedAndFlagsAreOffByDefault() {
        B5AdminService service = new B5AdminService();
        Map<String, Object> created = service.createContentDraft(1L, Map.of("contentCode", "b5-sensitive-content", "contentType", "UNIT", "title", "Blocked", "contentHash", HASH, "payload", Map.of("sensitiveHit", true)), "b5-content-create-002");
        String contentId = String.valueOf(created.get("contentId"));
        Map<String, Object> validation = service.validateContentDraft(contentId, 1L, "b5-content-validate-002");
        assertEquals(false, validation.get("valid"));
        assertEquals("SENSITIVE_CONTENT_BLOCKED", validation.get("resultCode"));
        B5Exception blocked = assertThrows(B5Exception.class, () -> service.submitContentReview(contentId, 1L, "b5-content-submit-002"));
        assertEquals("CONTENT_SCHEMA_INVALID", blocked.code());
        List<?> flags = (List<?>) service.listFeatureFlags().get("items");
        assertEquals(true, flags.stream().allMatch(flag -> Boolean.TRUE.equals(((Map<?, ?>) flag).get("defaultOff"))));
    }

    @Test
    void riskActionHasTtlAndAuditExportIsRedacted() {
        B5AdminService service = new B5AdminService();
        Map<String, Object> profile = service.applyRiskAction(9L, Map.of("actionCode", "FREEZE_PAYMENT", "ttlSeconds", 3600), 7L, "b5-risk-001");
        assertEquals("REVIEW", profile.get("riskLevel"));
        assertEquals("b5-risk-v1", profile.get("ruleVersion"));
        assertEquals("QUEUED", service.exportAuditReport(7L, "b5-audit-export-001").get("status"));
        assertEquals(true, service.exportAuditReport(7L, "b5-audit-export-002").get("redacted"));
    }
}
