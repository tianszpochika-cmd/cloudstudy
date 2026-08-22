package com.englishflow.learning.application;

import com.englishflow.learning.domain.LearningAccessPolicy;
import com.englishflow.learning.domain.LearningDecisionCode;
import com.englishflow.learning.domain.LearningDomainException;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.ReviewEvent;
import com.englishflow.learning.domain.Sm2ReviewResult;
import com.englishflow.learning.domain.Sm2Scheduler;
import com.englishflow.learning.domain.SrsState;
import com.englishflow.learning.port.IdempotentExecution;
import com.englishflow.learning.port.LearningFactStore;
import com.englishflow.learning.port.LearningIdGenerator;
import com.englishflow.learning.port.LearnerTargetPort;
import com.englishflow.learning.port.PublishedContentPort;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

/** Applies one authoritative, idempotent SRS review against a content-version pin. */
public final class LearningReviewService {

    private final LearningFactStore store;
    private final LearnerTargetPort learnerTargetPort;
    private final PublishedContentPort contentPort;
    private final LearningIdGenerator ids;
    private final LearningAccessPolicy accessPolicy;
    private final Clock clock;

    public LearningReviewService(
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

    public LearningCommandResult<ReviewApplication> submit(
            LearningPrincipalContext principal,
            SubmitReviewCommand command) {
        authorize(principal, "learning.review.write", "srs_state", command.itemType() + ":" + command.itemId());
        LearningTenantScope scope = principal.scope();
        return unwrap(store.executeIdempotently(scope, "review.submit", command.idempotencyKey(),
                command.fingerprint(), () -> applyOnce(principal, command)));
    }

    private ReviewApplication applyOnce(LearningPrincipalContext principal, SubmitReviewCommand command) {
        LearningTenantScope scope = principal.scope();
        LearnerTargetPort.LearnerTargetSnapshot target = learnerTargetPort
                .findTarget(principal, command.targetId())
                .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.TARGET_NOT_FOUND,
                        "learner target is not available"));
        if (!scope.equals(target.scope()) || target.targetId() != command.targetId()
                || target.contentVersionId() != command.contentVersionId()) {
            throw new LearningDomainException(LearningDecisionCode.CONTENT_VERSION_MISMATCH,
                    "review target/content pin is not valid for the learner");
        }
        PublishedContentPort.PublishedContentSnapshot content = contentPort
                .findLearnerSnapshot(principal, command.contentVersionId())
                .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.CONTENT_NOT_AVAILABLE,
                        "published learner content is not available"));
        if (!content.learnerReadable() || content.contentVersionId() != command.contentVersionId()
                || content.items().stream().noneMatch(item -> item.itemType() == command.itemType()
                        && item.itemId() == command.itemId())) {
            throw new LearningDomainException(LearningDecisionCode.CONTENT_VERSION_MISMATCH,
                    "review item is not present in the readable content version");
        }

        SrsState before = store.findSrsState(scope, command.itemType(), command.itemId()).orElse(null);
        if (before == null) {
            if (command.expectedStateVersion() != 0) {
                throw new LearningDomainException(LearningDecisionCode.SRS_STATE_NOT_FOUND,
                        "expected an existing SRS state");
            }
            before = SrsState.newState(ids.nextId("srs_state"), scope, command.itemType(), command.targetId(),
                    command.itemId(), command.contentVersionId(), target.timeZoneId(), command.reviewedAt());
        } else {
            if (before.targetId() != command.targetId() || before.itemId() != command.itemId()
                    || before.contentVersionId() != command.contentVersionId()) {
                throw new LearningDomainException(LearningDecisionCode.CONTENT_VERSION_MISMATCH,
                        "review content version does not match the pinned SRS state");
            }
            if (command.expectedStateVersion() != before.stateVersion()) {
                throw new LearningDomainException(LearningDecisionCode.VERSION_CONFLICT,
                        "expected SRS state version does not match");
            }
            if (command.reviewedAt().isBefore(before.dueAt())) {
                throw new LearningDomainException(LearningDecisionCode.REVIEW_NOT_DUE,
                        "review cannot be applied before its due time");
            }
        }

        Sm2ReviewResult calculation = Sm2Scheduler.review(
                before, command.rawQuality(), command.confidence(), command.reviewedAt());
        SrsState after = before.apply(calculation);
        ReviewEvent review = new ReviewEvent(
                ids.nextId("review_event"), scope, command.itemType(), command.targetId(), command.itemId(),
                command.contentVersionId(), Sm2Scheduler.ALGORITHM_VERSION, before.srsStateId(), after.stateVersion(),
                calculation.rawQuality(), calculation.effectiveQuality(), command.confidence(),
                command.reviewedAt(), command.idempotencyKey().value());
        store.saveSrsState(after);
        store.saveReviewEvent(review);
        Instant occurredAt = clock.instant();
        store.appendOutbox(LearningEventFactory.reviewAccepted(scope, review, after,
                command.metadata(), occurredAt));
        store.appendOutbox(LearningEventFactory.srsStateChanged(scope, before, after,
                command.metadata(), occurredAt));
        return new ReviewApplication(before, after, review);
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

    public record ReviewApplication(SrsState before, SrsState after, ReviewEvent event) {
    }
}
