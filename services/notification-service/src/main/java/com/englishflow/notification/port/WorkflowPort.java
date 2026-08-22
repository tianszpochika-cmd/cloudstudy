package com.englishflow.notification.port;

import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RecoveryResult;
import com.englishflow.notification.domain.WorkflowTask;

import java.time.Instant;
import java.util.Optional;

/**
 * Saga/timer/DLQ/manual-recovery seam. The initial adapter is in-memory; a
 * durable workflow worker can replace it without changing application logic.
 */
public interface WorkflowPort {

    WorkflowTask enqueue(String tenantId, String principalId, String action, String aggregateType, String aggregateId,
            int maxAttempts, Instant now);

    WorkflowTask scheduleRetry(String taskId, String reasonCode, Instant nextRunAt);

    WorkflowTask complete(String taskId, Instant now);

    WorkflowTask moveToDlq(String taskId, String reasonCode, Instant now);

    Optional<WorkflowTask> find(String taskId);

    Optional<WorkflowTask> findByAggregate(String aggregateType, String aggregateId);

    RecoveryResult recover(RecoveryCommand command, Instant now);
}
