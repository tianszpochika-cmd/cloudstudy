package com.englishflow.assessment.domain;

import java.util.List;
import java.util.Map;

/** Immutable, learner-safe result of server-side scoring. */
public record ScoringResult(
        double earnedScore,
        double maxScore,
        Boolean correct,
        ScoringStatus status,
        String normalizedAnswerHash,
        List<String> errorCauseCandidates,
        String ruleVersion,
        Map<String, Object> scoreBreakdown) {
    public ScoringResult {
        if (earnedScore < 0 || maxScore <= 0 || earnedScore > maxScore) {
            throw AssessmentDomainException.invalid("ASM_SCORE_INVALID", "score is outside the score policy");
        }
        status = java.util.Objects.requireNonNull(status, "status is required");
        normalizedAnswerHash = normalizedAnswerHash == null ? "" : normalizedAnswerHash;
        errorCauseCandidates = List.copyOf(errorCauseCandidates == null ? List.of() : errorCauseCandidates);
        ruleVersion = ruleVersion == null ? "ASM-RULE-1" : ruleVersion;
        scoreBreakdown = SafePayloads.freeze(scoreBreakdown == null ? Map.of() : scoreBreakdown);
    }

    public static ScoringResult notAttempted(double maxScore, String ruleVersion) {
        return new ScoringResult(0, maxScore, null, ScoringStatus.NOT_ATTEMPTED, "", List.of(), ruleVersion, Map.of());
    }
}
