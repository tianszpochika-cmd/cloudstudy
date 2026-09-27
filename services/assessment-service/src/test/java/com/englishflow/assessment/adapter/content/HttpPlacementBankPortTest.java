package com.englishflow.assessment.adapter.content;

import com.englishflow.assessment.domain.P1PlacementScorer;
import com.englishflow.assessment.port.P1PlacementSourcePort;
import com.englishflow.assessment.web.AssessmentHttpPrincipals.VerifiedAssessmentPrincipal;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** HTTP bank adapter resolves real pins or fails closed; it never invents items. */
class HttpPlacementBankPortTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;
    private String baseUrl;
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private volatile int bankStatus = 200;
    private volatile String bankBody;
    private volatile int targetStatus = 200;
    private volatile String targetBody;

    @BeforeEach
    void setUp() throws Exception {
        bankBody = mapper.writeValueAsString(Map.of("data", bank()));
        targetBody = mapper.writeValueAsString(Map.of("source", "mysql",
                "data", goal()));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/content/placement-bank/sealed", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] body = (bankStatus == 200 ? bankBody : "{\"error\":\"bank down\"}")
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(bankStatus, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.createContext("/api/v1/learner/targets", exchange -> {
            byte[] body = (targetStatus == 200 ? targetBody : "{\"error\":\"no goal\"}")
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(targetStatus, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        Jwt jwt = Jwt.withTokenValue("test-bearer").header("alg", "RS256")
                .subject("test-subject").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60))
                .claim("tenant_id", "platform").build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, Set.of(), "test-subject"));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        if (server != null) server.stop(0);
    }

    @Test
    void resolvesTenSealedItemsWithPinsAndForwardsCallerJwt() {
        HttpPlacementBankPort port = new HttpPlacementBankPort(mapper, baseUrl, baseUrl, Duration.ofSeconds(5));
        P1PlacementSourcePort.Resolved resolved = port.resolve(principal());
        assertEquals(10, resolved.items().size());
        assertEquals(266100L, ((Number) resolved.contentPin().get("contentVersionId")).longValue());
        assertEquals("P1_PLACEMENT_V1", resolved.answerRulePin().get("completionRuleVersion"));
        assertEquals(71001L, ((Number) resolved.targetPin().get("targetId")).longValue());
        assertEquals(3L, ((Number) resolved.targetPin().get("targetVersion")).longValue());
        assertTrue(String.valueOf(resolved.targetPin().get("targetSnapshotDigest")).matches("[a-f0-9]{64}"));
        assertEquals("Bearer test-bearer", authorization.get());
        for (P1PlacementSourcePort.SealedItem item : resolved.items()) {
            assertTrue(!item.learnerItem().containsKey("answerRule")
                    && !item.learnerItem().containsKey("correctOption"));
        }
    }

    @Test
    void missingGoalFailsClosedInsteadOfPinningWithoutTarget() {
        targetStatus = 404;
        HttpPlacementBankPort port = new HttpPlacementBankPort(mapper, baseUrl, baseUrl, Duration.ofSeconds(5));
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> port.resolve(principal()));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failure.getStatusCode());
    }

    @Test
    void bankOutageFailsClosedInsteadOfSubstitutingLegacyQuestions() {
        bankStatus = 500;
        HttpPlacementBankPort port = new HttpPlacementBankPort(mapper, baseUrl, baseUrl, Duration.ofSeconds(5));
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> port.resolve(principal()));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failure.getStatusCode());
    }

    @Test
    void partialBankFailsClosed() throws Exception {
        Map<String, Object> partial = new LinkedHashMap<>(bank());
        @SuppressWarnings("unchecked")
        List<Object> items = new ArrayList<>((List<Object>) partial.get("items"));
        items.removeLast();
        partial.put("items", items);
        bankBody = mapper.writeValueAsString(Map.of("data", partial));
        HttpPlacementBankPort port = new HttpPlacementBankPort(mapper, baseUrl, baseUrl, Duration.ofSeconds(5));
        assertThrows(RuntimeException.class, () -> port.resolve(principal()));
    }

    @Test
    void missingCallerJwtFailsClosed() {
        SecurityContextHolder.clearContext();
        HttpPlacementBankPort port = new HttpPlacementBankPort(mapper, baseUrl, baseUrl, Duration.ofSeconds(5));
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> port.resolve(principal()));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failure.getStatusCode());
    }

    private static VerifiedAssessmentPrincipal principal() {
        return new VerifiedAssessmentPrincipal("test-subject", "platform",
                Set.of("learner"), Set.of("assessment.placement.session.create"));
    }

    private static Map<String, Object> goal() {
        Map<String, Object> goal = new LinkedHashMap<>();
        goal.put("targetId", 71001);
        goal.put("goalCode", "ZERO_BASIS");
        goal.put("targetLevel", "A1");
        goal.put("dailyQuotaMinutes", 15);
        goal.put("status", "ACTIVE");
        goal.put("stateVersion", 3);
        goal.put("updatedAt", "2026-09-27T12:00:00Z");
        return goal;
    }

    private static Map<String, Object> bank() {
        String[] dimensions = {"VOCABULARY", "VOCABULARY", "VOCABULARY",
                "BASIC_GRAMMAR", "BASIC_GRAMMAR", "BASIC_GRAMMAR",
                "READING", "READING", "LISTENING", "LISTENING"};
        String[] types = {"VOCABULARY", "VOCABULARY", "VOCABULARY",
                "GRAMMAR", "GRAMMAR", "GRAMMAR",
                "READING", "READING", "LISTENING", "LISTENING"};
        List<Map<String, Object>> items = new ArrayList<>();
        for (int index = 0; index < 10; index++) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("itemId", 266001 + index);
            item.put("itemCode", "p1.place.test." + index);
            item.put("itemType", types[index]);
            item.put("dimension", dimensions[index]);
            item.put("displayOrder", index + 1);
            item.put("stem", "Stem " + index + "?");
            item.put("options", List.of(Map.of("optionId", "a", "label", "alpha"),
                    Map.of("optionId", "b", "label", "beta")));
            item.put("questionType", "CHOICE");
            item.put("scoringVersion", "p1-choice-v1");
            item.put("maxScore", 10);
            item.put("contentCode", "p1.placement.v1");
            item.put("contentVersionId", 266100);
            item.put("answerRule", Map.of("correctOption", "a"));
            items.add(item);
        }
        Map<String, Object> bank = new LinkedHashMap<>();
        bank.put("bankCode", "P1_PLACEMENT_V1");
        bank.put("contentVersionId", 266100);
        bank.put("contentEpoch", 1);
        bank.put("snapshotId", "snap_p1.placement.v1-266100");
        bank.put("snapshotHash", "a".repeat(64));
        bank.put("answerRuleSetVersion", "p1-placement-bank-v1");
        bank.put("answerRuleVersion", "p1-choice-v1");
        bank.put("ruleDigest", "b".repeat(64));
        bank.put("items", items);
        return bank;
    }
}
