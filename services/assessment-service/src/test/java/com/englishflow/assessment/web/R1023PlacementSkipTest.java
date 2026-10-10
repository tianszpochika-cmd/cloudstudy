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

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** R1-023: skip stores a SKIPPED baseline and does not invent a placement report. */
class R1023PlacementSkipTest {
    private static final String SUBJECT = "prn_r1023learner00001";
    private static final String SNAPSHOT_ID = "snap_placement01";
    private static final String SNAPSHOT_HASH = "a".repeat(64);

    private final ObjectMapper mapper = new ObjectMapper();
    private final List<AssessmentOutboxPort.AssessmentOutboxEvent> events = new ArrayList<>();
    private JdbcTemplate jdbc;
    private P1PlacementJdbcController placement;
    private B25AssessmentJdbcController legacy;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:r1023_" + UUID.randomUUID().toString().replace("-", "")
                        + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE p1_placement_session (session_id VARCHAR(128) PRIMARY KEY,"
                + " principal_id VARCHAR(128), tenant_id VARCHAR(64), status VARCHAR(24),"
                + " state_version BIGINT, current_sequence INT, session_snapshot_digest CHAR(64),"
                + " manifest_json VARCHAR(8000), content_pin_json VARCHAR(8000),"
                + " answer_rule_pin_json VARCHAR(8000), target_pin_json VARCHAR(8000),"
                + " learner_items_json VARCHAR(8000), sealed_items_json VARCHAR(8000),"
                + " baseline_json VARCHAR(8000), started_at TIMESTAMP, updated_at TIMESTAMP)");
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
        jdbc.execute("CREATE TABLE b25_assessment_session (session_id VARCHAR(36) PRIMARY KEY,"
                + " principal_id VARCHAR(128), tenant_id VARCHAR(64), content_code VARCHAR(128),"
                + " status VARCHAR(24), answers_json VARCHAR(2000), score DECIMAL(6,3),"
                + " report_id VARCHAR(36), idempotency_key VARCHAR(192),"
                + " created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        jdbc.execute("CREATE TABLE b25_assessment_report (report_id VARCHAR(36) PRIMARY KEY,"
                + " session_id VARCHAR(36), principal_id VARCHAR(128), tenant_id VARCHAR(64),"
                + " cefr_level VARCHAR(8), score DECIMAL(6,3), radar_json VARCHAR(2000),"
                + " mistakes_json VARCHAR(2000), result_kind VARCHAR(16), requested_starting_level VARCHAR(8))");
        jdbc.execute("CREATE TABLE b25_assessment_idempotency (principal_id VARCHAR(128),"
                + " tenant_id VARCHAR(64), idempotency_key VARCHAR(192), operation_code VARCHAR(96),"
                + " created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (principal_id, idempotency_key))");
        placement = new P1PlacementJdbcController(jdbc, mapper, principal -> bank(), events::add,
                (itemId, optionId) -> {
                    boolean full = "a".equals(optionId);
                    return new PlacementRuleScorePort.RuleScore(full ? "FULL" : "ZERO",
                            full ? PlacementRuleScorePort.FULL_EXPLANATION : PlacementRuleScorePort.ZERO_EXPLANATION);
                });
        legacy = new B25AssessmentJdbcController(jdbc, mapper);
    }

    @Test
    void skipStatusIsSkippedAndReplayDoesNotInsertAnotherBaseline() throws Exception {
        Map<String, Object> hint = hint("B1");
        Map<String, Object> skipped = data(placement.skip(learner(), hint, key("plain")).getBody());
        assertEquals("SKIPPED", skipped.get("status"));
        assertEquals("SKIPPED", skipped.get("resultKind"));
        assertEquals("USER_SKIP", skipped.get("baselineSource"));
        assertEquals("UNVERIFIED", skipped.get("confidence"));
        String body = mapper.writeValueAsString(skipped);
        assertFalse(body.contains("reportId"), body);
        assertFalse(body.contains("digest"), body);
        assertFalse(body.contains("FULL"), body);
        assertFalse(body.contains("ZERO"), body);
        assertFalse(body.contains("correctOption"), body);
        assertFalse(body.contains("answerRule"), body);
        assertFalse(body.contains("aggregateScore"), body);
        assertEquals(1, sessionCount());
        assertEquals(0, resultCount());
        assertEquals(0, events.size());

        Map<String, Object> session = data(placement.read(learner(), String.valueOf(skipped.get("sessionId"))));
        assertEquals("SKIPPED", session.get("status"));
        assertEquals("USER_SKIP", session.get("baselineSource"));
        assertFalse(session.containsKey("completedResult"));
        String stored = jdbc.queryForObject("SELECT baseline_json FROM p1_placement_session", String.class);
        assertEquals(body, stored);

        Map<String, Object> replay = data(placement.skip(learner(), hint, key("plain")).getBody());
        assertEquals(body, mapper.writeValueAsString(replay));
        assertEquals(1, sessionCount());
        assertEquals(0, resultCount());
        assertEquals(stored, jdbc.queryForObject("SELECT baseline_json FROM p1_placement_session", String.class));
    }

    @Test
    void skipKeepsAcceptedAnswersAndDoesNotAddAReport() {
        String sessionId = open();
        answer(sessionId, 1, 1, "a", "keep");
        answer(sessionId, 2, 2, "b", "keep");
        List<Map<String, Object>> answers = answers(sessionId);
        assertEquals(2, answers.size());

        Map<String, Object> skipped = data(placement.skip(learner(),
                Map.of("sessionId", sessionId, "requestedStartingLevel",
                        Map.of("level", "A2", "authority", "USER_SELECTED_NON_AUTHORITATIVE")),
                key("bound")).getBody());
        assertEquals(sessionId, skipped.get("sessionId"));
        assertEquals("SKIPPED", skipped.get("status"));
        assertFalse(mapper.writeValueAsString(skipped).contains("reportId"));
        assertEquals(answers, answers(sessionId));
        assertEquals(1, sessionCount());
        assertEquals(0, resultCount());
        assertEquals("SKIPPED", data(placement.read(learner(), sessionId)).get("status"));

        Map<String, Object> again = data(placement.skip(learner(),
                Map.of("sessionId", sessionId, "requestedStartingLevel",
                        Map.of("level", "A2", "authority", "USER_SELECTED_NON_AUTHORITATIVE")),
                key("bound")).getBody());
        assertEquals(skipped.get("recordedAt"), again.get("recordedAt"));
        assertEquals(1, sessionCount());
        assertEquals(answers, answers(sessionId));

        ResponseStatusException later = assertThrows(ResponseStatusException.class,
                () -> placement.respond(learner(), sessionId, response(3, 3, "a"), key("later"), "state-3"));
        assertEquals(HttpStatus.CONFLICT, later.getStatusCode());
        assertEquals(answers, answers(sessionId));
        assertEquals(0, resultCount());
    }

    @Test
    void completedSessionSkipDoesNotChangeTheReportDigest() throws Exception {
        Finished finished = finish();
        String before = jdbc.queryForObject(
                "SELECT report_json FROM p1_placement_result WHERE session_id = ?", String.class, finished.sessionId());
        List<Map<String, Object>> answers = answers(finished.sessionId());
        assertEquals(10, answers.size());

        ResponseStatusException rejected = assertThrows(ResponseStatusException.class,
                () -> placement.skip(learner(), Map.of("sessionId", finished.sessionId()), key("done")));
        assertEquals(HttpStatus.CONFLICT, rejected.getStatusCode());
        assertEquals(before, jdbc.queryForObject(
                "SELECT report_json FROM p1_placement_result WHERE session_id = ?", String.class, finished.sessionId()));
        assertEquals(answers, answers(finished.sessionId()));
        assertEquals("COMPLETED", data(placement.read(learner(), finished.sessionId())).get("status"));
        assertEquals(finished.digest(), data(placement.report(learner(), finished.reportId())).get("digest"));
        assertEquals(1, resultCount());
        assertEquals(1, sessionCount());

        Map<String, Object> legacyBaseline = legacy.skip(learner(), Map.of("fastTrackLevel", "CET4_B1"), key("legacy"));
        assertEquals("SKIPPED", legacyBaseline.get("status"));
        assertEquals("USER_SKIP", legacyBaseline.get("baselineSource"));
        assertFalse(mapper.writeValueAsString(legacyBaseline).contains("reportId"));
        assertFalse(mapper.writeValueAsString(legacyBaseline).contains("digest"));
        assertEquals(before, jdbc.queryForObject(
                "SELECT report_json FROM p1_placement_result WHERE session_id = ?", String.class, finished.sessionId()));
        assertEquals(finished.digest(), data(placement.report(learner(), finished.reportId())).get("digest"));
        assertEquals(1, resultCount());
        assertEquals(answers, answers(finished.sessionId()));
    }

    @Test
    void legacySkipEndpointReplaysOneBaselineAndLeavesACompletedReport() throws Exception {
        Map<String, Object> first = legacy.skip(learner(), Map.of("fastTrackLevel", "B1"), key("legacy"));
        assertEquals("SKIPPED", first.get("status"));
        assertEquals("USER_SKIP", first.get("baselineSource"));
        assertEquals("UNVERIFIED", first.get("confidence"));
        String body = mapper.writeValueAsString(first);
        assertFalse(body.contains("reportId"), body);
        assertFalse(body.contains("digest"), body);
        assertFalse(body.contains("FULL"), body);
        assertFalse(body.contains("ZERO"), body);
        assertFalse(body.contains("score"), body);
        assertEquals(0, legacyReportCount());
        assertEquals(1, legacySessionCount());

        Map<String, Object> replay = legacy.skip(learner(), Map.of("fastTrackLevel", "B1"), key("legacy"));
        assertEquals(first.get("sessionId"), replay.get("sessionId"));
        assertEquals(body, mapper.writeValueAsString(replay));
        assertEquals(1, legacySessionCount());
        assertEquals(0, legacyReportCount());

        String completedId = "11111111-1111-1111-1111-111111111111";
        String reportId = "22222222-2222-2222-2222-222222222222";
        jdbc.update("INSERT INTO b25_assessment_session (session_id, principal_id, tenant_id, content_code,"
                        + " status, answers_json, score, report_id, idempotency_key) VALUES (?, ?, 'platform',"
                        + " 'course', 'COMPLETED', ?, 0.920, ?, ?)",
                completedId, SUBJECT, "{\"q\":\"a\"}", reportId, "completed-session-key");
        jdbc.update("INSERT INTO b25_assessment_report (report_id, session_id, principal_id, tenant_id,"
                        + " cefr_level, score, radar_json, mistakes_json, result_kind) VALUES (?, ?, ?, 'platform',"
                        + " 'B2', 0.920, ?, '[]', 'ASSESSED')",
                reportId, completedId, SUBJECT, "{\"digest\":\"kept-digest\"}");
        String kept = jdbc.queryForObject("SELECT radar_json FROM b25_assessment_report WHERE report_id = ?",
                String.class, reportId);

        ResponseStatusException rejected = assertThrows(ResponseStatusException.class,
                () -> legacy.skip(learner(), Map.of("fastTrackLevel", "A1", "sessionId", completedId), key("cover")));
        assertEquals(HttpStatus.CONFLICT, rejected.getStatusCode());
        assertEquals(kept, jdbc.queryForObject("SELECT radar_json FROM b25_assessment_report WHERE report_id = ?",
                String.class, reportId));
        assertEquals("{\"q\":\"a\"}", jdbc.queryForObject(
                "SELECT answers_json FROM b25_assessment_session WHERE session_id = ?", String.class, completedId));
        assertEquals("COMPLETED", jdbc.queryForObject(
                "SELECT status FROM b25_assessment_session WHERE session_id = ?", String.class, completedId));
        assertEquals(1, legacyReportCount());
        assertEquals(2, legacySessionCount());
    }

    private Finished finish() {
        String sessionId = open();
        long version = 1;
        Map<String, Object> receipt = null;
        for (int sequence = 1; sequence <= 10; sequence++) {
            receipt = answer(sessionId, sequence, version, sequence % 2 == 1 ? "a" : "b", "finish");
            version = ((Number) receipt.get("stateVersion")).longValue();
        }
        Map<String, Object> report = reportOf(receipt);
        return new Finished(sessionId, String.valueOf(report.get("reportId")), String.valueOf(report.get("digest")));
    }

    private String open() {
        return String.valueOf(data(placement.create(learner(), Map.of(), key("open")).getBody()).get("sessionId"));
    }

    private Map<String, Object> answer(String sessionId, int sequence, long version, String option, String name) {
        return data(placement.respond(learner(), sessionId, response(sequence, version, option),
                key(name + "-" + sequence), "state-" + version));
    }

    private List<Map<String, Object>> answers(String sessionId) {
        return jdbc.queryForList("SELECT item_sequence, correct, response_digest FROM p1_placement_response"
                + " WHERE session_id = ? ORDER BY item_sequence", sessionId);
    }

    private int sessionCount() {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM p1_placement_session", Integer.class);
        return count == null ? 0 : count;
    }

    private int resultCount() {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM p1_placement_result", Integer.class);
        return count == null ? 0 : count;
    }

    private int legacySessionCount() {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM b25_assessment_session", Integer.class);
        return count == null ? 0 : count;
    }

    private int legacyReportCount() {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM b25_assessment_report", Integer.class);
        return count == null ? 0 : count;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> reportOf(Map<String, Object> receipt) {
        return (Map<String, Object>) receipt.get("report");
    }

    private static Map<String, Object> hint(String level) {
        return Map.of("requestedStartingLevel",
                Map.of("level", level, "authority", "USER_SELECTED_NON_AUTHORITATIVE"));
    }

    private static Map<String, Object> response(int sequence, long version, String option) {
        return new LinkedHashMap<>(Map.of("expectedStateVersion", version, "itemId", (long) sequence,
                "itemSequence", sequence,
                "candidateResponse", Map.of("responseType", "CHOICE", "selectedOptionIds", List.of(option)),
                "responseDigest", "b".repeat(64), "timeSpentSec", 4));
    }

    private static String key(String name) {
        return "placement-r1023-" + name + "-0001";
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
                        "assessment.placement.session.read", "assessment.placement.response.submit",
                        "assessment.placement.skip", "assessment.placement.report.read",
                        "assessment.session.write", "assessment.session.read"))
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
                        "snapshotId", SNAPSHOT_ID, "snapshotHash", SNAPSHOT_HASH),
                Map.of("completionRuleVersion", "P1_PLACEMENT_V1"),
                items, true, true, true, true, true);
    }

    private record Finished(String sessionId, String reportId, String digest) {}
}
