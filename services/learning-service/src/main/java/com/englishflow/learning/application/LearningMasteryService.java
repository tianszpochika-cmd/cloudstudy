package com.englishflow.learning.application;

import com.englishflow.learning.domain.LearningAccessPolicy;
import com.englishflow.learning.domain.LearningDecisionCode;
import com.englishflow.learning.domain.LearningDomainException;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.MasteryEvidence;
import com.englishflow.learning.domain.MasteryProjection;
import com.englishflow.learning.port.AssessmentLearningEvent;
import com.englishflow.learning.port.IdempotentExecution;
import com.englishflow.learning.port.LearningFactStore;

import java.time.Clock;
import java.util.Objects;

/** Projects trusted assessment facts into learner-owned mastery; it never scores answers. */
public final class LearningMasteryService {

    private final LearningFactStore store;
    private final LearningAccessPolicy accessPolicy;
    private final Clock clock;

    public LearningMasteryService(LearningFactStore store, LearningAccessPolicy accessPolicy, Clock clock) {
        this.store = Objects.requireNonNull(store, "store is required");
        this.accessPolicy = Objects.requireNonNull(accessPolicy, "access policy is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public LearningCommandResult<MasteryProjection> applyAssessment(
            LearningPrincipalContext principal,
            ApplyAssessmentLearningCommand command) {
        AssessmentLearningEvent event = command.event();
        authorize(principal, "learning.mastery.write", "mastery_projection",
                event.itemType() + ":" + event.itemId());
        if (!principal.scope().equals(event.scope())) {
            throw new LearningDomainException(LearningDecisionCode.OWNER_MISMATCH,
                    "assessment event is outside the verified owner scope");
        }
        LearningTenantScope scope = principal.scope();
        return unwrap(store.executeIdempotently(scope, "mastery.apply", command.idempotencyKey(),
                command.fingerprint(), () -> {
                    MasteryEvidence evidence = new MasteryEvidence(
                            event.eventId(), event.scope(), event.itemType(), event.itemId(),
                            event.contentVersionId(), event.correct(), event.score(), event.reason(),
                            event.ruleVersion(), event.verificationStage(), event.occurredAt());
                    MasteryProjection before = store.findMastery(scope, event.itemType(), event.itemId())
                            .orElse(MasteryProjection.empty(scope, event.itemType(), event.itemId(), clock.instant()));
                    MasteryProjection.ApplyResult applied = before.apply(evidence);
                    if (applied.replayed()) {
                        return before;
                    }
                    MasteryProjection after = applied.projection();
                    store.saveMastery(after);
                    if (before.stage() != after.stage()) {
                        store.appendOutbox(LearningEventFactory.masteryChanged(scope, before, after,
                                event.reason(), command.metadata(), clock.instant()));
                    }
                    return after;
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
