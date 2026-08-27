package com.englishflow.assessment.integration;

/** Assessment write boundary accepts answer digest only and returns safe server-owned summaries. */
public interface AssessmentChainPort {
    AssessmentResult submit(AssessmentSubmission submission);

    record AssessmentSubmission(
            String attemptId,
            long assessmentVersion,
            String idempotencyKey,
            String answerDigest,
            String subject,
            String tenantId) {
        public AssessmentSubmission {
            for (String[] value : new String[][] {
                    {attemptId, "attemptId"}, {idempotencyKey, "idempotencyKey"}, {answerDigest, "answerDigest"},
                    {subject, "subject"}, {tenantId, "tenantId"}
            }) {
                if (value[0] == null || value[0].isBlank()) throw new IllegalArgumentException(value[1] + " is required");
            }
            if (assessmentVersion < 1) throw new IllegalArgumentException("assessmentVersion must be positive");
        }
    }

    record AssessmentResult(
            String sourceEventId,
            String scoreBucket,
            String masterySignal,
            boolean replayed) {
        public AssessmentResult {
            if (sourceEventId == null || sourceEventId.isBlank()) throw new IllegalArgumentException("sourceEventId is required");
            if (scoreBucket == null || scoreBucket.isBlank()) throw new IllegalArgumentException("scoreBucket is required");
            if (masterySignal == null || masterySignal.isBlank()) throw new IllegalArgumentException("masterySignal is required");
        }
    }
}
