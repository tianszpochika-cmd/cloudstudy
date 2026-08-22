package com.englishflow.content.domain;

import java.util.Map;

/** Minimal version schema guard; richer JSON Schema validation remains a contract-layer concern. */
public final class ContentSchemaValidator {

    private ContentSchemaValidator() {
    }

    public static ContentPayload validate(ContentKind kind, Map<String, Object> fields) {
        if (kind == null) {
            throw ContentOperationException.badRequest("CONTENT_KIND_REQUIRED", "content kind is required");
        }
        ContentPayload payload = new ContentPayload(fields);
        if (kind == ContentKind.QUESTION && !payload.containsAnswerRules()) {
            throw ContentOperationException.badRequest(
                    "QUESTION_ANSWER_RULE_REQUIRED", "question definitions require a private answer rule");
        }
        return payload;
    }
}
