package com.englishflow.assessment.web;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class B10SessionCreationIdempotencyTest {
    private static final String SUBJECT = "prn_learner0000000001";

    @Test
    void existingSessionCanReplayButCannotReuseKeyForDifferentMode() {
        ExistingSessionJdbc jdbc = new ExistingSessionJdbc();
        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(jdbc, new ObjectMapper(),
                "http://127.0.0.1:18089");
        Map<String, Object> original = Map.of("mode", "PRACTICE", "contentVersionId", 25001,
                "clientSessionRef", "existing-session-key");

        Map<String, Object> replay = controller.createSession(learner(), original, "existing-session-key", null);
        assertEquals("asess_existing", ((Map<?, ?>) replay.get("data")).get("sessionId"));

        ResponseStatusException conflict = assertThrows(ResponseStatusException.class,
                () -> controller.createSession(learner(),
                        Map.of("mode", "MOCK", "contentVersionId", 25001,
                                "clientSessionRef", "existing-session-key"),
                        "existing-session-key", null));
        assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
        for (Map<String, Object> uncheckableLegacyBody : List.of(
                Map.<String, Object>of("mode", "PRACTICE", "contentVersionId", 25001,
                        "clientSessionRef", "changed-ref"),
                Map.<String, Object>of("mode", "PRACTICE", "contentVersionId", 25001,
                        "itemIds", List.of(1)),
                Map.<String, Object>of("mode", "PRACTICE", "contentVersionId", 25001,
                        "ownerId", "someone-else"))) {
            ResponseStatusException unsafeReplay = assertThrows(ResponseStatusException.class,
                    () -> controller.createSession(learner(), uncheckableLegacyBody,
                            "existing-session-key", null));
            assertEquals(HttpStatus.CONFLICT, unsafeReplay.getStatusCode());
        }
    }

    @Test
    void newSessionStoresCanonicalRequestAndReplaysOriginalResponseOnlyForSameBody() throws Exception {
        NewSessionJdbc jdbc = new NewSessionJdbc();
        ObjectMapper mapper = new ObjectMapper();
        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(jdbc, mapper,
                "http://127.0.0.1:18089");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("contentVersionId", 25001);
        request.put("mode", "PRACTICE");
        request.put("clientSessionRef", "new-session-key");
        Map<String, Object> first = controller.createSession(learner(), request, "new-session-key", null);

        Map<String, Object> reordered = new LinkedHashMap<>();
        reordered.put("clientSessionRef", "new-session-key");
        reordered.put("mode", "PRACTICE");
        reordered.put("contentVersionId", 25001);
        Map<String, Object> replay = controller.createSession(learner(), reordered, "new-session-key", null);
        assertEquals(mapper.writeValueAsString(first), mapper.writeValueAsString(replay));
        jdbc.hideNextSessionLookup = true;
        Map<String, Object> concurrentReplay = controller.createSession(learner(), reordered,
                "new-session-key", null);
        assertEquals(mapper.writeValueAsString(first), mapper.writeValueAsString(concurrentReplay));
        assertEquals(1, jdbc.sessionWrites);
        assertEquals(1, jdbc.ruleReads);

        for (Map<String, Object> differentBody : List.of(
                Map.<String, Object>of("mode", "MOCK", "contentVersionId", 25001,
                        "clientSessionRef", "new-session-key"),
                Map.<String, Object>of("mode", "PRACTICE", "contentVersionId", 25002,
                        "clientSessionRef", "new-session-key"),
                Map.<String, Object>of("mode", "PRACTICE", "contentVersionId", 25001,
                        "clientSessionRef", "changed-ref"),
                Map.<String, Object>of("mode", "PRACTICE", "contentVersionId", 25001,
                        "clientSessionRef", "new-session-key", "itemIds", List.of(1)))) {
            ResponseStatusException conflict = assertThrows(ResponseStatusException.class,
                    () -> controller.createSession(learner(), differentBody, "new-session-key", null));
            assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
        }
        assertEquals(1, jdbc.sessionWrites);
        assertEquals(1, jdbc.ruleReads);

        Map<String, Object> otherOwner = controller.createSession(learner("prn_learner0000000002"),
                request, "new-session-key", null);
        assertNotEquals(((Map<?, ?>) first.get("data")).get("sessionId"),
                ((Map<?, ?>) otherOwner.get("data")).get("sessionId"));
        assertEquals(2, jdbc.sessionWrites);
    }

    @Test
    void secondOpenOfTheSameContentReusesTheInProgressSession() throws Exception {
        NewSessionJdbc jdbc = new NewSessionJdbc();
        ObjectMapper mapper = new ObjectMapper();
        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(jdbc, mapper,
                "http://127.0.0.1:18089");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("contentVersionId", 25001);
        request.put("mode", "PRACTICE");
        request.put("clientSessionRef", "open-a");
        Map<String, Object> first = controller.createSession(learner(), request, "open-key-a", null);
        Map<String, Object> again = new LinkedHashMap<>(request);
        again.put("clientSessionRef", "open-b");
        Map<String, Object> second = controller.createSession(learner(), again, "open-key-b", null);
        assertEquals(((Map<?, ?>) first.get("data")).get("sessionId"),
                ((Map<?, ?>) second.get("data")).get("sessionId"));
        assertEquals(1, jdbc.sessionWrites);

        Map<String, Object> otherMode = new LinkedHashMap<>();
        otherMode.put("contentVersionId", 25001);
        otherMode.put("mode", "REVIEW");
        otherMode.put("clientSessionRef", "open-c");
        Map<String, Object> third = controller.createSession(learner(), otherMode, "open-key-c", null);
        assertNotEquals(((Map<?, ?>) first.get("data")).get("sessionId"),
                ((Map<?, ?>) third.get("data")).get("sessionId"));
        assertEquals(2, jdbc.sessionWrites);
    }

    private static JwtAuthenticationToken learner() {
        return learner(SUBJECT);
    }

    private static JwtAuthenticationToken learner(String subject) {
        Jwt jwt = Jwt.withTokenValue("verified").header("alg", "RS256").subject(subject)
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.session.write"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, List.of(), subject);
    }

    private static final class ExistingSessionJdbc extends JdbcTemplate {
        private final Map<String, Object> session = new HashMap<>();

        ExistingSessionJdbc() {
            session.put("session_id", "asess_existing");
            session.put("principal_id", SUBJECT);
            session.put("tenant_id", "platform");
            session.put("idempotency_key", "existing-session-key");
            session.put("status", "IN_PROGRESS");
            session.put("mode", "PRACTICE");
            session.put("content_code", "course-b25-basics");
            session.put("content_version_id", 25001L);
            session.put("content_epoch", 1L);
            session.put("snapshot_id", 25001L);
            session.put("snapshot_hash", "0".repeat(63) + "1");
            session.put("items_json", "[]");
            session.put("attempt_count", 0);
            session.put("state_version", 1L);
            session.put("started_at", Timestamp.from(Instant.parse("2026-09-23T00:00:00Z")));
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            if (sql.contains("FROM b10_assessment_session") && sql.contains("idempotency_key = ?")) {
                return SUBJECT.equals(args[1]) && "existing-session-key".equals(args[2])
                        ? List.of(session) : List.of();
            }
            if (sql.contains("FROM assessment_idempotency")) return List.of();
            throw new AssertionError("unexpected query: " + sql);
        }
    }

    private static final class NewSessionJdbc extends JdbcTemplate {
        private final Map<String, Map<String, Object>> claims = new HashMap<>();
        private final Map<String, Map<String, Object>> sessions = new HashMap<>();
        private int sessionWrites;
        private int ruleReads;
        private boolean hideNextSessionLookup;
        private boolean requireCurrentRead;

        @Override
        public int update(String sql, Object... args) {
            if (sql.contains("INSERT IGNORE INTO assessment_idempotency")) {
                String key = args[1] + "|" + args[2] + "|" + args[3];
                if (claims.containsKey(key)) return 0;
                claims.put(key, new HashMap<>(Map.of("request_digest", args[4], "response_json", args[5])));
                return 1;
            }
            if (sql.contains("INSERT INTO b10_assessment_session")) {
                sessionWrites++;
                Map<String, Object> row = new HashMap<>();
                row.put("session_id", args[0]);
                row.put("principal_id", args[1]);
                row.put("tenant_id", args[2]);
                row.put("mode", args[3]);
                row.put("status", "IN_PROGRESS");
                row.put("content_code", args[4]);
                row.put("content_version_id", args[5]);
                row.put("alternative_content_version_id", args[6]);
                row.put("content_epoch", args[9]);
                row.put("snapshot_id", args[10]);
                row.put("snapshot_hash", args[11]);
                row.put("items_json", args[12]);
                row.put("idempotency_key", args[13]);
                row.put("attempt_count", 0);
                row.put("state_version", 1L);
                row.put("started_at", Timestamp.from(Instant.parse("2026-09-23T00:00:00Z")));
                sessions.put(args[1] + "|" + args[13], row);
                return 1;
            }
            if (sql.contains("UPDATE assessment_idempotency SET response_json")) {
                String key = args[2] + "|" + args[3] + "|" + args[4];
                Map<String, Object> stored = claims.get(key);
                if (stored == null) return 0;
                stored.put("response_json", args[0]);
                return 1;
            }
            throw new AssertionError("unexpected update: " + sql);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            if (sql.contains("FROM b10_assessment_session") && sql.contains("idempotency_key = ?")) {
                if (hideNextSessionLookup) {
                    hideNextSessionLookup = false;
                    requireCurrentRead = true;
                    return List.of();
                }
                if (requireCurrentRead) {
                    assertTrue(sql.contains("FOR UPDATE"), "raced session needs a current read");
                    requireCurrentRead = false;
                }
                Map<String, Object> row = sessions.get(args[1] + "|" + args[2]);
                return row == null ? List.of() : List.of(row);
            }
            if (sql.contains("FROM b10_assessment_session") && sql.contains("status = 'IN_PROGRESS'")) {
                return sessions.values().stream().filter(row -> args[1].equals(row.get("principal_id"))
                        && "IN_PROGRESS".equals(row.get("status"))
                        && args[2].equals(row.get("content_code"))
                        && args[3] instanceof Number requested
                        && row.get("content_version_id") instanceof Number stored
                        && requested.longValue() == stored.longValue()
                        && args[4].equals(row.get("mode"))).toList();
            }
            if (sql.contains("FROM b10_assessment_session") && sql.contains("session_id = ?")) {
                return sessions.values().stream().filter(row -> args[0].equals(row.get("session_id"))).toList();
            }
            if (sql.contains("FROM assessment_idempotency")) {
                assertTrue(sql.contains("FOR SHARE"),
                        "claim replay needs a current read without upgrading a duplicate insert's shared lock");
                Map<String, Object> row = claims.get(args[1] + "|" + args[2] + "|" + args[3]);
                return row == null ? List.of() : List.of(row);
            }
            if (sql.contains("FROM b25_assessment_item_rule")) {
                ruleReads++;
                return List.of(Map.of("item_id", "fixture-1", "content_version_id", 25001L,
                        "prompt", "Fixture question", "options_json", "[]", "dimension", "VOCABULARY",
                        "difficulty", 1, "answer_rule_json", "{}"));
            }
            throw new AssertionError("unexpected query: " + sql);
        }
    }
}
