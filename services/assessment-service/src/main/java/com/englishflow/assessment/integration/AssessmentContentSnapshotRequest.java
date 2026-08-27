package com.englishflow.assessment.integration;

/** Assessment asks content for a frozen versioned snapshot; it never owns the question bank. */
public record AssessmentContentSnapshotRequest(
        String contentId,
        long contentVersion,
        String tenantId,
        String subject) {
    public AssessmentContentSnapshotRequest {
        for (String[] value : new String[][] {{contentId, "contentId"}, {tenantId, "tenantId"}, {subject, "subject"}}) {
            if (value[0] == null || value[0].isBlank()) throw new IllegalArgumentException(value[1] + " is required");
        }
        if (contentVersion < 1) throw new IllegalArgumentException("contentVersion must be positive");
    }
}
