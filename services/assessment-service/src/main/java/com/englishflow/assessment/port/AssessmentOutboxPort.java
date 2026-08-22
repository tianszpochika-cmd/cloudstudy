package com.englishflow.assessment.port;

import com.englishflow.assessment.domain.AssessmentDomainException;
import com.englishflow.assessment.domain.SafePayloads;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Durable Outbox boundary. The current code slice supplies an in-memory adapter for smoke only. */
public interface AssessmentOutboxPort {
    void append(AssessmentOutboxEvent event);

    record AssessmentOutboxEvent(
            UUID eventId,
            String eventName,
            String aggregateType,
            String aggregateId,
            String tenantId,
            String actorId,
            String requestId,
            String traceId,
            String schema,
            int version,
            String dedupeKey,
            Map<String, Object> payload,
            Instant occurredAt) {
        public AssessmentOutboxEvent {
            eventId = Objects.requireNonNull(eventId, "eventId is required");
            eventName = token(eventName, "eventName");
            aggregateType = token(aggregateType, "aggregateType");
            aggregateId = token(aggregateId, "aggregateId");
            tenantId = token(tenantId, "tenantId");
            actorId = token(actorId, "actorId");
            requestId = token(requestId, "requestId");
            traceId = token(traceId, "traceId");
            schema = token(schema, "schema");
            if (version < 1) throw AssessmentDomainException.invalid("ASM_EVENT_INVALID", "event version must be positive");
            dedupeKey = token(dedupeKey, "dedupeKey");
            if (payload == null || SafePayloads.containsAnswerLeak(payload)) {
                throw AssessmentDomainException.invalid("ASM_EVENT_SENSITIVE_PAYLOAD", "event payload cannot contain answer rules or raw answers");
            }
            payload = SafePayloads.freeze(payload);
            occurredAt = Objects.requireNonNull(occurredAt, "occurredAt is required");
        }

        public String schemaVersion() { return schema; }

        private static String token(String value, String field) {
            if (value == null || value.isBlank() || value.length() > 128 || value.contains("\n")) {
                throw AssessmentDomainException.invalid("ASM_EVENT_INVALID", field + " is invalid");
            }
            return value;
        }
    }
}
