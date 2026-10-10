package com.englishflow.learner.web;

import com.englishflow.learner.adapter.memory.InMemoryLearnerProfileStore;
import com.englishflow.learner.adapter.shadow.LearnerProfileShadowAdapter;
import com.englishflow.learner.application.DefaultLearnerProfileCommandService;
import com.englishflow.learner.application.DefaultLearnerProfileQueryService;
import com.englishflow.learner.application.TargetPinService;
import com.englishflow.learner.config.LearnerServiceProperties;
import com.englishflow.learner.domain.GoalType;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.domain.OnboardingState;
import com.englishflow.learner.port.LegacyLearnerReadModelPort;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Confirmed goal and daily minutes round-trip through the existing target
 * command. A missing target stays absent; replay does not write again.
 */
class LearnerTargetPersistenceTest {

    private static final Instant NOW = Instant.parse("2026-10-09T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String SUBJECT = "550e8400-e29b-41d4-a716-446655440010";
    private static final String KEY = "r1-010-goal-replay-01";

    private InMemoryLearnerProfileStore store;
    private LearnerHttpController controller;
    private JwtAuthenticationToken authentication;
    private LearnerTenantScope scope;

    @BeforeEach
    void setUp() {
        store = new InMemoryLearnerProfileStore();
        LegacyLearnerReadModelPort emptyLegacy = ignored -> Optional.empty();
        LearnerProfileShadowAdapter shadow = new LearnerProfileShadowAdapter(emptyLegacy, CLOCK);
        var policy = new com.englishflow.learner.domain.LearnerAccessPolicy(CLOCK);
        var commands = new DefaultLearnerProfileCommandService(store, shadow, policy, CLOCK);
        var queries = new DefaultLearnerProfileQueryService(store, shadow, policy, CLOCK);
        LearnerServiceProperties properties = new LearnerServiceProperties();
        properties.setPhase("phase-1");
        JdbcTemplate jdbc = new JdbcTemplate() {
            @Override
            public List<Map<String, Object>> queryForList(String sql, Object... args) {
                if (sql.contains("b25_")) {
                    throw new AssertionError("public target read must not touch b25");
                }
                return List.of();
            }
        };
        controller = new LearnerHttpController(
                commands, queries, new VerifiedLearnerPrincipalFactory(properties),
                new TargetPinService(jdbc, CLOCK), new LearningPlanViewClient("http://127.0.0.1:9"));
        authentication = authentication();
        scope = LearnerTenantScope.forPhaseOne(SUBJECT);
    }

    @Test
    void missingTargetIs404AndDoesNotCreateAGoal() {
        var missing = controller.target(authentication, new HttpHeaders());

        assertEquals(HttpStatus.NOT_FOUND, missing.getStatusCode());
        assertTrue(store.find(scope).isEmpty());
        assertEquals(0, store.outboxEvents().size());
    }

    @Test
    void confirmedGoalAndMinutesAreStoredReadBackReplayedAndConflictOnADifferentBody() {
        var first = controller.putTarget(body(0, "COLLEGE_CET", "B1", 30), authentication, KEY, new HttpHeaders());

        assertFalse(first.meta().replayed());
        assertEquals("COLLEGE_CET", first.data().goalCode());
        assertEquals(30, first.data().dailyQuotaMinutes());
        assertEquals("B1", first.data().targetLevel());
        assertEquals(1L, first.data().stateVersion());
        assertEquals(first.data().stateVersion(), first.data().targetVersion());
        var stored = store.find(scope).orElseThrow();
        assertEquals(OnboardingState.DRAFT, stored.onboardingState());
        assertEquals(GoalType.CET_4_6, stored.goal().orElseThrow().type());
        assertEquals(30, stored.goal().orElseThrow().dailyStudyMinutes().minutes());
        assertEquals(1L, stored.version());
        assertEquals(1, store.outboxEvents().size());

        var read = controller.target(authentication, new HttpHeaders());
        assertEquals(HttpStatus.OK, read.getStatusCode());
        assertEquals(first.data().goalCode(), read.getBody().data().goalCode());
        assertEquals(first.data().dailyQuotaMinutes(), read.getBody().data().dailyQuotaMinutes());
        assertEquals(first.data().stateVersion(), read.getBody().data().stateVersion());
        assertEquals(read.getBody().data().stateVersion(), read.getBody().data().targetVersion());

        var replay = controller.putTarget(body(0, "COLLEGE_CET", "B1", 30), authentication, KEY, new HttpHeaders());
        assertTrue(replay.meta().replayed());
        assertEquals(first.data(), replay.data());
        assertEquals(1, store.outboxEvents().size());
        assertEquals(1L, store.find(scope).orElseThrow().version());

        LearnerDomainException conflict = assertThrows(LearnerDomainException.class,
                () -> controller.putTarget(body(0, "WORKPLACE_DAILY", "B1", 30), authentication, KEY, new HttpHeaders()));
        assertEquals(LearnerDecisionCode.IDEMPOTENCY_CONFLICT, conflict.code());
        assertEquals(HttpStatus.CONFLICT, new LearnerHttpExceptionHandler().domain(conflict).getStatusCode());
        assertEquals(GoalType.CET_4_6, store.find(scope).orElseThrow().goal().orElseThrow().type());
        assertEquals(30, store.find(scope).orElseThrow().goal().orElseThrow().dailyStudyMinutes().minutes());

        LearnerDomainException stale = assertThrows(LearnerDomainException.class,
                () -> controller.putTarget(body(0, "COLLEGE_CET", "B1", 15), authentication, "r1-010-goal-stale-0002",
                        new HttpHeaders()));
        assertEquals(LearnerDecisionCode.CONCURRENT_UPDATE, stale.code());
        assertEquals(HttpStatus.CONFLICT, new LearnerHttpExceptionHandler().domain(stale).getStatusCode());
        assertEquals(30, store.find(scope).orElseThrow().goal().orElseThrow().dailyStudyMinutes().minutes());
    }

    @Test
    void aPartialTargetDoesNotCreateAGoal() {
        assertThrows(LearnerDomainException.class,
                () -> new LearnerHttpController.TargetUpsertRequest(0, "FOUNDATION", "A1", null, null, null, null));
        assertThrows(LearnerDomainException.class,
                () -> controller.putTarget(body(0, "LANGUAGE_CERT", "A1", 15), authentication, "r1-010-goal-partial-03",
                        new HttpHeaders()));
        assertThrows(LearnerDomainException.class,
                () -> controller.putTarget(body(0, "FOUNDATION", "A1", 60), authentication, "r1-010-goal-partial-04",
                        new HttpHeaders()));
        assertTrue(store.find(scope).isEmpty());
    }

    private static LearnerHttpController.TargetUpsertRequest body(
            long version, String goalCode, String level, int minutes) {
        return new LearnerHttpController.TargetUpsertRequest(version, goalCode, level, minutes, null, null, "ACTIVE");
    }

    private static JwtAuthenticationToken authentication() {
        Jwt jwt = Jwt.withTokenValue("verified").header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(NOW).expiresAt(NOW.plusSeconds(300))
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("learner.profile.read", "learner.target.write"))
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, java.util.Set.of(), jwt.getSubject());
    }
}
