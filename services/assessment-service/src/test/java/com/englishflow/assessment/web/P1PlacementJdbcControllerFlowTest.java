package com.englishflow.assessment.web;

import com.englishflow.assessment.domain.ContentSnapshot;
import com.englishflow.assessment.domain.P1PlacementScorer;
import com.englishflow.assessment.domain.QuestionType;
import com.englishflow.assessment.port.AssessmentOutboxPort;
import com.englishflow.assessment.port.P1PlacementSourcePort;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** A synthetic source tests the owner flow without pretending content-service is ready. */
class P1PlacementJdbcControllerFlowTest {
    private static final String SUBJECT = "prn_learner0000000001";
    private final ObjectMapper mapper = new ObjectMapper();
    private final OwnerJdbc jdbc = new OwnerJdbc();
    private final List<AssessmentOutboxPort.AssessmentOutboxEvent> events = new ArrayList<>();
    private final P1PlacementJdbcController controller = new P1PlacementJdbcController(
            jdbc, mapper, ignored -> source(), events::add);

    @Test
    void tenObjectiveResponsesCheckpointAndFreezeOneImmutableOwnerReport() throws Exception {
        Map<String, Object> first = data(controller.create(learner(), Map.of(), "p1-create-key-0001").getBody());
        String sessionId = String.valueOf(first.get("sessionId"));
        assertEquals("CREATED", first.get("status"));
        assertEquals(1L, ((Number) first.get("stateVersion")).longValue());
        assertEquals(1L, ((Number) currentItem(first).get("itemId")).longValue());
        assertEquals(normalized(first), normalized(
                data(controller.create(learner(), Map.of(), "p1-create-key-0001").getBody())));
        assertEquals(1, jdbc.sessions.size());

        for (int i = 1; i <= 10; i++) {
            String key = "p1-response-key-" + String.format("%04d", i);
            Map<String, Object> body = response(i, i == 1 ? "b" : "a");
            Map<String, Object> receipt = data(controller.respond(learner(), sessionId, body, key, "state-" + i));
            assertEquals(i + 1L, ((Number) receipt.get("stateVersion")).longValue());
            assertEquals(normalized(receipt), normalized(
                    data(controller.respond(learner(), sessionId, body, key, "state-" + i))));
            if (i < 10) {
                assertEquals("IN_PROGRESS", receipt.get("status"));
                assertEquals((long) i + 1, ((Number) currentItem(Map.of("currentItem", receipt.get("nextItem")))
                        .get("itemId")).longValue());
                assertEquals(i + 1L, ((Number) data(controller.read(learner(), sessionId))
                        .get("stateVersion")).longValue());
            } else {
                assertEquals("COMPLETED", receipt.get("status"));
                Map<String, Object> result = object(receipt.get("finalResult"));
                assertEquals("ASSESSED", result.get("resultKind"));
                assertEquals(92, result.get("aggregateScore"));
                assertEquals("C1", result.get("referenceLevel"));
                assertEquals("HIGH", result.get("confidence"));
                assertEquals(normalized(result), normalized(
                        data(controller.read(learner(), sessionId)).get("completedResult")));
                Map<String, Object> report = data(controller.report(learner(),
                        String.valueOf(result.get("reportId"))));
                assertEquals(normalized(result), normalized(report.get("result")));
            }
        }
        assertEquals(10, jdbc.responses.size());
        assertEquals(10, jdbc.checkpoints.size());
        assertEquals(1, jdbc.results.size());
        assertEquals(1, events.size());
        assertEquals("assessment.placement.completed.v1", events.getFirst().eventName());
        ResponseStatusException changedBody = assertThrows(ResponseStatusException.class,
                () -> controller.respond(learner(), sessionId, response(10, "b"),
                        "p1-response-key-0010", "state-10"));
        assertEquals(HttpStatus.CONFLICT, changedBody.getStatusCode());
        assertEquals(10, jdbc.responses.size());
    }

    @Test
    void skipIsAnUnverifiedBaselineAndItsKeyCannotBecomeAnotherCommand() throws Exception {
        Map<String, Object> hint = Map.of("requestedStartingLevel",
                Map.of("level", "B2", "authority", "USER_SELECTED_NON_AUTHORITATIVE"));
        Map<String, Object> skipped = data(controller.skip(learner(), hint, "p1-skip-key-00001").getBody());
        assertEquals("SKIPPED", skipped.get("status"));
        assertEquals("SKIPPED", skipped.get("resultKind"));
        assertEquals("USER_SKIP", skipped.get("baselineSource"));
        assertEquals("UNVERIFIED", skipped.get("confidence"));
        assertFalse(skipped.containsKey("reportId"));
        assertFalse(skipped.containsKey("digest"));
        assertFalse(skipped.containsKey("aggregateScore"));
        assertFalse(skipped.containsKey("referenceLevel"));
        assertFalse(skipped.containsKey("dimensionSummaries"));
        assertEquals(normalized(skipped), normalized(
                data(controller.skip(learner(), hint, "p1-skip-key-00001").getBody())));
        Map<String, Object> session = data(controller.read(learner(), String.valueOf(skipped.get("sessionId"))));
        assertEquals("SKIPPED", session.get("status"));
        assertEquals("USER_SKIP", session.get("baselineSource"));
        assertFalse(session.containsKey("completedResult"));
        assertEquals(1, jdbc.sessions.size());
        assertEquals(0, jdbc.results.size());
        assertEquals(0, events.size());

        ResponseStatusException different = assertThrows(ResponseStatusException.class,
                () -> controller.skip(learner(), Map.of(), "p1-skip-key-00001"));
        assertEquals(HttpStatus.CONFLICT, different.getStatusCode());
        ResponseStatusException anotherCommand = assertThrows(ResponseStatusException.class,
                () -> controller.create(learner(), Map.of(), "p1-skip-key-00001"));
        assertEquals(HttpStatus.CONFLICT, anotherCommand.getStatusCode());
        assertEquals(1, jdbc.sessions.size());
    }

    @Test
    void staleCheckpointAndForeignOwnerCannotMutateOrReadTheSession() {
        String sessionId = String.valueOf(data(controller.create(learner(), Map.of(),
                "p1-create-key-0002").getBody()).get("sessionId"));
        ResponseStatusException stale = assertThrows(ResponseStatusException.class,
                () -> controller.respond(learner(), sessionId, response(2, "a"),
                        "p1-response-key-stale", "state-2"));
        assertEquals(HttpStatus.CONFLICT, stale.getStatusCode());
        ResponseStatusException wrongTag = assertThrows(ResponseStatusException.class,
                () -> controller.respond(learner(), sessionId, response(1, "a"),
                        "p1-response-key-tag", "state-2"));
        assertEquals(HttpStatus.CONFLICT, wrongTag.getStatusCode());
        assertEquals(0, jdbc.responses.size());

        JwtAuthenticationToken foreign = learner("prn_otherlearner0000001");
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> controller.read(foreign, sessionId)).getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> controller.respond(foreign, sessionId, response(1, "a"),
                        "p1-response-key-foreign", "state-1")).getStatusCode());
        assertEquals(0, jdbc.responses.size());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    private static Map<String, Object> object(Object value) {
        assertNotNull(value);
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) value;
        return result;
    }

    private static Map<String, Object> currentItem(Map<String, Object> view) {
        return object(view.get("currentItem"));
    }

    private static Map<String, Object> response(int sequence, String option) {
        return Map.of("expectedStateVersion", sequence, "itemId", (long) sequence,
                "itemSequence", sequence, "candidateResponse",
                Map.of("responseType", "CHOICE", "selectedOptionIds", List.of(option)),
                "responseDigest", "a".repeat(64), "timeSpentSec", 15);
    }

    private Object normalized(Object value) throws Exception {
        return mapper.readValue(mapper.writeValueAsString(value), Object.class);
    }

    private static JwtAuthenticationToken learner() {
        return learner(SUBJECT);
    }

    private static JwtAuthenticationToken learner(String subject) {
        Jwt jwt = Jwt.withTokenValue("verified")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.placement.session.create",
                        "assessment.placement.session.read", "assessment.placement.response.submit",
                        "assessment.placement.skip", "assessment.placement.report.read"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, List.of(), subject);
    }

    private static P1PlacementSourcePort.Resolved source() {
        List<P1PlacementSourcePort.SealedItem> items = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            P1PlacementScorer.Dimension dimension = i <= 3 ? P1PlacementScorer.Dimension.VOCABULARY
                    : i <= 6 ? P1PlacementScorer.Dimension.BASIC_GRAMMAR
                    : i <= 8 ? P1PlacementScorer.Dimension.READING : P1PlacementScorer.Dimension.LISTENING;
            String type = switch (dimension) {
                case VOCABULARY -> "VOCABULARY";
                case BASIC_GRAMMAR -> "GRAMMAR";
                case READING -> "READING";
                case LISTENING -> "LISTENING";
            };
            items.add(new P1PlacementSourcePort.SealedItem(i, dimension,
                    Map.of("itemId", (long) i, "itemCode", "p1.item." + i,
                            "itemType", type, "stem", "Choose the correct word",
                            "options", List.of(Map.of("optionId", "a", "label", "Correct"),
                                    Map.of("optionId", "b", "label", "Incorrect"))),
                    new ContentSnapshot("p1.placement", 22, i, i, QuestionType.CHOICE,
                            Map.of("stem", "Choose the correct word"),
                            Map.of("correctOptionKeys", List.of("a")), "rule-v1", 1, true)));
        }
        return new P1PlacementSourcePort.Resolved(
                Map.of("targetId", 7L, "targetVersion", 2L, "targetSnapshotDigest", "c".repeat(64)),
                Map.of("contentVersionId", 22L, "contentEpoch", 0L,
                        "snapshotId", "snap_placement01", "snapshotHash", "a".repeat(64)),
                Map.of("answerRuleSetVersion", "set-v1", "answerRuleVersion", "rule-v1",
                        "ruleDigest", "b".repeat(64), "completionRuleVersion", "P1_PLACEMENT_V1"),
                items, true, true, true, true, true);
    }

    private final class OwnerJdbc extends JdbcTemplate {
        private final Map<String, Map<String, Object>> sessions = new HashMap<>();
        private final Map<String, Map<String, Object>> idempotency = new HashMap<>();
        private final Map<String, Map<String, Object>> results = new HashMap<>();
        private final List<Map<String, Object>> responses = new ArrayList<>();
        private final List<Map<String, Object>> checkpoints = new ArrayList<>();

        @Override
        public int update(String sql, Object... args) {
            if (sql.contains("INSERT INTO p1_placement_idempotency")) {
                Map<String, Object> row = new HashMap<>();
                row.put("operation", args[3]);
                row.put("request_digest", args[4]);
                row.put("response_json", "{}");
                idempotency.put(String.valueOf(args[2]), row);
                return 1;
            }
            if (sql.contains("UPDATE p1_placement_idempotency")) {
                idempotency.get(String.valueOf(args[3])).put("response_json", args[0]);
                return 1;
            }
            if (sql.contains("INSERT INTO p1_placement_session")) {
                Map<String, Object> row = new HashMap<>();
                row.put("session_id", args[0]);
                row.put("principal_id", args[1]);
                row.put("tenant_id", args[2]);
                row.put("status", args[3]);
                row.put("state_version", 1L);
                row.put("current_sequence", args[4]);
                row.put("session_snapshot_digest", args[5]);
                row.put("manifest_json", args[6]);
                row.put("content_pin_json", args[7]);
                row.put("answer_rule_pin_json", args[8]);
                row.put("target_pin_json", args[9]);
                row.put("learner_items_json", args[10]);
                row.put("sealed_items_json", args[11]);
                row.put("started_at", args[12]);
                row.put("updated_at", args[13]);
                sessions.put(String.valueOf(args[0]), row);
                return 1;
            }
            if (sql.contains("INSERT INTO p1_placement_response")) {
                responses.add(Map.of("session_id", args[0], "item_id", args[2], "correct", args[7]));
                return 1;
            }
            if (sql.contains("INSERT INTO p1_placement_checkpoint")) {
                checkpoints.add(Map.of("session_id", args[0], "state_version", args[1]));
                return 1;
            }
            if (sql.contains("UPDATE p1_placement_session") && sql.contains("baseline_json")) {
                Map<String, Object> row = sessions.get(String.valueOf(args[2]));
                if (row == null) return 0;
                String status = String.valueOf(row.get("status"));
                if (!"CREATED".equals(status) && !"IN_PROGRESS".equals(status) && !"SKIPPED".equals(status)) {
                    return 0;
                }
                row.put("status", "SKIPPED");
                row.put("baseline_json", args[0]);
                row.put("updated_at", args[1]);
                return 1;
            }
            if (sql.contains("UPDATE p1_placement_session")) {
                Map<String, Object> row = sessions.get(String.valueOf(args[4]));
                if (!row.get("state_version").equals(args[7])) return 0;
                row.put("status", args[0]);
                row.put("state_version", args[1]);
                row.put("current_sequence", args[2]);
                row.put("updated_at", args[3]);
                return 1;
            }
            if (sql.contains("INSERT INTO p1_placement_result")) {
                Map<String, Object> row = new HashMap<>();
                row.put("placement_result_id", args[0]);
                row.put("session_id", args[1]);
                row.put("report_id", args[2]);
                row.put("principal_id", args[3]);
                row.put("tenant_id", args[4]);
                row.put("result_kind", args[5]);
                row.put("result_json", args[6]);
                row.put("report_json", args[7]);
                results.put(String.valueOf(args[1]), row);
                return 1;
            }
            throw new AssertionError("Unexpected placement write: " + sql);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            if (sql.contains("FROM p1_placement_idempotency")) {
                return row(idempotency.get(String.valueOf(args[2])));
            }
            if (sql.contains("FROM p1_placement_session")) {
                return row(sessions.get(String.valueOf(args[0])));
            }
            if (sql.contains("SELECT item_id, correct FROM p1_placement_response")) {
                return responses.stream().filter(value -> value.get("session_id").equals(args[0]))
                        .map(value -> Map.of("item_id", value.get("item_id"),
                                "correct", value.get("correct"))).toList();
            }
            if (sql.contains("FROM p1_placement_response") && sql.contains("request_digest")) {
                return List.of();
            }
            if (sql.contains("FROM p1_placement_result") && sql.contains("report_id = ?")) {
                return results.values().stream()
                        .filter(value -> value.get("report_id").equals(args[0])).toList();
            }
            if (sql.contains("FROM p1_placement_result") && sql.contains("session_id = ?")) {
                Map<String, Object> result = results.get(String.valueOf(args[0]));
                return result == null ? List.of() : List.of(Map.of("result_json", result.get("result_json")));
            }
            throw new AssertionError("Unexpected placement read: " + sql);
        }

        private List<Map<String, Object>> row(Map<String, Object> value) {
            return value == null ? List.of() : List.of(new LinkedHashMap<>(value));
        }
    }
}
