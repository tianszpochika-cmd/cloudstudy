package com.englishflow.analytics.domain;

import java.math.BigDecimal;
import java.time.format.DateTimeParseException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Validates a trusted delivery envelope before it can be journaled or projected. */
public final class AnalyticsEventValidator {

    public ValidatedAnalyticsEvent validate(AnalyticsEventEnvelope event) {
        AnalyticsEventDefinition definition = AnalyticsEventAllowlist.definition(event.eventName());
        if (definition == null) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.EVENT_NOT_ALLOWLISTED,
                    "event is not registered for analytics");
        }
        if (!definition.sourceService().equals(event.sourceService())) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.SOURCE_NOT_ALLOWLISTED,
                    "event source is not registered for this event");
        }
        if (!definition.schema().equals(event.schema()) || definition.version() != event.version()
                || !versionMatches(event.schemaVersion(), definition.version())) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.SCHEMA_VERSION_UNSUPPORTED,
                    "event schema version is not supported");
        }
        if (!definition.aggregateType().equals(event.aggregateType())) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.AGGREGATE_MISMATCH,
                    "aggregate type does not match the allowlist");
        }

        Map<String, Object> payload = AnalyticsPrivacyBoundary.sanitizePayload(event.payload());
        Set<String> fields = payload.keySet();
        for (String required : definition.requiredPayloadFields()) {
            if (!fields.contains(required) || payload.get(required) == null) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_REQUIRED_FIELD_MISSING,
                        "required payload field is missing");
            }
        }
        for (String field : fields) {
            if (!definition.allowedPayloadFields().contains(field)) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_FIELD_NOT_ALLOWED,
                        "payload field is not registered for this event");
            }
        }
        Object aggregateValue = payload.get(definition.aggregateIdField());
        if (!(aggregateValue instanceof String aggregateId) || !event.aggregateId().equals(aggregateId)) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.AGGREGATE_MISMATCH,
                    "aggregate id does not match the event payload");
        }
        Object payloadTenant = payload.get("tenantId");
        if (payloadTenant != null && (!event.tenantId().equals(String.valueOf(payloadTenant)))) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.TENANT_SCOPE_INVALID,
                    "payload tenant is outside the verified tenant scope");
        }
        validateEnums(payload, definition.enumFields());
        validateNullability(payload, definition);
        validateNumericBounds(payload);
        validateStringAndCollectionShapes(payload);
        if (Boolean.FALSE.equals(payload.get("domainFactsUntouched"))) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "analytics recovery event must not claim domain facts were changed");
        }
        return new ValidatedAnalyticsEvent(event, definition, payload, AnalyticsHash.payloadHash(payload));
    }

    private static void validateEnums(Map<String, Object> payload, Map<String, Set<String>> enumFields) {
        for (Map.Entry<String, Set<String>> entry : enumFields.entrySet()) {
            Object value = payload.get(entry.getKey());
            if (value == null || !entry.getValue().contains(String.valueOf(value))) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                        "payload enum value is not supported");
            }
        }
    }

    private static void validateNullability(Map<String, Object> payload, AnalyticsEventDefinition definition) {
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            if (entry.getValue() == null && !definition.nullablePayloadFields().contains(entry.getKey())) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                        "null payload field is not nullable in the registered event shape");
            }
        }
    }

    private static void validateNumericBounds(Map<String, Object> payload) {
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            if (!(entry.getValue() instanceof Number number)) {
                continue;
            }
            BigDecimal value;
            try {
                value = new BigDecimal(String.valueOf(number));
            } catch (NumberFormatException exception) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                        "numeric payload value is invalid");
            }
            BigDecimal minimum = minimumFor(entry.getKey());
            BigDecimal maximum = maximumFor(entry.getKey());
            if (value.compareTo(minimum) < 0 || value.compareTo(maximum) > 0) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                        "numeric payload value is outside the safe range");
            }
        }
    }

    private static void validateStringAndCollectionShapes(Map<String, Object> payload) {
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            Object value = entry.getValue();
            if (value instanceof String text) {
                validateCodeOrTime(entry.getKey(), text);
            } else if (value instanceof List<?> list) {
                for (Object item : list) {
                    if (!(item instanceof String text)) {
                        throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                                "analytics arrays may contain only safe code strings");
                    }
                    validateCodeOrTime(entry.getKey(), text);
                }
            }
        }
    }

    private static void validateCodeOrTime(String field, String value) {
        int maxLength = maxLengthFor(field);
        if (value.isBlank() || value.length() > maxLength || value.matches(".*\\s+.*")) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "analytics string value is outside the registered shape");
        }
        if (isTimeField(field)) {
            try {
                Instant.parse(value);
            } catch (DateTimeParseException exception) {
                throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                        "analytics timestamp is invalid");
            }
            return;
        }
        if (!value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0," + (maxLength - 1) + "}")) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID,
                    "analytics field must be a code/reference, not free text");
        }
    }

    private static boolean isTimeField(String field) {
        return field.endsWith("At") || field.equals("nextReviewAt") || field.equals("dueAt")
                || field.equals("startedAt") || field.equals("submittedAt") || field.equals("assessedAt")
                || field.equals("projectedAt") || field.equals("scheduledAt") || field.equals("replayedAt")
                || field.equals("compensatedAt") || field.equals("occurredAt");
    }

    private static int maxLengthFor(String field) {
        return switch (field) {
            case "tenantId" -> 64;
            case "gradingRuleVersion", "assessmentVersion", "failureCode", "rewardCode", "templateId" -> 96;
            case "locale" -> 20;
            case "templateVersion" -> 32;
            case "kind" -> 64;
            case "period" -> 32;
            case "itemRefs" -> 128;
            default -> 256;
        };
    }

    private static BigDecimal minimumFor(String field) {
        return switch (field) {
            case "amount", "entryCount" -> BigDecimal.ZERO;
            case "contentVersionId", "contentEpoch" -> BigDecimal.ONE;
            default -> field.equals("itemCount") || field.endsWith("Version") || field.endsWith("Attempt")
                    || field.equals("itemId") || field.equals("leaseVersion") || field.equals("queueVersion")
                    || field.equals("replayAttempt") || field.equals("durationMinutes")
                    ? BigDecimal.ONE : BigDecimal.ZERO;
        };
    }

    private static BigDecimal maximumFor(String field) {
        return switch (field) {
            case "itemCount" -> BigDecimal.valueOf(1_000L);
            case "durationMinutes" -> BigDecimal.valueOf(180L);
            case "entryCount" -> BigDecimal.valueOf(100L);
            default -> BigDecimal.valueOf(1_000_000_000L);
        };
    }

    private static boolean versionMatches(String schemaVersion, int version) {
        String normalized = schemaVersion.startsWith("v") ? schemaVersion.substring(1) : schemaVersion;
        return String.valueOf(version).equals(normalized);
    }
}
