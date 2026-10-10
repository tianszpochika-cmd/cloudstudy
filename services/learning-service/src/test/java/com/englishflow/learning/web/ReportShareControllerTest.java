package com.englishflow.learning.web;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReportShareControllerTest {

    @Test
    void issueStoresOnlyPublicFieldsAndTheRefIsUnguessable() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(contains("b3_learning_interaction"), any(Object[].class))).thenReturn(List.of());
        when(jdbc.update(contains("b25_learning_report_share"), any(), any(), any(), any(), any(), any())).thenReturn(1);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);

        Map<String, Object> issued = controller.issueReportShare(learner(), "DAILY", "2026-10-11");

        String ref = String.valueOf(issued.get("ref"));
        assertTrue(ref.matches("[0-9a-f]{32}"));
        assertEquals("/api/v1/public/learning/report-shares/" + ref, issued.get("publicPath"));
        assertFalse(issued.containsKey("token"));
        assertFalse(issued.containsKey("subject"));
        org.mockito.ArgumentCaptor<String> snapshot = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(contains("INSERT INTO b25_learning_report_share"),
                eq(ref), eq("platform"), eq("learner-share-test"), eq("DAILY"), snapshot.capture(), any());
        assertTrue(snapshot.getValue().contains("NEVER_STUDIED"));
        assertFalse(snapshot.getValue().contains("token"));
        assertFalse(snapshot.getValue().contains("\"subject\""));
    }

    @Test
    void publicReadHidesTheOwnerAndRevokeIsOwnerOnly() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25LearningJdbcController controller = new B25LearningJdbcController(jdbc);
        String ref = "ab".repeat(16);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("share_ref", ref);
        row.put("principal_id", "learner-share-test");
        row.put("snapshot_json", "{\"availability\":\"EMPTY\",\"copy\":\"这段时间还没有学习记录。\",\"subject\":\"learner-share-test\",\"token\":\"secret\"}");
        row.put("expires_at", java.sql.Timestamp.from(Instant.parse("2026-10-18T00:00:00Z")));
        row.put("revoked_at", null);
        when(jdbc.queryForList(contains("b25_learning_report_share"), eq(ref), eq("platform"))).thenReturn(List.of(row));

        Map<String, Object> view = controller.readReportShare(ref);
        assertEquals("ACTIVE", view.get("status"));
        assertEquals("EMPTY", view.get("availability"));
        assertFalse(view.containsKey("subject"));
        assertFalse(view.containsKey("token"));
        assertFalse(String.valueOf(view).contains("secret"));

        row.put("principal_id", "someone-else");
        ResponseStatusException hidden = assertThrows(ResponseStatusException.class,
                () -> controller.revokeReportShare(learner(), ref));
        assertEquals(HttpStatus.NOT_FOUND, hidden.getStatusCode());
    }

    private static JwtAuthenticationToken learner() {
        Instant now = Instant.parse("2026-10-11T00:00:00Z");
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .subject("learner-share-test")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("learning.progress.read"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .claim("phase", "phase-1")
                .claim("account_status", "ACTIVE")
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }
}
