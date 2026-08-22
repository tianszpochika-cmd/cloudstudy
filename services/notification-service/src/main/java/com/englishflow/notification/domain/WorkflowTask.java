package com.englishflow.notification.domain;

import java.time.Instant;

/**
 * Workflow metadata only. No request payload is copied into Saga/DLQ records.
 */
public record WorkflowTask(
        String taskId,
        String tenantId,
        String principalId,
        String action,
        String aggregateType,
        String aggregateId,
        WorkflowState state,
        int attempt,
        int maxAttempts,
        String reasonCode,
        Instant nextRunAt,
        Instant updatedAt) {

    public WorkflowTask {
        require(taskId, "taskId");
        require(tenantId, "tenantId");
        require(principalId, "principalId");
        require(action, "action");
        require(aggregateType, "aggregateType");
        require(aggregateId, "aggregateId");
        if (state == null || attempt < 0 || maxAttempts < 1 || attempt > maxAttempts
                || nextRunAt == null || updatedAt == null) {
            throw NotificationDomainException.invalid("workflow task is invalid");
        }
        if (reasonCode != null && reasonCode.length() > 100) {
            throw NotificationDomainException.invalid("workflow reason is too long");
        }
    }

    public WorkflowTask transition(WorkflowState nextState, int nextAttempt,
            String nextReason, Instant nextRun) {
        return new WorkflowTask(taskId, tenantId, principalId, action, aggregateType, aggregateId, nextState,
                nextAttempt, maxAttempts, nextReason, nextRun, nextRun);
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw NotificationDomainException.invalid(field + " is required");
        }
    }
}
