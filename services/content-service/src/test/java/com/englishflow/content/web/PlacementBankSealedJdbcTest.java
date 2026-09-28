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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The sealed bank serves exactly ten rights-checked items or fails closed; never a partial manifest. */
public class PlacementBankSealedJdbcTest {

    private JdbcTemplate jdbc;
    private PlacementBankSealedController controller;
    private JwtAuthenticationToken learner;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:placementbank_" + UUID.randomUUID().toString().replace("-", "")
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
        controller = new PlacementBankSealedController(jdbc, new ObjectMapper());
        Jwt jwt = Jwt.withTokenValue("test-token").header("alg", "RS256")
                .subject("test-learner").issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T00:05:00Z"))
                .claim("tenant_id", "platform").claim("roles", List.of("learner"))
                .claim("permissions", List.of("content.read"))
                .claim("adult_gate", "PASSED").claim("consent_state", "GRANTED").build();
        learner = new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }

    @Test
    @SuppressWarnings("unchecked")
    void sealedBankServesTenItemsWithAnswerRulesForInternalScoring() {
        Map<String, Object> data = (Map<String, Object>) controller.sealed(learner).get("data");
        assertEquals("P1_PLACEMENT_V1", data.get("bankCode"));
        assertEquals(266100L, ((Number) data.get("contentVersionId")).longValue());
        assertEquals(1L, ((Number) data.get("contentStateVersion")).longValue());
        assertTrue(String.valueOf(data.get("snapshotId")).startsWith("snap_"));
        assertTrue(String.valueOf(data.get("snapshotHash")).matches("[a-f0-9]{64}"));
        assertTrue(String.valueOf(data.get("ruleDigest")).matches("[a-f0-9]{64}"));
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        assertEquals(10, items.size());
        long vocab = items.stream().filter(item -> "VOCABULARY".equals(item.get("dimension"))).count();
        long grammar = items.stream().filter(item -> "BASIC_GRAMMAR".equals(item.get("dimension"))).count();
        assertEquals(3, vocab);
        assertEquals(3, grammar);
        for (Map<String, Object> item : items) {
            Map<String, Object> rule = (Map<String, Object>) item.get("answerRule");
            List<Map<String, Object>> options = (List<Map<String, Object>>) item.get("options");
            assertTrue(options.stream().anyMatch(option -> rule.get("correctOption").equals(option.get("optionId"))));
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void planItemsServeIdentifiersOnlyWithoutStemsOptionsOrAnswers() {
        Map<String, Object> data = (Map<String, Object>) controller.planItems(learner).get("data");
        assertEquals("P1_PLACEMENT_V1", data.get("bankCode"));
        assertEquals(266100L, ((Number) data.get("contentVersionId")).longValue());
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        assertEquals(10, items.size());
        for (Map<String, Object> item : items) {
            assertEquals(java.util.Set.of("itemId", "itemCode", "itemType", "dimension", "displayOrder",
                    "practiceRef"), item.keySet());
            Map<String, Object> ref = (Map<String, Object>) item.get("practiceRef");
            assertEquals("p1.placement.v1", ref.get("contentCode"));
            assertEquals(266100L, ((Number) ref.get("contentVersionId")).longValue());
            assertEquals(String.valueOf(item.get("itemId")), ref.get("questionItemId"));
        }
    }

    @Test
    void partialBankFailsClosedInsteadOfServingNineItems() {
        jdbc.update("DELETE FROM content_placement_item WHERE placement_item_id = 266010");
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> controller.sealed(learner));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failure.getStatusCode());
    }

    @Test
    void danglingAnswerRuleFailsClosed() {
        jdbc.update("UPDATE content_placement_item SET answer_rule_json = '{\"correctOption\":\"z\"}'"
                + " WHERE placement_item_id = 266001");
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> controller.sealed(learner));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failure.getStatusCode());
    }

    @Test
    void missingContentEpochFailsClosed() {
        jdbc.update("DELETE FROM content_definition WHERE content_id = 'p1-placement-bank-v1'");
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> controller.sealed(learner));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failure.getStatusCode());
    }

    @Test
    void unauthenticatedCallerIsDeniedBeforeAnyBankRead() {
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> controller.sealed(null));
        assertEquals(HttpStatus.UNAUTHORIZED, failure.getStatusCode());
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
            jdbc.update("INSERT INTO content_placement_item VALUES (?, 'platform', 'P1_PLACEMENT_V1', ?, ?, ?, ?, ?, ?, ?, 'CHOICE', 'p1-choice-v1', 10, 266100, 'p1.placement.v1', 'ACTIVE', TRUE, 'PUBLISHED')",
                    id, dimensions[index], index + 1, "p1.place.test." + index, types[index],
                    "Stem " + index + "?", options, "{\"correctOption\":\"a\"}");
        }
    }
}
