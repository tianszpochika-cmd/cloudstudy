package com.englishflow.notification.domain;

import com.englishflow.notification.application.DeliveryResult;

import java.time.Instant;

public record RetryDispatchResult(
        String taskId,
        RetryDispatchStatus status,
        DeliveryResult delivery,
        WorkflowTask workflow,
        String reasonCode,
        Instant nextAttemptAt) {

    public RetryDispatchResult {
        if (taskId == null || taskId.isBlank() || status == null || workflow == null) {
            throw NotificationDomainException.invalid("retry dispatch result is invalid");
        }
        if (reasonCode != null && !reasonCode.matches("[A-Za-z0-9._:-]{1,100}")) {
            throw NotificationDomainException.invalid("retry reason code is invalid");
        }
    }
}
