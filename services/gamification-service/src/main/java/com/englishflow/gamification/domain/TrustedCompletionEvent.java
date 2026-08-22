package com.englishflow.gamification.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Strict event envelope accepted at the trusted learning/assessment boundary.
 * No client-controlled reward amount is part of this type.
 */
public record TrustedCompletionEvent(
        String sourceService,
        String eventId,
        String traceId,
        String schemaVersion,
        Instant occurredAt,
        String subjectId,
        String aggregateId,
        String ruleVersion,
        String eventType) {

    public static final String RULE_VERSION = "GAM_RULE_2026_08_20_01";
    public static final String SCHEMA_VERSION = "v1";
    private static final Set<String> ALLOWED_SCHEMA_VERSIONS = Set.of("v1", "1", "1.0", "1.0.0");

    private static final Set<String> ALLOWED_FIELDS = Set.of(
            "sourceService", "eventId", "traceId", "schemaVersion", "occurredAt",
            "subject", "user", "aggregateId", "ruleVersion", "eventType");
    private static final Set<String> FORBIDDEN_FIELDS = Set.of(
            "xp", "xpdelta", "coin", "coins", "coindelta", "coin_delta",
            "delta", "amount", "role", "roles", "tenant", "tenantid", "owner", "ownerid",
            "owneruserid", "userid");
    private static final Set<String> ALLOWED_SOURCES = Set.of("learning-service", "assessment-service");
    private static final Map<String, Set<String>> SOURCE_EVENT_TYPES = Map.of(
            "learning-service", Set.of(
            "learning.task.completed.v1",
            "learning.lesson.completed.v1",
                    "learning.review.completed.v1",
                    "learning.reading.completed.v1",
                    "learning.listening.completed.v1",
                    "learning.writing.completed.v1",
                    "learning.daily_goal.reached.v1"),
            "assessment-service", Set.of(
                    "assessment.practice.completed.v1",
                    "assessment.attempt.completed.v1",
                    "assessment.attempt.assessed.v1",
                    "assessment.checkpoint.completed.v1",
                    "assessment.checkpoint.passed.v1",
                    "grammar.practice.completed.v1",
                    "writing.evaluation.completed.v1"));

    public TrustedCompletionEvent {
        requireText(sourceService, "sourceService", 80);
        requireText(eventId, "eventId", 200);
        requireText(traceId, "traceId", 200);
        requireText(schemaVersion, "schemaVersion", 20);
        requireText(subjectId, "subject", 128);
        requireText(aggregateId, "aggregateId", 200);
        requireText(ruleVersion, "ruleVersion", 80);
        requireText(eventType, "eventType", 120);
        if (occurredAt == null) {
            throw GamificationDomainException.invalidEvent("occurredAt is required");
        }
        if (!ALLOWED_SCHEMA_VERSIONS.contains(schemaVersion)) {
            throw GamificationDomainException.invalidEvent("schemaVersion is unsupported");
        }
        if (!RULE_VERSION.equals(ruleVersion)) {
            throw GamificationDomainException.invalidEvent("ruleVersion is unsupported");
        }
        if (!ALLOWED_SOURCES.contains(sourceService)
                || !SOURCE_EVENT_TYPES.getOrDefault(sourceService, Set.of()).contains(eventType)) {
            throw GamificationDomainException.invalidEvent("sourceService and eventType are not allowlisted");
        }
    }

    public static TrustedCompletionEvent from(Map<String, ?> payload) {
        if (payload == null || payload.isEmpty()) {
            throw GamificationDomainException.invalidEvent("completion event is required");
        }
        rejectForbiddenFields(payload);
        for (String field : payload.keySet()) {
            if (!ALLOWED_FIELDS.contains(field)) {
                throw GamificationDomainException.invalidEvent("event field is not allowlisted");
            }
        }

        String sourceService = text(payload.get("sourceService"), "sourceService", 80);
        String eventId = text(payload.get("eventId"), "eventId", 200);
        String traceId = text(payload.get("traceId"), "traceId", 200);
        String schemaVersion = text(payload.get("schemaVersion"), "schemaVersion", 20);
        String aggregateId = text(payload.get("aggregateId"), "aggregateId", 200);
        String ruleVersion = text(payload.get("ruleVersion"), "ruleVersion", 80);
        String eventType = text(payload.get("eventType"), "eventType", 120);
        Instant occurredAt = instant(payload.get("occurredAt"));

        String subject = identity(payload.get("subject"), "subject");
        String user = identity(payload.get("user"), "user");
        if (subject == null && user == null) {
            throw GamificationDomainException.invalidEvent("subject or user is required");
        }
        if (subject != null && user != null && !subject.equals(user)) {
            throw GamificationDomainException.invalidEvent("subject and user do not match");
        }
        return new TrustedCompletionEvent(sourceService, eventId, traceId, schemaVersion, occurredAt,
                subject == null ? user : subject, aggregateId, ruleVersion, eventType);
    }

    public String fingerprint() {
        String canonical = String.join("|", sourceService, eventId, traceId, schemaVersion,
                occurredAt.toString(), subjectId, aggregateId, ruleVersion, eventType);
        return sha256(canonical);
    }

    /** Compatibility alias for application-only policy helpers; it is still event subject data. */
    public String subject() {
        return subjectId;
    }

    /** Event timezone is intentionally absent; timezone is read from the user-owned profile port. */
    public java.time.ZoneId userTimeZone() {
        return null;
    }

    public static boolean isAllowlistedSource(String sourceService) {
        return ALLOWED_SOURCES.contains(sourceService);
    }

    public static Set<String> allowlistedSources() {
        return ALLOWED_SOURCES;
    }

    private static void rejectForbiddenFields(Object value) {
        if (value instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (FORBIDDEN_FIELDS.contains(normalize(key))) {
                    throw GamificationDomainException.untrustedField("client security or reward fields are not accepted");
                }
                rejectForbiddenFields(entry.getValue());
            }
        } else if (value instanceof Collection<?> collection) {
            for (Object item : collection) {
                rejectForbiddenFields(item);
            }
        }
    }

    private static String identity(Object value, String field) {
        if (value == null) {
            return null;
        }
        if (value instanceof String string) {
            return text(string, field, 128);
        }
        if (value instanceof Map<?, ?> map) {
            Set<String> keys = new LinkedHashSet<>();
            for (Object key : map.keySet()) {
                keys.add(String.valueOf(key));
            }
            if (!keys.equals(Set.of("id"))) {
                throw GamificationDomainException.invalidEvent("subject identity shape is invalid");
            }
            return text(map.get("id"), field, 128);
        }
        throw GamificationDomainException.invalidEvent("subject identity shape is invalid");
    }

    private static Instant instant(Object value) {
        if (!(value instanceof String string) || string.isBlank()) {
            throw GamificationDomainException.invalidEvent("occurredAt must be an ISO-8601 instant");
        }
        try {
            return Instant.parse(string);
        } catch (DateTimeParseException exception) {
            throw GamificationDomainException.invalidEvent("occurredAt must be an ISO-8601 instant");
        }
    }

    private static String text(Object value, String field, int maxLength) {
        if (!(value instanceof String string)) {
            throw GamificationDomainException.invalidEvent(field + " is required");
        }
        return requireText(string, field, maxLength);
    }

    private static String requireText(String value, String field, int maxLength) {
        if (value == null || value.isBlank() || value.length() > maxLength
                || value.chars().anyMatch(Character::isISOControl)) {
            throw GamificationDomainException.invalidEvent(field + " is invalid");
        }
        return value;
    }

    private static String normalize(String value) {
        return value.replace("-", "").replace("_", "").toLowerCase(java.util.Locale.ROOT);
    }

    private static String sha256(String value) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }
}
