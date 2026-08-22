package com.englishflow.notification.domain;

import java.time.Instant;

/** Dedupe receipt contains hashes and state metadata, never event attributes. */
public record TrustedEventReceipt(
        String consumerName,
        String eventId,
        String eventName,
        String dedupeKey,
        String fingerprint,
        TrustedEventReceiptStatus status,
        int attempt,
        String reasonCode,
        String messageId,
        String workflowTaskId,
        Instant firstSeenAt,
        Instant updatedAt) {

    public TrustedEventReceipt {
        require(consumerName, "consumerName");
        require(eventId, "eventId");
        require(eventName, "eventName");
        require(dedupeKey, "dedupeKey");
        require(fingerprint, "fingerprint");
        if (status == null || attempt < 0 || firstSeenAt == null || updatedAt == null) {
            throw NotificationDomainException.invalid("trusted event receipt is invalid");
        }
        if (reasonCode != null && !reasonCode.matches("[A-Za-z0-9._:-]{1,100}")) {
            throw NotificationDomainException.invalid("receipt reason code is invalid");
        }
        if (messageId != null) require(messageId, "messageId");
        if (workflowTaskId != null) require(workflowTaskId, "workflowTaskId");
    }

    public TrustedEventReceipt transition(TrustedEventReceiptStatus nextStatus, int nextAttempt,
            String nextReason, String nextMessageId, String nextWorkflowTaskId, Instant now) {
        return new TrustedEventReceipt(consumerName, eventId, eventName, dedupeKey, fingerprint, nextStatus,
                nextAttempt, nextReason, nextMessageId == null ? messageId : nextMessageId,
                nextWorkflowTaskId == null ? workflowTaskId : nextWorkflowTaskId, firstSeenAt, now);
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw NotificationDomainException.invalid(field + " is required");
        }
    }
}
