package com.englishflow.gamification.domain;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record RewardProbabilityDisclosure(
        String grantId,
        String rewardCode,
        String probabilityVersion,
        List<RewardProbability> outcomes,
        BigDecimal totalProbability,
        boolean disclosedBeforeClaim,
        boolean cashReward,
        long cashValueMinor,
        String currency) {

    /** Compatibility constructor for the earlier application policy helper. */
    public RewardProbabilityDisclosure(String probabilityVersion, String algorithmVersion,
            Map<String, BigDecimal> probabilities, boolean disclosedBeforeClaim, boolean ignoredLegacyCashFlag) {
        this("", "FREE_LEARNING_COSMETIC_CHEST_V1", probabilityVersion,
                probabilities.entrySet().stream()
                        .map(entry -> new RewardProbability(entry.getKey(), entry.getValue()))
                        .toList(),
                probabilities.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add),
                disclosedBeforeClaim, false, 0L, "NONE");
    }

    /** Compatibility read for application-only policy helpers. */
    public String algorithmVersion() {
        return "SHA-256-DETERMINISTIC-V1";
    }

    /** Compatibility read for application-only policy helpers. */
    public Map<String, BigDecimal> probabilities() {
        Map<String, BigDecimal> result = new LinkedHashMap<>();
        for (RewardProbability probability : outcomes) {
            result.put(probability.outcomeCode(), probability.probability());
        }
        return Map.copyOf(result);
    }
}
