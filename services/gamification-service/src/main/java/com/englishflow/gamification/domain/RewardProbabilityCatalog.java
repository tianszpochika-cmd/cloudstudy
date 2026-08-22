package com.englishflow.gamification.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

/** Fixed, disclosed, non-cash reward distribution. */
public final class RewardProbabilityCatalog {

    public static final String VERSION = "GAM_REWARD_PROB_2026_08_20_01";
    private static final int COMMON_WEIGHT = 7_000;
    private static final int RARE_WEIGHT = 2_500;

    private final List<RewardProbability> probabilities = List.of(
            new RewardProbability("COSMETIC_COMMON", new BigDecimal("0.70")),
            new RewardProbability("COSMETIC_RARE", new BigDecimal("0.25")),
            new RewardProbability("COSMETIC_EPIC", new BigDecimal("0.05")));

    public String version() {
        return VERSION;
    }

    public RewardProbabilityDisclosure disclosure(String grantId, String rewardCode) {
        return new RewardProbabilityDisclosure(grantId, rewardCode, VERSION, probabilities,
                new BigDecimal("1.00"), true, false, 0L, "NONE");
    }

    public RewardOutcome resolve(String grantId) {
        int bucket = unsignedBucket(grantId);
        if (bucket < COMMON_WEIGHT) {
            return new RewardOutcome("COSMETIC_COMMON", "学习主题普通装扮");
        }
        if (bucket < COMMON_WEIGHT + RARE_WEIGHT) {
            return new RewardOutcome("COSMETIC_RARE", "学习主题稀有装扮");
        }
        return new RewardOutcome("COSMETIC_EPIC", "学习主题史诗装扮");
    }

    private static int unsignedBucket(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            int raw = ((digest[0] & 0xff) << 8) | (digest[1] & 0xff);
            return raw % 10_000;
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }
}
