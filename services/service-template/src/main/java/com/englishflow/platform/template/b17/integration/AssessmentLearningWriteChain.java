package com.englishflow.platform.template.b17.integration;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Neutral adapter contract for assessment submit -> authoritative assessment -> learning
 * mastery/SRS projection. Client score and answer authority are deliberately absent.
 */
public final class AssessmentLearningWriteChain {
    public interface ServerScorer {
        AssessmentOutcome assess(AssessmentSubmission submission);
    }

    public interface LearningProjectionWriter {
        ProjectionResult project(AssessmentOutcome outcome);
    }

    public record AssessmentSubmission(
            B17AuthorizationContext context,
            String attemptId,
            long assessmentVersion,
            String idempotencyKey,
            String answerDigest) {
        public AssessmentSubmission {
            Objects.requireNonNull(context, "context");
            attemptId = required(attemptId, "attemptId");
            idempotencyKey = required(idempotencyKey, "idempotencyKey");
            answerDigest = required(answerDigest, "answerDigest");
            if (assessmentVersion < 1) throw new IllegalArgumentException("assessmentVersion must be positive");
        }
    }

    public record AssessmentOutcome(
            B17AuthorizationContext context,
            String attemptId,
            long assessmentVersion,
            String sourceEventId,
            String scoreBucket,
            List<String> mistakeCodes,
            String masterySignal) {
        public AssessmentOutcome {
            Objects.requireNonNull(context, "context");
            attemptId = required(attemptId, "attemptId");
            sourceEventId = required(sourceEventId, "sourceEventId");
            scoreBucket = required(scoreBucket, "scoreBucket");
            masterySignal = required(masterySignal, "masterySignal");
            mistakeCodes = mistakeCodes == null ? List.of() : List.copyOf(mistakeCodes);
            if (assessmentVersion < 1) throw new IllegalArgumentException("assessmentVersion must be positive");
            if (mistakeCodes.stream().anyMatch(code -> code == null || code.isBlank())) {
                throw new IllegalArgumentException("mistakeCodes must be safe non-blank codes");
            }
        }
    }

    public record ProjectionResult(String projectionEventId, long projectionVersion, boolean replayed) {
        public ProjectionResult {
            projectionEventId = required(projectionEventId, "projectionEventId");
            if (projectionVersion < 1) throw new IllegalArgumentException("projectionVersion must be positive");
        }
    }

    public record ChainEvent(String eventName, String aggregateId, String idempotencyKey, String sourceEventId) {
        public ChainEvent {
            eventName = required(eventName, "eventName");
            aggregateId = required(aggregateId, "aggregateId");
            idempotencyKey = required(idempotencyKey, "idempotencyKey");
            sourceEventId = required(sourceEventId, "sourceEventId");
        }
    }

    public record Result(AssessmentOutcome assessment, ProjectionResult projection, List<ChainEvent> events) {
        public Result {
            Objects.requireNonNull(assessment, "assessment");
            Objects.requireNonNull(projection, "projection");
            events = List.copyOf(events);
        }
    }

    private final ServerScorer scorer;
    private final LearningProjectionWriter projections;

    public AssessmentLearningWriteChain(ServerScorer scorer, LearningProjectionWriter projections) {
        this.scorer = Objects.requireNonNull(scorer, "scorer");
        this.projections = Objects.requireNonNull(projections, "projections");
    }

    public Result submit(AssessmentSubmission submission, long expectedContentVersion) {
        Objects.requireNonNull(submission, "submission");
        if (submission.assessmentVersion() != expectedContentVersion) {
            throw new IllegalArgumentException("assessment snapshot version mismatch");
        }
        AssessmentOutcome outcome = Objects.requireNonNull(scorer.assess(submission), "scorer result");
        if (!submission.context().equals(outcome.context())
                || !submission.attemptId().equals(outcome.attemptId())
                || submission.assessmentVersion() != outcome.assessmentVersion()) {
            throw new IllegalStateException("assessment result is not bound to the submitted snapshot");
        }
        ProjectionResult projection = Objects.requireNonNull(projections.project(outcome), "projection result");
        List<ChainEvent> events = new ArrayList<>();
        events.add(new ChainEvent(
                "assessment.attempt.submitted.v1",
                outcome.attemptId(),
                submission.idempotencyKey(),
                outcome.sourceEventId()));
        events.add(new ChainEvent(
                "assessment.attempt.assessed.v1",
                outcome.attemptId(),
                "assessed:" + outcome.sourceEventId(),
                outcome.sourceEventId()));
        events.add(new ChainEvent(
                "learning.mastery.projected.v1",
                outcome.attemptId(),
                "mastery:" + outcome.sourceEventId(),
                outcome.sourceEventId()));
        return new Result(outcome, projection, events);
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value.trim();
    }
}
