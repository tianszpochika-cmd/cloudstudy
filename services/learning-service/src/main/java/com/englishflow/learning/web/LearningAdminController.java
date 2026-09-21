package com.englishflow.learning.web;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Single-tenant control-plane reads and governed SRS recovery on learning facts.
 *
 * <p>Every call requires a verified tenant-admin JWT; the target subject comes
 * from the path. The only write resets a stuck SRS row to its SM2-consistent
 * initial state under an Idempotency-Key; scores, intervals and mastery are
 * never set from client values.</p>
 */
@RestController
@RequestMapping("/internal/v1/learning/admin")
@ConditionalOnExpression("'jdbc'.equals('${learning.persistence.mode:fail-closed}') || 'mysql'.equals('${learning.persistence.mode:fail-closed}')")
public class LearningAdminController {

    private static final String TENANT = "platform";

    private final JdbcTemplate jdbc;

    public LearningAdminController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/subjects/{subjectId}/plans")
    public ResponseEntity<Map<String, Object>> plans(
            @PathVariable String subjectId,
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        requireRead(authentication);
        String subject = validSubject(subjectId);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT plan_id, status, target_minutes, plan_version, updated_at "
                        + "FROM b25_learning_plan WHERE principal_id = ? AND tenant_id = ? ORDER BY plan_id DESC LIMIT 20",
                subject, TENANT);
        Map<String, Object> counts = one(
                "SELECT COUNT(*) total, SUM(stage = 'NEW') new_count, SUM(stage = 'LEARNING') learning_count, "
                        + "SUM(stage = 'REVIEW') review_count, SUM(stage = 'MASTERED') mastered_count "
                        + "FROM b25_learning_srs_state WHERE principal_id = ? AND tenant_id = ?",
                subject, TENANT);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("subjectId", subject);
        data.put("plans", rows);
        data.put("srsOverview", counts);
        return ResponseEntity.ok(Map.of("data", data));
    }

    @GetMapping("/subjects/{subjectId}/srs")
    public ResponseEntity<Map<String, Object>> srs(
            @PathVariable String subjectId,
            Authentication authentication,
            @RequestParam(defaultValue = "100") int limit,
            @RequestHeader HttpHeaders headers) {
        requireRead(authentication);
        String subject = validSubject(subjectId);
        int bounded = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> due = jdbc.queryForList(
                "SELECT item_id, stage, due_at, interval_days, ease_factor, review_count "
                        + "FROM b25_learning_srs_state WHERE principal_id = ? AND tenant_id = ? "
                        + "AND due_at <= CURRENT_TIMESTAMP(6) ORDER BY due_at LIMIT ?",
                subject, TENANT, bounded);
        return ResponseEntity.ok(Map.of("data", Map.of("subjectId", subject, "due", due)));
    }

    @PostMapping("/subjects/{subjectId}/commands")
    public ResponseEntity<Map<String, Object>> command(
            @PathVariable String subjectId,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader HttpHeaders headers) {
        String admin = requireWrite(authentication);
        String subject = validSubject(subjectId);
        Map<String, Object> input = body == null ? Map.of() : body;
        String command = text(input.get("command")).toUpperCase();
        if (!"RESET_SRS_ITEM".equals(command)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported learning admin command");
        }
        String key = requireKey(idempotencyKey);
        String itemId = text(input.get("itemId"));
        if (itemId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "itemId is required");
        }
        Map<String, Object> current = one(
                "SELECT item_id, stage, last_idempotency_key FROM b25_learning_srs_state "
                        + "WHERE principal_id = ? AND item_id = ? AND tenant_id = ?",
                subject, itemId, TENANT);
        if (current != null && key.equals(String.valueOf(current.get("last_idempotency_key")))) {
            return ResponseEntity.status(HttpStatus.ACCEPTED)
                    .body(Map.of("data", Map.of("command", command, "subjectId", subject,
                            "itemId", itemId, "replayed", true, "adminSubject", admin)));
        }
        if (current == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "SRS row does not exist");
        }
        int updated = jdbc.update(
                "UPDATE b25_learning_srs_state SET stage = 'NEW', due_at = CURRENT_TIMESTAMP(6), "
                        + "interval_days = 0, ease_factor = 2.50, review_count = 0, last_idempotency_key = ? "
                        + "WHERE principal_id = ? AND item_id = ? AND tenant_id = ?",
                key, subject, itemId, TENANT);
        if (updated != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SRS row changed concurrently");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("command", command);
        data.put("subjectId", subject);
        data.put("itemId", itemId);
        data.put("replayed", false);
        data.put("reasonCode", textOr(input.get("reasonCode"), "ADMIN_SRS_RESET"));
        data.put("adminSubject", admin);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data", data));
    }

    private static void requireRead(Authentication authentication) {
        adminSubject(authentication, "admin.learning.read");
    }

    private static String requireWrite(Authentication authentication) {
        return adminSubject(authentication, "admin.learning.write");
    }

    private static String adminSubject(Authentication authentication, String permission) {
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
                && !permissions.contains(permission)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "tenant admin permission is required");
        }
        String subject = token.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "verified principal id is missing");
        }
        return subject;
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

    private Map<String, Object> one(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static String validSubject(String subjectId) {
        if (subjectId == null || !subjectId.trim().matches(
                "(prn_[A-Za-z0-9._:-]{15,127}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "subjectId has an unsafe format");
        }
        return subjectId.trim();
    }

    private static String requireKey(String value) {
        if (value == null || value.trim().length() < 16) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key is required");
        }
        return value.trim();
    }

    private static String text(Object value) {
        return value instanceof String string ? string.trim() : "";
    }

    private static String textOr(Object value, String fallback) {
        String text = text(value);
        return text.isEmpty() ? fallback : text;
    }

    private static Instant instant(Object value) {
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant();
        }
        return null;
    }
}
