package com.englishflow.notification.domain;

import java.time.Instant;

public record OfflineSyncReceipt(
        String clientEventId,
        String fingerprint,
        long clientSeq,
        SyncStatus status,
        long serverVersion,
        Instant acceptedAt) {

    public OfflineSyncReceipt {
        if (clientEventId == null || clientEventId.isBlank() || fingerprint == null || fingerprint.isBlank()
                || clientSeq < 1 || status == null || serverVersion < 1 || acceptedAt == null) {
            throw NotificationDomainException.invalid("offline sync receipt is invalid");
        }
    }
}
