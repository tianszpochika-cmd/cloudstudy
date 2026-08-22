package com.englishflow.notification.domain;

public enum TrustedEventReceiptStatus {
    RECEIVED,
    APPLIED,
    FILTERED,
    DUPLICATE,
    REJECTED,
    RETRY_SCHEDULED,
    DEAD_LETTER,
    RECOVERED
}
