package com.englishflow.assessment.web;

import com.englishflow.assessment.adapter.content.BankPracticeRuleProvider;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** B10 sessions accept a named gradable content; bank pins come from the bank. */
class B10BankSessionCreationTest {
    private static final String SUBJECT = "prn_learner0000000001";
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @SuppressWarnings("unchecked")
    void bankContentCodeCreatesPinnedSessionWithBankPins() {
        BankJdbc jdbc = new BankJdbc();
        B10AssessmentJdbcController controller = bankController(jdbc);
        Map<String, Object> body = Map.of("contentCode", "p1.placement.v1",
                "contentVersionId", 266100, "mode", "PRACTICE", "itemIds", List.of(266004));
        Map<String, Object> data = (Map<String, Object>) controller
                .createSession(learner(), body, "b10-bank-key-0001", "Bearer bank").get("data");
        assertEquals("IN_PROGRESS", data.get("status"));
        Map<String, Object> pin = (Map<String, Object>) data.get("pin");
        assertEquals("p1.placement.v1", pin.get("contentCode"));
        assertEquals(266100L, ((Number) pin.get("contentVersionId")).longValue());
        assertEquals("a".repeat(64), pin.get("snapshotHash"));
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        assertEquals(1, items.size());
        assertEquals("266004", String.valueOf(items.getFirst().get("itemCode")));
        // Same key replays the same session instead of creating another one.
        Map<String, Object> replay = (Map<String, Object>) controller
                .createSession(learner(), body, "b10-bank-key-0001", "Bearer bank").get("data");
        assertEquals(data.get("sessionId"), replay.get("sessionId"));
        assertEquals(1, jdbc.sessions.size());
    }

    @Test
    void invalidContentCodeIsRejectedBeforeAnyRuleLookup() {
        BankJdbc jdbc = new BankJdbc();
        B10AssessmentJdbcController controller = bankController(jdbc);
        ResponseStatusException rejected = assertThrows(ResponseStatusException.class,
                () -> controller.createSession(learner(),
                        Map.of("contentCode", "Evil Joined", "contentVersionId", 266100,
                                "mode", "PRACTICE"),
                        "b10-bank-key-evil1", "Bearer bank"));
        assertEquals(HttpStatus.BAD_REQUEST, rejected.getStatusCode());
        assertTrue(jdbc.sessions.isEmpty());
    }

    @Test
    void unknownContentCodeKeepsThe410() {
        BankJdbc jdbc = new BankJdbc();
        B10AssessmentJdbcController controller = bankController(jdbc);
        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> controller.createSession(learner(),
                        Map.of("contentCode", "p9.unknown.v1", "contentVersionId", 99,
                                "mode", "PRACTICE"),
                        "b10-bank-key-unkn1", "Bearer bank"));
        assertEquals(HttpStatus.GONE, missing.getStatusCode());
    }

    private B10AssessmentJdbcController bankController(BankJdbc jdbc) {
        return new B10AssessmentJdbcController(jdbc, mapper, "http://127.0.0.1:9") {
            @Override
            BankPracticeRuleProvider.BankRules bankRules(String contentCode, long contentVersionId,
                                                         String authorization) {
                if (!"p1.placement.v1".equals(contentCode) || contentVersionId != 266100) return null;
                List<Map<String, Object>> rows = List.of(Map.of(
                        "item_id", "266004", "content_version_id", 266100L,
                        "prompt", "She ___ to school every day.",
                        "options_json", "[{\"optionId\":\"a\",\"label\":\"go\"},{\"optionId\":\"b\",\"label\":\"goes\"}]",
                        "dimension", "GRAMMAR", "answer_rule_json", "{\"answer\":\"b\"}"));
                return new BankPracticeRuleProvider.BankRules(266100L, 1L, "a".repeat(64), rows);
            }
        };
    }

    private static JwtAuthenticationToken learner() {
        Jwt jwt = Jwt.withTokenValue("verified").header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("tenant_id", "platform").claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.session.write", "assessment.session.read"))
                .claim("adult_gate", "PASSED").claim("consent_state", "GRANTED").build();
        return new JwtAuthenticationToken(jwt, List.of(), SUBJECT);
    }

    private final class BankJdbc extends JdbcTemplate {
        private final Map<String, Map<String, Object>> sessions = new HashMap<>();
        private final Map<String, Map<String, Object>> claims = new HashMap<>();
        private final List<String> ruleQueries = new ArrayList<>();

        @Override
        public int update(String sql, Object... args) {
            if (sql.contains("INSERT IGNORE INTO assessment_idempotency")) {
                Map<String, Object> claim = new HashMap<>();
                claim.put("request_digest", args[4]);
                claim.put("response_json", "{}");
                claims.put(String.valueOf(args[3]), claim);
                return 1;
            }
            if (sql.contains("UPDATE assessment_idempotency")) {
                claims.get(String.valueOf(args[4])).put("response_json", args[0]);
                return 1;
            }
            if (sql.contains("INSERT INTO b10_assessment_session")) {
                Map<String, Object> row = new HashMap<>();
                row.put("session_id", args[0]);
                row.put("principal_id", args[1]);
                row.put("tenant_id", args[2]);
                row.put("mode", args[3]);
                row.put("status", "IN_PROGRESS");
                row.put("content_code", args[4]);
                row.put("content_version_id", args[5]);
                row.put("alternative_content_version_id", args[6]);
                row.put("alternative_content_code", args[7]);
                row.put("alternative_reason_code", args[8]);
                row.put("content_epoch", args[9]);
                row.put("snapshot_id", args[10]);
                row.put("snapshot_hash", args[11]);
                row.put("items_json", args[12]);
                row.put("state_version", 1L);
                row.put("attempt_count", 0);
                row.put("idempotency_key", args[13]);
                row.put("started_at", java.sql.Timestamp.from(Instant.now()));
                sessions.put(String.valueOf(args[0]), row);
                return 1;
            }
            throw new AssertionError("Unexpected B10 bank write: " + sql);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            if (sql.contains("FROM b25_assessment_item_rule")) {
                ruleQueries.add(String.valueOf(args[0]) + ":" + args[1]);
                return List.of();
            }
            if (sql.contains("FROM b10_assessment_session") && sql.contains("status = 'IN_PROGRESS'")) {
                return List.of();
            }
            if (sql.contains("FROM b10_assessment_session") && sql.contains("idempotency_key")) {
                return sessions.values().stream()
                        .filter(row -> row.get("idempotency_key") != null
                                && String.valueOf(args[2]).equals(String.valueOf(row.get("idempotency_key"))))
                        .map(row -> (Map<String, Object>) new LinkedHashMap<>(row)).toList();
            }
            if (sql.contains("FROM b10_assessment_session WHERE session_id")) {
                Map<String, Object> row = sessions.get(String.valueOf(args[0]));
                return row == null ? List.of() : List.of((Map<String, Object>) new LinkedHashMap<>(row));
            }
            if (sql.contains("FROM assessment_idempotency")) {
                Map<String, Object> claim = claims.get(String.valueOf(args[3]));
                return claim == null ? List.of() : List.of((Map<String, Object>) new LinkedHashMap<>(claim));
            }
            throw new AssertionError("Unexpected B10 bank read: " + sql);
        }
    }
}
