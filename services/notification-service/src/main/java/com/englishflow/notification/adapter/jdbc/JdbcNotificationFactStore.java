package com.englishflow.notification.adapter.jdbc;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.englishflow.notification.application.DeliveryResult;
import com.englishflow.notification.domain.DeliveryAttempt;
import com.englishflow.notification.domain.DeliveryStatus;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationDndWindow;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationFrequencyPolicy;
import com.englishflow.notification.domain.NotificationMessage;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.domain.WorkflowState;
import com.englishflow.notification.domain.WorkflowTask;
import com.englishflow.notification.port.NotificationFactStore;
import com.englishflow.notification.port.StoredIdempotency;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * MySQL adapter for notification-owned facts. JSON is used only for the
 * service-owned structured attributes and idempotent response snapshots.
 */
public final class JdbcNotificationFactStore implements NotificationFactStore {

    private static final Logger LOGGER = LoggerFactory.getLogger(JdbcNotificationFactStore.class);
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public JdbcNotificationFactStore(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    @Override
    public Optional<NotificationPreference> findPreference(String tenantId, String principalId,
            NotificationCategory category, NotificationChannel channel) {
        try {
            return jdbc.query("""
                    SELECT tenant_id, principal_id, category, channel, enabled, locale, consent_version,
                           dnd_start_local_time, dnd_end_local_time, frequency_policy, version_no, updated_at
                    FROM notification_preference
                    WHERE tenant_id = ? AND principal_id = ? AND category = ? AND channel = ?
                    """, (rs, row) -> preferenceRow(rs), tenantId, principalId, category.name(), channel.name())
                    .stream().findFirst();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public List<NotificationPreference> findPreferences(String tenantId, String principalId) {
        try {
            return jdbc.query("""
                    SELECT tenant_id, principal_id, category, channel, enabled, locale, consent_version,
                           dnd_start_local_time, dnd_end_local_time, frequency_policy, version_no, updated_at
                    FROM notification_preference
                    WHERE tenant_id = ? AND principal_id = ?
                    ORDER BY category, channel
                    """, (rs, row) -> preferenceRow(rs), tenantId, principalId);
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public boolean compareAndSetPreference(NotificationPreference preference, long expectedVersion) {
        Objects.requireNonNull(preference, "preference");
        if (expectedVersion < 0 || preference.version() != expectedVersion + 1) {
            return false;
        }
        try {
            int changed;
            if (expectedVersion == 0) {
                changed = jdbc.update("""
                        INSERT INTO notification_preference
                            (tenant_id, principal_id, category, channel, enabled, locale, consent_version,
                             dnd_start_local_time, dnd_end_local_time, frequency_policy, version_no, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, preference.tenantId(), preference.principalId(), preference.category().name(),
                        preference.channel().name(), preference.enabled(), preference.locale(), preference.consentVersion(),
                        preference.dndWindow().startLocalTime(), preference.dndWindow().endLocalTime(),
                        preference.frequencyPolicy().name(),
                        preference.version(), timestamp(preference.updatedAt()));
            } else {
                changed = jdbc.update("""
                        UPDATE notification_preference
                           SET enabled = ?, locale = ?, consent_version = ?, dnd_start_local_time = ?,
                               dnd_end_local_time = ?, frequency_policy = ?, version_no = ?, updated_at = ?
                         WHERE tenant_id = ? AND principal_id = ? AND category = ? AND channel = ?
                           AND version_no = ?
                        """, preference.enabled(), preference.locale(), preference.consentVersion(),
                        preference.dndWindow().startLocalTime(), preference.dndWindow().endLocalTime(),
                        preference.frequencyPolicy().name(),
                        preference.version(), timestamp(preference.updatedAt()), preference.tenantId(),
                        preference.principalId(), preference.category().name(), preference.channel().name(), expectedVersion);
            }
            return changed == 1;
        } catch (DuplicateKeyException exception) {
            return false;
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public void saveMessage(NotificationMessage message) {
        Objects.requireNonNull(message, "message");
        try {
            jdbc.update("""
                    INSERT INTO notification_message
                        (notification_id, subject_id, tenant_id, notification_type, channel, template_key,
                         template_version, title, safe_body, content_version, locale,
                         structured_attributes_json, not_before, template_only, message_version,
                         notification_status, idempotency_key, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE notification_id = notification_id
                    """, message.messageId(), message.principalId(), message.tenantId(), message.notificationType(),
                    message.channel().name(), message.templateKey(), message.templateVersion(), message.title(), message.safeBody(),
                    message.contentVersion(), message.locale(), writeJson(message.structuredAttributes()),
                    timestamp(message.notBefore()), message.templateOnly(), message.version(), "QUEUED",
                    message.messageId(), timestamp(message.createdAt()));
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<NotificationMessage> findMessage(String tenantId, String principalId, String messageId) {
        try {
            return jdbc.query(messageSelect() + " WHERE tenant_id = ? AND subject_id = ? AND notification_id = ?",
                    (rs, row) -> message(rs), tenantId, principalId, messageId).stream().findFirst();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public List<NotificationMessage> findMessages(String tenantId, String principalId, int limit) {
        int boundedLimit = Math.max(1, Math.min(limit, 100));
        try {
            return jdbc.query(messageSelect()
                            + " WHERE tenant_id = ? AND subject_id = ? ORDER BY created_at DESC LIMIT ?",
                    (rs, row) -> message(rs), tenantId, principalId, boundedLimit);
        } catch (DataAccessException exception) {
            LOGGER.warn("notification message query failed for tenant={} principal={}", tenantId, principalId, exception);
            throw unavailable();
        }
    }

    @Override
    public void appendDeliveryAttempt(DeliveryAttempt attempt) {
        Objects.requireNonNull(attempt, "attempt");
        try {
            jdbc.update("""
                    INSERT INTO notification_delivery_attempt
                        (attempt_id, message_id, channel, attempt_number, status, failure_code,
                         next_attempt_at, request_id, trace_id, occurred_at, retryable)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE attempt_id = attempt_id
                    """, attempt.attemptId(), attempt.messageId(), attempt.channel().name(), attempt.attemptNumber(),
                    attempt.status().name(), attempt.failureCode(), nullableTimestamp(attempt.nextAttemptAt()),
                    attempt.requestId(), attempt.traceId(), timestamp(attempt.occurredAt()), attempt.retryable());
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public List<DeliveryAttempt> findDeliveryAttempts(String messageId) {
        try {
            return jdbc.query("""
                    SELECT attempt_id, message_id, channel, attempt_number, status, failure_code,
                           next_attempt_at, request_id, trace_id, occurred_at, retryable
                    FROM notification_delivery_attempt
                    WHERE message_id = ?
                    ORDER BY attempt_number
                    """, (rs, row) -> attempt(rs), messageId);
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public Optional<StoredIdempotency> findIdempotency(String scope, String key) {
        try {
            return jdbc.query("""
                    SELECT fingerprint, value_type, value_json
                    FROM notification_idempotency
                    WHERE scope_key = ? AND idempotency_key = ?
                    """, (rs, row) -> new StoredIdempotency(rs.getString("fingerprint"),
                            readValue(rs.getString("value_type"), rs.getString("value_json"))), scope, key)
                    .stream().findFirst();
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    @Override
    public void saveIdempotency(String scope, String key, StoredIdempotency value) {
        Objects.requireNonNull(value, "value");
        String type = valueType(value.value());
        String valueJson = writeJson(value.value());
        try {
            Optional<StoredIdempotency> existing = findIdempotency(scope, key);
            if (existing.isPresent()) {
                if (!existing.get().fingerprint().equals(value.fingerprint())
                        || !valueType(existing.get().value()).equals(type)) {
                    throw new NotificationDomainException(NotificationDomainException.Code.IDEMPOTENCY_CONFLICT,
                            "idempotency key was reused with a different command");
                }
                return;
            }
            jdbc.update("""
                    INSERT INTO notification_idempotency
                        (scope_key, idempotency_key, fingerprint, value_type, value_json, created_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                    """, scope, key, value.fingerprint(), type, valueJson);
        } catch (DuplicateKeyException exception) {
            Optional<StoredIdempotency> existing = findIdempotency(scope, key);
            if (existing.isPresent() && existing.get().fingerprint().equals(value.fingerprint())) {
                return;
            }
            throw new NotificationDomainException(NotificationDomainException.Code.IDEMPOTENCY_CONFLICT,
                    "idempotency key was reused with a different command");
        } catch (DataAccessException exception) {
            throw unavailable();
        }
    }

    private static String messageSelect() {
        return """
                SELECT notification_id, subject_id, tenant_id, notification_type, template_key,
                       channel, template_version, title, safe_body, content_version, locale,
                       structured_attributes_json, not_before, template_only, message_version, notification_status, created_at
                FROM notification_message
                """;
    }

    private NotificationPreference preferenceRow(ResultSet rs) throws java.sql.SQLException {
        return new NotificationPreference(rs.getString("tenant_id"), rs.getString("principal_id"),
                NotificationCategory.valueOf(rs.getString("category")),
                NotificationChannel.valueOf(rs.getString("channel")), rs.getBoolean("enabled"),
                rs.getString("locale"), rs.getInt("consent_version"),
                new NotificationDndWindow(rs.getObject("dnd_start_local_time", java.time.LocalTime.class),
                        rs.getObject("dnd_end_local_time", java.time.LocalTime.class)),
                NotificationFrequencyPolicy.valueOf(rs.getString("frequency_policy")),
                rs.getLong("version_no"), instant(rs, "updated_at"));
    }

    private NotificationMessage message(ResultSet rs) throws java.sql.SQLException {
        String messageId = rs.getString("notification_id");
        String tenantId = rs.getString("tenant_id");
        String principalId = rs.getString("subject_id");
        String notificationType = rs.getString("notification_type");
        NotificationChannel channel = NotificationChannel.valueOf(rs.getString("channel"));
        String templateKey = rs.getString("template_key");
        String templateVersion = rs.getString("template_version");
        String locale = rs.getString("locale");
        Map<String, String> attributes = readAttributes(rs.getString("structured_attributes_json"));
        Instant createdAt = instant(rs, "created_at");
        Instant notBefore = instant(rs, "not_before");
        long version = rs.getLong("message_version");
        boolean read = "READ".equalsIgnoreCase(rs.getString("notification_status"));
        if (rs.getBoolean("template_only")) {
            return NotificationMessage.trustedTemplate(messageId, tenantId, principalId, notificationType, channel,
                    templateKey, templateVersion, locale, attributes, rs.getString("content_version"), version,
                    createdAt, notBefore, read);
        }
        return new NotificationMessage(messageId, tenantId, principalId, notificationType, channel, templateKey,
                templateVersion, rs.getString("title"), rs.getString("safe_body"),
                rs.getString("content_version"), version, createdAt, read);
    }

    private static DeliveryAttempt attempt(ResultSet rs) throws java.sql.SQLException {
        Timestamp next = rs.getTimestamp("next_attempt_at");
        return new DeliveryAttempt(rs.getString("attempt_id"), rs.getString("message_id"),
                NotificationChannel.valueOf(rs.getString("channel")), rs.getInt("attempt_number"),
                DeliveryStatus.valueOf(rs.getString("status")), rs.getString("failure_code"),
                next == null ? null : next.toInstant(), rs.getString("request_id"), rs.getString("trace_id"),
                instant(rs, "occurred_at"), rs.getBoolean("retryable"));
    }

    private Object readValue(String type, String valueJson) {
        try {
            JsonNode value = json.readTree(valueJson);
            return switch (type) {
                case "NotificationPreference" -> preferenceNode(value);
                case "NotificationMessage" -> messageNode(value);
                case "DeliveryResult" -> new DeliveryResult(attempt(value.get("attempt")),
                        workflow(value.get("workflow")), value.path("replayed").asBoolean());
                default -> throw new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                        "notification idempotency value type is unsupported");
            };
        } catch (JacksonException exception) {
            throw unavailable();
        }
    }

    private NotificationPreference preferenceNode(JsonNode value) {
        JsonNode dndWindow = value.path("dndWindow");
        return new NotificationPreference(text(value, "tenantId"), text(value, "principalId"),
                NotificationCategory.valueOf(text(value, "category")),
                NotificationChannel.valueOf(text(value, "channel")), value.path("enabled").asBoolean(),
                text(value, "locale"), value.path("consentVersion").asInt(),
                NotificationDndWindow.parse(text(dndWindow, "startLocalTime"), text(dndWindow, "endLocalTime")),
                NotificationFrequencyPolicy.valueOf(text(value, "frequencyPolicy")),
                value.path("version").asLong(), Instant.parse(text(value, "updatedAt")));
    }

    private NotificationMessage messageNode(JsonNode value) {
        String messageId = text(value, "messageId");
        String tenantId = text(value, "tenantId");
        String principalId = text(value, "principalId");
        NotificationChannel channel = NotificationChannel.valueOf(text(value, "channel"));
        Map<String, String> attributes = attributes(value.get("structuredAttributes"));
        Instant createdAt = Instant.parse(text(value, "createdAt"));
        Instant notBefore = Instant.parse(text(value, "notBefore"));
        if (value.path("templateOnly").asBoolean()) {
            return NotificationMessage.trustedTemplate(messageId, tenantId, principalId,
                    text(value, "notificationType"), channel, text(value, "templateId"),
                    text(value, "templateVersion"), text(value, "locale"), attributes,
                    text(value, "contentVersion"), value.path("version").asLong(), createdAt, notBefore);
        }
        return new NotificationMessage(messageId, tenantId, principalId, text(value, "notificationType"), channel,
                text(value, "templateKey"), text(value, "templateVersion"), text(value, "title"),
                text(value, "safeBody"), text(value, "contentVersion"), value.path("version").asLong(), createdAt);
    }

    private static DeliveryAttempt attempt(JsonNode value) {
        JsonNode next = value.get("nextAttemptAt");
        return new DeliveryAttempt(text(value, "attemptId"), text(value, "messageId"),
                NotificationChannel.valueOf(text(value, "channel")), value.path("attemptNumber").asInt(),
                DeliveryStatus.valueOf(text(value, "status")), nullableText(value, "failureCode"),
                next == null || next.isNull() ? null : Instant.parse(next.asText()), text(value, "requestId"),
                text(value, "traceId"), Instant.parse(text(value, "occurredAt")), value.path("retryable").asBoolean());
    }

    private static WorkflowTask workflow(JsonNode value) {
        return new WorkflowTask(text(value, "taskId"), text(value, "tenantId"), text(value, "principalId"),
                text(value, "action"), text(value, "aggregateType"), text(value, "aggregateId"),
                WorkflowState.valueOf(text(value, "state")), value.path("attempt").asInt(),
                value.path("maxAttempts").asInt(), nullableText(value, "reasonCode"),
                Instant.parse(text(value, "nextRunAt")), Instant.parse(text(value, "updatedAt")));
    }

    private Map<String, String> readAttributes(String value) {
        try {
            return attributes(json.readTree(value));
        } catch (JacksonException exception) {
            throw unavailable();
        }
    }

    private static Map<String, String> attributes(JsonNode value) {
        Map<String, String> attributes = new LinkedHashMap<>();
        if (value != null && value.isObject()) {
            for (Map.Entry<String, JsonNode> field : value.properties()) {
                if (field.getValue().isTextual()) {
                    attributes.put(field.getKey(), field.getValue().asText());
                }
            }
        }
        return Map.copyOf(attributes);
    }

    private String writeJson(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JacksonException exception) {
            throw unavailable();
        }
    }

    private static String valueType(Object value) {
        if (value instanceof NotificationPreference) return "NotificationPreference";
        if (value instanceof NotificationMessage) return "NotificationMessage";
        if (value instanceof DeliveryResult) return "DeliveryResult";
        throw new NotificationDomainException(NotificationDomainException.Code.INVALID_ARGUMENT,
                "notification idempotency value type is unsupported");
    }

    private static String text(JsonNode value, String field) {
        String text = value == null ? null : value.path(field).asText(null);
        if (text == null || text.isBlank()) {
            throw new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                    "notification persistence data is incomplete");
        }
        return text;
    }

    private static String nullableText(JsonNode value, String field) {
        JsonNode node = value == null ? null : value.get(field);
        return node == null || node.isNull() ? null : node.asText();
    }

    private static Instant instant(ResultSet rs, String column) throws java.sql.SQLException {
        Timestamp timestamp = rs.getTimestamp(column);
        if (timestamp == null) {
            throw new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                    "notification persistence timestamp is missing");
        }
        return timestamp.toInstant();
    }

    private static Timestamp timestamp(Instant value) {
        return Timestamp.from(Objects.requireNonNull(value, "instant"));
    }

    private static Timestamp nullableTimestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification durable persistence is unavailable");
    }
}
