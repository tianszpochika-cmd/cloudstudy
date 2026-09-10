package com.englishflow.analytics.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Shared privacy gate: an event that is not explicitly shaped by the allowlist never
 * reaches the journal or a projection.
 *
 * Security-critical: raw PII, credentials and content payloads must be rejected.
 */
class AnalyticsPrivacyBoundaryTest {

    private static AnalyticsErrorCode codeOf(Throwable thrown) {
        assertThat(thrown).isInstanceOf(AnalyticsDomainException.class);
        return ((AnalyticsDomainException) thrown).code();
    }

    // --- requireOpaqueReference ---

    @Test
    void opaqueReferenceRejectsNullAndBlank() {
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.requireOpaqueReference(null, "principalRef"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.TENANT_SCOPE_INVALID));
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.requireOpaqueReference("   ", "principalRef"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.TENANT_SCOPE_INVALID));
    }

    @Test
    void opaqueReferenceRejectsOverlongValue() {
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.requireOpaqueReference("a".repeat(257), "tenantRef"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.TENANT_SCOPE_INVALID));
    }

    @Test
    void opaqueReferenceRejectsRawEmail() {
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.requireOpaqueReference("user@example.com", "principalRef"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
    }

    @Test
    void opaqueReferenceRejectsRawPhone() {
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.requireOpaqueReference("+8613800138000", "principalRef"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
    }

    @Test
    void opaqueReferenceRejectsIllegalCharacters() {
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.requireOpaqueReference("has space", "tenantRef"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.TENANT_SCOPE_INVALID));
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.requireOpaqueReference("_leading", "tenantRef"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.TENANT_SCOPE_INVALID));
    }

    @Test
    void opaqueReferenceAcceptsBoundedOpaqueId() {
        assertThat(AnalyticsPrivacyBoundary.requireOpaqueReference("tenant-1:learner-42", "tenantRef"))
                .isEqualTo("tenant-1:learner-42");
    }

    // --- sanitizePayload: shape ---

    @Test
    void payloadMustBeAnObject() {
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(null))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID));
    }

    @Test
    void blankFieldNameIsRejected() {
        Map<String, Object> source = new HashMap<>();
        source.put("", "x");
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(source))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.PAYLOAD_FIELD_NOT_ALLOWED));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void nonStringFieldNameIsRejected() {
        Map raw = new LinkedHashMap();
        raw.put(1, "x");
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload((Map) raw))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.PAYLOAD_FIELD_NOT_ALLOWED));
    }

    // --- sanitizePayload: forbidden fields ---

    @Test
    void forbiddenFieldNamesAreRejected() {
        for (String field : List.of("email", "phone", "mobile", "fullName", "ipAddress",
                "token", "password", "secret", "authorization", "recording",
                "answer", "answerKey", "questionText", "freeText", "rawPayload")) {
            assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(Map.of(field, "x")))
                    .as("forbidden field: %s", field)
                    .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
        }
    }

    @Test
    void forbiddenFieldDetectionIsCaseAndSeparatorInsensitive() {
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(Map.of("user_Email_Address", "x")))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(Map.of("API-KEY", "x")))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
    }

    @Test
    void nestedForbiddenFieldIsAlsoRejected() {
        Map<String, Object> nested = Map.of("outer", Map.of("inner", Map.of("password", "p")));
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(nested))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
    }

    @Test
    void forbiddenFieldInsideListIsAlsoRejected() {
        Map<String, Object> source = Map.of("items", List.of(Map.of("email", "a@b.co")));
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(source))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
    }

    // --- sanitizePayload: forbidden values ---

    @Test
    void stringValuesThatLookLikePiiAreRejected() {
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(Map.of("note", "user@example.com")))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(Map.of("note", "+8613800138000")))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
    }

    @Test
    void bearerTokenAndAudioBlobValuesAreRejected() {
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(Map.of("auth", "Bearer abc.def")))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(
                Map.of("clip", "data:audio/webm;base64,AAAA")))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
    }

    @Test
    void overlongStringValueIsRejected() {
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(Map.of("blob", "x".repeat(513))))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.RAW_PII_REJECTED));
    }

    // --- sanitizePayload: shape limits ---

    @Test
    void oversizedListIsRejected() {
        List<Integer> tooMany = new ArrayList<>();
        for (int index = 0; index <= 100; index++) {
            tooMany.add(index);
        }
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(Map.of("items", tooMany)))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID));
    }

    @Test
    void listAtTheLimitIsAccepted() {
        List<Integer> atLimit = new ArrayList<>();
        for (int index = 0; index < 100; index++) {
            atLimit.add(index);
        }
        assertThat(AnalyticsPrivacyBoundary.sanitizePayload(Map.of("items", atLimit)))
                .containsKey("items");
    }

    @Test
    void unsupportedValueTypeIsRejected() {
        assertThatThrownBy(() -> AnalyticsPrivacyBoundary.sanitizePayload(Map.of("when", Instant.now())))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(AnalyticsErrorCode.PAYLOAD_VALUE_INVALID));
    }

    // --- sanitizePayload: accepted shapes ---

    @Test
    void scalarTypesAreAccepted() {
        Map<String, Object> sanitized = AnalyticsPrivacyBoundary.sanitizePayload(
                Map.of("count", 3, "ratio", 0.5, "ok", true, "label", "review"));

        assertThat(sanitized)
                .containsEntry("count", 3)
                .containsEntry("ratio", 0.5)
                .containsEntry("ok", true)
                .containsEntry("label", "review");
    }

    @Test
    void nullValueIsPreserved() {
        Map<String, Object> source = new HashMap<>();
        source.put("optional", null);

        assertThat(AnalyticsPrivacyBoundary.sanitizePayload(source)).containsEntry("optional", null);
    }

    @Test
    @SuppressWarnings("unchecked")
    void acceptedPayloadIsImmutableAtTopLevelAndNested() {
        Map<String, Object> sanitized = AnalyticsPrivacyBoundary.sanitizePayload(
                Map.of("nested", Map.of("k", "v"), "items", List.of("a")));

        assertThatThrownBy(() -> sanitized.put("new", 1))
                .isInstanceOf(UnsupportedOperationException.class);
        Map<String, Object> nested = (Map<String, Object>) sanitized.get("nested");
        assertThatThrownBy(() -> nested.put("k2", "v2"))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
