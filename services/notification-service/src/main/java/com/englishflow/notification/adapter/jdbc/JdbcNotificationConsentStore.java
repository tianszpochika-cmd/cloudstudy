package com.englishflow.notification.adapter.jdbc;

import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.port.NotificationConsentPort;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/** Read-only consent view for delivery; consent writes remain an authenticated server boundary. */
public final class JdbcNotificationConsentStore implements NotificationConsentPort {

    private final JdbcTemplate jdbc;

    public JdbcNotificationConsentStore(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public Optional<Boolean> findConsent(String tenantId, String principalId, NotificationChannel channel) {
        try {
            return jdbc.query("""
                    SELECT granted FROM notification_consent_fact
                    WHERE tenant_id = ? AND principal_id = ? AND channel = ?
                    """, (rs, row) -> rs.getBoolean("granted"), tenantId, principalId, channel.name())
                    .stream().findFirst();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    /** Server-side/IAM ingestion seam; callers must supply a durable idempotency key. */
    public void saveConsent(String tenantId, String principalId, NotificationChannel channel, boolean granted,
            String source, String idempotencyKey, Instant updatedAt) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw NotificationDomainException.invalid("consent idempotency key is required");
        }
        try {
            jdbc.update("""
                    INSERT INTO notification_consent_fact
                        (tenant_id, principal_id, channel, granted, source, idempotency_key, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        granted = VALUES(granted), source = VALUES(source),
                        idempotency_key = VALUES(idempotency_key), updated_at = VALUES(updated_at)
                    """, tenantId, principalId, channel.name(), granted, source, idempotencyKey,
                    java.sql.Timestamp.from(updatedAt));
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification durable persistence is unavailable");
    }
}
