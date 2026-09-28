package com.englishflow.learning.adapter.http;

import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningTenantScope;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Owner HTTP ports resolve verified facts or stay empty; never invented. */
class PlanPortsHttpTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;
    private String baseUrl;
    private volatile String targetsBody;
    private volatile String profileBody;
    private volatile String planItemsBody;

    @BeforeEach
    void setUp() throws Exception {
        targetsBody = mapper.writeValueAsString(Map.of("source", "mysql", "data", Map.of(
                "targetId", 71001, "goalCode", "ZERO_BASIS", "targetLevel", "A1",
                "dailyQuotaMinutes", 15, "status", "ACTIVE", "stateVersion", 3,
                "pinnedContentVersionId", 266100, "pinnedContentEpoch", 1,
                "updatedAt", "2026-09-27T12:00:00Z")));
        profileBody = mapper.writeValueAsString(Map.of("data", Map.of(
                "principalId", "x", "status", "ACTIVE", "timezone", "Asia/Shanghai",
                "stateVersion", 5, "updatedAt", "2026-09-27T12:00:00Z")));
        planItemsBody = mapper.writeValueAsString(Map.of("data", Map.of(
                "bankCode", "P1_PLACEMENT_V1", "contentVersionId", 266100, "contentEpoch", 1,
                "contentStateVersion", 1,
                "items", List.of(
                        Map.of("itemId", 266001, "itemCode", "p1.place.vocab.01",
                                "itemType", "VOCABULARY", "dimension", "VOCABULARY", "displayOrder", 1,
                                "practiceRef", Map.of("contentCode", "p1.placement.v1",
                                        "contentVersionId", 266100, "questionItemId", "266001")),
                        Map.of("itemId", 266004, "itemCode", "p1.place.grammar.01",
                                "itemType", "GRAMMAR", "dimension", "BASIC_GRAMMAR", "displayOrder", 4,
                                "practiceRef", Map.of("contentCode", "p1.placement.v1",
                                        "contentVersionId", 266100, "questionItemId", "266004"))))));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            String payload = switch (path) {
                case "/api/v1/learner/targets" -> targetsBody;
                case "/api/v1/learner/profile" -> profileBody;
                case "/internal/v1/content/placement-bank/plan-items" -> planItemsBody;
                default -> null;
            };
            if (payload == null) {
                byte[] missing = "{\"error\":\"nope\"}".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(404, missing.length);
                exchange.getResponseBody().write(missing);
            } else {
                byte[] body = payload.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
            exchange.close();
        });
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        Jwt jwt = Jwt.withTokenValue("test-bearer").header("alg", "RS256")
                .subject("c172aa8f-adfa-4eb8-b243-379a5903fbf8")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60))
                .claim("tenant_id", "platform").build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, Set.of(), "c172aa8f-adfa-4eb8-b243-379a5903fbf8"));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        if (server != null) server.stop(0);
    }

    private static LearningPrincipalContext principal() {
        return new LearningPrincipalContext(
                LearningTenantScope.forPhaseOne("c172aa8f-adfa-4eb8-b243-379a5903fbf8",
                        LearningTenantScope.stableUserIdFor("c172aa8f-adfa-4eb8-b243-379a5903fbf8")),
                "phase-1", Set.of("learner"), Set.of("learning.plan.write"),
                com.englishflow.learning.domain.ConsentState.GRANTED, false,
                com.englishflow.learning.domain.ClientAuthorityClaims.none());
    }

    @Test
    void targetResolvesPinnedSnapshotFromOwnerReads() {
        HttpLearnerTargetPort port = new HttpLearnerTargetPort(mapper, baseUrl);
        var snapshot = port.findTarget(principal(), 71001L).orElseThrow();
        assertEquals(71001L, snapshot.targetId());
        assertEquals("zero_basis", snapshot.goalCode());
        assertEquals(15, snapshot.dailyQuotaMinutes());
        assertEquals("Asia/Shanghai", snapshot.timeZoneId());
        assertEquals(266100L, snapshot.contentVersionId());
        assertEquals(3L, snapshot.targetVersion());
    }

    @Test
    void unpinnedTargetStaysEmpty() throws Exception {
        targetsBody = mapper.writeValueAsString(Map.of("source", "mysql", "data", Map.of(
                "targetId", 71001, "goalCode", "ZERO_BASIS", "targetLevel", "A1",
                "dailyQuotaMinutes", 15, "status", "ACTIVE", "stateVersion", 3,
                "updatedAt", "2026-09-27T12:00:00Z")));
        HttpLearnerTargetPort port = new HttpLearnerTargetPort(mapper, baseUrl);
        assertTrue(port.findTarget(principal(), 71001L).isEmpty());
    }

    @Test
    void planSeedsMapDimensionsWithoutAnswers() {
        HttpPlanContentPort port = new HttpPlanContentPort(mapper, baseUrl, baseUrl);
        var snapshot = port.findLearnerSnapshot(principal(), 266100L).orElseThrow();
        assertEquals(266100L, snapshot.contentVersionId());
        assertEquals(1L, snapshot.contentEpoch());
        assertTrue(snapshot.learnerReadable());
        assertEquals(2, snapshot.items().size());
        assertEquals(com.englishflow.learning.domain.LearningItemType.VOCAB,
                snapshot.items().getFirst().itemType());
        assertEquals(com.englishflow.learning.domain.LearningTaskType.VOCABULARY_REVIEW,
                snapshot.items().getFirst().taskType());
        assertEquals(java.time.LocalDate.now(java.time.ZoneId.of("Asia/Shanghai")),
                snapshot.items().getFirst().plannedLocalDate());
        assertEquals(com.englishflow.learning.domain.LearningItemType.GRAMMAR,
                snapshot.items().get(1).itemType());
    }

    @Test
    void planSeedsExposeAnswerFreePracticeRefs() {
        HttpPlanContentPort port = new HttpPlanContentPort(mapper, baseUrl, baseUrl);
        Map<String, Map<String, Object>> seeds = port.planSeeds(266100L);
        assertEquals(2, seeds.size());
        assertEquals("p1.placement.v1", seeds.get("266001").get("contentCode"));
        assertEquals(266100L, ((Number) seeds.get("266001").get("contentVersionId")).longValue());
        assertEquals("266001", seeds.get("266001").get("questionItemId"));
        assertEquals("266004", seeds.get("266004").get("questionItemId"));
        assertTrue(port.planSeeds(25001L).isEmpty());
    }

    @Test
    void versionMismatchStaysEmpty() {
        HttpPlanContentPort port = new HttpPlanContentPort(mapper, baseUrl, baseUrl);
        Optional<?> missing = port.findLearnerSnapshot(principal(), 25001L);
        assertTrue(missing.isEmpty());
    }
}
