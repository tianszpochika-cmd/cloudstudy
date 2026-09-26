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

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class LearningJdbcPermissionBoundaryTest {

    @Test
    void b25PlanReadAndVocabWriteRequireTheirOwnPermissionsBeforeDatabaseAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        JwtAuthenticationToken reviewOnly = learner("learning.review.read");

        assertForbidden(() -> controller.currentPlan(reviewOnly));
        assertForbidden(() -> controller.addLibraryEntry(reviewOnly,
                Map.of("itemType", "VOCAB", "itemId", "word-1", "sourceType", "READING"), "key-1"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void b3MasteryReadAndAttemptWriteRequireDistinctPermissions() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B3LearningJdbcController controller = new B3LearningJdbcController(jdbc, new ObjectMapper());

        assertForbidden(() -> controller.grammarMastery(learner("learning.progress.read"), null));
        assertForbidden(() -> controller.grammarAttempt(learner("learning.mastery.read"),
                Map.of("exerciseId", "exercise-1", "answer", "good"), "key-2"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void firstDayAndTodayProjectionsCannotUseAnUnrelatedPermission() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        V2LearningController controller = new V2LearningController(jdbc);

        assertForbidden(() -> controller.firstDay(learner("learning.review.read")));
        assertForbidden(() -> controller.today(learner("learning.plan.read")));
        verifyNoInteractions(jdbc);
    }

    private static void assertForbidden(Runnable action) {
        ResponseStatusException failure = assertThrows(ResponseStatusException.class, action::run);
        assertEquals(HttpStatus.FORBIDDEN, failure.getStatusCode());
    }

    private static JwtAuthenticationToken learner(String permission) {
        Instant now = Instant.parse("2026-09-23T00:00:00Z");
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .subject("learner-permission-test")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of(permission))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .claim("phase", "phase-1")
                .claim("account_status", "ACTIVE")
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }
}
