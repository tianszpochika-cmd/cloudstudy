package com.englishflow.learning.web;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class B25ReviewEvidenceGateTest {

    @Test
    void clientRatedLegacyAndCanonicalWritesCannotChangeSrsOrReviewFacts() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        JwtAuthenticationToken learner = learner(List.of("learning.review.write"));

        assertEvidenceConflict(() -> controller.review(learner,
                Map.of("itemId", "word-1", "quality", 5), "review-1"));
        assertEvidenceConflict(() -> controller.sync(learner,
                Map.of("events", List.of(Map.of("itemId", "word-1", "rawQuality", 3))), "sync-1"));
        assertEvidenceConflict(() -> controller.completeReviewQueue(learner, "word-1",
                Map.of("result", "PASS", "expectedStateVersion", 0), "complete-1"));

        verifyNoInteractions(jdbc);
    }

    @Test
    void writePermissionIsCheckedBeforeReportingMissingEvidence() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> controller.completeReviewQueue(learner(List.of("learning.plan.read")),
                        "word-1", Map.of("result", "PASS"), "complete-2"));
        assertEquals(HttpStatus.FORBIDDEN, failure.getStatusCode());
        verifyNoInteractions(jdbc);
    }

    @Test
    void legacyBatchAndReportDoNotPromoteUnverifiedRowsToAchievements() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        JwtAuthenticationToken learner = learner(List.of(
                "learning.review.read", "learning.review.write", "learning.progress.read"));

        Map<String, Object> batch = controller.createBatch(learner);
        assertEquals("RECOVERY_REQUIRED", batch.get("status"));
        assertTrue(((List<?>) batch.get("items")).isEmpty());

        org.mockito.Mockito.when(jdbc.queryForList(org.mockito.ArgumentMatchers.contains("b3_learning_interaction"),
                org.mockito.ArgumentMatchers.any(Object[].class))).thenReturn(List.of());

        Map<String, Object> report = controller.dailyReport(learner, "2026-09-23");
        assertEquals("PARTIAL", report.get("status"));
        assertEquals("UNVERIFIED_LEGACY_REVIEW", report.get("verificationStatus"));
        assertNull(report.get("reviewItems"));
        assertNull(report.get("accuracy"));
        assertTrue(((List<?>) report.get("weakness")).isEmpty());
        @SuppressWarnings("unchecked")
        Map<String, Object> period = (Map<String, Object>) report.get("period");
        assertEquals("NEVER_STUDIED", period.get("availability"));
        assertNull(period.get("newItems"));
        assertEquals(false, period.get("officialScore"));
        org.mockito.Mockito.verify(jdbc).queryForList(org.mockito.ArgumentMatchers.contains("b3_learning_interaction"),
                org.mockito.ArgumentMatchers.any(Object[].class));
    }

    private static void assertEvidenceConflict(Runnable action) {
        ResponseStatusException failure = assertThrows(ResponseStatusException.class, action::run);
        assertEquals(HttpStatus.CONFLICT, failure.getStatusCode());
        assertTrue(failure.getReason().contains("UNTRUSTED_REVIEW_EVIDENCE"));
    }

    private static JwtAuthenticationToken learner(List<String> permissions) {
        Instant now = Instant.parse("2026-09-23T00:00:00Z");
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .subject("learner-srs-test")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", permissions)
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .claim("phase", "phase-1")
                .claim("account_status", "ACTIVE")
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }
}
