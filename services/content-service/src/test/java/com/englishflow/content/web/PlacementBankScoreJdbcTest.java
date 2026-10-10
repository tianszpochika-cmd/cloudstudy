package com.englishflow.content.web;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** R1-021: service-token FULL/ZERO scoring. The sealed delivery stays answer-free. */
class PlacementBankScoreJdbcTest {
    private JdbcTemplate jdbc;
    private PlacementBankSealedController controller;
    private JwtAuthenticationToken learner;
    private JwtAuthenticationToken service;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:placementscore_" + UUID.randomUUID().toString().replace("-", "")
                        + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("""
                CREATE TABLE content_placement_item (
                    placement_item_id BIGINT PRIMARY KEY, tenant_id VARCHAR(64),
                    bank_code VARCHAR(64), dimension VARCHAR(24), display_order INT,
                    item_code VARCHAR(128), item_type VARCHAR(24), stem VARCHAR(4000),
                    options_json VARCHAR(4000), answer_rule_json VARCHAR(1000),
                    question_type VARCHAR(24), scoring_version VARCHAR(96),
                    max_score INT, content_version_id BIGINT, content_code VARCHAR(128),
                    copyright_status VARCHAR(24), rights_allows_learning BOOLEAN,
                    status VARCHAR(24))
                """);
        jdbc.execute("""
                CREATE TABLE content_definition (
                    content_id VARCHAR(128) PRIMARY KEY, tenant_id VARCHAR(64),
                    content_epoch BIGINT)
                """);
        jdbc.execute("""
                CREATE TABLE content_version (
                    content_version_id BIGINT PRIMARY KEY, state_version BIGINT)
                """);
        jdbc.update("INSERT INTO content_definition VALUES ('p1-placement-bank-v1', 'platform', 1)");
        jdbc.update("INSERT INTO content_version VALUES (266100, 1)");
        seedBank();
        controller = new PlacementBankSealedController(jdbc, mapper);
        learner = jwt("learner-1", "access", null, List.of("learner"), List.of("content.read"), true);
        service = jwt("assessment-service", "service", "assessment-service", List.of(),
                List.of("content:answer-rules:read"), false);
    }

    @Test
    void correctOptionIsFullAndWrongOptionIsZeroWithoutTheAnswerText() throws Exception {
        Map<String, Object> full = data(controller.score(service, Map.of("itemId", 266002L, "selectedOptionId", "b")));
        assertEquals(Set.of("itemId", "outcome", "explanation"), full.keySet());
        assertEquals(266002L, ((Number) full.get("itemId")).longValue());
        assertEquals("FULL", full.get("outcome"));
        assertEquals(PlacementBankSealedController.FULL_EXPLANATION, full.get("explanation"));

        Map<String, Object> zero = data(controller.score(service, Map.of("itemId", 266002L, "selectedOptionId", "a")));
        assertEquals("ZERO", zero.get("outcome"));
        assertEquals(PlacementBankSealedController.ZERO_EXPLANATION, zero.get("explanation"));

        String json = mapper.writeValueAsString(Map.of("full", full, "zero", zero));
        assertFalse(json.contains("correctOption"), json);
        assertFalse(json.contains("beta"), json);
        assertFalse(json.contains("fast"), json);
        assertFalse(String.valueOf(full.get("explanation")).contains("b"));
        String stored = jdbc.queryForObject(
                "SELECT answer_rule_json FROM content_placement_item WHERE placement_item_id = 266002",
                String.class);
        assertTrue(stored.contains("correctOption"));
    }

    @Test
    void caseAndWhitespaceStayUnmatched() {
        assertEquals("ZERO", data(controller.score(service,
                Map.of("itemId", 266001L, "selectedOptionId", "A"))).get("outcome"));
        assertEquals("ZERO", data(controller.score(service,
                Map.of("itemId", 266001L, "selectedOptionId", "a "))).get("outcome"));
        assertEquals("ZERO", data(controller.score(service,
                Map.of("itemId", 266001L, "selectedOptionId", " a"))).get("outcome"));
        assertEquals("FULL", data(controller.score(service,
                Map.of("itemId", 266001L, "selectedOptionId", "a"))).get("outcome"));
    }

    @Test
    void unresolvableRuleDoesNotInventAnOutcome() {
        jdbc.update("UPDATE content_placement_item SET answer_rule_json = '{\"correctOption\":\"A\"}'"
                + " WHERE placement_item_id = 266001");
        ResponseStatusException folded = assertThrows(ResponseStatusException.class,
                () -> controller.score(service, Map.of("itemId", 266001L, "selectedOptionId", "a")));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, folded.getStatusCode());

        jdbc.update("UPDATE content_placement_item SET answer_rule_json = '{\"correctOption\":\"a \"}'"
                + " WHERE placement_item_id = 266001");
        ResponseStatusException padded = assertThrows(ResponseStatusException.class,
                () -> controller.score(service, Map.of("itemId", 266001L, "selectedOptionId", "a")));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, padded.getStatusCode());
    }

    @Test
    void learnerAndAccessTokensAreDeniedBeforeTheAnswerIsRead() {
        JdbcTemplate denying = new JdbcTemplate(jdbc.getDataSource()) {
            @Override
            public List<Map<String, Object>> queryForList(String sql, Object... args) {
                throw new AssertionError("denied caller must not read answer_rule_json");
            }
        };
        PlacementBankSealedController gated = new PlacementBankSealedController(denying, mapper);
        Map<String, Object> body = Map.of("itemId", 266001L, "selectedOptionId", "a");
        ResponseStatusException anonymous = assertThrows(ResponseStatusException.class,
                () -> gated.score(null, body));
        assertEquals(HttpStatus.UNAUTHORIZED, anonymous.getStatusCode());
        ResponseStatusException learnerDenied = assertThrows(ResponseStatusException.class,
                () -> gated.score(learner, body));
        assertEquals(HttpStatus.FORBIDDEN, learnerDenied.getStatusCode());
        JwtAuthenticationToken accessWithPermission = jwt("assessment-service", "access", "assessment-service",
                List.of(), List.of("content:answer-rules:read"), false);
        ResponseStatusException accessDenied = assertThrows(ResponseStatusException.class,
                () -> gated.score(accessWithPermission, body));
        assertEquals(HttpStatus.FORBIDDEN, accessDenied.getStatusCode());
    }

    @Test
    @SuppressWarnings("unchecked")
    void sealedDeliveryStillOmitsTheAnswer() throws Exception {
        String json = mapper.writeValueAsString(controller.sealed(learner)).toLowerCase();
        assertFalse(json.contains("correctoption"), json);
        assertFalse(json.contains("answerrule"), json);
        List<Map<String, Object>> items = (List<Map<String, Object>>)
                ((Map<String, Object>) controller.sealed(learner).get("data")).get("items");
        assertEquals(10, items.size());
        assertFalse(items.getFirst().containsKey("answerRule"));
        assertFalse(items.getFirst().containsKey("correctOption"));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> body) {
        return (Map<String, Object>) body.get("data");
    }

    private static JwtAuthenticationToken jwt(String subject, String tokenType, String serviceId,
                                              List<String> roles, List<String> permissions, boolean learnerFacts) {
        Jwt.Builder builder = Jwt.withTokenValue("token-" + subject).header("alg", "RS256")
                .subject(subject).issuedAt(Instant.parse("2026-10-10T00:00:00Z"))
                .expiresAt(Instant.parse("2026-10-10T00:05:00Z"))
                .claim("tenant_id", "platform").claim("token_type", tokenType)
                .claim("roles", roles).claim("permissions", permissions);
        if (serviceId != null) builder.claim("service_id", serviceId);
        if (learnerFacts) {
            builder.claim("adult_gate", "PASSED").claim("consent_state", "GRANTED");
        }
        Jwt jwt = builder.build();
        return new JwtAuthenticationToken(jwt, Set.of(), subject);
    }

    private void seedBank() {
        String[] dimensions = {"VOCABULARY", "VOCABULARY", "VOCABULARY",
                "BASIC_GRAMMAR", "BASIC_GRAMMAR", "BASIC_GRAMMAR",
                "READING", "READING", "LISTENING", "LISTENING"};
        String[] types = {"VOCABULARY", "VOCABULARY", "VOCABULARY",
                "GRAMMAR", "GRAMMAR", "GRAMMAR",
                "READING", "READING", "LISTENING", "LISTENING"};
        for (int index = 0; index < 10; index++) {
            long id = 266001 + index;
            String options = "[{\"optionId\":\"a\",\"label\":\"alpha " + index + "\"},"
                    + "{\"optionId\":\"b\",\"label\":\"beta " + index + "\"},"
                    + "{\"optionId\":\"c\",\"label\":\"gamma " + index + "\"}]";
            String correct = index == 1 ? "b" : "a";
            jdbc.update("""
                    INSERT INTO content_placement_item VALUES (?, 'platform', 'P1_PLACEMENT_V1', ?, ?, ?, ?, ?, ?, ?,
                    'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED')
                    """, id, dimensions[index], index + 1, "p1.place.test." + index, types[index],
                    "Stem " + index + "?", options, "{\"correctOption\":\"" + correct + "\"}");
        }
    }
}
