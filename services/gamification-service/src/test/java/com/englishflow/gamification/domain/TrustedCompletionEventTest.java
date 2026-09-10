package com.englishflow.gamification.domain;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Strict trusted-event envelope at the learning/assessment boundary.
 *
 * Security-critical: no client-controlled reward or security field may enter through this type.
 */
class TrustedCompletionEventTest {

    private static final String SOURCE = "learning-service";
    private static final String EVENT_TYPE = "learning.task.completed.v1";

    private static GamificationDomainException.Code codeOf(Throwable thrown) {
        assertThat(thrown).isInstanceOf(GamificationDomainException.class);
        return ((GamificationDomainException) thrown).code();
    }

    private static TrustedCompletionEvent event() {
        return new TrustedCompletionEvent(SOURCE, "evt-1", "trace-1", "v1",
                java.time.Instant.parse("2026-09-10T00:00:00Z"), "learner-1", "agg-1",
                TrustedCompletionEvent.RULE_VERSION, EVENT_TYPE);
    }

    private static Map<String, Object> validPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sourceService", SOURCE);
        payload.put("eventId", "evt-1");
        payload.put("traceId", "trace-1");
        payload.put("schemaVersion", "v1");
        payload.put("occurredAt", "2026-09-10T00:00:00Z");
        payload.put("subject", "learner-1");
        payload.put("aggregateId", "agg-1");
        payload.put("ruleVersion", TrustedCompletionEvent.RULE_VERSION);
        payload.put("eventType", EVENT_TYPE);
        return payload;
    }

    // --- constructor guards ---

    @Test
    void everyTextFieldIsRequired() {
        assertThatThrownBy(() -> new TrustedCompletionEvent(null, "evt-1", "trace-1", "v1",
                java.time.Instant.now(), "learner-1", "agg-1", TrustedCompletionEvent.RULE_VERSION, EVENT_TYPE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
        assertThatThrownBy(() -> new TrustedCompletionEvent(SOURCE, "  ", "trace-1", "v1",
                java.time.Instant.now(), "learner-1", "agg-1", TrustedCompletionEvent.RULE_VERSION, EVENT_TYPE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    @Test
    void occurredAtIsRequired() {
        assertThatThrownBy(() -> new TrustedCompletionEvent(SOURCE, "evt-1", "trace-1", "v1",
                null, "learner-1", "agg-1", TrustedCompletionEvent.RULE_VERSION, EVENT_TYPE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    @Test
    void unsupportedSchemaVersionIsRejected() {
        assertThatThrownBy(() -> new TrustedCompletionEvent(SOURCE, "evt-1", "trace-1", "v9",
                java.time.Instant.now(), "learner-1", "agg-1", TrustedCompletionEvent.RULE_VERSION, EVENT_TYPE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    @Test
    void alternativeButEquivalentSchemaVersionsAreAccepted() {
        for (String version : new String[]{"v1", "1", "1.0", "1.0.0"}) {
            assertThat(new TrustedCompletionEvent(SOURCE, "evt-1", "trace-1", version,
                    java.time.Instant.now(), "learner-1", "agg-1",
                    TrustedCompletionEvent.RULE_VERSION, EVENT_TYPE)).isNotNull();
        }
    }

    @Test
    void ruleVersionMustMatchTheFrozenRule() {
        assertThatThrownBy(() -> new TrustedCompletionEvent(SOURCE, "evt-1", "trace-1", "v1",
                java.time.Instant.now(), "learner-1", "agg-1", "GAM_RULE_OTHER", EVENT_TYPE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    @Test
    void sourceServiceMustBeAllowlisted() {
        assertThatThrownBy(() -> new TrustedCompletionEvent("evil-service", "evt-1", "trace-1", "v1",
                java.time.Instant.now(), "learner-1", "agg-1", TrustedCompletionEvent.RULE_VERSION, EVENT_TYPE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    @Test
    void eventTypeMustBelongToTheDeclaredSource() {
        // assessment eventType 配 learning source -> 拒绝
        assertThatThrownBy(() -> new TrustedCompletionEvent(SOURCE, "evt-1", "trace-1", "v1",
                java.time.Instant.now(), "learner-1", "agg-1", TrustedCompletionEvent.RULE_VERSION,
                "assessment.attempt.completed.v1"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    @Test
    void assessmentSourceAcceptsItsOwnEventTypes() {
        assertThat(new TrustedCompletionEvent("assessment-service", "evt-1", "trace-1", "v1",
                java.time.Instant.now(), "learner-1", "agg-1", TrustedCompletionEvent.RULE_VERSION,
                "assessment.attempt.completed.v1")).isNotNull();
    }

    // --- from(payload): forbidden client fields ---

    @Test
    void emptyPayloadIsRejected() {
        assertThatThrownBy(() -> TrustedCompletionEvent.from(null))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
        assertThatThrownBy(() -> TrustedCompletionEvent.from(Map.of()))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    @Test
    void clientSuppliedRewardFieldsAreRejected() {
        for (String field : new String[]{"xp", "xpDelta", "coin", "coins", "coinDelta", "delta", "amount"}) {
            Map<String, Object> payload = validPayload();
            payload.put(field, 999);
            assertThatThrownBy(() -> TrustedCompletionEvent.from(payload))
                    .as("forbidden reward field: %s", field)
                    .satisfies(t -> assertThat(codeOf(t))
                            .isEqualTo(GamificationDomainException.Code.UNTRUSTED_FIELD));
        }
    }

    @Test
    void clientSuppliedSecurityFieldsAreRejected() {
        for (String field : new String[]{"role", "roles", "tenant", "tenantId", "owner", "ownerId", "userId"}) {
            Map<String, Object> payload = validPayload();
            payload.put(field, "admin");
            assertThatThrownBy(() -> TrustedCompletionEvent.from(payload))
                    .as("forbidden security field: %s", field)
                    .satisfies(t -> assertThat(codeOf(t))
                            .isEqualTo(GamificationDomainException.Code.UNTRUSTED_FIELD));
        }
    }

    @Test
    void forbiddenFieldDetectionIgnoresCaseAndSeparators() {
        for (String field : new String[]{"XP_DELTA", "xp-delta", "TenantID", "user_id", "Owner-ID"}) {
            Map<String, Object> payload = validPayload();
            payload.put(field, "x");
            assertThatThrownBy(() -> TrustedCompletionEvent.from(payload))
                    .as("normalized forbidden field: %s", field)
                    .satisfies(t -> assertThat(codeOf(t))
                            .isEqualTo(GamificationDomainException.Code.UNTRUSTED_FIELD));
        }
    }

    @Test
    void nestedForbiddenFieldIsAlsoRejected() {
        Map<String, Object> payload = validPayload();
        payload.put("subject", Map.of("id", "learner-1"));
        payload.put("metadata", Map.of("inner", Map.of("xp", 5)));

        // rejectForbiddenFields 先于字段白名单检查执行，故报 UNTRUSTED_FIELD
        assertThatThrownBy(() -> TrustedCompletionEvent.from(payload))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.UNTRUSTED_FIELD));
    }

    // --- from(payload): allowlist ---

    @Test
    void unknownFieldIsRejected() {
        Map<String, Object> payload = validPayload();
        payload.put("extra", "value");

        assertThatThrownBy(() -> TrustedCompletionEvent.from(payload))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    // --- from(payload): identity ---

    @Test
    void subjectOrUserIsRequired() {
        Map<String, Object> payload = validPayload();
        payload.remove("subject");

        assertThatThrownBy(() -> TrustedCompletionEvent.from(payload))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    @Test
    void subjectAndUserMustAgreeWhenBothPresent() {
        Map<String, Object> payload = validPayload();
        payload.put("user", "learner-OTHER");

        assertThatThrownBy(() -> TrustedCompletionEvent.from(payload))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    @Test
    void userIsAcceptedAsAlternativeIdentity() {
        Map<String, Object> payload = validPayload();
        payload.remove("subject");
        payload.put("user", "learner-1");

        assertThat(TrustedCompletionEvent.from(payload).subjectId()).isEqualTo("learner-1");
    }

    @Test
    void identityMapShapeMustBeExactlyId() {
        Map<String, Object> payload = validPayload();
        payload.put("subject", Map.of("id", "learner-1"));
        assertThat(TrustedCompletionEvent.from(payload).subjectId()).isEqualTo("learner-1");

        Map<String, Object> badShape = validPayload();
        badShape.put("subject", Map.of("id", "learner-1", "extra", "x"));
        assertThatThrownBy(() -> TrustedCompletionEvent.from(badShape))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    @Test
    void occurredAtMustBeIsoInstantString() {
        Map<String, Object> payload = validPayload();
        payload.put("occurredAt", "not-a-timestamp");

        assertThatThrownBy(() -> TrustedCompletionEvent.from(payload))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(GamificationDomainException.Code.INVALID_EVENT));
    }

    // --- from(payload): happy path ---

    @Test
    void validPayloadIsParsed() {
        TrustedCompletionEvent parsed = TrustedCompletionEvent.from(validPayload());

        assertThat(parsed.sourceService()).isEqualTo(SOURCE);
        assertThat(parsed.eventId()).isEqualTo("evt-1");
        assertThat(parsed.subjectId()).isEqualTo("learner-1");
        assertThat(parsed.subject()).isEqualTo("learner-1"); // compatibility alias
        assertThat(parsed.aggregateId()).isEqualTo("agg-1");
        assertThat(parsed.ruleVersion()).isEqualTo(TrustedCompletionEvent.RULE_VERSION);
        assertThat(parsed.eventType()).isEqualTo(EVENT_TYPE);
        assertThat(parsed.occurredAt()).isEqualTo(java.time.Instant.parse("2026-09-10T00:00:00Z"));
    }

    // --- fingerprint ---

    @Test
    void fingerprintIsStableForSameEvent() {
        assertThat(event().fingerprint()).isEqualTo(event().fingerprint());
        assertThat(event().fingerprint()).hasSize(64); // sha-256 hex
    }

    @Test
    void fingerprintChangesWhenAnyFieldChanges() {
        String base = event().fingerprint();
        TrustedCompletionEvent other = new TrustedCompletionEvent(SOURCE, "evt-2", "trace-1", "v1",
                java.time.Instant.parse("2026-09-10T00:00:00Z"), "learner-1", "agg-1",
                TrustedCompletionEvent.RULE_VERSION, EVENT_TYPE);

        assertThat(other.fingerprint()).isNotEqualTo(base);
    }

    // --- source allowlist helpers ---

    @Test
    void allowlistedSourceHelpers() {
        assertThat(TrustedCompletionEvent.isAllowlistedSource("learning-service")).isTrue();
        assertThat(TrustedCompletionEvent.isAllowlistedSource("assessment-service")).isTrue();
        assertThat(TrustedCompletionEvent.isAllowlistedSource("evil-service")).isFalse();
        // 实现对不可变 Set 做 contains，null 会抛 NPE 而非返回 false
        assertThatThrownBy(() -> TrustedCompletionEvent.isAllowlistedSource(null))
                .isInstanceOf(NullPointerException.class);
        assertThat(TrustedCompletionEvent.allowlistedSources())
                .containsExactlyInAnyOrder("learning-service", "assessment-service");
    }
}
