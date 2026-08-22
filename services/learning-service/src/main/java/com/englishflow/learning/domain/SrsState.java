package com.englishflow.learning.domain;

import java.time.Instant;
import java.time.ZoneId;
import java.util.Objects;

/** The learning-service-owned SRS fact for one learner and one published item. */
public record SrsState(
        long srsStateId,
        LearningTenantScope scope,
        LearningItemType itemType,
        long targetId,
        long itemId,
        long contentVersionId,
        SrsStage stage,
        double easinessFactor,
        int repetitions,
        int intervalDays,
        int lapseCount,
        String timeZoneId,
        Instant dueAt,
        Instant lastReviewedAt,
        int stateVersion) {

    public SrsState {
        if (srsStateId < 1 || targetId < 1 || itemId < 1 || contentVersionId < 1) {
            throw new IllegalArgumentException("SRS identifiers must be positive");
        }
        Objects.requireNonNull(scope, "scope is required");
        Objects.requireNonNull(itemType, "itemType is required");
        if (!itemType.srsEligible()) {
            throw new IllegalArgumentException("item type is not eligible for SRS: " + itemType);
        }
        Objects.requireNonNull(stage, "stage is required");
        if (easinessFactor < 1.3d || easinessFactor > 2.5d || repetitions < 0 || intervalDays < 0 || lapseCount < 0) {
            throw new IllegalArgumentException("invalid SRS numeric state");
        }
        if (timeZoneId == null || timeZoneId.isBlank()) {
            throw new IllegalArgumentException("timeZoneId is required");
        }
        ZoneId.of(timeZoneId);
        Objects.requireNonNull(dueAt, "dueAt is required");
        if (stateVersion < 1) {
            throw new IllegalArgumentException("stateVersion must be positive");
        }
    }

    public static SrsState newState(long srsStateId, LearningTenantScope scope,
            LearningItemType itemType, long targetId, long itemId, long contentVersionId,
            String timeZoneId, Instant now) {
        return new SrsState(srsStateId, scope, itemType, targetId, itemId, contentVersionId, SrsStage.NEW,
                2.5d, 0, 0, 0, timeZoneId, now, null, 1);
    }

    public SrsState apply(Sm2ReviewResult result) {
        Objects.requireNonNull(result, "result is required");
        if (result.nextStateVersion() != stateVersion + 1) {
            throw new LearningDomainException(LearningDecisionCode.VERSION_CONFLICT,
                    "SRS state version is not the next version");
        }
        if (result.beforeStage() != stage) {
            throw new LearningDomainException(LearningDecisionCode.INVALID_STATE_TRANSITION,
                    "SM-2 result was calculated from another state");
        }
        return new SrsState(
                srsStateId, scope, itemType, targetId, itemId, contentVersionId,
                result.afterStage(), result.easinessFactor(),
                result.repetitions(), result.intervalDays(), result.lapseCount(), timeZoneId,
                result.dueAt(), result.reviewedAt(), result.nextStateVersion());
    }
}
