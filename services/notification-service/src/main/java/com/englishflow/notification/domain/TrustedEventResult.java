package com.englishflow.notification.domain;

import java.time.Instant;

public record TrustedEventResult(
        String eventId,
        String dedupeKey,
        TrustedEventProcessingStatus status,
        String reasonCode,
        String messageId,
        String workflowTaskId,
        Instant nextAttemptAt,
        boolean replayed) {

    public TrustedEventResult {
        if (eventId == null || eventId.isBlank() || dedupeKey == null || dedupeKey.isBlank() || status == null) {
            throw NotificationDomainException.invalid("trusted event result is invalid");
        }
        if (reasonCode != null && !reasonCode.matches("[A-Za-z0-9._:-]{1,100}")) {
            throw NotificationDomainException.invalid("result reason code is invalid");
        }
    }
}
