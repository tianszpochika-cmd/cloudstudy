package com.englishflow.content.application;

import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentIdempotencyKey;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ContentRequestContext;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ContentVersionStatus;
import com.englishflow.content.domain.ScheduledPublishTask;
import com.englishflow.content.port.ContentRepository;
import com.englishflow.content.port.ScheduledPublishRepository;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Executes due scheduled-publish tasks inside content-service.
 *
 * <p>The executor runs under a server-derived system identity (never a client
 * principal) and re-validates the pinned state version at run time: a stale
 * pin fails the task instead of publishing the wrong version.</p>
 */
public final class ScheduledPublishExecutor {

    private final ScheduledPublishRepository tasks;
    private final ContentRepository contentsRepo;
    private final ContentCommandService contents;
    private final LexemeCommandService lexemes;
    private final ContentItemCommandService items;
    private final Clock clock;

    public ScheduledPublishExecutor(
            ScheduledPublishRepository tasks,
            ContentRepository contentsRepo,
            ContentCommandService contents,
            LexemeCommandService lexemes,
            ContentItemCommandService items,
            Clock clock) {
        this.tasks = Objects.requireNonNull(tasks, "tasks are required");
        this.contentsRepo = Objects.requireNonNull(contentsRepo, "contentsRepo is required");
        this.contents = Objects.requireNonNull(contents, "contents are required");
        this.lexemes = Objects.requireNonNull(lexemes, "lexemes are required");
        this.items = Objects.requireNonNull(items, "items are required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public record ExecutionReport(int executed, int failed, Instant executedAt) {
    }

    public ExecutionReport executeDue(Instant now) {
        List<ScheduledPublishTask> due = tasks.dueTasks(now, 50);
        int executed = 0;
        int failed = 0;
        for (ScheduledPublishTask task : due) {
            boolean succeeded;
            try {
                execute(task, now);
                task.markExecuted(now);
                succeeded = true;
            } catch (ContentOperationException error) {
                task.markFailed(error.code(), now);
                succeeded = false;
            } catch (RuntimeException error) {
                // A non-domain failure (JDBC outage, serialization, NPE) must fail
                // only its own task; the rest of the batch still runs.
                task.markFailed("SCHEDULE_EXECUTION_FAILED", now);
                succeeded = false;
            }
            if (succeeded && persist(task)) {
                executed += 1;
            } else {
                failed += 1;
            }
        }
        return new ExecutionReport(executed, failed, now);
    }

    /**
     * Records the terminal task state. A store outage here still fails only this
     * task: it stays SCHEDULED in the store and is retried on the next relay tick
     * (execution itself is idempotent per task id).
     */
    private boolean persist(ScheduledPublishTask task) {
        try {
            tasks.save(task);
            return true;
        } catch (RuntimeException error) {
            return false;
        }
    }

    private void execute(ScheduledPublishTask task, Instant now) {
        ContentActor system = new ContentActor("schedule-executor", "platform",
                Set.of("content-editor", "content-publisher"),
                Set.of("content:write", "content:publish"), true);
        ContentRequestContext context = new ContentRequestContext(
                "sched-" + task.taskId(), "0123456789abcdef0123456789abcdef");
        ContentIdempotencyKey key = new ContentIdempotencyKey("schedule-execute-" + task.taskId() + "-idempotency");
        switch (task.targetType()) {
            case "LEXEME" -> {
                var current = lexemes.current(task.packCode(), task.targetRef(), system);
                checkPin(task, current.stateVersion());
                lexemes.publish(task.packCode(), task.targetRef(), "SCHEDULED_PUBLISH", system, key, context);
            }
            case "ITEM" -> {
                var current = items.current(task.packCode(), task.targetRef(), system);
                checkPin(task, current.stateVersion());
                items.publish(task.packCode(), task.targetRef(), "SCHEDULED_PUBLISH", system, key, context);
            }
            case "PACK" -> {
                ContentDefinition pack = contentsRepo.findByCode(task.packCode())
                        .orElseThrow(() -> ContentOperationException.notFound("CONTENT_NOT_FOUND",
                                "scheduled pack does not exist"));
                ContentVersion target = pack.versions().stream()
                        .filter(version -> version.status() == ContentVersionStatus.APPROVED)
                        .reduce((left, right) -> right)
                        .orElseThrow(() -> ContentOperationException.conflict("SCHEDULE_PACK_NOT_APPROVED",
                                "scheduled pack has no APPROVED version to publish"));
                // The pin guards the version that will actually be published. Comparing
                // against the global max (which may be a newer DRAFT) would false-positive
                // SCHEDULE_PIN_STALE after any draft revision.
                checkPin(task, target.stateVersion());
                contents.publish(
                        new ContentCommandService.VersionCommand(pack.contentId(), target.versionId()),
                        system, key, context);
            }
            default -> throw ContentOperationException.badRequest("SCHEDULE_TARGET_INVALID", "target type is invalid");
        }
    }

    private static void checkPin(ScheduledPublishTask task, long current) {
        if (task.expectedStateVersion() != null && task.expectedStateVersion() != current) {
            throw ContentOperationException.conflict("SCHEDULE_PIN_STALE",
                    "pinned stateVersion " + task.expectedStateVersion() + " differs from current " + current);
        }
    }
}
