package com.englishflow.notification.domain;

/** Delivery cadence selected by the owner and enforced by notification-service. */
public enum NotificationFrequencyPolicy {
    IMMEDIATE,
    DAILY_DIGEST,
    WEEKLY_DIGEST,
    DISABLED
}
