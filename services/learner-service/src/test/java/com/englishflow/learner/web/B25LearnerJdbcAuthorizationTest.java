package com.englishflow.learner.web;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class B25LearnerJdbcAuthorizationTest {

    private static final String SUBJECT = "3f8b1c42-9d2e-4a7b-8c1d-5e6f7a8b9c0d";
    private static final Instant NOW = Instant.parse("2026-09-23T00:00:00Z");

    @Test
    void everyB25RouteDeniesPreGateMissingConsentAndWrongPermissionBeforeDatabaseAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearnerJdbcController controller = new B25LearnerJdbcController(jdbc);

        for (GuardedRoute route : routes()) {
            assertDenied(route, controller, token(List.of(route.permission()), "NOT_EVALUATED", "GRANTED"));
            assertDenied(route, controller, token(List.of(route.permission()), "PASSED", null));
            assertDenied(route, controller, token(List.of(route.permission()), "PASSED", "WITHDRAWN"));
            assertDenied(route, controller, token(List.of("unrelated.read"), "PASSED", "GRANTED"));
            verifyNoInteractions(jdbc);
        }
    }

    @Test
    void passedAdultGateGrantedConsentAndMatchingPermissionReachTheDataRead() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString())).thenReturn(List.of());
        B25LearnerJdbcController controller = new B25LearnerJdbcController(jdbc);

        Map<String, Object> response = controller.onboardingOptions(
                token(List.of("learner.onboarding.read"), "PASSED", "GRANTED"));

        assertEquals("mysql", response.get("source"));
        verify(jdbc).queryForList(anyString());
    }

    @Test
    void staleGrantedTokenIsForbiddenOnLearningRoutesWhenLiveConsentIsWithdrawn() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        LearningConsentRecheck withdrawn = principalId -> false;
        B25LearnerJdbcController controller = new B25LearnerJdbcController(jdbc, withdrawn);
        Authentication token = token(List.of("learner.profile.read", "learner.profile.write", "learner.target.write",
                "learner.onboarding.read", "learning.plan.read", "learning.task.write", "learner.preference.write"),
                "PASSED", "GRANTED");

        for (GuardedRoute route : learningRoutes()) {
            ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                    () -> route.action().accept(controller, token), route.name());
            assertEquals(HttpStatus.FORBIDDEN, failure.getStatusCode(), route.name());
            assertFalse(failure.getStatusCode().isSameCodeAs(HttpStatus.UNAUTHORIZED), route.name());
        }
        verifyNoInteractions(jdbc);
    }

    @Test
    void liveGrantStillReachesLearningRead() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString())).thenReturn(List.of());
        B25LearnerJdbcController controller = new B25LearnerJdbcController(jdbc, principalId -> true);

        Map<String, Object> response = controller.onboardingOptions(
                token(List.of("learner.onboarding.read"), "PASSED", "GRANTED"));

        assertEquals("mysql", response.get("source"));
        verify(jdbc).queryForList(anyString());
    }

    @Test
    void unreadableLiveConsentFailsClosedBeforeLearningData() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        LearningConsentRecheck unavailable = principalId -> {
            throw new IllegalStateException("iam unavailable");
        };
        B25LearnerJdbcController controller = new B25LearnerJdbcController(jdbc, unavailable);

        ResponseStatusException failure = assertThrows(ResponseStatusException.class, () -> controller.profile(
                token(List.of("learner.profile.read"), "PASSED", "GRANTED")));

        assertEquals(HttpStatus.FORBIDDEN, failure.getStatusCode());
        verifyNoInteractions(jdbc);
    }

    @Test
    void privacyExportStaysOpenWhenOnlyTheLiveLearningFactIsWithdrawn() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearnerJdbcController controller = new B25LearnerJdbcController(jdbc, principalId -> false);
        Authentication token = token(List.of("iam.self.read", "iam.self.write"), "PASSED", "GRANTED");

        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> controller.privacyExportStatus("export", token));

        assertEquals(HttpStatus.NOT_FOUND, missing.getStatusCode());
        verify(jdbc).queryForList(anyString(), eq("export"), eq("platform"), eq(SUBJECT));
    }

    private static List<GuardedRoute> learningRoutes() {
        return routes().stream().filter(route -> !route.name().contains("privacy")).toList();
    }

    private static void assertDenied(GuardedRoute route, B25LearnerJdbcController controller,
            Authentication authentication) {
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> route.action().accept(controller, authentication), route.name());
        assertEquals(HttpStatus.FORBIDDEN, failure.getStatusCode(), route.name());
    }

    private static Authentication token(List<String> permissions, String adultGate, String consentState) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", permissions);
        if (adultGate != null) builder.claim("adult_gate", adultGate);
        if (consentState != null) builder.claim("consent_state", consentState);
        Jwt jwt = builder.build();
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }

    private static List<GuardedRoute> routes() {
        return List.of(
                new GuardedRoute("GET profile", "learner.profile.read", (c, a) -> c.profile(a)),
                new GuardedRoute("PATCH profile", "learner.profile.write", (c, a) -> c.patchProfile(Map.of(), a, "key")),
                new GuardedRoute("GET targets", "learner.profile.read", (c, a) -> c.target(a)),
                new GuardedRoute("PUT targets", "learner.target.write", (c, a) -> c.putTarget(Map.of(), a, "key")),
                new GuardedRoute("GET onboarding options", "learner.onboarding.read", (c, a) -> c.onboardingOptions(a)),
                new GuardedRoute("GET daily tasks", "learning.plan.read", (c, a) -> c.dailyTasksToday(a)),
                new GuardedRoute("POST ensure daily task", "learning.task.write", (c, a) -> c.ensureDailyTask(Map.of(), a, "key")),
                new GuardedRoute("GET preferences", "learner.profile.read", (c, a) -> c.preferences(a)),
                new GuardedRoute("PATCH preferences", "learner.preference.write", (c, a) -> c.patchPreferences(Map.of(), a, "key")),
                new GuardedRoute("POST privacy export", "iam.self.write", (c, a) -> c.createPrivacyExport(Map.of(), a, "key")),
                new GuardedRoute("GET privacy export status", "iam.self.read", (c, a) -> c.privacyExportStatus("export", a)),
                new GuardedRoute("GET privacy export download", "iam.self.read", (c, a) -> c.privacyExportDownload("export", a)),
                new GuardedRoute("GET first day", "learner.onboarding.read", (c, a) -> c.firstDay(a)),
                new GuardedRoute("GET home", "learner.onboarding.read", (c, a) -> c.home(a)),
                new GuardedRoute("POST complete daily task", "learning.task.write", (c, a) -> c.completeTask("task", a, "key")));
    }

    private record GuardedRoute(String name, String permission,
            BiConsumer<B25LearnerJdbcController, Authentication> action) { }
}
