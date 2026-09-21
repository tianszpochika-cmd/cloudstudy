package com.englishflow.content.application;

import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ScheduledPublishTask;
import com.englishflow.content.port.ContentIdempotencyPort;
import com.englishflow.content.port.ScheduledPublishRepository;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Scheduled-publish task management owned by content-service. */
public final class ScheduledPublishService {

    private final ScheduledPublishRepository tasks;
    private final ContentIdempotencyPort idempotency;
    private final Clock clock;

    public ScheduledPublishService(
            ScheduledPublishRepository tasks,
            ContentIdempotencyPort idempotency,
            Clock clock) {
        this.tasks = Objects.requireNonNull(tasks, "tasks are required");
        this.idempotency = Objects.requireNonNull(idempotency, "idempotency is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public ScheduledPublishTask schedule(
            String packCode,
            String targetType,
            String targetRef,
            Long expectedStateVersion,
            Instant runAt,
            String reasonCode,
            String cohort,
            ContentActor actor,
            ContentIdempotencyKey key,
            ContentRequestContext context) {
        if (!actor.canPublish()) {
            throw ContentOperationException.forbidden("SCHEDULE_PUBLISHER_REQUIRED",
                    "schedule publisher permission is required");
        }
        requireTenant(actor);
        String target = targetType == null ? "PACK" : targetType.trim().toUpperCase();
        if (!ScheduledPublishTask.TARGETS.contains(target)) {
            throw ContentOperationException.badRequest("SCHEDULE_TARGET_INVALID", "target type is invalid");
        }
        if (targetRef == null || targetRef.isBlank()) {
            throw ContentOperationException.badRequest("SCHEDULE_FIELD_INVALID", "targetRef is required");
        }
        if (reasonCode == null || reasonCode.isBlank()) {
            throw ContentOperationException.badRequest("SCHEDULE_FIELD_INVALID", "reasonCode is required for audit");
        }
        Objects.requireNonNull(runAt, "runAt is required");
        return idempotency.execute(
                scope(actor, "schedule.publish"), key, fingerprint(packCode, target, targetRef, runAt, cohort),
                () -> {
                    Instant now = clock.instant();
                    ScheduledPublishTask task = ScheduledPublishTask.schedule(
                            "spt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12),
                            packCode, target, targetRef.trim(), expectedStateVersion, runAt,
                            reasonCode.trim(), cohort, actor.subjectId(), now);
                    tasks.save(task);
                    return task;
                });
    }

    public ScheduledPublishTask cancel(String taskId, ContentActor actor,
            ContentIdempotencyKey key, ContentRequestContext context) {
        if (!actor.canPublish()) {
            throw ContentOperationException.forbidden("SCHEDULE_PUBLISHER_REQUIRED",
                    "schedule publisher permission is required");
        }
        requireTenant(actor);
        return idempotency.execute(
                scope(actor, "schedule.cancel"), key, fingerprint(taskId),
                () -> {
                    ScheduledPublishTask task = tasks.findById(taskId)
                            .orElseThrow(() -> ContentOperationException.notFound("SCHEDULE_NOT_FOUND",
                                    "scheduled task does not exist"));
                    task.cancel(clock.instant());
                    tasks.save(task);
                    return task;
                });
    }

    public ScheduledPublishTask get(String taskId, ContentActor actor) {
        requireRead(actor);
        requireTenant(actor);
        return tasks.findById(taskId)
                .orElseThrow(() -> ContentOperationException.notFound("SCHEDULE_NOT_FOUND",
                        "scheduled task does not exist"));
    }

    public List<ScheduledPublishTask> listByPack(String packCode, int limit, ContentActor actor) {
        requireRead(actor);
        requireTenant(actor);
        return tasks.listByPack(packCode, limit);
    }

    private static void requireTenant(ContentActor actor) {
        if (!"platform".equals(actor.tenantId())) {
            throw ContentOperationException.forbidden("SCHEDULE_TENANT_DENIED", "schedule tenant scope denied");
        }
    }

    private static void requireRead(ContentActor actor) {
        if (!actor.canEdit() && !actor.canReviewFirst() && !actor.canReviewFinal() && !actor.canPublish()) {
            throw ContentOperationException.forbidden("SCHEDULE_ADMIN_REQUIRED", "schedule admin permission is required");
        }
    }

    private static String scope(ContentActor actor, String operation) {
        return actor.tenantId() + ":" + actor.subjectId() + ":" + operation;
    }

    private static String fingerprint(Object... parts) {
        StringBuilder joined = new StringBuilder();
        for (Object part : parts) {
            joined.append(part == null ? "null" : part.toString()).append('|');
        }
        return com.englishflow.content.domain.ContentPayloadHash.sha256(Map.of("command", joined.toString()));
    }
}
