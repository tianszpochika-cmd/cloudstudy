package com.englishflow.assessment.domain;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Version-pinned question snapshot returned by the content-service adapter.
 *
 * <p>The snapshot is frozen into an assessment session.  Assessment owns neither the question
 * master record nor the answer-rule version; it only keeps the immutable scoring input needed to
 * make a reproducible decision.</p>
 */
public record ContentSnapshot(
        String contentCode,
        long contentVersionId,
        long questionId,
        long itemId,
        QuestionType questionType,
        Map<String, Object> learnerFields,
        Map<String, Object> answerRules,
        String scoringVersion,
        int maxScore,
        boolean published) {

    public ContentSnapshot {
        contentCode = token(contentCode, "contentCode");
        if (contentVersionId < 1 || questionId < 1 || itemId < 1) {
            throw AssessmentDomainException.invalid("ASM_CONTENT_SNAPSHOT_INVALID", "content identifiers must be positive");
        }
        questionType = Objects.requireNonNull(questionType, "questionType is required");
        learnerFields = SafePayloads.freeze(learnerFields);
        answerRules = SafePayloads.freeze(answerRules);
        if (answerRules.isEmpty()) {
            throw AssessmentDomainException.invalid("ASM_ANSWER_RULES_MISSING", "content snapshot has no answer rules");
        }
        scoringVersion = token(scoringVersion, "scoringVersion");
        if (maxScore < 1) throw AssessmentDomainException.invalid("ASM_SCORE_POLICY_INVALID", "maxScore must be positive");
        if (!published) throw AssessmentDomainException.notFound("content version is not published");
        if (SafePayloads.containsSensitive(learnerFields)) {
            throw AssessmentDomainException.invalid("ASM_CONTENT_LEARNER_VIEW_UNSAFE", "learner fields contain protected scoring data");
        }
    }

    public Map<String, Object> learnerView() {
        return SafePayloads.sanitizeLearnerView(learnerFields);
    }

    private static String token(String value, String field) {
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._:-]{1,127}")) {
            throw AssessmentDomainException.invalid("ASM_CONTENT_SNAPSHOT_INVALID", field + " is invalid");
        }
        return value;
    }
}
