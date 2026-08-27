package com.englishflow.platform.template.reliability;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Canonical, broker-neutral event envelope. The aggregate id is the partition key; the sequence
 * is checked by consumers and is not a Kafka/RPC coordination mechanism.
 */
public record ReliableEventEnvelope(
        String eventId,
        String traceId,
        String schemaVersion,
        String eventType,
        String aggregateId,
        long aggregateSequence,
        String idempotencyKey,
        EventPayloadSummary payload,
        Instant occurredAt
) {

    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");
    private static final Pattern EVENT_TYPE = Pattern.compile("[a-z][a-z0-9]*(\\.[a-z0-9_-]+)+\\.v[0-9]+");
    private static final Pattern SEMVER = Pattern.compile("[0-9]+\\.[0-9]+\\.[0-9]+");
    private static final Pattern NAMED_SCHEMA = Pattern.compile("[a-z][a-z0-9_.-]{2,63}\\.v[0-9]+");

    public ReliableEventEnvelope {
        requireId(eventId, "eventId");
        requireId(traceId, "traceId");
        requireId(aggregateId, "aggregateId");
        requireId(idempotencyKey, "idempotencyKey");
        if (eventType == null || !EVENT_TYPE.matcher(eventType).matches()) {
            throw new IllegalArgumentException("eventType must use domain.action.vN");
        }
        if (schemaVersion == null
                || (!SEMVER.matcher(schemaVersion).matches() && !NAMED_SCHEMA.matcher(schemaVersion).matches())) {
            throw new IllegalArgumentException("schemaVersion must use semantic or named versioning");
        }
        if (aggregateSequence < 1) {
            throw new IllegalArgumentException("aggregateSequence must be positive");
        }
        Objects.requireNonNull(payload, "payload is required");
        Objects.requireNonNull(occurredAt, "occurredAt is required");
    }

    public static ReliableEventEnvelope create(
            String eventId,
            String traceId,
            String schemaVersion,
            String eventType,
            String aggregateId,
            long aggregateSequence,
            String idempotencyKey,
            EventPayloadSummary payload
    ) {
        return new ReliableEventEnvelope(eventId, traceId, schemaVersion, eventType, aggregateId,
                aggregateSequence, idempotencyKey, payload, Instant.now());
    }

    /** The only routing key a dispatcher may derive from the event. */
    public String partitionKey() {
        return aggregateId;
    }

    /** Metadata fingerprint used to reject event-id/idempotency-key reuse with different facts. */
    public String fingerprint() {
        String canonical = eventId + '\u001f' + traceId + '\u001f' + schemaVersion + '\u001f'
                + eventType + '\u001f' + aggregateId + '\u001f' + aggregateSequence + '\u001f'
                + idempotencyKey + '\u001f' + payload.fingerprint();
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static void requireId(String value, String field) {
        if (value == null || !SAFE_ID.matcher(value).matches()) {
            throw new IllegalArgumentException(field + " has an unsafe format");
        }
    }
}
