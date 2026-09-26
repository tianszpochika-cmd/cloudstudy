package com.englishflow.assessment.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** The frozen P1_PLACEMENT_V1 manifest and its assessment-owned scoring rule. */
public final class P1PlacementScorer {
    public enum Dimension { VOCABULARY, BASIC_GRAMMAR, READING, LISTENING }

    public record Item(String itemId, Dimension dimension) {}
    public record DimensionSummary(Dimension dimension, int validItemCount,
            int earnedItemCount, BigDecimal dimensionPercent) {}
    public record Progress(int validItemCount, BigDecimal coverageRatio, String confidence) {}
    public record Assessed(int aggregateScore, String referenceLevel, Progress progress,
            List<DimensionSummary> dimensionSummaries) {}

    private static final List<Dimension> ORDER = List.of(Dimension.VOCABULARY,
            Dimension.BASIC_GRAMMAR, Dimension.READING, Dimension.LISTENING);
    private static final Map<Dimension, Integer> REQUIRED = Map.of(
            Dimension.VOCABULARY, 3, Dimension.BASIC_GRAMMAR, 3,
            Dimension.READING, 2, Dimension.LISTENING, 2);
    private static final BigDecimal WEIGHT = new BigDecimal("0.25");

    private P1PlacementScorer() {}

    public static void requireManifest(List<Item> items) {
        if (items == null || items.size() != 10) throw new IllegalArgumentException("placement requires exactly ten items");
        Set<String> itemIds = new HashSet<>();
        EnumMap<Dimension, Integer> counts = new EnumMap<>(Dimension.class);
        for (Item item : items) {
            if (item == null || item.itemId() == null || item.itemId().isBlank()
                    || item.dimension() == null || !itemIds.add(item.itemId())) {
                throw new IllegalArgumentException("placement item identity or dimension is invalid");
            }
            counts.merge(item.dimension(), 1, Integer::sum);
        }
        for (Dimension dimension : ORDER) {
            if (counts.getOrDefault(dimension, 0) != REQUIRED.get(dimension)) {
                throw new IllegalArgumentException("placement dimension count is invalid: " + dimension);
            }
        }
    }

    public static Progress progress(List<Item> items, Map<String, Boolean> serverGradedAnswers) {
        requireManifest(items);
        requireAcceptedAnswers(items, serverGradedAnswers);
        int accepted = serverGradedAnswers.size();
        BigDecimal coverage = BigDecimal.valueOf(accepted).divide(BigDecimal.TEN, 2, RoundingMode.HALF_UP);
        if (accepted == 0) return new Progress(0, coverage, "UNVERIFIED");
        if (accepted == 10) return new Progress(10, coverage, "HIGH");
        Set<Dimension> answeredDimensions = new HashSet<>();
        for (Item item : items) if (serverGradedAnswers.containsKey(item.itemId())) answeredDimensions.add(item.dimension());
        String confidence = accepted >= 8 && answeredDimensions.size() == 4 ? "MEDIUM" : "LOW";
        return new Progress(accepted, coverage, confidence);
    }

    /** Called only after ten distinct, protected server-graded responses have been accepted. */
    public static Assessed assess(List<Item> items, Map<String, Boolean> serverGradedAnswers) {
        Progress progress = progress(items, serverGradedAnswers);
        if (progress.validItemCount() != 10) {
            throw new IllegalArgumentException("an incomplete placement cannot become an assessed result");
        }
        List<DimensionSummary> summaries = new ArrayList<>(4);
        BigDecimal aggregate = BigDecimal.ZERO;
        for (Dimension dimension : ORDER) {
            int earned = 0;
            for (Item item : items) {
                if (item.dimension() == dimension && Boolean.TRUE.equals(serverGradedAnswers.get(item.itemId()))) earned++;
            }
            BigDecimal percent = BigDecimal.valueOf(earned)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(REQUIRED.get(dimension)), 2, RoundingMode.HALF_UP);
            summaries.add(new DimensionSummary(dimension, REQUIRED.get(dimension), earned, percent));
            aggregate = aggregate.add(percent.multiply(WEIGHT));
        }
        int score = aggregate.setScale(0, RoundingMode.HALF_UP).intValueExact();
        return new Assessed(score, referenceLevel(score), progress, List.copyOf(summaries));
    }

    public static String referenceLevel(int score) {
        if (score < 0 || score > 100) throw new IllegalArgumentException("score is outside 0..100");
        if (score < 40) return "A1";
        if (score < 60) return "A2";
        if (score < 75) return "B1";
        if (score < 85) return "B2";
        if (score < 93) return "C1";
        return "C2";
    }

    private static void requireAcceptedAnswers(List<Item> items, Map<String, Boolean> answers) {
        if (answers == null) throw new IllegalArgumentException("server-graded answers are required");
        Set<String> ids = new HashSet<>();
        for (Item item : items) ids.add(item.itemId());
        for (Map.Entry<String, Boolean> answer : answers.entrySet()) {
            if (!ids.contains(answer.getKey()) || answer.getValue() == null) {
                throw new IllegalArgumentException("answer is not part of the frozen manifest");
            }
        }
    }
}
