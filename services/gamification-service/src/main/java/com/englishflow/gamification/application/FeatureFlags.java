package com.englishflow.gamification.application;

/** Feature gates are server configuration, never event/client input. */
public record FeatureFlags(boolean gamificationEnabled, boolean rewardsEnabled) {
}
