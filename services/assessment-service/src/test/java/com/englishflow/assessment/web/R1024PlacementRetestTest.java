package com.englishflow.assessment.web;

import com.englishflow.assessment.domain.P1PlacementScorer;
import com.englishflow.assessment.port.AssessmentOutboxPort;
import com.englishflow.assessment.port.P1PlacementSourcePort;
import com.englishflow.assessment.port.PlacementRuleScorePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** R1-024: retest opens a new session. The completed report and its answers stay. */
class R1024PlacementRetestTest {
    private static final String SUBJECT = "prn_r1024learner00001";
    private static final String OTHER = "prn_r1024learner00002";
    private static final String SNAPSHOT_ID = "snap_placement01";
    private static final String SNAPSHOT_HASH = "a".repeat(64);
    private static final String RETEST_KEY = "placement-r1024-retest-0001";

    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicInteger scoreCalls = new AtomicInteger();
    private final AtomicInteger bankReads = new AtomicInteger();
    private final List<AssessmentOutboxPort.AssessmentOutboxEvent> events = new ArrayList<>();
    private String snapshotId = SNAPSHOT_ID;
    private String snapshotHash = SNAPSHOT_HASH;
    private String stemPrefix = "Stem ";
    private JdbcTemplate jdbc;
    private P1PlacementJdbcController controller;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:r1024_" + UUID.randomUUID().toString().replace("-", "")
                        + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE p1_placement_session (session_id VARCHAR(128) PRIMARY KEY,"
                + " principal_id VARCHAR(128), tenant_id VARCHAR(64), status VARCHAR(24),"
                + " state_version BIGINT, current_sequence INT, session_snapshot_digest CHAR(64),"
                + " manifest_json VARCHAR(8000), content_pin_json VARCHAR(8000),"
                + " answer_rule_pin_json VARCHAR(8000), target_pin_json VARCHAR(8000),"
                + " learner_items_json VARCHAR(8000), sealed_items_json VARCHAR(8000),"
                + " started_at TIMESTAMP, updated_at TIMESTAMP)");
        jdbc.execute("CREATE TABLE p1_placement_response (session_id VARCHAR(128),"
                + " item_sequence INT, item_id BIGINT, principal_id VARCHAR(128), tenant_id VARCHAR(64),"
                + " response_digest CHAR(64), request_digest CHAR(64), correct BOOLEAN,"
                + " time_spent_sec INT, accepted_at TIMESTAMP, PRIMARY KEY (session_id, item_sequence))");
        jdbc.execute("CREATE TABLE p1_placement_checkpoint (session_id VARCHAR(128),"
                + " state_version BIGINT, principal_id VARCHAR(128), tenant_id VARCHAR(64),"
                + " next_sequence INT, checkpoint_digest CHAR(64), saved_at TIMESTAMP,"
                + " PRIMARY KEY (session_id, state_version))");
        jdbc.execute("CREATE TABLE p1_placement_result (placement_result_id VARCHAR(128) PRIMARY KEY,"
                + " session_id VARCHAR(128), report_id VARCHAR(128), principal_id VARCHAR(128),"
                + " tenant_id VARCHAR(64), result_kind VARCHAR(16), result_json VARCHAR(8000),"
                + " report_json VARCHAR(8000), completed_at TIMESTAMP,"
                + " UNIQUE (session_id), UNIQUE (report_id))");
        jdbc.execute("CREATE TABLE p1_placement_idempotency (tenant_id VARCHAR(64),"
                + " principal_id VARCHAR(128), idempotency_key VARCHAR(192), operation VARCHAR(24),"
                + " request_digest CHAR(64), response_json VARCHAR(8000), created_at TIMESTAMP,"
                + " PRIMARY KEY (tenant_id, principal_id, idempotency_key))");
        controller = new P1PlacementJdbcController(jdbc, mapper, principal -> {
            bankReads.incrementAndGet();
            return bank();
        }, events::add, (itemId, optionId) -> {
            scoreCalls.incrementAndGet();
            boolean full = "a".equals(optionId);
            return new PlacementRuleScorePort.RuleScore(full ? "FULL" : "ZERO",
                    full ? PlacementRuleScorePort.FULL_EXPLANATION : PlacementRuleScorePort.ZERO_EXPLANATION);
        });
    }

    @Test
    void completedRetestOpensAFreshSessionAndKeepsTheOldDigest() throws Exception {
        Finished finished = finish(SUBJECT);
        List<Map<String, Object>> answers = answers(finished.sessionId());
        String reportJson = jdbc.queryForObject(
                "SELECT report_json FROM p1_placement_result WHERE session_id = ?",
                String.class, finished.sessionId());
        snapshotId = "snap_retest0002";
        snapshotHash = "d".repeat(64);
        stemPrefix = "Next ";
        int readsBeforeRetest = bankReads.get();

        Map<String, Object> created = data(controller.retest(learner(SUBJECT), finished.sessionId(),
                Map.of(), RETEST_KEY).getBody());
        String newSessionId = String.valueOf(created.get("sessionId"));
        assertFalse(newSessionId.equals(finished.sessionId()));
        assertTrue(newSessionId.startsWith("asess_"));
        assertEquals("CREATED", created.get("status"));
        assertEquals(0, number(created.get("acceptedSequence")));
        assertEquals(1, number(created.get("nextSequence")));
        assertEquals(1, number(created.get("stateVersion")));
        assertFalse(created.containsKey("completedResult"));
        assertEquals("Next 1", ((Map<?, ?>) created.get("currentItem")).get("stem"));
        assertEquals(snapshotId, ((Map<?, ?>) created.get("contentPin")).get("snapshotId"));
        assertEquals(snapshotHash, ((Map<?, ?>) created.get("contentPin")).get("snapshotHash"));
        assertFalse(mapper.writeValueAsString(created).contains("correctOption"));
        assertEquals(readsBeforeRetest + 1, bankReads.get());
        assertEquals(0, count("SELECT COUNT(*) FROM p1_placement_response WHERE session_id = ?", newSessionId));
        assertEquals(0, count("SELECT COUNT(*) FROM p1_placement_checkpoint WHERE session_id = ?", newSessionId));
        assertEquals(10, count("SELECT COUNT(*) FROM p1_placement_response WHERE session_id = ?", finished.sessionId()));
        assertEquals(answers, answers(finished.sessionId()));
        assertEquals(reportJson, jdbc.queryForObject(
                "SELECT report_json FROM p1_placement_result WHERE session_id = ?",
                String.class, finished.sessionId()));
        assertEquals(1, count("SELECT COUNT(*) FROM p1_placement_result"));
        assertEquals(10, scoreCalls.get());
        assertEquals(0, events.size());

        Map<String, Object> oldSession = data(controller.read(learner(SUBJECT), finished.sessionId()));
        assertEquals("COMPLETED", oldSession.get("status"));
        assertEquals(10, number(oldSession.get("acceptedSequence")));
        assertEquals(SNAPSHOT_ID, ((Map<?, ?>) oldSession.get("contentPin")).get("snapshotId"));
        assertEquals(finished.digest(), ((Map<?, ?>) oldSession.get("completedResult")).get("digest"));
        Map<String, Object> reread = data(controller.report(learner(SUBJECT), finished.reportId()));
        assertEquals(finished.digest(), reread.get("digest"));
        assertEquals(reportJson, mapper.writeValueAsString(reread));
        assertFalse(reportJson.contains("correctOption"), reportJson);
        assertFalse(reportJson.contains("answerRule"), reportJson);

        Map<String, Object> replay = data(controller.retest(learner(SUBJECT), finished.sessionId(),
                Map.of(), RETEST_KEY).getBody());
        assertEquals(newSessionId, replay.get("sessionId"));
        assertEquals(0, number(replay.get("acceptedSequence")));
        assertEquals(2, count("SELECT COUNT(*) FROM p1_placement_session WHERE principal_id = ?", SUBJECT));

        ResponseStatusException unfinished = assertThrows(ResponseStatusException.class,
                () -> controller.retest(learner(SUBJECT), newSessionId, Map.of(),
                        "placement-r1024-retest-0002"));
        assertEquals(HttpStatus.CONFLICT, unfinished.getStatusCode());
        assertEquals(2, count("SELECT COUNT(*) FROM p1_placement_session WHERE principal_id = ?", SUBJECT));
        assertEquals(0, count("SELECT COUNT(*) FROM p1_placement_response WHERE session_id = ?", newSessionId));
        Map<String, Object> fresh = data(controller.read(learner(SUBJECT), newSessionId));
        assertEquals("CREATED", fresh.get("status"));
        assertEquals(0, number(fresh.get("acceptedSequence")));
        assertEquals("Next 1", ((Map<?, ?>) fresh.get("currentItem")).get("stem"));
    }

    @Test
    void incompleteSessionDoesNotOpenARetest() {
        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> controller.retest(learner(SUBJECT), "asess_missing0000001", Map.of(), RETEST_KEY));
        assertEquals(HttpStatus.NOT_FOUND, missing.getStatusCode());
        assertEquals(0, bankReads.get());
        assertEquals(0, count("SELECT COUNT(*) FROM p1_placement_session"));

        String otherSessionId = open(OTHER);
        ResponseStatusException foreign = assertThrows(ResponseStatusException.class,
                () -> controller.retest(learner(SUBJECT), otherSessionId, Map.of(), RETEST_KEY));
        assertEquals(HttpStatus.FORBIDDEN, foreign.getStatusCode());
        assertEquals(0, count("SELECT COUNT(*) FROM p1_placement_session WHERE principal_id = ?", SUBJECT));
        assertEquals(1, count("SELECT COUNT(*) FROM p1_placement_session WHERE principal_id = ?", OTHER));

        String sessionId = open(SUBJECT);
        int reads = bankReads.get();
        ResponseStatusException opened = assertThrows(ResponseStatusException.class,
                () -> controller.retest(learner(SUBJECT), sessionId, Map.of(), RETEST_KEY));
        assertEquals(HttpStatus.CONFLICT, opened.getStatusCode());
        assertEquals(reads, bankReads.get());
        assertEquals(1, count("SELECT COUNT(*) FROM p1_placement_session WHERE principal_id = ?", SUBJECT));
        assertEquals("CREATED", data(controller.read(learner(SUBJECT), sessionId)).get("status"));

        long version = 1;
        for (int sequence = 1; sequence <= 9; sequence++) {
            Map<String, Object> receipt = answer(sessionId, sequence, version, optionFor(sequence));
            version = number(receipt.get("stateVersion"));
        }
        ResponseStatusException partial = assertThrows(ResponseStatusException.class,
                () -> controller.retest(learner(SUBJECT), sessionId, Map.of(), RETEST_KEY));
        assertEquals(HttpStatus.CONFLICT, partial.getStatusCode());
        assertEquals(reads, bankReads.get());
        assertEquals(1, count("SELECT COUNT(*) FROM p1_placement_session WHERE principal_id = ?", SUBJECT));
        assertEquals(9, count("SELECT COUNT(*) FROM p1_placement_response WHERE session_id = ?", sessionId));
        assertEquals(0, count("SELECT COUNT(*) FROM p1_placement_result"));
        assertEquals("IN_PROGRESS", data(controller.read(learner(SUBJECT), sessionId)).get("status"));

        jdbc.update("UPDATE p1_placement_session SET status = 'COMPLETED', current_sequence = 11"
                + " WHERE session_id = ?", sessionId);
        ResponseStatusException withoutReport = assertThrows(ResponseStatusException.class,
                () -> controller.retest(learner(SUBJECT), sessionId, Map.of(), RETEST_KEY));
        assertEquals(HttpStatus.CONFLICT, withoutReport.getStatusCode());
        assertEquals(reads, bankReads.get());
        assertEquals(1, count("SELECT COUNT(*) FROM p1_placement_session WHERE principal_id = ?", SUBJECT));
        assertEquals(9, count("SELECT COUNT(*) FROM p1_placement_response WHERE session_id = ?", sessionId));
        assertEquals(0, count("SELECT COUNT(*) FROM p1_placement_result"));
        assertEquals(0, events.size());
    }

    @Test
    void historyShowsTheOldReportAndTheNewSession() throws Exception {
        Finished finished = finish(SUBJECT);
        snapshotId = "snap_retest0002";
        snapshotHash = "d".repeat(64);
        stemPrefix = "Next ";
        Map<String, Object> created = data(controller.retest(learner(SUBJECT), finished.sessionId(),
                Map.of(), RETEST_KEY).getBody());
        String newSessionId = String.valueOf(created.get("sessionId"));
        String otherSessionId = open(OTHER);

        List<Map<String, Object>> entries = entries(controller.history(learner(SUBJECT)));
        assertEquals(2, entries.size());
        Map<String, Object> oldEntry = entry(entries, finished.sessionId());
        Map<String, Object> newEntry = entry(entries, newSessionId);
        assertEquals("COMPLETED", oldEntry.get("status"));
        assertEquals(10, number(oldEntry.get("acceptedSequence")));
        assertEquals(finished.reportId(), oldEntry.get("reportId"));
        assertEquals(finished.digest(), oldEntry.get("digest"));
        assertEquals("CREATED", newEntry.get("status"));
        assertEquals(0, number(newEntry.get("acceptedSequence")));
        assertFalse(newEntry.containsKey("reportId"));
        assertFalse(newEntry.containsKey("digest"));
        String historyJson = mapper.writeValueAsString(entries);
        assertFalse(historyJson.contains("correctOption"), historyJson);
        assertFalse(historyJson.contains("answerRule"), historyJson);
        assertFalse(historyJson.contains(otherSessionId), historyJson);

        List<Map<String, Object>> otherEntries = entries(controller.history(learner(OTHER)));
        assertEquals(1, otherEntries.size());
        assertEquals(otherSessionId, otherEntries.getFirst().get("sessionId"));
        assertFalse(otherEntries.getFirst().containsKey("reportId"));

        Map<String, Object> report = data(controller.report(learner(SUBJECT), finished.reportId()));
        assertEquals(finished.digest(), report.get("digest"));
        assertEquals(SNAPSHOT_ID, report.get("snapshotId"));
        assertEquals(1, count("SELECT COUNT(*) FROM p1_placement_result WHERE session_id = ?", finished.sessionId()));
        assertEquals(10, count("SELECT COUNT(*) FROM p1_placement_response WHERE session_id = ?", finished.sessionId()));
        assertEquals(0, count("SELECT COUNT(*) FROM p1_placement_response WHERE session_id = ?", newSessionId));
        assertEquals(0, count("SELECT COUNT(*) FROM p1_placement_result WHERE session_id = ?", newSessionId));
    }

    private Finished finish(String subject) {
        String sessionId = open(subject);
        long version = 1;
        Map<String, Object> receipt = null;
        for (int sequence = 1; sequence <= 10; sequence++) {
            receipt = answer(sessionId, sequence, version, optionFor(sequence));
            version = number(receipt.get("stateVersion"));
        }
        assertEquals("COMPLETED", receipt.get("status"));
        Map<String, Object> report = reportOf(receipt);
        assertFalse(mapper.writeValueAsString(receipt).contains("correctOption"));
        return new Finished(sessionId, String.valueOf(report.get("reportId")), String.valueOf(report.get("digest")));
    }

    private String open(String subject) {
        Map<String, Object> created = data(controller.create(learner(subject), Map.of(), key("open", subject)).getBody());
        assertEquals("CREATED", created.get("status"));
        assertEquals(0, number(created.get("acceptedSequence")));
        return String.valueOf(created.get("sessionId"));
    }

    private Map<String, Object> answer(String sessionId, int sequence, long version, String option) {
        return data(controller.respond(learner(SUBJECT), sessionId, response(sequence, version, option),
                key("answer-" + sequence, SUBJECT), "state-" + version));
    }

    private List<Map<String, Object>> answers(String sessionId) {
        return jdbc.queryForList("""
                SELECT item_sequence, item_id, response_digest, request_digest, correct
                  FROM p1_placement_response WHERE session_id = ? ORDER BY item_sequence
                """, sessionId);
    }

    private int count(String sql, Object... args) {
        Integer count = jdbc.queryForObject(sql, Integer.class, args);
        return count == null ? 0 : count;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> entries(Map<String, Object> envelope) {
        return (List<Map<String, Object>>) data(envelope).get("entries");
    }

    private static Map<String, Object> entry(List<Map<String, Object>> entries, String sessionId) {
        return entries.stream()
                .filter(entry -> sessionId.equals(entry.get("sessionId")))
                .findFirst()
                .orElseThrow();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> reportOf(Map<String, Object> receipt) {
        return (Map<String, Object>) receipt.get("report");
    }

    private static long number(Object value) {
        return ((Number) value).longValue();
    }

    private static String optionFor(int sequence) {
        return sequence % 2 == 1 ? "a" : "b";
    }

    private static String key(String name, String subject) {
        return "placement-r1024-" + name + "-" + subject.substring(subject.length() - 4);
    }

    private static Map<String, Object> response(int sequence, long version, String option) {
        return new LinkedHashMap<>(Map.of("expectedStateVersion", version, "itemId", (long) sequence,
                "itemSequence", sequence,
                "candidateResponse", Map.of("responseType", "CHOICE", "selectedOptionIds", List.of(option)),
                "responseDigest", "b".repeat(64), "timeSpentSec", 4));
    }

    private static JwtAuthenticationToken learner(String subject) {
        Jwt jwt = Jwt.withTokenValue("verified")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(java.time.Instant.parse("2026-10-10T00:00:00Z"))
                .expiresAt(java.time.Instant.parse("2026-10-10T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.placement.session.create",
                        "assessment.placement.session.read", "assessment.placement.response.submit",
                        "assessment.placement.report.read"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, List.of(), subject);
    }

    private P1PlacementSourcePort.Resolved bank() {
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
                            "stem", stemPrefix + i, "options", List.of(
                                    Map.of("optionId", "a", "label", "Alpha"),
                                    Map.of("optionId", "b", "label", "Beta"))),
                    null));
        }
        return new P1PlacementSourcePort.Resolved(
                Map.of("targetId", 7L, "targetVersion", 2L, "targetSnapshotDigest", "c".repeat(64)),
                Map.of("contentVersionId", 22L, "contentEpoch", 0L,
                        "snapshotId", snapshotId, "snapshotHash", snapshotHash),
                Map.of("completionRuleVersion", "P1_PLACEMENT_V1"),
                items, true, true, true, true, true);
    }

    private record Finished(String sessionId, String reportId, String digest) {}
}
