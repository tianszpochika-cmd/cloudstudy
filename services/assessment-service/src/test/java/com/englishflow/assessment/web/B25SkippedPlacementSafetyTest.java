package com.englishflow.assessment.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import tools.jackson.databind.ObjectMapper;

class B25SkippedPlacementSafetyTest {
    @Test
    void skippedReportCannotMasqueradeAsAMeasuredCefrResult() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenAnswer(call -> {
            String sql = call.getArgument(0);
            if (sql.contains("b25_assessment_session")) {
                return List.of(Map.of("session_id", "session-1", "report_id", "report-1", "status", "SKIPPED"));
            }
            if (sql.contains("b25_assessment_report")) {
                return List.of(Map.of("report_id", "report-1", "session_id", "session-1",
                        "result_kind", "SKIPPED", "requested_starting_level", "B1"));
            }
            return List.of();
        });
        B25AssessmentJdbcController controller = new B25AssessmentJdbcController(jdbc, new ObjectMapper());
        Map<String, Object> report = controller.report(authentication(), "session-1");
        assertEquals("SKIPPED", report.get("resultKind"));
        assertEquals("UNVERIFIED", report.get("confidence"));
        assertNull(report.get("score"));
        assertNull(report.get("cefrLevel"));
        assertFalse(report.containsKey("estimatedVocabulary"));
        assertFalse(report.containsKey("radarScores"));
        assertEquals(Map.of("level", "B1", "authority", "USER_SELECTED_NON_AUTHORITATIVE"),
                report.get("requestedStartingLevel"));
    }

    private static JwtAuthenticationToken authentication() {
        Instant now = Instant.parse("2026-09-23T00:00:00Z");
        Jwt jwt = Jwt.withTokenValue("verified")
                .header("alg", "RS256")
                .subject("learner-1")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("assessment.session.read"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }
}
