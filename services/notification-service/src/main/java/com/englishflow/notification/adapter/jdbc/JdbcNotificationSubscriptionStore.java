package com.englishflow.notification.adapter.jdbc;

import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationSubscription;
import com.englishflow.notification.port.NotificationSubscriptionStore;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Optional;

/** Content-service-owned MySQL subscription store with version-guarded writes. */
public final class JdbcNotificationSubscriptionStore implements NotificationSubscriptionStore {

    private final JdbcTemplate jdbc;

    public JdbcNotificationSubscriptionStore(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public Optional<NotificationSubscription> findSubscription(String tenantId, String principalId,
            String notificationType, NotificationChannel channel) {
        try {
            return jdbc.query("""
                    SELECT tenant_id, principal_id, notification_type, channel, subscribed, version_no, updated_at
                    FROM notification_subscription
                    WHERE tenant_id = ? AND principal_id = ? AND notification_type = ? AND channel = ?
                    """, (rs, row) -> map(rs), tenantId, principalId, notificationType, channel.name())
                    .stream().findFirst();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public NotificationSubscription saveSubscription(NotificationSubscription subscription) {
        try {
            Optional<NotificationSubscription> current = findSubscription(subscription.tenantId(),
                    subscription.principalId(), subscription.notificationType(), subscription.channel());
            if (current.isEmpty()) {
                if (subscription.version() != 1) {
                    throw new NotificationDomainException(NotificationDomainException.Code.VERSION_CONFLICT,
                            "subscription does not exist at the requested version");
                }
                jdbc.update("""
                        INSERT INTO notification_subscription
                            (tenant_id, principal_id, notification_type, channel, subscribed, version_no, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, subscription.tenantId(), subscription.principalId(), subscription.notificationType(),
                        subscription.channel().name(), subscription.subscribed(), 1,
                        java.sql.Timestamp.from(subscription.updatedAt()));
                return subscription;
            }
            if (current.get().version() != subscription.version() - 1
                    && current.get().version() != subscription.version()) {
                throw new NotificationDomainException(NotificationDomainException.Code.VERSION_CONFLICT,
                        "subscription version changed before commit");
            }
            int updated = jdbc.update("""
                    UPDATE notification_subscription
                    SET subscribed = ?, version_no = ?, updated_at = ?
                    WHERE tenant_id = ? AND principal_id = ? AND notification_type = ? AND channel = ?
                      AND version_no = ?
                    """, subscription.subscribed(), subscription.version(),
                    java.sql.Timestamp.from(subscription.updatedAt()), subscription.tenantId(),
                    subscription.principalId(), subscription.notificationType(), subscription.channel().name(),
                    current.get().version());
            if (updated != 1) {
                throw new NotificationDomainException(NotificationDomainException.Code.VERSION_CONFLICT,
                        "subscription version changed before commit");
            }
            return subscription;
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    private static NotificationSubscription map(ResultSet rs) throws SQLException {
        return new NotificationSubscription(rs.getString("tenant_id"), rs.getString("principal_id"),
                rs.getString("notification_type"), NotificationChannel.valueOf(rs.getString("channel")),
                rs.getBoolean("subscribed"), rs.getLong("version_no"),
                rs.getTimestamp("updated_at").toInstant());
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification subscription persistence is unavailable");
    }
}
