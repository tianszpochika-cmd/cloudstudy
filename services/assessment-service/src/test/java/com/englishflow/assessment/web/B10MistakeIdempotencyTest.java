package com.englishflow.assessment.web;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class B10MistakeIdempotencyTest {

    private static final String SUBJECT = "prn_learner0000000001";

    @Test
    void verifyReplaysStoredResponseAndRejectsDifferentRequestWithoutAnotherWrite() throws Exception {
        FakeJdbc jdbc = new FakeJdbc();
        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(jdbc, new ObjectMapper(),
                "http://127.0.0.1:18089");

        Map<String, Object> first = controller.verifyMistake(learner(), 1, Map.of("outcome", "CORRECT"), "verify-key");
        Map<String, Object> replay = controller.verifyMistake(learner(), 1, Map.of("outcome", "CORRECT"), "verify-key");

        assertEquals(new ObjectMapper().writeValueAsString(first), new ObjectMapper().writeValueAsString(replay));
        assertEquals("DELAY_VERIFY_D1", ((Map<?, ?>) first.get("data")).get("mistakeStatus"));
        assertEquals(1, jdbc.mistakeWrites);
        ResponseStatusException conflict = assertThrows(ResponseStatusException.class,
                () -> controller.verifyMistake(learner(), 1, Map.of("outcome", "WRONG"), "verify-key"));
        assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
        assertEquals(1, jdbc.mistakeWrites);
    }

    @Test
    void variantReplaysStoredResponseAndScopesDigestToMistakeId() throws Exception {
        FakeJdbc jdbc = new FakeJdbc();
        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(jdbc, new ObjectMapper(),
                "http://127.0.0.1:18089");

        Map<String, Object> first = controller.issueVariant(learner(), 1, Map.of("variantItemId", 200), "variant-key");
        Map<String, Object> replay = controller.issueVariant(learner(), 1, Map.of("variantItemId", 200), "variant-key");

        assertEquals(new ObjectMapper().writeValueAsString(first), new ObjectMapper().writeValueAsString(replay));
        assertEquals(1, jdbc.mistakeWrites);
        for (Runnable differentRequest : List.<Runnable>of(
                () -> controller.issueVariant(learner(), 1, Map.of("variantItemId", 201), "variant-key"),
                () -> controller.issueVariant(learner(), 2, Map.of("variantItemId", 200), "variant-key"))) {
            ResponseStatusException conflict = assertThrows(ResponseStatusException.class, differentRequest::run);
            assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
        }
        assertEquals(1, jdbc.mistakeWrites);
    }

    private static JwtAuthenticationToken learner() {
        Jwt jwt = Jwt.withTokenValue("verified")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.session.write"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, List.of(), SUBJECT);
    }

    /** The controller's SQL claim and response storage, with a single seeded owner fact. */
    private static final class FakeJdbc extends JdbcTemplate {
        private final Map<String, Map<String, Object>> idempotency = new HashMap<>();
        private final Map<String, Object> mistake = new HashMap<>();
        private int mistakeWrites;

        private FakeJdbc() {
            Timestamp time = Timestamp.from(Instant.parse("2026-09-22T00:00:00Z"));
            mistake.put("mistake_id", 1L);
            mistake.put("subject_id", SUBJECT);
            mistake.put("tenant_id", "platform");
            mistake.put("item_id", 100L);
            mistake.put("question_id", 100L);
            mistake.put("error_category", "UNCLASSIFIED");
            mistake.put("rule_version", "v1");
            mistake.put("answer_hash", "hash");
            mistake.put("wrong_count", 1);
            mistake.put("mistake_status", "PENDING_RETRY");
            mistake.put("mastery_status", "LEARNING");
            mistake.put("first_error_at", time);
            mistake.put("last_error_at", time);
            mistake.put("next_action_at", time);
            mistake.put("reason_trace_json", "[]");
        }

        @Override
        public int update(String sql, Object... args) {
            if (sql.contains("INSERT IGNORE INTO assessment_idempotency")) {
                String key = args[2] + "|" + args[3];
                if (idempotency.containsKey(key)) return 0;
                idempotency.put(key, Map.of("request_digest", args[4], "response_json", args[5]));
                return 1;
            }
            if (sql.contains("UPDATE assessment_idempotency SET response_json")) {
                String key = args[3] + "|" + args[4];
                Map<String, Object> stored = idempotency.get(key);
                if (stored == null) return 0;
                idempotency.put(key, Map.of("request_digest", stored.get("request_digest"), "response_json", args[0]));
                return 1;
            }
            if (sql.contains("INSERT INTO assessment_mistake")) {
                mistakeWrites++;
                return 1;
            }
            throw new AssertionError("unexpected update: " + sql);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            if (sql.contains("FROM assessment_idempotency")) {
                Map<String, Object> stored = idempotency.get(args[2] + "|" + args[3]);
                return stored == null ? List.of() : List.of(stored);
            }
            if (sql.contains("FROM assessment_mistake")) {
                if (!sql.contains("FOR UPDATE")) throw new AssertionError("mistake write requires a row lock");
                return List.of(mistake);
            }
            throw new AssertionError("unexpected query: " + sql);
        }
    }
}
