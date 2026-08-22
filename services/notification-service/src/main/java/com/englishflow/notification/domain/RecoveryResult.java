package com.englishflow.notification.domain;

import java.time.Instant;

public record RecoveryResult(
        String taskId,
        RecoveryAction action,
        WorkflowState state,
        String reasonCode,
        Instant updatedAt) {

    public RecoveryResult {
        if (taskId == null || taskId.isBlank() || action == null || state == null
                || reasonCode == null || reasonCode.isBlank() || updatedAt == null) {
            throw NotificationDomainException.invalid("recovery result is invalid");
        }
    }
}
