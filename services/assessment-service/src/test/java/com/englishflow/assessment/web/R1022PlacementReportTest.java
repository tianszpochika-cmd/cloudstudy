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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** R1-022: ten scored placement answers freeze one report. A later read returns that same body. */
class R1022PlacementReportTest {
    private static final String SUBJECT = "prn_r1022learner00001";
    private static final String SNAPSHOT_ID = "snap_placement01";
    private static final String SNAPSHOT_HASH = "a".repeat(64);

    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicInteger scoreCalls = new AtomicInteger();
    private final AtomicInteger bankReads = new AtomicInteger();
    private final List<AssessmentOutboxPort.AssessmentOutboxEvent> events = new ArrayList<>();
    private JdbcTemplate jdbc;
    private P1PlacementJdbcController controller;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:r1022_" + UUID.randomUUID().toString().replace("-", "")
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
    void fewerThanTenAnswersDoesNotCreateAReport() throws Exception {
        String sessionId = open();
        ResponseStatusException ahead = assertThrows(ResponseStatusException.class,
                () -> controller.respond(learner(), sessionId, response(2, 1, "a"), key("ahead", 2), "state-1"));
        assertEquals(HttpStatus.CONFLICT, ahead.getStatusCode());
        assertEquals(0, scoreCalls.get());
        assertEquals(0, resultCount());

        long version = 1;
        Map<String, Object> receipt = null;
        for (int sequence = 1; sequence <= 9; sequence++) {
            receipt = answer(sessionId, sequence, version, optionFor(sequence), "nine");
            assertEquals("IN_PROGRESS", receipt.get("status"));
            assertFalse(receipt.containsKey("report"));
            assertFalse(receipt.containsKey("summary"));
            version = ((Number) receipt.get("stateVersion")).longValue();
        }
        assertEquals(9, scoreCalls.get());
        assertEquals(0, resultCount());
        assertEquals(0, events.size());
        Map<String, Object> session = data(controller.read(learner(), sessionId));
        assertEquals("IN_PROGRESS", session.get("status"));
        assertFalse(session.containsKey("completedResult"));
        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> controller.report(learner(), "rpt_notcreated01"));
        assertEquals(HttpStatus.NOT_FOUND, missing.getStatusCode());
        assertFalse(mapper.writeValueAsString(receipt).contains("correctOption"));
        assertFalse(mapper.writeValueAsString(receipt).contains("answerRule"));
    }

    @Test
    void tenAnswersFreezeOneReportAndASecondReadKeepsTheDigest() throws Exception {
        Finished finished = finish();
        Map<String, Object> first = data(controller.report(learner(), finished.reportId()));
        Map<String, Object> second = data(controller.report(learner(), finished.reportId()));
        String stored = jdbc.queryForObject("SELECT report_json FROM p1_placement_result", String.class);
        String storedSummary = jdbc.queryForObject("SELECT result_json FROM p1_placement_result", String.class);
        assertEquals(stored, mapper.writeValueAsString(first));
        assertEquals(stored, mapper.writeValueAsString(second));
        assertEquals(finished.digest(), first.get("digest"));
        assertEquals(finished.digest(), second.get("digest"));
        assertEquals(finished.reportId(), first.get("reportId"));
        assertEquals(SNAPSHOT_ID, first.get("snapshotId"));
        assertEquals(SNAPSHOT_HASH, first.get("snapshotHash"));
        assertEquals(outcomes(), first.get("outcomes"));
        assertEquals(sha256(mapper.writeValueAsString(facts(first))), first.get("digest"));
        assertTrue(String.valueOf(first.get("digest")).matches("[a-f0-9]{64}"));
        assertEquals(finished.sessionId(), first.get("sessionId"));
        assertEquals("ASSESSED", first.get("resultKind"));
        assertEquals("HIGH", first.get("confidence"));
        assertEquals("A2", first.get("referenceLevel"));
        assertEquals(50, ((Number) first.get("aggregateScore")).intValue());
        String storedResultId = jdbc.queryForObject(
                "SELECT placement_result_id FROM p1_placement_result", String.class);
        assertEquals(storedResultId, first.get("placementResultId"));
        assertFalse(storedSummary.contains("referenceLevel"));

        Map<String, Object> session = data(controller.read(learner(), finished.sessionId()));
        Map<String, Object> sessionAgain = data(controller.read(learner(), finished.sessionId()));
        assertEquals(storedSummary, mapper.writeValueAsString(first.get("summary")));
        assertEquals(storedSummary, mapper.writeValueAsString(session.get("completedResult")));
        assertEquals(storedSummary, mapper.writeValueAsString(sessionAgain.get("completedResult")));
        assertEquals(finished.digest(), ((Map<?, ?>) session.get("completedResult")).get("digest"));
        assertFalse(stored.contains("correctOption"), stored);
        assertFalse(stored.contains("answerRule"), stored);
        assertFalse(stored.contains("Alpha"), stored);
        assertFalse(storedSummary.contains("correctOption"), storedSummary);
        assertFalse(storedSummary.contains("answerRule"), storedSummary);
        assertEquals(1, resultCount());
        assertEquals(10, scoreCalls.get());
        assertEquals(1, bankReads.get());
        assertEquals(0, events.size());
    }

    @Test
    void repeatingCompletionReturnsTheStoredReport() throws Exception {
        Finished finished = finish();
        String before = jdbc.queryForObject("SELECT report_json FROM p1_placement_result", String.class);
        Map<String, Object> replay = answer(finished.sessionId(), 10, 10, optionFor(10), "finish");
        Map<String, Object> again = answer(finished.sessionId(), 10, 10, optionFor(10), "repeat");
        assertEquals(finished.reportId(), reportOf(replay).get("reportId"));
        assertEquals(finished.digest(), reportOf(replay).get("digest"));
        assertEquals(finished.reportId(), reportOf(again).get("reportId"));
        assertEquals(finished.digest(), reportOf(again).get("digest"));
        assertEquals(mapper.writeValueAsString(reportOf(replay)), mapper.writeValueAsString(reportOf(again)));
        assertFalse(mapper.writeValueAsString(again).contains("correctOption"));
        assertFalse(mapper.writeValueAsString(again).contains("answerRule"));
        assertEquals(before, jdbc.queryForObject("SELECT report_json FROM p1_placement_result", String.class));
        assertEquals(1, resultCount());
        assertEquals(10, scoreCalls.get());

        Map<String, Object> changed = new LinkedHashMap<>(response(10, 10, "a"));
        ResponseStatusException conflict = assertThrows(ResponseStatusException.class,
                () -> controller.respond(learner(), finished.sessionId(), changed, key("other", 10), "state-10"));
        assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
        assertEquals(before, jdbc.queryForObject("SELECT report_json FROM p1_placement_result", String.class));
        assertEquals(1, resultCount());
        assertEquals(10, scoreCalls.get());
        Map<String, Object> reread = data(controller.report(learner(), finished.reportId()));
        assertEquals(finished.digest(), reread.get("digest"));
        assertEquals(before, mapper.writeValueAsString(reread));
    }

    private Finished finish() throws Exception {
        String sessionId = open();
        long version = 1;
        Map<String, Object> receipt = null;
        for (int sequence = 1; sequence <= 10; sequence++) {
            receipt = answer(sessionId, sequence, version, optionFor(sequence), "finish");
            version = ((Number) receipt.get("stateVersion")).longValue();
            if (sequence < 10) assertFalse(receipt.containsKey("report"));
        }
        assertEquals("COMPLETED", receipt.get("status"));
        Map<String, Object> report = reportOf(receipt);
        Map<String, Object> summary = summaryOf(receipt);
        assertEquals(report.get("reportId"), summary.get("reportId"));
        assertEquals(report.get("digest"), summary.get("digest"));
        assertFalse(mapper.writeValueAsString(receipt).contains("correctOption"));
        assertFalse(mapper.writeValueAsString(receipt).contains("answerRule"));
        return new Finished(sessionId, String.valueOf(report.get("reportId")), String.valueOf(report.get("digest")));
    }

    private String open() {
        Map<String, Object> created = data(controller.create(learner(), Map.of(), key("open", 1)).getBody());
        assertEquals("CREATED", created.get("status"));
        assertEquals(SNAPSHOT_ID, ((Map<?, ?>) created.get("contentPin")).get("snapshotId"));
        assertEquals(SNAPSHOT_HASH, ((Map<?, ?>) created.get("contentPin")).get("snapshotHash"));
        return String.valueOf(created.get("sessionId"));
    }

    private Map<String, Object> answer(String sessionId, int sequence, long version, String option, String name) {
        return data(controller.respond(learner(), sessionId, response(sequence, version, option),
                key(name, sequence), "state-" + version));
    }

    private int resultCount() {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM p1_placement_result", Integer.class);
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

    @SuppressWarnings("unchecked")
    private static Map<String, Object> summaryOf(Map<String, Object> receipt) {
        return (Map<String, Object>) receipt.get("summary");
    }

    private static Map<String, Object> facts(Map<String, Object> report) {
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("reportId", report.get("reportId"));
        facts.put("outcomes", report.get("outcomes"));
        facts.put("snapshotId", report.get("snapshotId"));
        facts.put("snapshotHash", report.get("snapshotHash"));
        return facts;
    }

    private static List<Map<String, Object>> outcomes() {
        List<Map<String, Object>> outcomes = new ArrayList<>();
        for (int sequence = 1; sequence <= 10; sequence++) {
            outcomes.add(Map.of("sequence", sequence, "outcome", sequence % 2 == 1 ? "FULL" : "ZERO"));
        }
        return outcomes;
    }

    private static String optionFor(int sequence) {
        return sequence % 2 == 1 ? "a" : "b";
    }

    private static String key(String name, int sequence) {
        return "placement-r1022-" + name + "-" + String.format("%04d", sequence);
    }

    private static Map<String, Object> response(int sequence, long version, String option) {
        return new LinkedHashMap<>(Map.of("expectedStateVersion", version, "itemId", (long) sequence,
                "itemSequence", sequence,
                "candidateResponse", Map.of("responseType", "CHOICE", "selectedOptionIds", List.of(option)),
                "responseDigest", "b".repeat(64), "timeSpentSec", 4));
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
                        "assessment.placement.report.read"))
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

    private static String sha256(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    private record Finished(String sessionId, String reportId, String digest) {}
}
