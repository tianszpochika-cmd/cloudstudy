package com.englishflow.iam.web;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * M6-008 self-scoped account deletion: request with a 168-hour cooling window, status,
 * cancel inside the window, internal execute after it (revokes sessions, flips the
 * account to DELETED, writes the receipt), owner receipts and half-deleted recovery view.
 *
 * <p>Cross-owner anonymization fan-out rides the workflow Saga and is recorded as a
 * follow-up, not claimed here. The row is retained for audit either way.</p>
 */
@RestController
public final class IamAccountDeletionController {

    private static final long COOLING_SECONDS = 7L * 24L * 60L * 60L;

    private final ObjectProvider<JdbcTemplate> jdbc;

    public IamAccountDeletionController(ObjectProvider<JdbcTemplate> jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @PostMapping("/api/v1/iam/account-deletions")
    public Map<String, Object> request(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication authentication) {
        Principal principal = accessPrincipal(authentication);
        JdbcTemplate template = requiredJdbc();
        String key = requireKey(idempotencyKey);
        List<Map<String, Object>> existing = template.queryForList(
                "SELECT deletion_request_id, status FROM iam_account_deletion WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?",
                principal.tenantId(), principal.subject(), key);
        if (!existing.isEmpty()) {
            return envelope(deletionView(findRequest(template, principal,
                    String.valueOf(existing.get(0).get("deletion_request_id")))));
        }
        String requestId = "del_" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
        template.update(
                "INSERT INTO iam_account_deletion (deletion_request_id, principal_id, tenant_id, status, execute_at, idempotency_key, receipt_json, created_at, decided_at)"
                        + " VALUES (?, ?, ?, 'REQUESTED', DATE_ADD(CURRENT_TIMESTAMP(6), INTERVAL 168 HOUR), ?, NULL, CURRENT_TIMESTAMP(6), NULL)",
                requestId, principal.subject(), principal.tenantId(), key);
        return envelope(deletionView(findRequest(template, principal, requestId)));
    }

    @GetMapping("/api/v1/iam/account-deletions/{deletionRequestId}")
    public Map<String, Object> status(@PathVariable String deletionRequestId,
            Authentication authentication) {
        Principal principal = accessPrincipal(authentication);
        return envelope(deletionView(findRequest(requiredJdbc(), principal, deletionRequestId)));
    }

    @PostMapping("/api/v1/iam/account-deletions/{deletionRequestId}/cancel")
    public Map<String, Object> cancel(@PathVariable String deletionRequestId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication authentication) {
        Principal principal = accessPrincipal(authentication);
        JdbcTemplate template = requiredJdbc();
        Map<String, Object> row = findRequest(template, principal, deletionRequestId);
        if (!"REQUESTED".equals(String.valueOf(row.get("status")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "only a cooling deletion can be cancelled");
        }
        template.update(
                "UPDATE iam_account_deletion SET status = 'CANCELLED', decided_at = CURRENT_TIMESTAMP(6)"
                        + " WHERE deletion_request_id = ? AND tenant_id = ? AND principal_id = ? AND status = 'REQUESTED'",
                deletionRequestId, principal.tenantId(), principal.subject());
        return envelope(deletionView(findRequest(template, principal, deletionRequestId)));
    }

    @PostMapping("/internal/v1/iam/account-deletions/{deletionRequestId}/execute")
    public Map<String, Object> execute(@PathVariable String deletionRequestId,
            Authentication authentication) {
        servicePrincipal(authentication);
        JdbcTemplate template = requiredJdbc();
        Map<String, Object> row = template.queryForList(
                "SELECT deletion_request_id, principal_id, tenant_id, status, execute_at FROM iam_account_deletion WHERE deletion_request_id = ?",
                deletionRequestId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "deletion request does not exist"));
        if (!"REQUESTED".equals(String.valueOf(row.get("status")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "deletion is not executable");
        }
        Object executeAt = row.get("execute_at");
        if (executeAt instanceof java.sql.Timestamp stamp && stamp.toInstant().isAfter(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "cooling window has not elapsed");
        }
        String principalId = String.valueOf(row.get("principal_id"));
        String tenantId = String.valueOf(row.get("tenant_id"));
        int sessionsRevoked = template.update(
                "UPDATE iam_session SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP(6), revoke_reason = 'ACCOUNT_DELETED'"
                        + " WHERE principal_id = ? AND status <> 'REVOKED'",
                principalId);
        template.update("UPDATE iam_account SET status = 'DELETED' WHERE principal_id = ?",
                principalId);
        String receipt = "{\"deletionRequestId\":\"" + deletionRequestId + "\",\"sessionsRevoked\":" + sessionsRevoked
                + ",\"accountStatus\":\"DELETED\",\"executedAt\":\"" + Instant.now() + "\"}";
        template.update(
                "UPDATE iam_account_deletion SET status = 'EXECUTED', decided_at = CURRENT_TIMESTAMP(6), receipt_json = ?"
                        + " WHERE deletion_request_id = ? AND status = 'REQUESTED'",
                receipt, deletionRequestId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("deletionRequestId", deletionRequestId);
        data.put("status", "EXECUTED");
        data.put("sessionsRevoked", sessionsRevoked);
        data.put("receipt", receipt);
        return envelope(data);
    }

    @GetMapping("/internal/v1/iam/account-deletions/{deletionRequestId}/owner-receipts")
    public Map<String, Object> ownerReceipts(@PathVariable String deletionRequestId,
            Authentication authentication) {
        servicePrincipal(authentication);
        JdbcTemplate template = requiredJdbc();
        Map<String, Object> row = template.queryForList(
                "SELECT deletion_request_id, principal_id, tenant_id, status, receipt_json, decided_at FROM iam_account_deletion WHERE deletion_request_id = ?",
                deletionRequestId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "deletion request does not exist"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("deletionRequestId", row.get("deletion_request_id"));
        data.put("status", row.get("status"));
        data.put("receipt", row.get("receipt_json"));
        data.put("decidedAt", row.get("decided_at"));
        return envelope(data);
    }

    @GetMapping("/internal/v1/iam/account-deletions/{deletionRequestId}/recovery")
    public Map<String, Object> recovery(@PathVariable String deletionRequestId,
            Authentication authentication) {
        servicePrincipal(authentication);
        JdbcTemplate template = requiredJdbc();
        Map<String, Object> row = template.queryForList(
                "SELECT deletion_request_id, principal_id, tenant_id, status, execute_at, decided_at FROM iam_account_deletion WHERE deletion_request_id = ?",
                deletionRequestId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "deletion request does not exist"));
        String principalId = String.valueOf(row.get("principal_id"));
        Integer activeSessions = template.queryForObject(
                "SELECT COUNT(*) FROM iam_session WHERE principal_id = ? AND status = 'ACTIVE'",
                Integer.class, principalId);
        String accountStatus = template.queryForList(
                "SELECT status FROM iam_account WHERE principal_id = ?", principalId).stream()
                .findFirst().map(entry -> String.valueOf(entry.get("status"))).orElse("UNKNOWN");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("deletionRequestId", row.get("deletion_request_id"));
        data.put("deletionStatus", row.get("status"));
        data.put("accountStatus", accountStatus);
        data.put("activeSessions", activeSessions == null ? 0 : activeSessions);
        data.put("executeAt", row.get("execute_at"));
        return envelope(data);
    }

    private Map<String, Object> findRequest(JdbcTemplate template, Principal principal, String requestId) {
        return template.queryForList(
                "SELECT deletion_request_id, principal_id, tenant_id, status, execute_at, created_at, decided_at FROM iam_account_deletion"
                        + " WHERE deletion_request_id = ? AND tenant_id = ? AND principal_id = ?",
                requestId, principal.tenantId(), principal.subject()).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "deletion request does not exist"));
    }

    private static Map<String, Object> deletionView(Map<String, Object> row) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("deletionRequestId", row.get("deletion_request_id"));
        data.put("status", row.get("status"));
        data.put("executeAt", row.get("execute_at"));
        data.put("createdAt", row.get("created_at"));
        data.put("decidedAt", row.get("decided_at"));
        data.put("coolingHours", 168);
        return data;
    }

    private static Map<String, Object> envelope(Map<String, Object> data) {
        return Map.of("data", data, "meta", Map.of("source", "IAM"));
    }

    private JdbcTemplate requiredJdbc() {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (template == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "IAM persistence is not configured");
        }
        return template;
    }

    private static String requireKey(String value) {
        if (value == null || value.isBlank() || value.length() > 192) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key is required");
        }
        return value.trim();
    }

    private static Principal accessPrincipal(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken token && token.isAuthenticated()) {
            Jwt jwt = token.getToken();
            if (jwt.getSubject() != null && !jwt.getSubject().isBlank()
                    && jwt.getClaimAsString("tenant_id") != null) {
                return new Principal(jwt.getSubject(), jwt.getClaimAsString("tenant_id"));
            }
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "verified access principal is required");
    }

    private static void servicePrincipal(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken token && token.isAuthenticated()
                && token.getAuthorities().stream().anyMatch(a -> "TOKEN_TYPE_service".equals(a.getAuthority()))) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "service principal is required");
    }

    private record Principal(String subject, String tenantId) {
    }
}
