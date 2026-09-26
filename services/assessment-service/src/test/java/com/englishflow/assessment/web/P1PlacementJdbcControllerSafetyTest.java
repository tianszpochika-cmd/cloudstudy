package com.englishflow.assessment.web;

import com.englishflow.assessment.adapter.content.UnavailableP1PlacementSourcePort;
import com.englishflow.assessment.domain.SafePayloads;
import com.englishflow.assessment.port.AssessmentOutboxPort;
import com.englishflow.assessment.web.AssessmentHttpPrincipals.VerifiedAssessmentPrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import org.mockito.ArgumentCaptor;

class P1PlacementJdbcControllerSafetyTest {
    private static final String SUBJECT = "prn_learner0000000001";

    @Test
    void allFiveRoutesRequireTheirExactPermissionBeforeOwnerStorage() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AssessmentOutboxPort outbox = mock(AssessmentOutboxPort.class);
        P1PlacementJdbcController controller = controller(jdbc, outbox);
        JwtAuthenticationToken broadOnly = learner("assessment.session.read", "assessment.session.write");

        denied(() -> controller.create(broadOnly, Map.of(), "placement-create-key"));
        denied(() -> controller.read(broadOnly, "asess_any12345"));
        denied(() -> controller.respond(broadOnly, "asess_any12345", Map.of(), "placement-response-key", null));
        denied(() -> controller.skip(broadOnly, Map.of(), "placement-skip-key"));
        denied(() -> controller.report(broadOnly, "rpt_any12345"));
        denied(() -> controller.create(learnerWithGate("WITHDRAWN", "assessment.placement.session.create"),
                Map.of(), "placement-create-key"));
        verifyNoInteractions(jdbc, outbox);
    }

    @Test
    void absentPublishedAuthorizedSourceReturns503BeforeAnyOwnerWrite() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AssessmentOutboxPort outbox = mock(AssessmentOutboxPort.class);
        P1PlacementJdbcController controller = controller(jdbc, outbox);

        ResponseStatusException create = assertThrows(ResponseStatusException.class,
                () -> controller.create(learner("assessment.placement.session.create"), Map.of(),
                        "placement-create-key"));
        ResponseStatusException skip = assertThrows(ResponseStatusException.class,
                () -> controller.skip(learner("assessment.placement.skip"), Map.of(),
                        "placement-skip-key"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, create.getStatusCode());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, skip.getStatusCode());
        verifyNoInteractions(jdbc, outbox);
    }

    @Test
    void malformedClientFactsReturn422BeforeOwnerStorage() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AssessmentOutboxPort outbox = mock(AssessmentOutboxPort.class);
        P1PlacementJdbcController controller = controller(jdbc, outbox);
        JwtAuthenticationToken writer = learner("assessment.placement.response.submit");
        Map<String, Object> fractional = Map.of("expectedStateVersion", 1.5, "itemId", 1,
                "itemSequence", 1, "candidateResponse", Map.of("responseType", "UNANSWERED"),
                "responseDigest", "a".repeat(64), "timeSpentSec", 0);
        Map<String, Object> forgedShape = Map.of("expectedStateVersion", 1, "itemId", 1,
                "itemSequence", 1, "candidateResponse", "{\"responseType\":\"UNANSWERED\"}",
                "responseDigest", "a".repeat(64), "timeSpentSec", 0);
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, assertThrows(ResponseStatusException.class,
                () -> controller.respond(writer, "asess_any12345", fractional,
                        "placement-response-key", null)).getStatusCode());
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, assertThrows(ResponseStatusException.class,
                () -> controller.respond(writer, "asess_any12345", forgedShape,
                        "placement-response-key", null)).getStatusCode());
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, assertThrows(ResponseStatusException.class,
                () -> controller.skip(learner("assessment.placement.skip"),
                        Map.of("requestedStartingLevel", "B2"), "placement-skip-key"))
                .getStatusCode());
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, assertThrows(ResponseStatusException.class,
                () -> controller.create(learner("assessment.placement.session.create"), Map.of(), null))
                .getStatusCode());
        verifyNoInteractions(jdbc, outbox);
    }

    @Test
    void eachClosedObjectiveResponseUsesTheSealedServerRule() {
        P1PlacementJdbcController controller = controller(mock(JdbcTemplate.class),
                mock(AssessmentOutboxPort.class));
        assertTrue(controller.score(sealed("CHOICE", Map.of("correctOptionKeys", List.of("a"))),
                Map.of("responseType", "CHOICE", "selectedOptionIds", List.of("a"))));
        assertTrue(controller.score(sealed("CONNECT_LINE", Map.of("correctPairs",
                        List.of(Map.of("leftId", "l1", "rightId", "r1")))),
                Map.of("responseType", "MATCHING", "pairs",
                        List.of(Map.of("leftId", "l1", "rightId", "r1")))));
        assertTrue(controller.score(sealed("DRAG_SORTER", Map.of("answerKeyOrder", List.of("a", "b"))),
                Map.of("responseType", "ORDERING", "orderedTokenIds", List.of("a", "b"))));
        assertTrue(controller.score(sealed("FILL_BLANK", Map.of("acceptedAnswers", Map.of("b1", "hello"))),
                Map.of("responseType", "CLOZE", "blanks",
                        List.of(Map.of("blankId", "b1", "text", "hello")))));
        assertTrue(controller.score(sealed("SPELL_INPUT", Map.of("acceptedText", "hello")),
                Map.of("responseType", "TEXT", "text", "hello")));
        assertFalse(controller.score(sealed("CHOICE", Map.of("correctOptionKeys", List.of("a"))),
                Map.of("responseType", "UNANSWERED")));
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, assertThrows(ResponseStatusException.class,
                () -> controller.score(sealed("CHOICE", Map.of("correctOptionKeys", List.of("a"))),
                        Map.of("responseType", "CHOICE", "selectedOptionIds", List.of("a"),
                                "isCorrect", true))).getStatusCode());
    }

    @Test
    void completionEventProjectsOnlyTheFourSafeDimensionSummaries() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AssessmentOutboxPort outbox = mock(AssessmentOutboxPort.class);
        P1PlacementJdbcController controller = controller(jdbc, outbox);
        Map<String, Object> result = result("ASSESSED");
        List<Map<String, Object>> dimensions = new ArrayList<>();
        for (String dimension : List.of("VOCABULARY", "BASIC_GRAMMAR", "READING", "LISTENING")) {
            dimensions.add(Map.of("dimension", dimension, "validItemCount", 3,
                    "earnedItemCount", 2, "dimensionPercent", 66.67));
        }
        result.put("dimensionSummaries", dimensions);

        controller.appendCompletion(principal(), session(), result, 11L,
                Instant.parse("2026-09-23T00:00:00Z"));

        ArgumentCaptor<AssessmentOutboxPort.AssessmentOutboxEvent> captor =
                ArgumentCaptor.forClass(AssessmentOutboxPort.AssessmentOutboxEvent.class);
        verify(outbox).append(captor.capture());
        Map<String, Object> payload = captor.getValue().payload();
        assertEquals("assessment.placement.completed.v1", captor.getValue().eventName());
        assertEquals(10, payload.get("totalItemCount"));
        assertFalse(SafePayloads.containsAnswerLeak(payload));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> eventDimensions = (List<Map<String, Object>>) payload.get("dimensionSummaries");
        assertEquals(4, eventDimensions.size());
        assertEquals(Set.of("dimensionId", "dimensionPercent", "coverageRatio"),
                eventDimensions.getFirst().keySet());
        assertEquals("VOCABULARY", eventDimensions.getFirst().get("dimensionId"));
        assertEquals(1, eventDimensions.getFirst().get("coverageRatio"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void skippedEventKeepsMeasuredValuesNullAndHasNoDimensions() {
        AssessmentOutboxPort outbox = mock(AssessmentOutboxPort.class);
        P1PlacementJdbcController controller = controller(mock(JdbcTemplate.class), outbox);
        controller.appendCompletion(principal(), session(), result("SKIPPED"), 1L,
                Instant.parse("2026-09-23T00:00:00Z"));

        ArgumentCaptor<AssessmentOutboxPort.AssessmentOutboxEvent> captor =
                ArgumentCaptor.forClass(AssessmentOutboxPort.AssessmentOutboxEvent.class);
        verify(outbox).append(captor.capture());
        Map<String, Object> payload = captor.getValue().payload();
        assertEquals("SKIPPED", payload.get("completionStatus"));
        assertEquals("UNVERIFIED", payload.get("confidence"));
        assertNull(payload.get("aggregateScore"));
        assertNull(payload.get("referenceLevel"));
        assertFalse(payload.containsKey("dimensionSummaries"));
    }

    private static P1PlacementJdbcController controller(JdbcTemplate jdbc, AssessmentOutboxPort outbox) {
        return new P1PlacementJdbcController(jdbc, new ObjectMapper(),
                new UnavailableP1PlacementSourcePort(), outbox);
    }

    private static void denied(Runnable command) {
        assertEquals(HttpStatus.FORBIDDEN,
                assertThrows(ResponseStatusException.class, command::run).getStatusCode());
    }

    private static JwtAuthenticationToken learner(String... permissions) {
        return learnerWithGate("GRANTED", permissions);
    }

    private static JwtAuthenticationToken learnerWithGate(String consent, String... permissions) {
        Jwt jwt = Jwt.withTokenValue("verified")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of(permissions))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", consent)
                .build();
        return new JwtAuthenticationToken(jwt, List.of(), SUBJECT);
    }

    private static VerifiedAssessmentPrincipal principal() {
        return new VerifiedAssessmentPrincipal(SUBJECT, "platform", Set.of("learner"),
                Set.of("assessment.placement.response.submit"));
    }

    private static Map<String, Object> sealed(String questionType, Map<String, Object> answerRules) {
        return Map.of("contentCode", "p1.placement", "contentVersionId", 22,
                "questionId", 1, "itemId", 1, "questionType", questionType,
                "learnerFields", Map.of("stem", "Question"), "answerRules", answerRules,
                "scoringVersion", "rule-v1", "maxScore", 1);
    }

    private static Map<String, Object> session() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("session_snapshot_digest", "d".repeat(64));
        value.put("manifest_json", Map.of("placementManifestId", "P1_PLACEMENT_V1",
                "placementManifestVersion", "P1_PLACEMENT_V1", "placementManifestDigest", "a".repeat(64),
                "dimensionSetDigest", "b".repeat(64), "totalItemCount", 10));
        value.put("content_pin_json", Map.of("contentVersionId", 22, "contentEpoch", 0,
                "snapshotId", "snap_placement01", "snapshotHash", "c".repeat(64)));
        value.put("answer_rule_pin_json", Map.of("answerRuleSetVersion", "set-v1",
                "answerRuleVersion", "rule-v1", "ruleDigest", "e".repeat(64),
                "completionRuleVersion", "P1_PLACEMENT_V1"));
        value.put("target_pin_json", Map.of("targetId", 7, "targetVersion", 2,
                "targetSnapshotDigest", "f".repeat(64)));
        return value;
    }

    private static Map<String, Object> result(String kind) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("placementResultId", "plr_12345678");
        value.put("resultVersion", 1);
        value.put("reportId", "rpt_12345678");
        value.put("reportVersion", 1);
        value.put("resultDigest", "1".repeat(64));
        value.put("reportDigest", "2".repeat(64));
        value.put("sessionId", "asess_12345678");
        value.put("resultKind", kind);
        value.put("completionStatus", "ASSESSED".equals(kind) ? "COMPLETED" : "SKIPPED");
        value.put("aggregateScore", "ASSESSED".equals(kind) ? 60 : null);
        value.put("referenceLevel", "ASSESSED".equals(kind) ? "B1" : null);
        value.put("confidence", "ASSESSED".equals(kind) ? "HIGH" : "UNVERIFIED");
        value.put("coverageRatio", "ASSESSED".equals(kind) ? 1 : 0);
        value.put("completedAt", "2026-09-23T00:00:00Z");
        return value;
    }
}
