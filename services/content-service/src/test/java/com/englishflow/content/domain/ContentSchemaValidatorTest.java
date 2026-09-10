package com.englishflow.content.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Structure/answer-rule validation rules from {@link ContentSchemaValidator}. */
@DisplayName("ContentSchemaValidator structure and answer-rule rules")
class ContentSchemaValidatorTest {

    @Test
    @DisplayName("non-question kinds accept a plain payload")
    void nonQuestionAcceptsPlainPayload() {
        ContentPayload payload = ContentSchemaValidator.validate(ContentKind.VOCABULARY, Map.of("term", "cat"));
        assertEquals("cat", payload.raw().get("term"));
    }

    @Test
    @DisplayName("a question without an answer rule is rejected")
    void questionRequiresAnswerRule() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentSchemaValidator.validate(ContentKind.QUESTION, Map.of("prompt", "choose")));
        assertEquals("QUESTION_ANSWER_RULE_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("a question with an answer rule is accepted")
    void questionWithAnswerRuleAccepted() {
        ContentPayload payload = ContentSchemaValidator.validate(ContentKind.QUESTION,
                Map.of("prompt", "choose", "answerRule", Map.of("correctOption", "A")));
        assertEquals(Map.of("correctOption", "A"), payload.raw().get("answerRule"));
    }

    @Test
    @DisplayName("a null content kind is rejected")
    void nullKindRejected() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> ContentSchemaValidator.validate(null, Map.of("term", "cat")));
        assertEquals("CONTENT_KIND_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("payload keys are validated for the immutable copy")
    void blankPayloadKeyRejected() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> new ContentPayload(Map.of(" ", "value")));
        assertEquals("CONTENT_PAYLOAD_KEY_INVALID", ex.code());
    }

    @Test
    @DisplayName("empty payload is rejected")
    void emptyPayloadRejected() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> new ContentPayload(Map.of()));
        assertEquals("CONTENT_PAYLOAD_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("content payload detects restricted answer-rule keys recursively")
    void payloadContainsAnswerRulesRecursive() {
        Map<String, Object> withRule = Map.of("options", java.util.List.of(Map.of("answerRule", Map.of("a", "b"))));
        assertTrue(ContentPayload.containsAnswerRules(withRule));
        assertFalse(ContentPayload.containsAnswerRules(Map.of("title", "x")));
    }
}
