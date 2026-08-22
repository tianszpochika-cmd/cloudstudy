package com.englishflow.learning.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Objects;

/**
 * Deterministic SM-2/review rule interpreter. The algorithm version is part of the event facts so
 * future rule changes can replay historical reviews with the correct interpreter.
 */
public final class Sm2Scheduler {

    public static final String ALGORITHM_VERSION = "SM2_Q03_V1";
    private static final double MIN_EASE = 1.30d;
    private static final double MAX_EASE = 2.50d;
    private static final int[] INTERVAL_ANCHORS = {0, 1, 3, 7, 15, 30, 90};

    private Sm2Scheduler() {
    }

    public static Sm2ReviewResult review(SrsState state, int rawQuality,
            ReviewConfidence confidence, Instant reviewedAt) {
        Objects.requireNonNull(state, "state is required");
        Objects.requireNonNull(confidence, "confidence is required");
        Objects.requireNonNull(reviewedAt, "reviewedAt is required");
        if (rawQuality < 0 || rawQuality > 3) {
            throw new LearningDomainException(LearningDecisionCode.INVALID_REVIEW,
                    "quality must be between 0 and 3");
        }
        if (state.lastReviewedAt() != null && reviewedAt.isBefore(state.lastReviewedAt())) {
            throw new LearningDomainException(LearningDecisionCode.REVIEW_OUT_OF_ORDER,
                    "reviewedAt cannot move backwards for an SRS state");
        }

        int effectiveQuality = confidence.capQuality(rawQuality);
        int distanceFromPerfect = 3 - effectiveQuality;
        double nextEf = state.easinessFactor()
                + 0.10d - distanceFromPerfect * (0.08d + distanceFromPerfect * 0.02d);
        nextEf = Math.min(MAX_EASE, Math.max(MIN_EASE, round2(nextEf)));

        int repetitions;
        int intervalDays;
        int lapseCount = state.lapseCount();
        if (effectiveQuality < 2) {
            repetitions = 0;
            intervalDays = 1;
            lapseCount++;
        } else {
            repetitions = state.repetitions() + 1;
            intervalDays = repetitions <= 6
                    ? INTERVAL_ANCHORS[repetitions]
                    : Math.max(1, Math.min(365,
                            (int) Math.round(state.intervalDays() * nextEf)));
        }

        SrsStage after = effectiveQuality < 3 && state.stage() != SrsStage.NEW
                ? SrsStage.LEARNING
                : SrsStage.from(repetitions, intervalDays, effectiveQuality);
        SrsStage.assertTransition(state.stage(), after);
        ZoneId zone = ZoneId.of(state.timeZoneId());
        LocalDate localReviewDate = reviewedAt.atZone(zone).toLocalDate();
        Instant dueAt = reviewedAt.atZone(zone).plusDays(intervalDays).toInstant();
        return new Sm2ReviewResult(
                state.stage(), after, rawQuality, effectiveQuality, nextEf, repetitions,
                intervalDays, lapseCount, dueAt, reviewedAt, state.stateVersion() + 1);
    }

    private static double round2(double value) {
        return Math.round(value * 100d) / 100d;
    }
}
