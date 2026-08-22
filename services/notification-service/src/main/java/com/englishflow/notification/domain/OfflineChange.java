package com.englishflow.notification.domain;

import java.time.Instant;
import java.util.Map;

/**
 * Metadata-only sync fact. Payload bytes stay in the owning client/source
 * service and are represented here by a SHA-256 digest only.
 */
public final class OfflineChange {

    private final String clientEventId;
    private final long clientSeq;
    private final String tenantId;
    private final String principalId;
    private final String deviceId;
    private final String entityType;
    private final String entityId;
    private final long baseVersion;
    private final String operation;
    private final String payloadDigest;
    private final Instant occurredAt;
    private final OfflineVector vector;

    /** Contract-first constructor used by the HTTP sync boundary. */
    public OfflineChange(String tenantId, String principalId, String deviceId, String clientEventId,
            long clientSeq, String entityType, String entityId, String operation, long baseVersion,
            OfflineVector vector, String payloadDigest, Instant occurredAt) {
        this.clientEventId = require(clientEventId, "clientEventId");
        this.clientSeq = positive(clientSeq, "clientSeq");
        this.tenantId = require(tenantId, "tenantId");
        this.principalId = require(principalId, "principalId");
        this.deviceId = require(deviceId, "deviceId");
        this.entityType = require(entityType, "entityType");
        this.entityId = require(entityId, "entityId");
        this.baseVersion = nonNegative(baseVersion, "baseVersion");
        this.operation = require(operation, "operation");
        this.payloadDigest = digest(payloadDigest);
        if (occurredAt == null) {
            throw invalid("occurredAt is required");
        }
        this.occurredAt = occurredAt;
        this.vector = vector == null ? new OfflineVector(Map.of()) : vector;
    }

    /** Compatibility constructor for B3-style metadata producers. */
    public OfflineChange(String clientEventId, long clientSeq, String tenantId, String principalId,
            String deviceId, String entityType, String entityId, long entityVersion, String operation,
            String payloadHash, Instant occurredAt) {
        this(tenantId, principalId, deviceId, clientEventId, clientSeq, entityType, entityId, operation,
                entityVersion, new OfflineVector(Map.of(deviceId, clientSeq)), payloadHash, occurredAt);
    }

    public String clientEventId() { return clientEventId; }
    public long clientSeq() { return clientSeq; }
    public String tenantId() { return tenantId; }
    public String principalId() { return principalId; }
    public String deviceId() { return deviceId; }
    public String entityType() { return entityType; }
    public String entityId() { return entityId; }
    public long baseVersion() { return baseVersion; }
    public long entityVersion() { return baseVersion; }
    public String operation() { return operation; }
    public String payloadDigest() { return payloadDigest; }
    public String payloadHash() { return payloadDigest; }
    public Instant occurredAt() { return occurredAt; }
    public OfflineVector vector() { return vector; }

    public String dedupeKey() {
        return tenantId + ":" + principalId + ":" + deviceId + ":" + clientEventId;
    }

    public String fingerprint() {
        return String.join("|", tenantId, principalId, deviceId, clientEventId,
                Long.toString(clientSeq), entityType, entityId, operation,
                Long.toString(baseVersion), vector.values().toString(), payloadDigest,
                occurredAt.toString());
    }

    private static String require(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 256) {
            throw invalid(field + " is invalid");
        }
        return value.trim();
    }

    private static String digest(String value) {
        if (value == null || !value.matches("(?i)[0-9a-f]{64}")) {
            throw invalid("payloadDigest must be a SHA-256 digest");
        }
        return value.toLowerCase(java.util.Locale.ROOT);
    }

    private static long positive(long value, String field) {
        if (value < 1) {
            throw invalid(field + " must be positive");
        }
        return value;
    }

    private static long nonNegative(long value, String field) {
        if (value < 0) {
            throw invalid(field + " cannot be negative");
        }
        return value;
    }

    private static NotificationDomainException invalid(String message) {
        return NotificationDomainException.invalid(message);
    }
}
