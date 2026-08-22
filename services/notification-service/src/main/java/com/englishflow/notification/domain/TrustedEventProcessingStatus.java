package com.englishflow.notification.domain;

public enum TrustedEventProcessingStatus {
    QUEUED,
    DELIVERED,
    DELAYED,
    FILTERED,
    DUPLICATE,
    REJECTED,
    RETRY_SCHEDULED,
    DEAD_LETTER,
    RECOVERED
}
