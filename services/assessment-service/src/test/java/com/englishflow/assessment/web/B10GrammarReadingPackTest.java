package com.englishflow.assessment.web;

import com.englishflow.assessment.domain.GrammarReadingPack;
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

/** Grammar and reading packs close when short and do not call the substitute. */
class B10GrammarReadingPackTest {
    private static final String SUBJECT = "prn_learner0000000001";
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @SuppressWarnings("unchecked")
    void fourGrammarRulesOpenAsThreeItems() {
        PackJdbc jdbc = new PackJdbc(grammarRules(4));
        B10AssessmentJdbcController controller = controller(jdbc);
        Map<String, Object> data = (Map<String, Object>) controller.createSession(learner(),
                Map.of("contentCode", "p1-b3-grammar-01", "contentVersionId", 44,
                        "mode", "PRACTICE"),
                "r1-044-grammar-4", "Bearer pack").get("data");
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        assertEquals(3, items.size());
        assertEquals("GRAMMAR", items.getFirst().get("itemType"));
        assertEquals(List.of("g1", "g2", "g3"), items.stream().map(item -> String.valueOf(item.get("itemCode"))).toList());
        assertEquals(1, jdbc.sessions.size());
    }

    @Test
    void aShortGrammarPackClosesBeforeAnyWrite() {
        PackJdbc jdbc = new PackJdbc(grammarRules(2));
        B10AssessmentJdbcController controller = controller(jdbc);
        ResponseStatusException closed = assertThrows(ResponseStatusException.class,
                () -> controller.createSession(learner(),
                        Map.of("contentCode", "p1-b3-grammar-01", "contentVersionId", 44,
                                "mode", "PRACTICE"),
                        "r1-044-grammar-short", "Bearer pack"));
        assertEquals(HttpStatus.CONFLICT, closed.getStatusCode());
        assertEquals(GrammarReadingPack.CLOSED_MISSING, closed.getReason());
        assertTrue(jdbc.sessions.isEmpty());
        assertTrue(jdbc.writes.isEmpty());
    }

    @Test
    @SuppressWarnings("unchecked")
    void aNamedGrammarItemStaysUntrimmed() {
        PackJdbc jdbc = new PackJdbc(grammarRules(1));
        B10AssessmentJdbcController controller = controller(jdbc);
        Map<String, Object> data = (Map<String, Object>) controller.createSession(learner(),
                Map.of("contentCode", "p1-b3-grammar-01", "contentVersionId", 44,
                        "mode", "PRACTICE", "itemIds", List.of("g1")),
                "r1-044-grammar-named", "Bearer pack").get("data");
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        assertEquals(1, items.size());
        assertEquals("g1", String.valueOf(items.getFirst().get("itemCode")));
    }

    @Test
    void aShortReadingPackCloses() {
        PackJdbc jdbc = new PackJdbc(List.of(rule("r1", "READING")));
        B10AssessmentJdbcController controller = controller(jdbc);
        ResponseStatusException closed = assertThrows(ResponseStatusException.class,
                () -> controller.createSession(learner(),
                        Map.of("contentCode", "unit-rdg-01", "contentVersionId", 44,
                                "mode", "PRACTICE"),
                        "r1-044-reading-short", "Bearer pack"));
        assertEquals(GrammarReadingPack.CLOSED_MISSING, closed.getReason());
        assertTrue(jdbc.writes.isEmpty());
    }

    private B10AssessmentJdbcController controller(PackJdbc jdbc) {
        return new B10AssessmentJdbcController(jdbc, mapper, "http://127.0.0.1:9");
    }

    private static List<Map<String, Object>> grammarRules(int count) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int index = 1; index <= count; index++) rows.add(rule("g" + index, "GRAMMAR"));
        return rows;
    }

    private static Map<String, Object> rule(String id, String dimension) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("item_id", id);
        row.put("content_version_id", 44L);
        row.put("prompt", "Item " + id);
        row.put("options_json", "[{\"optionId\":\"a\",\"label\":\"A\"}]");
        row.put("dimension", dimension);
        row.put("answer_rule_json", "{\"answer\":\"a\"}");
        return row;
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

    private static final class PackJdbc extends JdbcTemplate {
        private final List<Map<String, Object>> rules;
        private final Map<String, Map<String, Object>> sessions = new HashMap<>();
        private final Map<String, Map<String, Object>> claims = new HashMap<>();
        private final List<String> writes = new ArrayList<>();

        private PackJdbc(List<Map<String, Object>> rules) {
            this.rules = rules;
        }

        @Override
        public int update(String sql, Object... args) {
            writes.add(sql);
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
            throw new AssertionError("Unexpected pack write: " + sql);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            if (sql.contains("FROM b25_assessment_item_rule")) return List.copyOf(rules);
            if (sql.contains("FROM b10_assessment_session") && sql.contains("status = 'IN_PROGRESS'")) return List.of();
            if (sql.contains("FROM b10_assessment_session") && sql.contains("idempotency_key")) return List.of();
            if (sql.contains("FROM b10_assessment_session WHERE session_id")) {
                Map<String, Object> row = sessions.get(String.valueOf(args[0]));
                return row == null ? List.of() : List.of(new LinkedHashMap<>(row));
            }
            if (sql.contains("FROM assessment_idempotency")) {
                Map<String, Object> claim = claims.get(String.valueOf(args[3]));
                return claim == null ? List.of() : List.of(new LinkedHashMap<>(claim));
            }
            throw new AssertionError("Unexpected pack read: " + sql);
        }
    }
}
