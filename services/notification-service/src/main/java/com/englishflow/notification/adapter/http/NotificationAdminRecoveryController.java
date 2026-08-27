package com.englishflow.notification.adapter.http;

import com.englishflow.notification.application.NotificationRecoveryApplicationService;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.RecoveryAction;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RecoveryResult;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Local-real B12 governance adapter. The browser-facing admin contract is owned by notification
 * service; it never forwards an admin request to the historical core-api controller.
 */
@RestController
@Profile("local-real")
@RequestMapping("/internal/v1/notifications/admin/recovery/tasks")
public final class NotificationAdminRecoveryController {

    private final JdbcTemplate jdbc;
    private final NotificationPrincipalResolver principals;
    private final NotificationAccessPolicy access;
    private final NotificationRecoveryApplicationService recovery;

    public NotificationAdminRecoveryController(JdbcTemplate jdbc,
            NotificationPrincipalResolver principals,
            NotificationAccessPolicy access,
            NotificationRecoveryApplicationService recovery) {
        this.jdbc = jdbc;
        this.principals = principals;
        this.access = access;
        this.recovery = recovery;
    }

    @GetMapping
    public Map<String, Object> list(Authentication authentication,
            @RequestParam(defaultValue = "PENDING") String status,
            HttpServletRequest request) {
        NotificationPrincipalContext principal = principals.require(authentication);
        access.requireRecoveryRead(principal);
        String predicate = switch (status) {
            case "RUNNING" -> "state IN ('RUNNING', 'RETRY_SCHEDULED')";
            case "SUCCEEDED" -> "state = 'SUCCEEDED'";
            case "FAILED" -> "state = 'FAILED'";
            case "DLQ" -> "state = 'DEAD_LETTER'";
            case "MANUAL_REVIEW" -> "state = 'MANUAL_RECOVERY'";
            default -> "state IN ('QUEUED', 'RETRY_SCHEDULED', 'DEAD_LETTER')";
        };
        List<Map<String, Object>> items = jdbc.query(
                "SELECT task_id, action, state, reason_code, attempt, max_attempts, updated_at "
                        + "FROM notification_workflow_task WHERE tenant_id = ? AND " + predicate
                        + " ORDER BY updated_at DESC LIMIT 100",
                (rs, row) -> taskView(rs), principal.tenantId());
        return envelope(Map.of("items", items, "status", status, "source", "mysql"), request);
    }

    @PostMapping("/{taskId}/commands")
    public Map<String, Object> command(Authentication authentication,
            @PathVariable String taskId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "traceparent", required = false) String traceparent,
            HttpServletRequest request) {
        NotificationPrincipalContext principal = principals.require(authentication);
        String requestedAction = String.valueOf(body.getOrDefault("action", "")).trim();
        RecoveryAction action = switch (requestedAction) {
            // A DEAD_LETTER task has exhausted ordinary retries. B12's RETRY button therefore
            // deliberately maps to the durable REPLAY transition, not to an in-memory retry.
            case "RETRY", "REPLAY" -> RecoveryAction.REPLAY;
            case "CANCEL" -> RecoveryAction.CANCEL;
            case "MANUAL_REVIEW" -> RecoveryAction.MANUAL_REVIEW;
            default -> throw new IllegalArgumentException("unsupported recovery action");
        };
        RequestMetadata metadata = new RequestMetadata(
                requestId == null || requestId.isBlank() ? "req-b12-recovery" : requestId,
                traceparent == null || traceparent.isBlank() ? "trace-b12-recovery" : traceparent);
        RecoveryResult result = recovery.recover(principal,
                new RecoveryCommand(taskId, action, "B12_ADMIN_" + requestedAction), metadata);
        return envelope(Map.of("taskId", result.taskId(), "action", requestedAction,
                "state", result.state().name(), "reasonCode", result.reasonCode(),
                "updatedAt", result.updatedAt().toString(), "source", "mysql"), request);
    }

    private static Map<String, Object> taskView(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        int attempt = rs.getInt("attempt");
        int maxAttempts = rs.getInt("max_attempts");
        return map("taskId", rs.getString("task_id"), "domain", "notification",
                "status", rs.getString("state"), "reasonCode", rs.getString("reason_code"),
                "updatedAt", updatedAt == null ? null : updatedAt.toInstant().toString(),
                "retryable", attempt < maxAttempts && "DEAD_LETTER".equals(rs.getString("state")));
    }

    private static Map<String, Object> envelope(Map<String, Object> data, HttpServletRequest request) {
        String requestId = request.getHeader("X-Request-Id");
        return map("requestId", requestId == null || requestId.isBlank() ? "req_notification_admin" : requestId,
                "data", data, "meta", map("service", "notification-service", "schemaVersion", "notification.api.v1"));
    }

    private static Map<String, Object> map(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) result.put(String.valueOf(pairs[index]), pairs[index + 1]);
        return result;
    }
}
