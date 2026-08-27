package com.englishflow.learning.integration;

/** Learning-owned today task projection bound to the content version it selected. */
public record LearningTaskReadProjection(
        String taskId,
        String subject,
        long contentVersion,
        String status) {
    public LearningTaskReadProjection {
        require(taskId, "taskId");
        require(subject, "subject");
        require(status, "status");
        if (contentVersion < 1) throw new IllegalArgumentException("contentVersion must be positive");
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
    }
}
