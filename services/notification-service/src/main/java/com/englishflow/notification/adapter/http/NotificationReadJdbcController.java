package com.englishflow.notification.adapter.http;

import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** Durable learner notification read facts for the local-real JDBC runtime. */
@RestController
@RequestMapping("/internal/v1/notifications")
@ConditionalOnProperty(prefix = "notification.persistence", name = "mode", havingValue = "jdbc")
public final class NotificationReadJdbcController {

    private final JdbcTemplate jdbc;
    private final NotificationPrincipalResolver principals;
    private final NotificationAccessPolicy access;

    public NotificationReadJdbcController(JdbcTemplate jdbc, NotificationPrincipalResolver principals,
            NotificationAccessPolicy access) {
        this.jdbc = jdbc;
        this.principals = principals;
        this.access = access;
    }

    @PutMapping("/messages/{messageId}/read")
    public Map<String, Object> read(Authentication authentication, @PathVariable String messageId,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        NotificationPrincipalContext context = owner(authentication);
        int updated = jdbc.update("""
                UPDATE notification_message SET notification_status = 'READ'
                 WHERE notification_id = ? AND tenant_id = ? AND subject_id = ?
                """, messageId, context.tenantId(), context.principalId());
        if (updated == 0) throw new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                "notification message was not found");
        return result(messageId, updated);
    }

    @PutMapping("/messages/read-all")
    public Map<String, Object> readAll(Authentication authentication,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        NotificationPrincipalContext context = owner(authentication);
        int updated = jdbc.update("""
                UPDATE notification_message SET notification_status = 'READ'
                 WHERE tenant_id = ? AND subject_id = ? AND notification_status <> 'READ'
                """, context.tenantId(), context.principalId());
        return result("all", updated);
    }

    private NotificationPrincipalContext owner(Authentication authentication) {
        NotificationPrincipalContext context = principals.require(authentication);
        access.requirePermission(context, "notification.read");
        return context;
    }

    private static Map<String, Object> result(String messageId, int updated) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("messageId", messageId);
        response.put("updated", updated > 0);
        response.put("replayed", false);
        response.put("source", "mysql");
        return response;
    }
}
