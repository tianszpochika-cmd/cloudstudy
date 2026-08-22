package com.englishflow.notification.domain;

import java.time.Instant;

public record DeliveryAttempt(
        String attemptId,
        String messageId,
        NotificationChannel channel,
        int attemptNumber,
        DeliveryStatus status,
        String failureCode,
        Instant nextAttemptAt,
        String requestId,
        String traceId,
        Instant occurredAt,
        boolean retryable) {

    public DeliveryAttempt(String attemptId, String messageId, NotificationChannel channel, int attemptNumber,
            DeliveryStatus status, String failureCode, Instant nextAttemptAt, String requestId, String traceId,
            Instant occurredAt) {
        this(attemptId, messageId, channel, attemptNumber, status, failureCode, nextAttemptAt, requestId, traceId,
                occurredAt, status == DeliveryStatus.RETRY_SCHEDULED);
    }

    public DeliveryAttempt {
        require(attemptId, "attemptId");
        require(messageId, "messageId");
        if (channel == null || status == null || attemptNumber < 1 || occurredAt == null) {
            throw NotificationDomainException.invalid("delivery attempt fields are invalid");
        }
        if (failureCode != null && !failureCode.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,79}")) {
            throw NotificationDomainException.invalid("failure code is invalid");
        }
        require(requestId, "requestId");
        require(traceId, "traceId");
        if (status == DeliveryStatus.RETRY_SCHEDULED && !retryable) {
            throw NotificationDomainException.invalid("scheduled delivery must be retryable");
        }
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw NotificationDomainException.invalid(field + " is required");
        }
    }
}
