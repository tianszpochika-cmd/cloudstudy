package com.englishflow.assessment.domain;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/** Protected answer fact. No public view method returns the raw answer. */
public final class AssessmentAttempt {
    private final long submissionId;
    private final long exerciseId;
    private final String clientSubmissionId;
    private final int revision;
    private final Map<String, Object> answer;
    private final String answerHash;
    private final Instant submittedAt;
    private ScoringResult scoringResult;

    public AssessmentAttempt(long submissionId, long exerciseId, String clientSubmissionId, int revision,
                             Map<String, Object> answer, Instant submittedAt) {
        if (submissionId < 1 || exerciseId < 1 || revision < 1) throw AssessmentDomainException.invalid("ASM_ATTEMPT_INVALID", "attempt identifiers are invalid");
        this.submissionId = submissionId;
        this.exerciseId = exerciseId;
        this.clientSubmissionId = required(clientSubmissionId, "clientSubmissionId");
        this.revision = revision;
        this.answer = SafePayloads.freeze(answer == null ? Map.of() : answer);
        this.answerHash = SafePayloads.digest(this.answer);
        this.submittedAt = Objects.requireNonNull(submittedAt, "submittedAt is required");
    }

    /** Rehydrates a server-owned attempt from the assessment store. */
    public static AssessmentAttempt restore(long submissionId, long exerciseId, String clientSubmissionId,
                                             int revision, Map<String, Object> answer, Instant submittedAt,
                                             ScoringResult scoringResult) {
        AssessmentAttempt attempt = new AssessmentAttempt(submissionId, exerciseId, clientSubmissionId,
                revision, answer, submittedAt);
        if (scoringResult != null) attempt.setScoringResult(scoringResult);
        return attempt;
    }

    public long submissionId() { return submissionId; }
    public long exerciseId() { return exerciseId; }
    public String clientSubmissionId() { return clientSubmissionId; }
    public int revision() { return revision; }
    public String answerHash() { return answerHash; }
    public Instant submittedAt() { return submittedAt; }
    public Map<String, Object> answerForScoring() { return SafePayloads.copyMap(answer); }
    public ScoringResult scoringResult() { return scoringResult; }
    public void setScoringResult(ScoringResult scoringResult) { this.scoringResult = Objects.requireNonNull(scoringResult); }

    private static String required(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 128) throw AssessmentDomainException.invalid("ASM_ATTEMPT_INVALID", field + " is invalid");
        return value;
    }
}
