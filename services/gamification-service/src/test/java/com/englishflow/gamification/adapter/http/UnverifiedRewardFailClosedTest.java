package com.englishflow.gamification.adapter.http;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.englishflow.gamification.application.GamificationAccessPolicy;
import com.englishflow.gamification.application.GamificationApplicationService;
import com.englishflow.gamification.domain.GamificationDomainException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.ObjectMapper;

class UnverifiedRewardFailClosedTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final GamificationApplicationService service = mock(GamificationApplicationService.class);
    private final GamificationLocalFeatureController controller = new GamificationLocalFeatureController(
            jdbc, new ObjectMapper(), new GamificationPrincipalResolver(new GamificationAccessPolicy()), service);

    @Test
    void oldQuestAchievementAndSeasonJsonCannotShowProgressOrGrantRewards() {
        JwtAuthenticationToken reader = user("alice", "gamification.read");
        JwtAuthenticationToken claimer = user("alice", "gamification.rewards.claim");
        assertEquals(List.of(), controller.quests(reader).get("items"));
        assertEquals(List.of(), controller.achievements(reader).get("items"));
        assertEquals(List.of(), controller.seasonRewards(reader, "old-season").get("items"));
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.claimQuest(
                claimer, "daily-practice", "same-key")));
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.claimQuest(
                claimer, "daily-practice", "same-key")));
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.claimQuest(
                claimer, "daily-practice", "different-key")));
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.showcase(
                reader, "FIRST_REVIEW", Map.of())));
        verifyNoInteractions(jdbc, service);
    }

    @Test
    void httpWritesReturnCanonical503WithNoDatabaseWrite() throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GamificationApiExceptionHandler()).build();
        JwtAuthenticationToken claimer = user("alice", "gamification.rewards.claim");
        JwtAuthenticationToken reader = user("alice", "gamification.read");

        mvc.perform(post("/internal/v1/gamification/quests/daily-practice/claim")
                        .principal(claimer).header("Idempotency-Key", "quest-key-1")
                        .header("X-Request-Id", "rQuest0001")
                        .header("X-Trace-Id", "0123456789abcdef0123456789abcdef"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("X-Request-Id", "rQuest0001"))
                .andExpect(header().string("X-Trace-Id", "0123456789abcdef0123456789abcdef"))
                .andExpect(header().string("X-API-Version", "v1"))
                .andExpect(jsonPath("$.error.errorCode").value("SERVICE_UNAVAILABLE"))
                .andExpect(jsonPath("$.error.retryable").value(false))
                .andExpect(jsonPath("$.error.details.reasonCode").value("ENTITLEMENT_UNAVAILABLE"))
                .andExpect(jsonPath("$.meta.requestId").value("rQuest0001"))
                .andExpect(jsonPath("$.meta.traceId").value("0123456789abcdef0123456789abcdef"))
                .andExpect(jsonPath("$.meta.apiVersion").value("v1"))
                .andExpect(jsonPath("$.meta.schemaVersion").value("1.0.0"));
        mvc.perform(put("/internal/v1/gamification/avatar/profile")
                        .principal(reader).contentType("application/json")
                        .content("{\"renderMode\":\"3D\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.errorCode").value("SERVICE_UNAVAILABLE"));
        verifyNoInteractions(jdbc, service);
    }

    private static JwtAuthenticationToken user(String subject, String permission) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("permissions", List.of(permission))
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), subject);
    }

    private static String code(Runnable action) {
        return assertThrows(GamificationDomainException.class, action::run).code().name();
    }
}
