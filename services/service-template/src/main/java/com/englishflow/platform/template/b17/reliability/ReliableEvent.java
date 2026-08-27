package com.englishflow.platform.template.b17.reliability;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Canonical safe event envelope for B17 Outbox and consumer adapters. */
public record ReliableEvent(
        String eventId,
        String traceId,
        String schemaVersion,
        String eventName,
        String aggregateId,
        long aggregateSequence,
        String idempotencyKey,
        Instant occurredAt,
        Map<String, String> payloadSummary) {
    private static final Set<String> FORBIDDEN = Set.of(
            "answer", "answertext", "answerkey", "audio", "recording", "token", "password", "secret",
            "privatekey", "rawpayload", "rawanswer", "paymentcredential", "cardnumber");

    public ReliableEvent {
        eventId = required(eventId, "eventId");
        traceId = required(traceId, "traceId");
        schemaVersion = required(schemaVersion, "schemaVersion");
        eventName = required(eventName, "eventName");
        aggregateId = required(aggregateId, "aggregateId");
        idempotencyKey = required(idempotencyKey, "idempotencyKey");
        occurredAt = Objects.requireNonNull(occurredAt, "occurredAt");
        if (aggregateSequence < 1) throw new IllegalArgumentException("aggregateSequence must be positive");
        payloadSummary = payloadSummary == null ? Map.of() : Map.copyOf(payloadSummary);
        if (payloadSummary.size() > 32) throw new IllegalArgumentException("payload summary is too large");
        for (Map.Entry<String, String> entry : payloadSummary.entrySet()) {
            String key = required(entry.getKey(), "payload key").toLowerCase();
            String value = required(entry.getValue(), "payload value");
            if (FORBIDDEN.stream().anyMatch(key::contains) || FORBIDDEN.stream().anyMatch(value.toLowerCase()::contains)) {
                throw new IllegalArgumentException("sensitive event payload is forbidden");
            }
            if (value.length() > 512) throw new IllegalArgumentException("payload summary value is too long");
        }
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value.trim();
    }
}
