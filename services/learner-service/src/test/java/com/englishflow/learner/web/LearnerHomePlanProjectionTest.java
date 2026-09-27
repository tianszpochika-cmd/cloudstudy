package com.englishflow.learner.web;

import com.englishflow.learner.application.FirstDayView;
import com.englishflow.learner.application.TargetPinService;
import com.englishflow.learner.config.LearnerServiceProperties;
import com.englishflow.learner.domain.AssessmentState;
import com.englishflow.learner.domain.CefrLevel;
import com.englishflow.learner.domain.DailyStudyMinutes;
import com.englishflow.learner.domain.GoalType;
import com.englishflow.learner.domain.LearningGoal;
import com.englishflow.learner.domain.OnboardingState;
import com.englishflow.learner.domain.ProfileSource;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Home promotes to READY only on a verified ACTIVE plan view; else honest NOT_READY. */
class LearnerHomePlanProjectionTest {
    private static final Instant NOW = Instant.parse("2026-09-27T12:00:00Z");

    private LearnerHttpController controller(TargetPinService pins, LearningPlanViewClient views) {
        LearnerServiceProperties properties = new LearnerServiceProperties();
        properties.setPhase("phase-1");
        return new LearnerHttpController(null, null,
                new VerifiedLearnerPrincipalFactory(properties), pins, views);
    }

    private static JwtAuthenticationToken auth() {
        Jwt jwt = Jwt.withTokenValue("verified").header("alg", "RS256")
                .subject("c172aa8f-adfa-4eb8-b243-379a5903fbf8")
                .issuedAt(NOW).expiresAt(NOW.plusSeconds(300))
                .claim("tenant_id", "platform").claim("roles", List.of("learner"))
                .claim("permissions", List.of("learner.target.write", "learning.plan.read"))
                .claim("adult_gate", "PASSED").claim("consent_state", "GRANTED").build();
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }

    private static FirstDayView view() {
        LearningGoal goal = new LearningGoal(71001L, GoalType.FOUNDATION, DailyStudyMinutes.FIFTEEN,
                null, CefrLevel.A1, Map.of(), NOW);
        return new FirstDayView("profile:test", "platform", "c172aa8f-adfa-4eb8-b243-379a5903fbf8",
                ProfileSource.OWNED, OnboardingState.COMPLETED, AssessmentState.NOT_STARTED,
                Optional.of(goal), Optional.empty(), 0, 0, 0, 25, "onboarding.resume",
                Optional.empty(), 3, NOW);
    }

    private static TargetPinService pins() {
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource()) {
            @Override
            public java.util.List<Map<String, Object>> queryForList(String sql, Object... args) {
                Map<String, Object> row = new java.util.HashMap<>();
                row.put("target_id", 71001L);
                row.put("pinned_content_version_id", 266100L);
                row.put("pinned_content_epoch", 1L);
                row.put("pinned_at", java.sql.Timestamp.from(NOW));
                return java.util.List.of(row);
            }
        };
        return new TargetPinService(jdbc,
                java.time.Clock.fixed(NOW, java.time.ZoneOffset.UTC));
    }

    @Test
    void activePlanViewPromotesHomeToReadyWithEmbeddedFacts() {
        LearningPlanViewClient views = new LearningPlanViewClient("http://127.0.0.1:9") {
            @Override
            public Optional<Map<String, Object>> fetchView(
                    org.springframework.security.core.Authentication authentication) {
                Map<String, Object> view = new java.util.LinkedHashMap<>();
                view.put("planId", "plan-100001");
                view.put("status", "ACTIVE");
                view.put("targetMinutes", 15);
                view.put("planVersion", 2L);
                view.put("replayed", false);
                view.put("planningInput", Map.of("pinId", "plan-pin-71001-266100"));
                view.put("plan", Map.of("planId", "plan-100001"));
                view.put("tasks", List.of(Map.of("itemId", "266001")));
                view.put("contentEpoch", 1L);
                view.put("projectionVersion", 1L);
                view.put("projectionWatermark", "w".repeat(64));
                return Optional.of(view);
            }
        };
        LearnerHttpController.FirstDayData data =
                controller(pins(), views).firstDayData(auth(), view()).data();
        assertEquals("READY", data.state());
        assertEquals("COMPLETED", data.placementStatus());
        assertEquals(1, data.taskCount());
        assertEquals(1, data.tasks().size());
        assertNull(data.blocker());
    }

    @Test
    void learningOutageKeepsHomeHonestlyNotReady() {
        LearningPlanViewClient views = new LearningPlanViewClient("http://127.0.0.1:9") {
            @Override
            public Optional<Map<String, Object>> fetchView(
                    org.springframework.security.core.Authentication authentication) {
                return Optional.empty();
            }
        };
        LearnerHttpController.FirstDayData data =
                controller(pins(), views).firstDayData(auth(), view()).data();
        assertEquals("NOT_READY", data.state());
        // Placement is verified (pin present) but the plan view is missing.
        assertEquals("COMPLETED", data.placementStatus());
        assertEquals("PLACEMENT_REQUIRED", data.blocker());
        assertEquals(0, data.taskCount());
        assertTrue(data.tasks().isEmpty());
    }
}
