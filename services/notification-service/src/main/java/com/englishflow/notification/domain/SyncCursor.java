package com.englishflow.notification.domain;

import java.time.Instant;

public record SyncCursor(
        String tenantId,
        String principalId,
        String deviceId,
        long lastClientSeq,
        long serverVersion,
        OfflineVector vector,
        Instant updatedAt) {

    public SyncCursor {
        require(tenantId, "tenantId");
        require(principalId, "principalId");
        require(deviceId, "deviceId");
        if (lastClientSeq < 0 || serverVersion < 0 || vector == null || updatedAt == null) {
            throw NotificationDomainException.invalid("sync cursor is invalid");
        }
    }

    public static SyncCursor initial(String tenantId, String principalId, String deviceId, Instant now) {
        return new SyncCursor(tenantId, principalId, deviceId, 0, 0, new OfflineVector(java.util.Map.of()), now);
    }

    public SyncCursor advance(OfflineChange change, Instant now) {
        return new SyncCursor(tenantId, principalId, deviceId, change.clientSeq(),
                serverVersion + 1, vector.merge(change.vector()), now);
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw NotificationDomainException.invalid(field + " is required");
        }
    }
}
