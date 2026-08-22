package com.englishflow.gamification.application;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import com.englishflow.gamification.domain.RewardGrant;
import com.englishflow.gamification.domain.RewardProbabilityDisclosure;

/** Deterministic server-authoritative cosmetic reward selection. No cash or payment path exists. */
public final class RewardPolicy {

    public static final String PROBABILITY_VERSION = "GAM_REWARD_PROB_2026_08_20_01";
    public static final String ALGORITHM_VERSION = "HMAC-SHA256-DETERMINISTIC-V1";
    public static final String REWARD_POOL = "FREE_LEARNING_COSMETIC_CHEST_V1";

    private final RewardProbabilityDisclosure disclosure;

    public RewardPolicy() {
        Map<String, BigDecimal> probabilities = new LinkedHashMap<>();
        probabilities.put("COMMON_COSMETIC", new BigDecimal("0.70"));
        probabilities.put("RARE_COSMETIC", new BigDecimal("0.25"));
        probabilities.put("EPIC_COSMETIC", new BigDecimal("0.05"));
        disclosure = new RewardProbabilityDisclosure(PROBABILITY_VERSION, ALGORITHM_VERSION,
                probabilities, true, true);
    }

    public RewardProbabilityDisclosure disclosure() {
        return disclosure;
    }

    public RewardGrant newGrant(String grantId, String subject, String sourceEventKey, Instant grantedAt) {
        return RewardGrant.granted(grantId, subject, sourceEventKey, REWARD_POOL, disclosure, grantedAt);
    }

    public String selectReward(String grantId) {
        int bucket = unsignedBucket(grantId);
        if (bucket < 7000) {
            return "COMMON_COSMETIC";
        }
        if (bucket < 9500) {
            return "RARE_COSMETIC";
        }
        return "EPIC_COSMETIC";
    }

    private static int unsignedBucket(String grantId) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((ALGORITHM_VERSION + "|" + grantId).getBytes(StandardCharsets.UTF_8));
            return Math.floorMod(ByteBuffer.wrap(digest).getInt(), 10_000);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }
}
