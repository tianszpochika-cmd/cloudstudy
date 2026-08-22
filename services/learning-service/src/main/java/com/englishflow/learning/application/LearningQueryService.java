package com.englishflow.learning.application;

import com.englishflow.learning.domain.AuthorizationDecision;
import com.englishflow.learning.domain.LearningAccessPolicy;
import com.englishflow.learning.domain.LearningDecisionCode;
import com.englishflow.learning.domain.LearningDomainException;
import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningProgress;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.MasteryProjection;
import com.englishflow.learning.domain.SrsState;
import com.englishflow.learning.port.LearningFactStore;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Objects;

/** Read-only learning projections; queries never reach learner/content tables directly. */
public final class LearningQueryService {

    private final LearningFactStore store;
    private final LearningAccessPolicy policy;
    private final Clock clock;
    private final String rulesVersion;

    public LearningQueryService(LearningFactStore store, LearningAccessPolicy policy, Clock clock) {
        this(store, policy, clock, "SM2_Q03_V1");
    }

    public LearningQueryService(LearningFactStore store, LearningAccessPolicy policy,
            Clock clock, String rulesVersion) {
        this.store = Objects.requireNonNull(store, "store is required");
        this.policy = Objects.requireNonNull(policy, "policy is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
        if (rulesVersion == null || rulesVersion.isBlank()) {
            throw new IllegalArgumentException("rulesVersion is required");
        }
        this.rulesVersion = rulesVersion;
    }

    public LearningPlan getPlan(com.englishflow.learning.domain.LearningPrincipalContext principal,
            long planId) {
        authorize(principal, "learning.plan.read", "learning-plan", planId);
        return store.findPlanById(principal.scope(), planId)
                .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.TARGET_NOT_FOUND,
                        "learning plan was not found"));
    }

    public ReviewQueueView getReviewQueue(
            com.englishflow.learning.domain.LearningPrincipalContext principal,
            long planId, LocalDate requestedDate) {
        LearningPlan plan = getPlan(principal, planId);
        authorize(principal, "learning.review.read", "review-queue", planId);
        ZoneId zone = ZoneId.of(plan.timeZoneId());
        LocalDate localDate = requestedDate == null
                ? clock.instant().atZone(zone).toLocalDate()
                : requestedDate;
        ZonedDateTime endOfDay = ZonedDateTime.of(localDate.plusDays(1), LocalTime.MIDNIGHT, zone)
                .minusNanos(1);
        return new ReviewQueueView(principal.scope(), localDate, plan.timeZoneId(), rulesVersion,
                store.dueSrsStates(principal.scope(), endOfDay.toInstant()).stream()
                        .filter(state -> state.targetId() == plan.targetId()
                                && state.contentVersionId() == plan.contentVersionId())
                        .toList());
    }

    public SrsState getSrsState(com.englishflow.learning.domain.LearningPrincipalContext principal,
            LearningItemType itemType, long itemId) {
        authorize(principal, "learning.review.read", "srs-state", itemId);
        return store.findSrsState(principal.scope(), itemType, itemId)
                .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.SRS_STATE_NOT_FOUND,
                        "SRS state was not found"));
    }

    public MasteryProjection getMastery(
            com.englishflow.learning.domain.LearningPrincipalContext principal,
            LearningItemType itemType, long itemId) {
        authorize(principal, "learning.mastery.read", "mastery-projection", itemId);
        return store.findMastery(principal.scope(), itemType, itemId)
                .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.MASTERY_INVALID,
                        "mastery projection was not found"));
    }

    public LearningProgress getProgress(
            com.englishflow.learning.domain.LearningPrincipalContext principal,
            long planId, long taskId) {
        authorize(principal, "learning.progress.read", "learning-progress", planId);
        return store.findProgress(principal.scope(), planId, taskId)
                .orElseThrow(() -> new LearningDomainException(LearningDecisionCode.PROGRESS_INVALID,
                        "learning progress was not found"));
    }

    private void authorize(com.englishflow.learning.domain.LearningPrincipalContext principal,
            String permission, String resourceType, long resourceId) {
        AuthorizationDecision decision = policy.authorize(principal, permission, resourceType,
                Long.toString(resourceId), principal == null ? null : principal.scope().tenantId(),
                principal == null ? null : principal.scope().principalId());
        decision.requireAllowed();
    }
}
