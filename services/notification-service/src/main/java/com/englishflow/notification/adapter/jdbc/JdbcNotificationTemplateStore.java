package com.englishflow.notification.adapter.jdbc;

import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationTemplate;
import com.englishflow.notification.port.NotificationTemplateStore;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Optional;

/** Content-service-owned MySQL template store. Templates are immutable facts; retire via status. */
public final class JdbcNotificationTemplateStore implements NotificationTemplateStore {

    private final JdbcTemplate jdbc;

    public JdbcNotificationTemplateStore(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public Optional<NotificationTemplate> findTemplate(String templateKey, String templateVersion, String locale) {
        try {
            return jdbc.query("""
                    SELECT template_key, template_version, locale, title_template, body_template, status, updated_at
                    FROM notification_template
                    WHERE template_key = ? AND template_version = ? AND locale = ?
                    """, (rs, row) -> map(rs), templateKey, templateVersion, locale)
                    .stream().findFirst();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public void saveTemplate(NotificationTemplate template) {
        try {
            jdbc.update("""
                    INSERT INTO notification_template
                        (template_key, template_version, locale, title_template, body_template, status, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        title_template = VALUES(title_template), body_template = VALUES(body_template),
                        status = VALUES(status), updated_at = VALUES(updated_at)
                    """, template.templateKey(), template.templateVersion(), template.locale(),
                    template.titleTemplate(), template.bodyTemplate(), template.status().name(),
                    java.sql.Timestamp.from(template.updatedAt()));
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    private static NotificationTemplate map(ResultSet rs) throws SQLException {
        return new NotificationTemplate(rs.getString("template_key"), rs.getString("template_version"),
                rs.getString("locale"), rs.getString("title_template"), rs.getString("body_template"),
                NotificationTemplate.TemplateStatus.valueOf(rs.getString("status")),
                rs.getTimestamp("updated_at").toInstant());
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification template persistence is unavailable");
    }
}
