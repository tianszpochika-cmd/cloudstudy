package com.englishflow.content.domain;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** Internal assessment snapshot; answer rules never cross a learner/public boundary. */
public record AssessmentContentSnapshot(
        ContentId contentId,
        ContentVersionId versionId,
        ContentKind kind,
        Map<String, Object> learnerFields,
        Map<String, Object> answerRules,
        String contentHash) {

    public AssessmentContentSnapshot {
        learnerFields = immutableMap(learnerFields);
        answerRules = immutableMap(answerRules);
        if (answerRules.isEmpty()) {
            throw ContentOperationException.badRequest(
                    "QUESTION_ANSWER_RULE_REQUIRED", "assessment snapshot requires answer rules");
        }
    }

    private static Map<String, Object> immutableMap(Map<String, Object> source) {
        return Collections.unmodifiableMap(new LinkedHashMap<>(source == null ? Map.of() : source));
    }
}
