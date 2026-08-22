package com.englishflow.notification.domain;

public record SyncConflict(
        String reason,
        long currentVersion,
        OfflineVector currentVector,
        long expectedClientSeq) {

    public SyncConflict {
        if (reason == null || reason.isBlank() || currentVersion < 0
                || currentVector == null || expectedClientSeq < 1) {
            throw NotificationDomainException.invalid("sync conflict is incomplete");
        }
    }
}
