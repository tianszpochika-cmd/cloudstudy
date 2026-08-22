package com.englishflow.notification.domain;

public enum DeliveryStatus {
    QUEUED,
    DELIVERED,
    RETRY_SCHEDULED,
    SENT,
    FAILED,
    CANCELLED
}
