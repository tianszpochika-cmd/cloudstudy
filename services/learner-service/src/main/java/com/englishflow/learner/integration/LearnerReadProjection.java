package com.englishflow.learner.integration;

/** Read-only learner fact exported through an API/event adapter, never as a shared ORM entity. */
public record LearnerReadProjection(
        String subject,
        String tenantId,
        String profileId,
        String goal,
        long profileVersion) {
    public LearnerReadProjection {
        require(subject, "subject");
        require(tenantId, "tenantId");
        require(profileId, "profileId");
        require(goal, "goal");
        if (profileVersion < 1) throw new IllegalArgumentException("profileVersion must be positive");
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
    }
}
