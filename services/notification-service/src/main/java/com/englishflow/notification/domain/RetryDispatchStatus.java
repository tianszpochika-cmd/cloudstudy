package com.englishflow.notification.domain;

public enum RetryDispatchStatus {
    DELAYED,
    DELIVERED,
    RETRY_SCHEDULED,
    DEAD_LETTER,
    CANCELLED,
    TERMINAL
}
