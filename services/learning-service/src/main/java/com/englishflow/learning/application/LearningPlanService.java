package com.englishflow.learning.application;

import com.englishflow.learning.domain.LearningDomainException;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningTask;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.LearningDecisionCode;
import com.englishflow.learning.domain.PlanningKey;
import com.englishflow.learning.domain.ReviewQueueSnapshot;
import com.englishflow.learning.domain.SrsState;
import com.englishflow.learning.domain.Sm2Scheduler;
import com.englishflow.learning.port.IdempotentExecution;
import com.englishflow.learning.port.LearnerTargetPort;
import com.englishflow.learning.port.LearningFactStore;
import com.englishflow.learning.port.LearningIdGenerator;
import com.englishflow.learning.port.PublishedContentPort;
import com.englishflow.learning.domain.LearningAccessPolicy;
import com.englishflow.learning.domain.LearningPrincipalContext;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;

/** Application boundary for plans, tasks and replayable SRS queue snapshots. */
public final class LearningPlanService {

    private static final String PLAN_WRITE = "learning.plan.write";
    private static final String TASK_WRITE = "learning.task.write";
    private static final String REVIEW_READ = "learning.review.read";

    private final LearningFactStore store;
    private final LearnerTargetPort learnerTargetPort;
    private final PublishedContentPort contentPort;
    private final LearningIdGenerator ids;
    private final LearningAccessPolicy accessPolicy;
    private final Clock clock;

    public LearningPlanService(
            LearningFactStore store,
            LearnerTargetPort learnerTargetPort,
            PublishedContentPort contentPort,
            LearningIdGenerator ids,
            LearningAccessPolicy accessPolicy,
            Clock clock) {
        this.store = Objects.requireNonNull(store, "store is required");
        this.learnerTargetPort = Objects.requireNonNull(learnerTargetPort, "learner target port is required");
        this.contentPort = Objects.requireNonNull(contentPort, "content port is required");
        this.ids = Objects.requireNonNull(ids, "id generator is required");
        this.accessPolicy = Objects.requireNonNull(accessPolicy, "access policy is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public LearningCommandResult<LearningPlan> createPlan(
            LearningPrincipalContext principal,
            CreateLearningPlanCommand command) {
        authorize(principal, PLAN_WRITE, "learning_plan", Long.toString(command.targetId()));
        LearningTenantScope scope = principal.scope();
        return unwrap(store.executeIdempotently(scope, "plan.create", command.idempotencyKey(),
                command.fingerprint(), () -> {
                    LearnerTargetPort.LearnerTargetSnapshot target = learnerTargetPort
                            .findTarget(principal, command.targetId())
                            .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.TARGET_NOT_FOUND,
                                    "learner target is not available"));
                    requireSameScope(scope, target.scope());
                    if (target.targetId() != command.targetId()) {
                        throw new LearningDomainException(LearningDecisionCode.TARGET_NOT_FOUND,
                                "learner target port returned another target");
                    }
                    if (target.contentVersionId() != command.contentVersionId()) {
                        throw new LearningDomainException(LearningDecisionCode.CONTENT_VERSION_MISMATCH,
                                "plan content version must match the learner target pin");
                    }
                    PublishedContentPort.PublishedContentSnapshot content = contentPort
                            .findLearnerSnapshot(principal, command.contentVersionId())
                            .orElseThrow(() -> new LearningDomainException(
                                    LearningDecisionCode.CONTENT_NOT_AVAILABLE,
                                    "published learner content is not available"));
                    if (!content.learnerReadable() || content.contentVersionId() != command.contentVersionId()) {
                        throw new LearningDomainException(LearningDecisionCode.CONTENT_NOT_AVAILABLE,
                                "content is not readable for the learner");
                    }
                    if (content.items().isEmpty()) {
                        throw new LearningDomainException(LearningDecisionCode.CONTENT_NOT_AVAILABLE,
                                "published content contains no learning items");
                    }
                    PlanningKey planningKey = new PlanningKey(scope, target.targetId(),
                            content.contentVersionId(), content.contentEpoch());
                    LearningPlan existing = store.findPlan(scope, planningKey).orElse(null);
                    if (existing != null) {
                        return existing;
                    }
                    Instant now = clock.instant();
                    List<LearningTask> tasks = content.items().stream()
                            .map(seed -> LearningTask.planned(ids.nextId("learning_task"), seed.taskType(),
                                    seed.itemId(), content.contentVersionId(), seed.plannedLocalDate(), now))
                            .toList();
                    LearningPlan plan = LearningPlan.draft(
                            ids.nextId("learning_plan"), scope, target.targetId(), target.goalCode(),
                            content.contentVersionId(), content.contentEpoch(), target.timeZoneId(),
                            target.dailyQuotaMinutes(), tasks, now);
                    store.savePlan(plan);
                    return plan;
                }));
    }

    public LearningCommandResult<LearningPlan> resumePlan(
            LearningPrincipalContext principal,
            ResumeLearningPlanCommand command) {
        authorize(principal, PLAN_WRITE, "learning_plan", Long.toString(command.planId()));
        LearningTenantScope scope = principal.scope();
        return unwrap(store.executeIdempotently(scope, "plan.resume", command.idempotencyKey(),
                command.fingerprint(), () -> {
                    LearningPlan current = store.findPlanById(scope, command.planId())
                            .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.TARGET_NOT_FOUND,
                                    "learning plan is not available"));
                    requireVersion(current.version(), command.expectedPlanVersion());
                    LearningPlan resumed = current.resume(clock.instant());
                    store.savePlan(resumed);
                    return resumed;
                }));
    }

    public LearningCommandResult<LearningPlan> completeTask(
            LearningPrincipalContext principal,
            CompleteLearningTaskCommand command) {
        authorize(principal, TASK_WRITE, "learning_task", Long.toString(command.taskId()));
        LearningTenantScope scope = principal.scope();
        return unwrap(store.executeIdempotently(scope, "task.complete", command.idempotencyKey(),
                command.fingerprint(), () -> {
                    LearningPlan current = store.findPlanById(scope, command.planId())
                            .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.TARGET_NOT_FOUND,
                                    "learning plan is not available"));
                    requireVersion(current.version(), command.expectedPlanVersion());
                    LearningPlan completed = current.completeTask(command.taskId(), clock.instant());
                    store.savePlan(completed);
                    LearningTask task = completed.tasks().stream()
                            .filter(candidate -> candidate.taskId() == command.taskId())
                            .findFirst().orElseThrow();
                    store.appendOutbox(LearningEventFactory.taskCompleted(
                            scope, task, command.metadata(), clock.instant()));
                    // M5-013 trusted completion (v2): same idempotent block, so replays
                    // append once. v1 is retained for existing consumers until the M8 cutover.
                    store.appendOutbox(LearningEventFactory.trustedTaskCompleted(
                            scope, task, current.contentEpoch(), "P1_TASK_COMPLETION_V1",
                            command.metadata(), clock.instant()));
                    return completed;
                }));
    }

    public LearningCommandResult<ReviewQueueSnapshot> buildReviewQueue(
            LearningPrincipalContext principal,
            BuildReviewQueueCommand command) {
        authorize(principal, REVIEW_READ, "review_queue", Long.toString(command.targetId()));
        LearningTenantScope scope = principal.scope();
        return unwrap(store.executeIdempotently(scope, "srs.queue.build", command.idempotencyKey(),
                command.fingerprint(), () -> {
                    LearnerTargetPort.LearnerTargetSnapshot target = learnerTargetPort
                            .findTarget(principal, command.targetId())
                            .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.TARGET_NOT_FOUND,
                                    "learner target is not available"));
                    requireSameScope(scope, target.scope());
                    if (target.targetId() != command.targetId()) {
                        throw new LearningDomainException(LearningDecisionCode.TARGET_NOT_FOUND,
                                "learner target port returned another target");
                    }
                    ZoneId zone = ZoneId.of(target.timeZoneId());
                    Instant dueBy = command.localDate().plusDays(1).atStartOfDay(zone)
                            .toInstant().minusNanos(1);
                    List<SrsState> states = store.dueSrsStates(scope, dueBy).stream()
                            .filter(state -> state.targetId() == target.targetId()
                                    && state.contentVersionId() == target.contentVersionId())
                            .filter(state -> !state.dueAt().isAfter(dueBy))
                            .limit(command.limit())
                            .toList();
                    ReviewQueueSnapshot snapshot = new ReviewQueueSnapshot(
                            ids.nextId("schedule_snapshot"), scope, command.localDate(),
                            target.timeZoneId(), Sm2Scheduler.ALGORITHM_VERSION, states);
                    store.saveReviewQueue(snapshot);
                    store.appendOutbox(LearningEventFactory.queueCreated(
                            scope, snapshot.scheduleSnapshotId(), snapshot.localDate(), snapshot.rulesVersion(),
                            snapshot.items().size(), command.metadata(), clock.instant()));
                    return snapshot;
                }));
    }

    private void authorize(LearningPrincipalContext principal, String permission,
            String resourceType, String resourceId) {
        accessPolicy.authorize(principal, permission, resourceType, resourceId,
                principal == null ? null : principal.scope().tenantId(),
                principal == null ? null : principal.scope().principalId()).requireAllowed();
    }

    private static void requireSameScope(LearningTenantScope expected, LearningTenantScope actual) {
        if (!expected.equals(actual)) {
            throw new LearningDomainException(LearningDecisionCode.OWNER_MISMATCH,
                    "port returned a target outside the verified owner scope");
        }
    }

    private static void requireVersion(long actual, long expected) {
        if (actual != expected) {
            throw new LearningDomainException(LearningDecisionCode.VERSION_CONFLICT,
                    "expected state version does not match");
        }
    }

    private static <T> LearningCommandResult<T> unwrap(IdempotentExecution<T> execution) {
        return new LearningCommandResult<>(execution.value(), execution.replayed());
    }
}
