package com.englishflow.platform.template.b17.integration;

import java.util.Objects;
import java.util.Optional;

/**
 * Neutral adapter contract for learner -> content -> learning reads.
 *
 * <p>The records are integration facts, not shared ORM entities. Each service supplies an adapter
 * backed by its own schema/API. A missing, revoked, or stale fact is an explicit result and is
 * never silently converted into an empty success response.</p>
 */
public final class LearningReadChain {
    public enum Status { READY, EMPTY, DENIED, RECOVERY }

    public interface LearnerSource {
        Optional<LearnerFact> find(B17AuthorizationContext context);
    }

    public interface ContentSource {
        Optional<ContentFact> findPublished(B17AuthorizationContext context, String contentId, long expectedVersion);
    }

    public interface LearningSource {
        Optional<LearningTaskFact> findToday(B17AuthorizationContext context, String taskId, long contentVersion);
    }

    public record Request(
            B17AuthorizationContext context,
            String contentId,
            long contentVersion,
            String taskId) {
        public Request {
            Objects.requireNonNull(context, "context");
            contentId = required(contentId, "contentId");
            taskId = required(taskId, "taskId");
            if (contentVersion < 1) throw new IllegalArgumentException("contentVersion must be positive");
        }
    }

    public record LearnerFact(String subject, String tenantId, String profileId, String goal, long profileVersion) {
        public LearnerFact {
            subject = required(subject, "subject");
            tenantId = required(tenantId, "tenantId");
            profileId = required(profileId, "profileId");
            goal = required(goal, "goal");
            if (profileVersion < 1) throw new IllegalArgumentException("profileVersion must be positive");
        }
    }

    public record ContentFact(
            String contentId,
            long contentVersion,
            boolean published,
            boolean rightsActive,
            String rightsReference) {
        public ContentFact {
            contentId = required(contentId, "contentId");
            rightsReference = required(rightsReference, "rightsReference");
            if (contentVersion < 1) throw new IllegalArgumentException("contentVersion must be positive");
        }

        public boolean readable() {
            return published && rightsActive;
        }
    }

    public record LearningTaskFact(String taskId, String subject, long contentVersion, String status) {
        public LearningTaskFact {
            taskId = required(taskId, "taskId");
            subject = required(subject, "subject");
            status = required(status, "status");
            if (contentVersion < 1) throw new IllegalArgumentException("contentVersion must be positive");
        }
    }

    public record Result(Status status, String reason, LearnerFact learner, ContentFact content, LearningTaskFact task) {
        public Result {
            Objects.requireNonNull(status, "status");
            reason = required(reason, "reason");
        }
    }

    private final LearnerSource learners;
    private final ContentSource content;
    private final LearningSource learning;

    public LearningReadChain(LearnerSource learners, ContentSource content, LearningSource learning) {
        this.learners = Objects.requireNonNull(learners, "learners");
        this.content = Objects.requireNonNull(content, "content");
        this.learning = Objects.requireNonNull(learning, "learning");
    }

    public Result load(Request request) {
        Objects.requireNonNull(request, "request");
        B17AuthorizationContext context = request.context();
        LearnerFact learner = learners.find(context).orElse(null);
        if (learner == null) return new Result(Status.EMPTY, "LEARNER_PROFILE_NOT_FOUND", null, null, null);
        if (!context.subject().equals(learner.subject()) || !context.tenantId().equals(learner.tenantId())) {
            return new Result(Status.DENIED, "LEARNER_AUTHORITY_MISMATCH", null, null, null);
        }
        ContentFact contentFact = content.findPublished(context, request.contentId(), request.contentVersion()).orElse(null);
        if (contentFact == null) return new Result(Status.EMPTY, "CONTENT_VERSION_NOT_FOUND", learner, null, null);
        if (contentFact.contentVersion() != request.contentVersion()) {
            return new Result(Status.RECOVERY, "CONTENT_VERSION_STALE", learner, contentFact, null);
        }
        if (!contentFact.readable()) return new Result(Status.DENIED, "CONTENT_RIGHTS_REVOKED", learner, contentFact, null);
        LearningTaskFact task = learning.findToday(context, request.taskId(), contentFact.contentVersion()).orElse(null);
        if (task == null) return new Result(Status.EMPTY, "LEARNING_TASK_NOT_FOUND", learner, contentFact, null);
        if (!context.subject().equals(task.subject())) {
            return new Result(Status.DENIED, "LEARNING_OWNER_MISMATCH", learner, contentFact, null);
        }
        if (task.contentVersion() != contentFact.contentVersion()) {
            return new Result(Status.RECOVERY, "LEARNING_CONTENT_VERSION_MISMATCH", learner, contentFact, task);
        }
        return new Result(Status.READY, "OK", learner, contentFact, task);
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value.trim();
    }
}
