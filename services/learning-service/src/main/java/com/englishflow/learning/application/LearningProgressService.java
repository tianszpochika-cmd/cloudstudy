package com.englishflow.learning.application;

import com.englishflow.learning.domain.LearningAccessPolicy;
import com.englishflow.learning.domain.LearningDecisionCode;
import com.englishflow.learning.domain.LearningDomainException;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningProgress;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.port.IdempotentExecution;
import com.englishflow.learning.port.LearningFactStore;

import java.time.Clock;
import java.util.Objects;

/** Monotonic task progress application boundary; progress never writes another service's facts. */
public final class LearningProgressService {

    private final LearningFactStore store;
    private final LearningAccessPolicy accessPolicy;
    private final Clock clock;

    public LearningProgressService(LearningFactStore store, LearningAccessPolicy accessPolicy, Clock clock) {
        this.store = Objects.requireNonNull(store, "store is required");
        this.accessPolicy = Objects.requireNonNull(accessPolicy, "access policy is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public LearningCommandResult<LearningProgress> record(
            LearningPrincipalContext principal,
            RecordProgressCommand command) {
        authorize(principal, "learning.progress.write", "learning_progress", command.planId() + ":" + command.taskId());
        LearningTenantScope scope = principal.scope();
        return unwrap(store.executeIdempotently(scope, "progress.record", command.idempotencyKey(),
                command.fingerprint(), () -> {
                    LearningPlan plan = store.findPlanById(scope, command.planId())
                            .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.TARGET_NOT_FOUND,
                                    "learning plan is not available"));
                    if (plan.tasks().stream().noneMatch(task -> task.taskId() == command.taskId())) {
                        throw new LearningDomainException(LearningDecisionCode.TASK_NOT_FOUND,
                                "task is not part of the learning plan");
                    }
                    LearningProgress current = store.findProgress(scope, command.planId(), command.taskId())
                            .orElse(null);
                    LearningProgress next;
                    if (current == null) {
                        if (command.expectedVersion() != 0) {
                            throw new LearningDomainException(LearningDecisionCode.VERSION_CONFLICT,
                                    "new progress must use version zero");
                        }
                        next = LearningProgress.empty(scope, command.planId(), command.taskId(),
                                command.totalUnits(), clock.instant())
                                .advance(command.completedUnits(), command.addedStudySeconds(), 0, clock.instant());
                    } else {
                        if (current.totalUnits() != command.totalUnits()) {
                            throw new LearningDomainException(LearningDecisionCode.PROGRESS_INVALID,
                                    "total units cannot change for a progress fact");
                        }
                        next = current.advance(command.completedUnits(), command.addedStudySeconds(),
                                command.expectedVersion(), clock.instant());
                    }
                    store.saveProgress(next);
                    return next;
                }));
    }

    private void authorize(LearningPrincipalContext principal, String permission,
            String resourceType, String resourceId) {
        accessPolicy.authorize(principal, permission, resourceType, resourceId,
                principal == null ? null : principal.scope().tenantId(),
                principal == null ? null : principal.scope().principalId()).requireAllowed();
    }

    private static <T> LearningCommandResult<T> unwrap(IdempotentExecution<T> execution) {
        return new LearningCommandResult<>(execution.value(), execution.replayed());
    }
}
