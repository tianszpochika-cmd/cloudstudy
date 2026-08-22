package com.englishflow.notification.application;

import com.englishflow.notification.domain.DeliveryAttempt;
import com.englishflow.notification.domain.WorkflowTask;

public record DeliveryResult(DeliveryAttempt attempt, WorkflowTask workflow, boolean replayed) {

    public DeliveryResult {
        if (attempt == null || workflow == null) {
            throw new IllegalArgumentException("delivery result is incomplete");
        }
    }
}
