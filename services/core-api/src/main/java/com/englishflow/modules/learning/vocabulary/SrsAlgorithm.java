package com.englishflow.modules.learning.vocabulary;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/** Deterministic SM2_Q03_V1 calculator. It has no persistence or Spring dependencies. */
public final class SrsAlgorithm {
    public static final String VERSION = "SM2_Q03_V1";
    public static final BigDecimal MIN_EASE = new BigDecimal("1.30");
    public static final BigDecimal MAX_EASE = new BigDecimal("2.50");
    private static final int[] ANCHORS = {0, 1, 3, 7, 15, 30, 90};

    private SrsAlgorithm() {}

    public record Input(int repetitionCount, int intervalDays, BigDecimal easeFactor, int rawQuality,
                        String answerOutcome, Instant reviewedAt, ZoneId timezone) {}

    public record Result(int effectiveQuality, int repetitionCount, int intervalDays, BigDecimal easeFactor,
                         Instant dueAt, String dueLocalDate) {}

    public static Result calculate(Input input) {
        if (input == null || input.reviewedAt() == null || input.timezone() == null) {
            throw new IllegalArgumentException("reviewedAt and timezone are required");
        }
        int q = effectiveQuality(input.rawQuality(), input.answerOutcome());
        if (q < 0 || q > 3) throw new IllegalArgumentException("quality must be 0..3");
        BigDecimal currentEase = input.easeFactor() == null ? MAX_EASE : input.easeFactor();
        BigDecimal delta = new BigDecimal("0.10").subtract(
                BigDecimal.valueOf(3L - q).multiply(
                        new BigDecimal("0.08").add(BigDecimal.valueOf(3L - q).multiply(new BigDecimal("0.02")))));
        BigDecimal nextEase = currentEase.add(delta).setScale(2, RoundingMode.HALF_UP);
        if (nextEase.compareTo(MIN_EASE) < 0) nextEase = MIN_EASE;
        if (nextEase.compareTo(MAX_EASE) > 0) nextEase = MAX_EASE;
        int nextRepetition = q < 2 ? 0 : Math.addExact(input.repetitionCount(), 1);
        int nextInterval;
        if (q < 2) nextInterval = 1;
        else if (nextRepetition <= 6) nextInterval = ANCHORS[nextRepetition];
        else {
            nextInterval = Math.max(1, Math.min(365, new BigDecimal(input.intervalDays()).multiply(nextEase).setScale(0, RoundingMode.HALF_UP).intValue()));
        }
        ZonedDateTime localReview = input.reviewedAt().atZone(input.timezone());
        Instant dueAt = localReview.plusDays(nextInterval).toInstant();
        return new Result(q, nextRepetition, nextInterval, nextEase, dueAt,
                dueAt.atZone(input.timezone()).toLocalDate().toString());
    }

    public static int effectiveQuality(int rawQuality, String answerOutcome) {
        if (rawQuality < 0 || rawQuality > 3) throw new IllegalArgumentException("quality must be 0..3");
        String outcome = answerOutcome == null ? "" : answerOutcome.toUpperCase();
        return switch (outcome) {
            case "INCORRECT" -> Math.min(rawQuality, 1);
            case "UNANSWERED" -> 0;
            case "CORRECT", "REVEALED_WITHOUT_ANSWER" -> rawQuality;
            default -> throw new IllegalArgumentException("unsupported answer outcome");
        };
    }
}
