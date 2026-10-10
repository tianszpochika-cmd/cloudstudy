package com.englishflow.assessment.web;

import com.englishflow.assessment.domain.P1PlacementScorer;
import com.englishflow.assessment.port.AssessmentOutboxPort;
import com.englishflow.assessment.port.P1PlacementSourcePort;
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
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** R1-020: answer checkpoints on the existing placement response route. No scoring. */
class R1020PlacementCheckpointTest {
    private static final String SUBJECT = "prn_learner0000000001";
    private final ObjectMapper mapper = new ObjectMapper();
    private final OwnerJdbc jdbc = new OwnerJdbc();
    private final List<AssessmentOutboxPort.AssessmentOutboxEvent> events = new ArrayList<>();
    private final int[] bankReads = {0};
    private final P1PlacementJdbcController controller = new P1PlacementJdbcController(
            jdbc, mapper, principal -> {
                if (++bankReads[0] > 1) throw new AssertionError("response must not read the sealed bank");
                return bank();
            }, events::add);

    @Test
    void sequentialAnswersAdvanceTheCheckpointWithoutScoring() throws Exception {
        String sessionId = open();
        long version = 1;
        for (int sequence = 1; sequence <= 10; sequence++) {
            Map<String, Object> receipt = data(controller.respond(learner(), sessionId,
                    response(sequence, version), key("seq", sequence), "state-" + version));
            assertEquals(version + 1, number(receipt.get("stateVersion")));
            assertEquals(sequence, number(receipt.get("acceptedSequence")));
            assertEquals(sequence + 1L, number(receipt.get("nextSequence")));
            assertEquals("IN_PROGRESS", receipt.get("status"));
            assertFalse(receipt.containsKey("finalResult"));
            assertFalse(mapper.writeValueAsString(receipt).contains("correctOption"));
            assertFalse(mapper.writeValueAsString(receipt).contains("FULL"));
            assertFalse(mapper.writeValueAsString(receipt).contains("ZERO"));
            version++;
            Map<String, Object> read = data(controller.read(learner(), sessionId));
            assertEquals(version, number(read.get("stateVersion")));
            assertEquals(sequence, number(read.get("acceptedSequence")));
            assertEquals(sequence + 1L, number(read.get("nextSequence")));
            if (sequence < 10) {
                assertEquals(sequence + 1L, number(item(read.get("currentItem")).get("itemId")));
            } else {
                assertFalse(read.containsKey("currentItem"));
                assertFalse(read.containsKey("completedResult"));
            }
        }
        assertEquals(10, jdbc.responses.size());
        assertEquals(10, jdbc.checkpoints.size());
        assertEquals(0, jdbc.results.size());
        assertEquals(0, events.size());
        assertEquals(1, bankReads[0]);
        assertTrue(jdbc.responses.stream().allMatch(row -> row.get("correct") == null));
        assertFalse(String.valueOf(jdbc.sessions.values().iterator().next().get("sealed_items_json"))
                .contains("correctOption"));
    }

    @Test
    void outOfOrderAndStaleVersionReturn409AndReadStaysOnTheLastCheckpoint() throws Exception {
        String sessionId = open();
        assertConflict(() -> controller.respond(learner(), sessionId, response(2, 1),
                key("ahead", 2), "state-1"));
        Map<String, Object> before = data(controller.read(learner(), sessionId));
        assertEquals(0, number(before.get("acceptedSequence")));
        assertEquals(1, number(before.get("stateVersion")));
        assertEquals(1, number(before.get("nextSequence")));
        assertEquals(0, jdbc.responses.size());
        assertEquals(0, jdbc.checkpoints.size());

        controller.respond(learner(), sessionId, response(1, 1), key("ok", 1), "state-1");
        assertConflict(() -> controller.respond(learner(), sessionId, response(1, 1),
                key("behind", 1), "state-1"));
        assertConflict(() -> controller.respond(learner(), sessionId, response(3, 2),
                key("skip", 3), "state-2"));
        assertConflict(() -> controller.respond(learner(), sessionId, response(2, 1),
                key("stale", 2), "state-1"));

        Map<String, Object> after = data(controller.read(learner(), sessionId));
        assertEquals(1, number(after.get("acceptedSequence")));
        assertEquals(2, number(after.get("stateVersion")));
        assertEquals(2, number(after.get("nextSequence")));
        assertEquals(2L, number(item(after.get("currentItem")).get("itemId")));
        assertEquals(1, jdbc.responses.size());
        assertEquals(1, jdbc.checkpoints.size());
        assertEquals(0, events.size());
    }

    @Test
    void sameKeyAndSameAnswerReplaysTheReceiptWithoutAdvancing() throws Exception {
        String sessionId = open();
        Map<String, Object> body = response(1, 1);
        String idempotencyKey = key("replay", 1);
        Map<String, Object> first = data(controller.respond(learner(), sessionId, body, idempotencyKey, "state-1"));
        Map<String, Object> replay = data(controller.respond(learner(), sessionId, body, idempotencyKey, "state-1"));
        assertEquals(normalized(first), normalized(replay));
        assertEquals(1, jdbc.responses.size());
        assertEquals(1, jdbc.checkpoints.size());
        assertEquals(2, number(data(controller.read(learner(), sessionId)).get("stateVersion")));

        Map<String, Object> changed = new LinkedHashMap<>(body);
        changed.put("candidateResponse", Map.of("responseType", "CHOICE", "selectedOptionIds", List.of("b")));
        assertConflict(() -> controller.respond(learner(), sessionId, changed, idempotencyKey, "state-1"));
        assertEquals(1, jdbc.responses.size());

        jdbc.blankReceipt(idempotencyKey);
        Map<String, Object> recovered = data(controller.respond(learner(), sessionId, body, idempotencyKey, "state-1"));
        assertEquals(normalized(first), normalized(recovered));
        assertEquals(1, jdbc.responses.size());
        assertEquals(1, jdbc.checkpoints.size());
        Map<String, Object> read = data(controller.read(learner(), sessionId));
        assertEquals(1, number(read.get("acceptedSequence")));
        assertEquals(2, number(read.get("stateVersion")));
        assertNull(jdbc.responses.getFirst().get("correct"));
    }

    @Test
    void concurrentSameVersionKeepsTheWinningCheckpoint() throws Exception {
        String sessionId = open();
        controller.respond(learner(), sessionId, response(1, 1), key("base", 1), "state-1");
        jdbc.raceForUpdate = true;
        jdbc.barrier = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Object> left = pool.submit(() -> call(sessionId, 2, 2, key("race", 1)));
            Future<Object> right = pool.submit(() -> call(sessionId, 2, 2, key("race", 2)));
            Object first = left.get(10, TimeUnit.SECONDS);
            Object second = right.get(10, TimeUnit.SECONDS);
            assertEquals(1, successes(first, second));
            assertEquals(1, conflicts(first, second));
        } finally {
            jdbc.raceForUpdate = false;
            pool.shutdownNow();
        }

        Map<String, Object> read = data(controller.read(learner(), sessionId));
        assertEquals(2, number(read.get("acceptedSequence")));
        assertEquals(3, number(read.get("stateVersion")));
        assertEquals(3, number(read.get("nextSequence")));
        assertEquals(2, jdbc.responses.size());
        assertEquals(2, jdbc.checkpoints.size());
        assertEquals(0, jdbc.results.size());
        assertEquals(0, events.size());

        Object againLeft = call(sessionId, 2, 2, key("race", 1));
        Object againRight = call(sessionId, 2, 2, key("race", 2));
        assertEquals(1, successes(againLeft, againRight));
        assertEquals(1, conflicts(againLeft, againRight));
        assertEquals(2, jdbc.responses.size());
        assertEquals(2, jdbc.checkpoints.size());
        assertEquals(3, number(data(controller.read(learner(), sessionId)).get("stateVersion")));
    }

    private String open() {
        Map<String, Object> created = data(controller.create(learner(), Map.of(), "placement-open-key-20").getBody());
        assertEquals("CREATED", created.get("status"));
        assertEquals(0, number(created.get("acceptedSequence")));
        assertEquals(1, number(created.get("stateVersion")));
        return String.valueOf(created.get("sessionId"));
    }

    private Object call(String sessionId, int sequence, long version, String idempotencyKey) {
        try {
            return controller.respond(learner(), sessionId, response(sequence, version), idempotencyKey,
                    "state-" + version);
        } catch (ResponseStatusException failure) {
            return failure;
        }
    }

    private static void assertConflict(org.junit.jupiter.api.function.Executable action) {
        ResponseStatusException failure = assertThrows(ResponseStatusException.class, action);
        assertEquals(HttpStatus.CONFLICT, failure.getStatusCode());
    }

    private static int successes(Object... values) {
        int count = 0;
        for (Object value : values) if (value instanceof Map<?, ?>) count++;
        return count;
    }

    private static int conflicts(Object... values) {
        int count = 0;
        for (Object value : values) {
            if (value instanceof ResponseStatusException failure && failure.getStatusCode() == HttpStatus.CONFLICT) {
                count++;
            }
        }
        return count;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> item(Object value) {
        return (Map<String, Object>) value;
    }

    private static long number(Object value) {
        return ((Number) value).longValue();
    }

    private Object normalized(Object value) throws Exception {
        return mapper.readValue(mapper.writeValueAsString(value), Object.class);
    }

    private static String key(String name, int sequence) {
        return "placement-" + name + "-" + String.format("%04d", sequence);
    }

    private static Map<String, Object> response(int sequence, long version) {
        return Map.of("expectedStateVersion", version, "itemId", (long) sequence, "itemSequence", sequence,
                "candidateResponse", Map.of("responseType", "CHOICE", "selectedOptionIds", List.of("a")),
                "responseDigest", "a".repeat(64), "timeSpentSec", 12);
    }

    private static JwtAuthenticationToken learner() {
        Jwt jwt = Jwt.withTokenValue("verified")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
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
        private volatile boolean raceForUpdate;
        private CyclicBarrier barrier;

        void blankReceipt(String key) {
            synchronized (lock) {
                idempotency.get(key).put("response_json", "{}");
            }
        }

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
            List<Map<String, Object>> rows;
            boolean wait;
            synchronized (lock) {
                rows = queryLocked(sql, args);
                wait = raceForUpdate && sql.contains("FOR UPDATE");
            }
            if (wait) {
                try {
                    barrier.await(5, TimeUnit.SECONDS);
                } catch (Exception failure) {
                    throw new IllegalStateException(failure);
                }
            }
            return rows;
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
