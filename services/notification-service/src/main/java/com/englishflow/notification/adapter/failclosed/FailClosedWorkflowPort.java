package com.englishflow.notification.adapter.failclosed;

import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RecoveryResult;
import com.englishflow.notification.domain.WorkflowTask;
import com.englishflow.notification.port.WorkflowPort;

import java.time.Instant;
import java.util.Optional;

/** Delivery workflow cannot be created or replayed without a durable owner. */
public final class FailClosedWorkflowPort implements WorkflowPort {

    @Override
    public WorkflowTask enqueue(String tenantId, String principalId, String action, String aggregateType,
            String aggregateId, int maxAttempts, Instant now) {
        throw unavailable();
    }

    @Override
    public WorkflowTask scheduleRetry(String taskId, String reasonCode, Instant nextRunAt) {
        throw unavailable();
    }

    @Override
    public WorkflowTask complete(String taskId, Instant now) {
        throw unavailable();
    }

    @Override
    public WorkflowTask moveToDlq(String taskId, String reasonCode, Instant now) {
        throw unavailable();
    }

    @Override
    public Optional<WorkflowTask> find(String taskId) {
        throw unavailable();
    }

    @Override
    public Optional<WorkflowTask> findByAggregate(String aggregateType, String aggregateId) {
        throw unavailable();
    }

    @Override
    public RecoveryResult recover(RecoveryCommand command, Instant now) {
        throw unavailable();
    }

    private static NotificationDomainException unavailable() {
        return new NotificationDomainException(NotificationDomainException.Code.NETWORK_UNAVAILABLE,
                "notification workflow persistence is not configured");
    }
}
