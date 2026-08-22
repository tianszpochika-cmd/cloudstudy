package com.englishflow.notification.adapter.memory;

import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.RecoveryAction;
import com.englishflow.notification.domain.RecoveryCommand;
import com.englishflow.notification.domain.RecoveryResult;
import com.englishflow.notification.domain.WorkflowState;
import com.englishflow.notification.domain.WorkflowTask;
import com.englishflow.notification.port.WorkflowPort;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Deterministic Saga/timer/DLQ adapter for local execution. It stores metadata
 * only and is intentionally replaceable by workflow-service/job-runner.
 */
public final class InMemoryWorkflowPort implements WorkflowPort {

    private final Map<String, WorkflowTask> tasks = new LinkedHashMap<>();

    @Override
    public synchronized WorkflowTask enqueue(String tenantId, String principalId, String action,
            String aggregateType, String aggregateId,
            int maxAttempts, Instant now) {
        WorkflowTask task = new WorkflowTask("wf-" + UUID.randomUUID(), tenantId, principalId,
                action, aggregateType, aggregateId,
                WorkflowState.QUEUED, 0, maxAttempts, null, now, now);
        tasks.put(task.taskId(), task);
        return task;
    }

    @Override
    public synchronized WorkflowTask scheduleRetry(String taskId, String reasonCode, Instant nextRunAt) {
        WorkflowTask current = require(taskId);
        int nextAttempt = current.attempt() + 1;
        if (nextAttempt > current.maxAttempts()) {
            return moveToDlq(taskId, reasonCode, nextRunAt);
        }
        WorkflowTask next = current.transition(WorkflowState.RETRY_SCHEDULED, nextAttempt, reasonCode, nextRunAt);
        tasks.put(taskId, next);
        return next;
    }

    @Override
    public synchronized WorkflowTask complete(String taskId, Instant now) {
        WorkflowTask next = require(taskId).transition(WorkflowState.SUCCEEDED,
                Math.max(1, require(taskId).attempt()), null, now);
        tasks.put(taskId, next);
        return next;
    }

    @Override
    public synchronized WorkflowTask moveToDlq(String taskId, String reasonCode, Instant now) {
        WorkflowTask current = require(taskId);
        WorkflowTask next = current.transition(WorkflowState.DEAD_LETTER,
                Math.max(1, current.attempt()), reasonCode, now);
        tasks.put(taskId, next);
        return next;
    }

    @Override
    public synchronized Optional<WorkflowTask> find(String taskId) {
        return Optional.ofNullable(tasks.get(taskId));
    }

    @Override
    public synchronized Optional<WorkflowTask> findByAggregate(String aggregateType, String aggregateId) {
        return tasks.values().stream()
                .filter(task -> task.aggregateType().equals(aggregateType)
                        && task.aggregateId().equals(aggregateId))
                .findFirst();
    }

    @Override
    public synchronized RecoveryResult recover(RecoveryCommand command, Instant now) {
        WorkflowTask current = require(command.taskId());
        WorkflowTask next;
        switch (command.action()) {
            case RETRY -> {
                if (current.attempt() >= current.maxAttempts()) {
                    throw new NotificationDomainException(NotificationDomainException.Code.RECOVERY_NOT_ALLOWED,
                            "workflow retry budget is exhausted");
                }
                next = current.transition(WorkflowState.RETRY_SCHEDULED,
                        current.attempt() + 1, command.reasonCode(), now);
            }
            case REPLAY -> next = current.transition(WorkflowState.QUEUED,
                    current.attempt(), command.reasonCode(), now);
            case CANCEL -> next = current.transition(WorkflowState.FAILED,
                    Math.max(1, current.attempt()), command.reasonCode(), now);
            case MANUAL_REVIEW -> next = current.transition(WorkflowState.MANUAL_RECOVERY,
                    Math.max(1, current.attempt()), command.reasonCode(), now);
            default -> throw new NotificationDomainException(NotificationDomainException.Code.RECOVERY_NOT_ALLOWED,
                    "recovery action is not supported");
        }
        tasks.put(next.taskId(), next);
        return new RecoveryResult(next.taskId(), command.action(), next.state(),
                command.reasonCode(), now);
    }

    private WorkflowTask require(String taskId) {
        return Optional.ofNullable(tasks.get(taskId)).orElseThrow(() ->
                new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                        "workflow task was not found"));
    }
}
