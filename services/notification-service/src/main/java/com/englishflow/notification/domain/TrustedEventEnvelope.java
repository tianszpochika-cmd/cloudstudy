package com.englishflow.notification.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;

/**
 * Server-to-server event envelope. It deliberately contains only bounded,
 * structured attributes; a client event cannot be promoted to this type by an
 * HTTP caller without a verified service permission.
 */
public record TrustedEventEnvelope(
        String eventId,
        String eventName,
        String schema,
        int version,
        Instant occurredAt,
        String aggregateType,
        String aggregateId,
        String actorId,
        String traceId,
        String requestId,
        String schemaVersion,
        String dedupeKey,
        String tenantId,
        String principalId,
        String templateId,
        String locale,
        NotificationChannel channel,
        Instant notBefore,
        Map<String, String> attributes) {

    public TrustedEventEnvelope {
        requireToken(eventId, "eventId", 128);
        requireEventName(eventName, "eventName");
        requireSchema(schema, "schema");
        if (version < 1 || occurredAt == null) {
            throw NotificationDomainException.invalid("trusted event version and occurredAt are required");
        }
        requireToken(aggregateType, "aggregateType", 64);
        requireToken(aggregateId, "aggregateId", 128);
        requireToken(actorId, "actorId", 128);
        requireTrace(traceId, "traceId");
        requireToken(requestId, "requestId", 128);
        requireSchema(schemaVersion, "schemaVersion");
        if (!schema.equals(schemaVersion)) {
            throw new NotificationDomainException(NotificationDomainException.Code.TRUSTED_EVENT_REJECTED,
                    "event schema versions do not match");
        }
        requireToken(dedupeKey, "dedupeKey", 255);
        requireToken(tenantId, "tenantId", 64);
        requireToken(principalId, "principalId", 128);
        if (templateId != null) {
            requireToken(templateId, "templateId", 96);
        }
        if (locale != null && !locale.matches("[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2})?")) {
            throw NotificationDomainException.invalid("locale is invalid");
        }
        attributes = SafeEventAttributes.copy(attributes);
        if (attributes.size() > 64) {
            throw NotificationDomainException.invalid("trusted event attributes exceed the safe limit");
        }
    }

    public TrustedEventEnvelope(String eventId, String eventName, String schema, int version,
            Instant occurredAt, String aggregateType, String aggregateId, String actorId,
            String traceId, String requestId, String schemaVersion, String dedupeKey,
            String tenantId, String principalId, Map<String, String> attributes) {
        this(eventId, eventName, schema, version, occurredAt, aggregateType, aggregateId, actorId,
                traceId, requestId, schemaVersion, dedupeKey, tenantId, principalId,
                null, null, null, null, attributes);
    }

    /** Convenient constructor for tests/producers that need template routing hints. */
    public static TrustedEventEnvelope forNotification(String eventId, String eventName, String schema,
            String aggregateType, String aggregateId, String actorId, String traceId, String requestId,
            String dedupeKey, String tenantId, String principalId, String templateId, String locale,
            NotificationChannel channel, Instant notBefore, Map<String, String> attributes) {
        return new TrustedEventEnvelope(eventId, eventName, schema, 1, Instant.now(), aggregateType,
                aggregateId, actorId, traceId, requestId, schema, dedupeKey, tenantId, principalId,
                templateId, locale, channel, notBefore, attributes);
    }

    public String fingerprint() {
        StringBuilder value = new StringBuilder(eventName).append('|').append(schema).append('|')
                .append(version).append('|').append(aggregateType).append('|').append(aggregateId)
                .append('|').append(tenantId).append('|').append(principalId).append('|')
                .append(templateId).append('|').append(locale).append('|').append(channel).append('|')
                .append(notBefore);
        attributes.keySet().stream().sorted().forEach(key -> value.append('|').append(key).append('=').append(attributes.get(key)));
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static void requireEventName(String value, String field) {
        if (value == null || !value.matches("[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+\\.v[0-9]+")) {
            throw NotificationDomainException.invalid(field + " is invalid");
        }
    }

    private static void requireSchema(String value, String field) {
        if (value == null || !value.matches("[a-z][a-z0-9_.-]{2,63}\\.v[0-9]+")) {
            throw NotificationDomainException.invalid(field + " is invalid");
        }
    }

    private static void requireTrace(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 128 || value.contains(" ")
                || value.contains("\n") || value.contains("\r")) {
            throw NotificationDomainException.invalid(field + " is invalid");
        }
    }

    private static void requireToken(String value, String field, int maxLength) {
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0," + (maxLength - 1) + "}")) {
            throw NotificationDomainException.invalid(field + " is invalid");
        }
    }
}
