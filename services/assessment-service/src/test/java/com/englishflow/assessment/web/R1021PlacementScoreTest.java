package com.englishflow.assessment.web;

import com.englishflow.assessment.domain.P1PlacementScorer;
import com.englishflow.assessment.port.AssessmentOutboxPort;
import com.englishflow.assessment.port.P1PlacementSourcePort;
import com.englishflow.assessment.port.PlacementRuleScorePort;
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
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** R1-021: answer-free placement receipts are FULL or ZERO, and out-of-order work is not scored. */
class R1021PlacementScoreTest {
    private static final String SUBJECT = "prn_learner0000000001";
    private final ObjectMapper mapper = new ObjectMapper();
    private final OwnerJdbc jdbc = new OwnerJdbc();
    private final List<AssessmentOutboxPort.AssessmentOutboxEvent> events = new ArrayList<>();
    private final AtomicInteger scoreCalls = new AtomicInteger();
    private final AtomicInteger bankReads = new AtomicInteger();
    private boolean scoreUnavailable;
    private final PlacementRuleScorePort scores = (itemId, optionId) -> {
        if (scoreUnavailable) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "placement answer rule is missing");
        }
        scoreCalls.incrementAndGet();
        boolean full = "a".equals(optionId);
        return new PlacementRuleScorePort.RuleScore(full ? "FULL" : "ZERO",
                full ? PlacementRuleScorePort.FULL_EXPLANATION : PlacementRuleScorePort.ZERO_EXPLANATION);
    };
    private final P1PlacementJdbcController controller = new P1PlacementJdbcController(
            jdbc, mapper, principal -> {
                if (bankReads.incrementAndGet() > 1) {
                    throw new AssertionError("scoring must not re-read the sealed bank");
                }
                return bank();
            }, events::add, scores);

    @Test
    void correctAnswerIsFullAndTheReceiptOmitsCorrectOption() throws Exception {
        String sessionId = open();
        Map<String, Object> envelope = controller.respond(learner(), sessionId, response(1, 1, "a"),
                key("full", 1), "state-1");
        Map<String, Object> receipt = data(envelope);
        assertEquals("FULL", receipt.get("outcome"));
        assertEquals(PlacementRuleScorePort.FULL_EXPLANATION, receipt.get("explanation"));
        assertEquals("IN_PROGRESS", receipt.get("status"));
        assertFalse(receipt.containsKey("correctOption"));
        assertFalse(receipt.containsKey("finalResult"));
        String json = mapper.writeValueAsString(envelope);
        assertFalse(json.contains("correctOption"), json);
        assertFalse(json.contains("answerRule"), json);
        assertFalse(String.valueOf(receipt.get("explanation")).contains("Alpha"));
        assertEquals(Boolean.TRUE, jdbc.responses.getFirst().get("correct"));
        assertEquals(1, scoreCalls.get());
        assertEquals(0, jdbc.results.size());
        assertEquals(0, events.size());
        assertEquals(1, bankReads.get());
    }

    @Test
    void wrongAnswerIsZeroAndTheReceiptOmitsCorrectOption() throws Exception {
        String sessionId = open();
        Map<String, Object> envelope = controller.respond(learner(), sessionId, response(1, 1, "b"),
                key("zero", 1), "state-1");
        Map<String, Object> receipt = data(envelope);
        assertEquals("ZERO", receipt.get("outcome"));
        assertEquals(PlacementRuleScorePort.ZERO_EXPLANATION, receipt.get("explanation"));
        String json = mapper.writeValueAsString(envelope);
        assertFalse(json.contains("correctOption"), json);
        assertEquals(Boolean.FALSE, jdbc.responses.getFirst().get("correct"));
        assertEquals(1, scoreCalls.get());
        assertEquals(0, jdbc.results.size());
    }

    @Test
    void outOfOrderDoesNotScore() {
        String sessionId = open();
        assertConflict(() -> controller.respond(learner(), sessionId, response(2, 1, "a"),
                key("ahead", 2), "state-1"));
        Map<String, Object> wrongItem = new LinkedHashMap<>(response(1, 1, "a"));
        wrongItem.put("itemId", 9L);
        assertConflict(() -> controller.respond(learner(), sessionId, wrongItem, key("other", 1), "state-1"));
        assertEquals(0, scoreCalls.get());
        assertEquals(0, jdbc.responses.size());
        assertEquals(0, jdbc.checkpoints.size());

        controller.respond(learner(), sessionId, response(1, 1, "a"), key("ok", 1), "state-1");
        assertEquals(1, scoreCalls.get());
        assertConflict(() -> controller.respond(learner(), sessionId, response(1, 2, "b"),
                key("behind", 1), "state-2"));
        assertConflict(() -> controller.respond(learner(), sessionId, response(2, 1, "a"),
                key("stale", 2), "state-1"));
        assertEquals(1, scoreCalls.get());
        assertEquals(1, jdbc.responses.size());
        assertEquals(Boolean.TRUE, jdbc.responses.getFirst().get("correct"));
    }

    @Test
    void caseAndWhitespaceAreNotFuzzyMatched() {
        String sessionId = open();
        assertUnprocessable(() -> controller.respond(learner(), sessionId, response(1, 1, "A"),
                key("upper", 1), "state-1"));
        assertUnprocessable(() -> controller.respond(learner(), sessionId, response(1, 1, "a "),
                key("trail", 1), "state-1"));
        assertUnprocessable(() -> controller.respond(learner(), sessionId, response(1, 1, " a"),
                key("lead", 1), "state-1"));
        assertEquals(0, scoreCalls.get());
        assertEquals(0, jdbc.responses.size());

        Map<String, Object> several = new LinkedHashMap<>(response(1, 1, "a"));
        several.put("candidateResponse", Map.of("responseType", "CHOICE", "selectedOptionIds", List.of("a", "b")));
        Map<String, Object> receipt = data(controller.respond(learner(), sessionId, several, key("many", 1), "state-1"));
        assertEquals("ZERO", receipt.get("outcome"));
        assertEquals(0, scoreCalls.get());
        assertEquals(Boolean.FALSE, jdbc.responses.getFirst().get("correct"));
    }

    @Test
    void missingAnswerDoesNotInventAnOutcome() {
        String sessionId = open();
        scoreUnavailable = true;
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> controller.respond(learner(), sessionId, response(1, 1, "a"), key("none", 1), "state-1"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failure.getStatusCode());
        assertEquals(0, scoreCalls.get());
        assertEquals(0, jdbc.responses.size());
        assertEquals(0, jdbc.checkpoints.size());
        assertEquals(0, jdbc.results.size());
        assertFalse(String.valueOf(failure.getReason()).contains("correctOption"));
    }

    private String open() {
        Map<String, Object> created = data(controller.create(learner(), Map.of(), key("open", 1)).getBody());
        assertEquals("CREATED", created.get("status"));
        assertFalse(created.containsKey("outcome"));
        return String.valueOf(created.get("sessionId"));
    }

    private static void assertConflict(org.junit.jupiter.api.function.Executable action) {
        ResponseStatusException failure = assertThrows(ResponseStatusException.class, action);
        assertEquals(HttpStatus.CONFLICT, failure.getStatusCode());
    }

    private static void assertUnprocessable(org.junit.jupiter.api.function.Executable action) {
        ResponseStatusException failure = assertThrows(ResponseStatusException.class, action);
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, failure.getStatusCode());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    private static String key(String name, int sequence) {
        return "placement-r1021-" + name + "-" + String.format("%04d", sequence);
    }

    private static Map<String, Object> response(int sequence, long version, String option) {
        return new LinkedHashMap<>(Map.of("expectedStateVersion", version, "itemId", (long) sequence,
                "itemSequence", sequence,
                "candidateResponse", Map.of("responseType", "CHOICE", "selectedOptionIds", List.of(option)),
                "responseDigest", "a".repeat(64), "timeSpentSec", 12));
    }

    private static JwtAuthenticationToken learner() {
        Jwt jwt = Jwt.withTokenValue("verified")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(Instant.parse("2026-10-10T00:00:00Z"))
                .expiresAt(Instant.parse("2026-10-10T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.placement.session.create",
                        "assessment.placement.session.read", "assessment.placement.response.submit"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, List.of(), SUBJECT);
    }

    private static P1PlacementSourcePort.Resolved bank() {
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
                    Map.of("itemId", (long) i, "itemCode", "p1.item." + i, "itemType", type,
                            "stem", "Stem " + i, "options", List.of(
                                    Map.of("optionId", "a", "label", "Alpha"),
                                    Map.of("optionId", "b", "label", "Beta"))),
                    null));
        }
        return new P1PlacementSourcePort.Resolved(
                Map.of("targetId", 7L, "targetVersion", 2L, "targetSnapshotDigest", "c".repeat(64)),
                Map.of("contentVersionId", 22L, "contentEpoch", 0L,
                        "snapshotId", "snap_placement01", "snapshotHash", "a".repeat(64)),
                Map.of("completionRuleVersion", "P1_PLACEMENT_V1"),
                items, true, true, true, true, true);
    }

    private static final class OwnerJdbc extends JdbcTemplate {
        private final Object lock = new Object();
        private final Map<String, Map<String, Object>> sessions = new HashMap<>();
        private final Map<String, Map<String, Object>> idempotency = new HashMap<>();
        private final Map<String, Map<String, Object>> results = new HashMap<>();
        private final List<Map<String, Object>> responses = new ArrayList<>();
        private final List<Map<String, Object>> checkpoints = new ArrayList<>();

        @Override
        public int update(String sql, Object... args) {
            synchronized (lock) {
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
                    Map<String, Object> row = new HashMap<>();
                    row.put("session_id", args[0]);
                    row.put("item_sequence", args[1]);
                    row.put("item_id", args[2]);
                    row.put("principal_id", args[3]);
                    row.put("request_digest", args[6]);
                    row.put("correct", args[7]);
                    row.put("accepted_at", args[9]);
                    responses.add(row);
                    return 1;
                }
                if (sql.contains("INSERT INTO p1_placement_checkpoint")) {
                    Map<String, Object> row = new HashMap<>();
                    row.put("session_id", args[0]);
                    row.put("state_version", args[1]);
                    row.put("principal_id", args[2]);
                    row.put("next_sequence", args[4]);
                    row.put("saved_at", args[6]);
                    checkpoints.add(row);
                    return 1;
                }
                if (sql.contains("UPDATE p1_placement_session")) {
                    Map<String, Object> row = sessions.get(String.valueOf(args[4]));
                    if (row == null || !row.get("state_version").equals(args[7])) return 0;
                    if (args.length > 8 && !row.get("current_sequence").equals(args[8])) return 0;
                    row.put("status", args[0]);
                    row.put("state_version", args[1]);
                    row.put("current_sequence", args[2]);
                    row.put("updated_at", args[3]);
                    return 1;
                }
                if (sql.contains("INSERT INTO p1_placement_result")) {
                    results.put(String.valueOf(args[1]), Map.of("session_id", args[1]));
                    return 1;
                }
                throw new AssertionError("Unexpected placement write: " + sql);
            }
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            synchronized (lock) {
                return queryLocked(sql, args);
            }
        }

        private List<Map<String, Object>> queryLocked(String sql, Object... args) {
            if (sql.contains("FROM p1_placement_idempotency")) {
                return row(idempotency.get(String.valueOf(args[2])));
            }
            if (sql.contains("FROM p1_placement_session")) {
                return row(sessions.get(String.valueOf(args[0])));
            }
            if (sql.contains("FROM p1_placement_response") && sql.contains("request_digest")) {
                return responses.stream()
                        .filter(value -> value.get("session_id").equals(args[0])
                                && value.get("item_sequence").equals(args[3])
                                && value.get("request_digest").equals(args[4]))
                        .map(value -> Map.<String, Object>of("item_sequence", value.get("item_sequence"),
                                "accepted_at", value.get("accepted_at")))
                        .toList();
            }
            if (sql.contains("FROM p1_placement_checkpoint")) {
                return checkpoints.stream()
                        .filter(value -> value.get("session_id").equals(args[0])
                                && value.get("next_sequence").equals(args[3]))
                        .map(value -> {
                            Map<String, Object> copy = new HashMap<>();
                            copy.put("state_version", value.get("state_version"));
                            copy.put("next_sequence", value.get("next_sequence"));
                            copy.put("saved_at", value.get("saved_at"));
                            return copy;
                        }).toList();
            }
            throw new AssertionError("Unexpected placement read: " + sql);
        }

        private static List<Map<String, Object>> row(Map<String, Object> value) {
            return value == null ? List.of() : List.of(new LinkedHashMap<>(value));
        }
    }
}
