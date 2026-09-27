package com.englishflow.assessment.web;

import com.englishflow.assessment.adapter.jdbc.JdbcAssessmentOutbox;
import com.englishflow.assessment.domain.ContentSnapshot;
import com.englishflow.assessment.domain.P1PlacementScorer;
import com.englishflow.assessment.domain.QuestionType;
import com.englishflow.assessment.port.AssessmentOutboxPort;
import com.englishflow.assessment.port.P1PlacementSourcePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Real-SQL completion run: create + ten responses through JDBC against H2 in
 * MySQL mode, with the real outbox writer. Catches completion-path failures
 * that owner-flow mocks cannot see (JSON round-trips, result freeze, outbox).
 */
class P1PlacementCompletionJdbcTest {

    private JdbcTemplate jdbc;
    private P1PlacementJdbcController controller;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:p1complete_" + UUID.randomUUID().toString().replace("-", "")
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
                + " time_spent_sec INT, accepted_at TIMESTAMP,"
                + " PRIMARY KEY (session_id, item_sequence))");
        jdbc.execute("CREATE TABLE p1_placement_checkpoint (session_id VARCHAR(128),"
                + " state_version BIGINT, principal_id VARCHAR(128), tenant_id VARCHAR(64),"
                + " next_sequence INT, checkpoint_digest CHAR(64), saved_at TIMESTAMP,"
                + " PRIMARY KEY (session_id, state_version))");
        jdbc.execute("CREATE TABLE p1_placement_result (placement_result_id VARCHAR(128) PRIMARY KEY,"
                + " session_id VARCHAR(128), report_id VARCHAR(128), principal_id VARCHAR(128),"
                + " tenant_id VARCHAR(64), result_kind VARCHAR(16), result_json VARCHAR(8000),"
                + " report_json VARCHAR(8000), completed_at TIMESTAMP)");
        jdbc.execute("CREATE TABLE p1_placement_idempotency (tenant_id VARCHAR(64),"
                + " principal_id VARCHAR(128), idempotency_key VARCHAR(192), operation VARCHAR(24),"
                + " request_digest CHAR(64), response_json VARCHAR(8000), created_at TIMESTAMP,"
                + " PRIMARY KEY (tenant_id, principal_id, idempotency_key))");
        jdbc.execute("CREATE TABLE assessment_outbox_event (event_id VARCHAR(128) PRIMARY KEY,"
                + " aggregate_id VARCHAR(128), event_name VARCHAR(128), schema_version VARCHAR(32),"
                + " dedupe_key VARCHAR(256), payload_json VARCHAR(8000), status VARCHAR(16),"
                + " attempt_count INT, available_at TIMESTAMP, created_at TIMESTAMP, occurred_at TIMESTAMP)");
        AssessmentOutboxPort outbox = new JdbcAssessmentOutbox(jdbc, mapper, "PUBLIC");
        controller = new P1PlacementJdbcController(jdbc, mapper, ignored -> source(), outbox);
    }

    @Test
    @SuppressWarnings("unchecked")
    void tenRealResponsesFreezeOneImmutableReport() {
        JwtAuthenticationToken learner = learner();
        Map<String, Object> first = (Map<String, Object>) controller
                .create(learner, Map.of(), "p1-h2-create-0001").getBody().get("data");
        String sessionId = String.valueOf(first.get("sessionId"));
        Map<String, Object> current = (Map<String, Object>) first.get("currentItem");
        long version = ((Number) first.get("stateVersion")).longValue();
        Map<String, Object> receipt = null;
        for (int sequence = 1; sequence <= 10; sequence++) {
            Map<String, Object> body = Map.of("expectedStateVersion", version,
                    "itemId", ((Number) current.get("itemId")).longValue(),
                    "itemSequence", sequence,
                    "candidateResponse", Map.of("responseType", "CHOICE",
                            "selectedOptionIds", List.of("a")),
                    "responseDigest", "a".repeat(64), "timeSpentSec", 5);
            receipt = (Map<String, Object>) controller
                    .respond(learner, sessionId, body, "p1-h2-response-" + sequence, "state-" + version)
                    .get("data");
            version = ((Number) receipt.get("stateVersion")).longValue();
            if (sequence < 10) current = (Map<String, Object>) receipt.get("nextItem");
        }
        assertEquals("COMPLETED", receipt.get("status"));
        Map<String, Object> result = (Map<String, Object>) receipt.get("finalResult");
        assertEquals("ASSESSED", result.get("resultKind"));
        assertEquals(100, ((Number) result.get("aggregateScore")).intValue());
        assertEquals("C2", result.get("referenceLevel"));
        List<Map<String, Object>> outboxRows = jdbc.queryForList(
                "SELECT event_name FROM assessment_outbox_event");
        assertEquals(1, outboxRows.size());
        assertEquals("assessment.placement.completed.v1", outboxRows.getFirst().get("event_name"));
        assertEquals(1, jdbc.queryForList("SELECT * FROM p1_placement_result").size());
    }

    private static JwtAuthenticationToken learner() {
        Jwt jwt = Jwt.withTokenValue("verified").header("alg", "RS256")
                .subject("prn_h2learner00000001")
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("tenant_id", "platform").claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.placement.session.create",
                        "assessment.placement.session.read", "assessment.placement.response.submit",
                        "assessment.placement.report.read"))
                .claim("adult_gate", "PASSED").claim("consent_state", "GRANTED").build();
        return new JwtAuthenticationToken(jwt, List.of(), jwt.getSubject());
    }

    private static P1PlacementSourcePort.Resolved source() {
        List<P1PlacementSourcePort.SealedItem> items = new ArrayList<>();
        for (int index = 0; index < 10; index++) {
            P1PlacementScorer.Dimension dimension = index < 3 ? P1PlacementScorer.Dimension.VOCABULARY
                    : index < 6 ? P1PlacementScorer.Dimension.BASIC_GRAMMAR
                    : index < 8 ? P1PlacementScorer.Dimension.READING
                    : P1PlacementScorer.Dimension.LISTENING;
            String type = switch (dimension) {
                case VOCABULARY -> "VOCABULARY";
                case BASIC_GRAMMAR -> "GRAMMAR";
                case READING -> "READING";
                case LISTENING -> "LISTENING";
            };
            long itemId = 266001 + index;
            items.add(new P1PlacementSourcePort.SealedItem(itemId, dimension,
                    Map.of("itemId", itemId, "itemCode", "p1.place.test." + index,
                            "itemType", type, "stem", "Stem " + index + "?",
                            "options", List.of(Map.of("optionId", "a", "label", "alpha"),
                                    Map.of("optionId", "b", "label", "beta")),
                            "displayOrder", index + 1),
                    new ContentSnapshot("p1.placement.v1", 266100, itemId, itemId,
                            QuestionType.CHOICE, Map.of("stem", "Stem " + index + "?"),
                            Map.of("correctOption", "a"), "p1-choice-v1", 10, true)));
        }
        return new P1PlacementSourcePort.Resolved(
                Map.of("targetId", 71001L, "targetVersion", 3L,
                        "targetSnapshotDigest", "c".repeat(64)),
                Map.of("contentVersionId", 266100L, "contentEpoch", 1L,
                        "snapshotId", "snap_p1.placement.v1-266100",
                        "snapshotHash", "a".repeat(64)),
                Map.of("answerRuleSetVersion", "p1-placement-bank-v1",
                        "answerRuleVersion", "p1-choice-v1", "ruleDigest", "b".repeat(64),
                        "completionRuleVersion", "P1_PLACEMENT_V1"),
                items, true, true, true, true, true);
    }
}
