package com.englishflow.learning.integration;

/** Assessment summary accepted by learning for a single idempotent mastery projection. */
public record AssessmentMasteryProjection(
        String subject,
        String tenantId,
        String attemptId,
        long assessmentVersion,
        String sourceAssessmentEventId,
        String scoreBucket,
        String masterySignal,
        String idempotencyKey) {
    public AssessmentMasteryProjection {
        for (String[] value : new String[][] {
                {subject, "subject"}, {tenantId, "tenantId"}, {attemptId, "attemptId"},
                {sourceAssessmentEventId, "sourceAssessmentEventId"}, {scoreBucket, "scoreBucket"},
                {masterySignal, "masterySignal"}, {idempotencyKey, "idempotencyKey"}
        }) require(value[0], value[1]);
        if (assessmentVersion < 1) throw new IllegalArgumentException("assessmentVersion must be positive");
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
    }
}
