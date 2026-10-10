package com.englishflow.learning.adapter.http;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Only owner-verified ASSESSED completions yield plan pins. */
class VerifiedPlacementReportTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;
    private String baseUrl;

    @BeforeEach
    void setUp() throws Exception {
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("placementResultId", "plr_abc");
        result.put("sessionId", "asess_abc");
        result.put("resultVersion", 1);
        result.put("reportId", "rpt_abc");
        result.put("reportVersion", 1);
        result.put("resultDigest", "d".repeat(64));
        result.put("reportDigest", "e".repeat(64));
        result.put("resultKind", "ASSESSED");
        result.put("confidence", "HIGH");
        result.put("coverageRatio", 1);
        result.put("aggregateScore", 100);
        result.put("referenceLevel", "C2");
        result.put("completionStatus", "COMPLETED");
        result.put("manifest", Map.of("placementManifestId", "P1_PLACEMENT_V1"));
        result.put("contentPin", Map.of("contentVersionId", 266100));
        result.put("answerRulePin", Map.of("answerRuleSetVersion", "set-v1"));
        result.put("targetPin", Map.of("targetId", 71001));
        result.put("completedAt", "2026-09-27T12:00:00Z");
        Map<String, Object> report = new java.util.LinkedHashMap<>();
        report.put("result", result);
        report.put("manifest", Map.of("placementManifestId", "P1_PLACEMENT_V1",
                "placementManifestVersion", "P1_PLACEMENT_V1",
                "placementManifestDigest", "a".repeat(64), "dimensionSetDigest", "b".repeat(64),
                "totalItemCount", 10));
        report.put("contentPin", Map.of("contentVersionId", 266100, "contentEpoch", 1,
                "snapshotId", "snap_p1.placement.v1-266100", "snapshotHash", "a".repeat(64)));
        report.put("answerRulePin", Map.of("answerRuleSetVersion", "p1-placement-bank-v1",
                "answerRuleVersion", "p1-choice-v1", "ruleDigest", "b".repeat(64),
                "completionRuleVersion", "P1_PLACEMENT_V1"));
        report.put("targetPin", Map.of("targetId", 71001, "targetVersion", 3,
                "targetSnapshotDigest", "f".repeat(64)));
        report.put("generatedAt", "2026-09-27T12:00:00Z");
        Map<String, Object> session = Map.of("sessionId", "asess_abc", "status", "COMPLETED",
                "stateVersion", 11, "sessionSnapshotDigest", "c".repeat(64));
        String outcomeDigest = "9".repeat(64);
        Map<String, Object> outcomeSummary = new LinkedHashMap<>();
        outcomeSummary.put("reportId", "rpt_outcome");
        outcomeSummary.put("digest", outcomeDigest);
        outcomeSummary.put("itemCount", 10);
        outcomeSummary.put("fullCount", 5);
        outcomeSummary.put("zeroCount", 5);
        List<Map<String, Object>> outcomes = new ArrayList<>();
        for (int sequence = 1; sequence <= 10; sequence++) {
            outcomes.add(Map.of("sequence", sequence, "outcome", sequence % 2 == 1 ? "FULL" : "ZERO"));
        }
        Map<String, Object> outcome = new LinkedHashMap<>();
        outcome.put("reportId", "rpt_outcome");
        outcome.put("digest", outcomeDigest);
        outcome.put("snapshotId", "snap_p1.placement.v1-22");
        outcome.put("snapshotHash", "a".repeat(64));
        outcome.put("outcomes", outcomes);
        outcome.put("summary", outcomeSummary);
        outcome.put("sessionId", "asess_outcome");
        outcome.put("placementResultId", "plr_outcome");
        outcome.put("resultKind", "ASSESSED");
        outcome.put("completedAt", "2026-10-11T01:00:00Z");
        outcome.put("confidence", "HIGH");
        outcome.put("referenceLevel", "A2");
        outcome.put("aggregateScore", 50);
        Map<String, Object> outcomeSession = new LinkedHashMap<>();
        outcomeSession.put("sessionId", "asess_outcome");
        outcomeSession.put("status", "COMPLETED");
        outcomeSession.put("stateVersion", 11);
        outcomeSession.put("sessionSnapshotDigest", "c".repeat(64));
        outcomeSession.put("completedResult", outcomeSummary);
        outcomeSession.put("contentPin", Map.of("contentVersionId", 22, "contentEpoch", 0,
                "snapshotId", "snap_p1.placement.v1-22", "snapshotHash", "a".repeat(64)));
        outcomeSession.put("targetPin", Map.of("targetId", 7, "targetVersion", 2,
                "targetSnapshotDigest", "f".repeat(64)));
        outcomeSession.put("answerRulePin", Map.of("completionRuleVersion", "P1_PLACEMENT_V1"));
        outcomeSession.put("manifest", Map.of("placementManifestId", "P1_PLACEMENT_V1", "totalItemCount", 10));
        String reportBody = mapper.writeValueAsString(Map.of("data", report));
        String sessionBody = mapper.writeValueAsString(Map.of("data", session));
        String outcomeBody = mapper.writeValueAsString(Map.of("data", outcome));
        String outcomeSessionBody = mapper.writeValueAsString(Map.of("data", outcomeSession));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            byte[] payload;
            int status = 200;
            if (path.equals("/internal/v1/assessment/placement/reports/rpt_abc")) {
                payload = reportBody.getBytes(StandardCharsets.UTF_8);
            } else if (path.equals("/internal/v1/assessment/placement/sessions/asess_abc")) {
                payload = sessionBody.getBytes(StandardCharsets.UTF_8);
            } else if (path.equals("/internal/v1/assessment/placement/reports/rpt_outcome")) {
                payload = outcomeBody.getBytes(StandardCharsets.UTF_8);
            } else if (path.equals("/internal/v1/assessment/placement/sessions/asess_outcome")) {
                payload = outcomeSessionBody.getBytes(StandardCharsets.UTF_8);
            } else {
                status = 404;
                payload = "{\"error\":\"nope\"}".getBytes(StandardCharsets.UTF_8);
            }
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, payload.length);
            exchange.getResponseBody().write(payload);
            exchange.close();
        });
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void tearDown() {
        if (server != null) server.stop(0);
    }

    @Test
    void assessedCompletionYieldsPins() {
        VerifiedPlacementReport verifier = new VerifiedPlacementReport(mapper, baseUrl);
        VerifiedPlacementReport.PlacementPins pins = verifier.verify("rpt_abc", "Bearer t");
        assertEquals(71001L, pins.targetId());
        assertEquals(3L, pins.targetVersion());
        assertEquals(266100L, pins.contentVersionId());
        assertEquals(1L, pins.contentEpoch());
        assertEquals(11L, pins.sessionStateVersion());
        assertEquals("C2", pins.referenceLevel());
        assertEquals("p1-placement-bank-v1", pins.answerRuleSetVersion());
    }

    @Test
    void answerFreeOutcomeSnapshotYieldsSessionPins() {
        VerifiedPlacementReport verifier = new VerifiedPlacementReport(mapper, baseUrl);
        VerifiedPlacementReport.PlacementPins pins = verifier.verify("rpt_outcome", "Bearer t");
        assertEquals("asess_outcome", pins.sessionId());
        assertEquals("plr_outcome", pins.placementResultId());
        assertEquals(1L, pins.resultVersion());
        assertEquals(1L, pins.reportVersion());
        assertEquals("9".repeat(64), pins.reportDigest());
        assertEquals(pins.reportDigest(), pins.resultDigest());
        assertEquals("A2", pins.referenceLevel());
        assertEquals("HIGH", pins.confidence());
        assertEquals(7L, pins.targetId());
        assertEquals(22L, pins.contentVersionId());
        assertEquals(0L, pins.contentEpoch());
        assertEquals("P1_PLACEMENT_V1", pins.answerRuleSetVersion());
        assertEquals("P1_PLACEMENT_V1", pins.answerRuleVersion());
        assertEquals(VerifiedPlacementReport.sha256("P1_PLACEMENT_V1"), pins.ruleDigest());
        assertEquals(11L, pins.sessionStateVersion());
    }

    @Test
    void unknownReportIsUnprocessableNotFound() {
        VerifiedPlacementReport verifier = new VerifiedPlacementReport(mapper, baseUrl);
        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> verifier.verify("rpt_nope", "Bearer t"));
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, missing.getStatusCode());
    }

    @Test
    void blankReferenceIsRejected() {
        VerifiedPlacementReport verifier = new VerifiedPlacementReport(mapper, baseUrl);
        assertThrows(ResponseStatusException.class, () -> verifier.verify(" ", "Bearer t"));
        assertTrue(server != null);
    }
}
