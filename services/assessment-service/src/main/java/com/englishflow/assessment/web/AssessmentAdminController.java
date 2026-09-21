package com.englishflow.assessment.web;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Single-tenant control-plane reads on assessment facts.
 *
 * <p>Every call requires a verified tenant-admin JWT; the target subject comes
 * from the path. Answers, evidence payloads and answer hashes are never
 * exposed; only session/report/mistake summaries cross this boundary.
 * B3 ships no assessment writes.</p>
 */
@RestController
@RequestMapping("/internal/v1/assessment/admin")
@ConditionalOnProperty(prefix = "assessment.persistence", name = "enabled", havingValue = "true")
public class AssessmentAdminController {

    private static final String TENANT = "platform";

    private final JdbcTemplate jdbc;

    public AssessmentAdminController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/subjects/{subjectId}/assessments")
    public ResponseEntity<Map<String, Object>> assessments(
            @PathVariable String subjectId,
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        requireRead(authentication);
        String subject = validSubject(subjectId);
        List<Map<String, Object>> sessions = jdbc.queryForList(
                "SELECT session_id, session_type, session_status, created_at, closed_at "
                        + "FROM assessment_session WHERE tenant_id = ? AND subject_id = ? "
                        + "ORDER BY created_at DESC LIMIT 20",
                TENANT, subject);
        List<Map<String, Object>> reports = jdbc.queryForList(
                "SELECT report_id, session_id, report_type, report_status, score, max_score, "
                        + "completed_count, total_count, calculation_version, generated_at "
                        + "FROM assessment_report WHERE tenant_id = ? AND subject_id = ? "
                        + "ORDER BY generated_at DESC LIMIT 20",
                TENANT, subject);
        List<Map<String, Object>> mistakes = jdbc.queryForList(
                "SELECT mistake_id, item_id, question_id, error_category, rule_version, "
                        + "wrong_count, mistake_status, mastery_status, first_error_at, last_error_at "
                        + "FROM assessment_mistake WHERE tenant_id = ? AND subject_id = ? "
                        + "ORDER BY last_error_at DESC LIMIT 50",
                TENANT, subject);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("subjectId", subject);
        data.put("sessions", sessions);
        data.put("reports", reports);
        data.put("mistakes", mistakes);
        return ResponseEntity.ok(Map.of("data", data));
    }

    private static void requireRead(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "verified JWT principal is required");
        }
        Jwt token = jwt.getToken();
        if (!TENANT.equals(token.getClaimAsString("tenant_id"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "tenant is not allowed");
        }
        Set<String> roles = strings(token.getClaim("roles"));
        Set<String> permissions = strings(token.getClaim("permissions"));
        if (!roles.contains("platform-admin") && !roles.contains("tenant-admin")
                && !permissions.contains("admin.assessment.read")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "tenant admin permission is required");
        }
    }

    private static Set<String> strings(Object claim) {
        Set<String> values = new LinkedHashSet<>();
        if (claim instanceof String text && !text.isBlank()) {
            values.add(text);
        } else if (claim instanceof Iterable<?> items) {
            for (Object item : items) {
                if (item instanceof String text && !text.isBlank()) values.add(text);
            }
        }
        return values;
    }

    private static String validSubject(String subjectId) {
        if (subjectId == null || !subjectId.trim().matches(
                "(prn_[A-Za-z0-9._:-]{15,127}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "subjectId has an unsafe format");
        }
        return subjectId.trim();
    }
}
