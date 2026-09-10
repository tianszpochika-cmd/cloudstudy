package com.englishflow.learner.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Minimal integration event envelope.
 *
 * A durable adapter must persist it in the same transaction as the profile and idempotency
 * record; this class deliberately does not pretend Kafka is available.
 */
class LearnerOutboxEventTest {

    private static final LearnerTenantScope SCOPE = LearnerTenantScope.forPhaseOne("prn_learner00000001");
    private static final Instant NOW = Instant.parse("2026-09-10T00:00:00Z");
    private static final String TRACE = "0123456789abcdef0123456789abcdef"; // 32 lowercase hex
    private static final String EVENT_TYPE = "learner.profile.updated.v1";
    private static final String SCHEMA = "learner.profile.v1";

    private static LearnerOutboxEvent event(Map<String, Object> payload) {
        return new LearnerOutboxEvent(UUID.randomUUID(), SCOPE, "learner_profile", "profile-1",
                EVENT_TYPE, SCHEMA, "dedupe-1", payload, "request-0001", TRACE, NOW);
    }

    // --- required fields ---

    @Test
    void requiredFieldsAreEnforced() {
        assertThatThrownBy(() -> new LearnerOutboxEvent(null, SCOPE, "learner_profile", "profile-1",
                EVENT_TYPE, SCHEMA, "dedupe-1", Map.of(), "request-0001", TRACE, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new LearnerOutboxEvent(UUID.randomUUID(), null, "learner_profile", "profile-1",
                EVENT_TYPE, SCHEMA, "dedupe-1", Map.of(), "request-0001", TRACE, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new LearnerOutboxEvent(UUID.randomUUID(), SCOPE, "learner_profile", "profile-1",
                EVENT_TYPE, SCHEMA, "dedupe-1", Map.of(), "request-0001", TRACE, null))
                .isInstanceOf(NullPointerException.class);
    }

    // --- naming conventions ---

    @Test
    void eventTypeMustUseDomainActionVersionForm() {
        for (String bad : new String[]{"Learner.Profile.Updated.v1", "learner.profile", "learner..v1", "learner.profile.updated"}) {
            assertThatThrownBy(() -> new LearnerOutboxEvent(UUID.randomUUID(), SCOPE, "learner_profile", "profile-1",
                    bad, SCHEMA, "dedupe-1", Map.of(), "request-0001", TRACE, NOW))
                    .as("eventType: %s", bad)
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void schemaVersionMustUseDomainEventVersionForm() {
        for (String bad : new String[]{"Learner.profile.v1", "v1", "learner.profile"}) {
            assertThatThrownBy(() -> new LearnerOutboxEvent(UUID.randomUUID(), SCOPE, "learner_profile", "profile-1",
                    EVENT_TYPE, bad, "dedupe-1", Map.of(), "request-0001", TRACE, NOW))
                    .as("schemaVersion: %s", bad)
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void aggregateAndDedupeFieldsMustBeSafeTokens() {
        assertThatThrownBy(() -> new LearnerOutboxEvent(UUID.randomUUID(), SCOPE, "bad type", "profile-1",
                EVENT_TYPE, SCHEMA, "dedupe-1", Map.of(), "request-0001", TRACE, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new LearnerOutboxEvent(UUID.randomUUID(), SCOPE, "learner_profile", "profile-1",
                EVENT_TYPE, SCHEMA, " bad", Map.of(), "request-0001", TRACE, NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // --- correlation ids ---

    @Test
    void requestIdMustHaveMinimumLength() {
        assertThatThrownBy(() -> new LearnerOutboxEvent(UUID.randomUUID(), SCOPE, "learner_profile", "profile-1",
                EVENT_TYPE, SCHEMA, "dedupe-1", Map.of(), "short", TRACE, NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void traceIdMustBe32LowercaseHex() {
        for (String bad : new String[]{"0123456789ABCDEF0123456789ABCDEF", "abc", "x".repeat(32)}) {
            assertThatThrownBy(() -> new LearnerOutboxEvent(UUID.randomUUID(), SCOPE, "learner_profile", "profile-1",
                    EVENT_TYPE, SCHEMA, "dedupe-1", Map.of(), "request-0001", bad, NOW))
                    .as("traceId: %s", bad)
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // --- payload validation ---

    @Test
    void nullPayloadBecomesEmptyMap() {
        assertThat(event(null).payload()).isEmpty();
    }

    @Test
    void payloadKeysMustBeSafeTokens() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("bad key", "v");

        assertThatThrownBy(() -> event(payload)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void nullPayloadValuesAreRejected() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("optional", null);

        // Map.copyOf 在拷贝阶段即拒绝顶层 null 值（NPE）；嵌套 null 才走 validateValue 的 IAE 分支
        assertThatThrownBy(() -> event(payload)).isInstanceOf(NullPointerException.class);
    }

    @Test
    void payloadStringValuesMustBeBounded() {
        assertThatThrownBy(() -> event(Map.of("blob", "x".repeat(257))))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(event(Map.of("label", "x".repeat(256))).payload()).containsKey("label");
    }

    @Test
    void scalarValuesAreAccepted() {
        Map<String, Object> payload = Map.of("count", 3, "ratio", 0.5, "ok", true, "label", "review");

        assertThat(event(payload).payload())
                .containsEntry("count", 3)
                .containsEntry("ok", true)
                .containsEntry("label", "review");
    }

    @Test
    void collectionsAreBoundedAndValidatedRecursively() {
        List<Object> atLimit = new ArrayList<>();
        for (int index = 0; index < 32; index++) {
            atLimit.add(index);
        }
        assertThat(event(Map.of("items", atLimit)).payload()).containsKey("items");

        List<Object> overLimit = new ArrayList<>(atLimit);
        overLimit.add(99);
        assertThatThrownBy(() -> event(Map.of("items", overLimit)))
                .isInstanceOf(IllegalArgumentException.class);

        Map<String, Object> nestedWithNull = new LinkedHashMap<>();
        nestedWithNull.put("k", null);
        assertThatThrownBy(() -> event(Map.of("items", List.of(nestedWithNull))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void nestedMapKeysMustBeStrings() {
        Map<Object, Object> nested = new LinkedHashMap<>();
        nested.put(1, "value");

        assertThatThrownBy(() -> event(Map.of("nested", nested)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unsupportedValueTypeIsRejected() {
        assertThatThrownBy(() -> event(Map.of("when", Instant.now())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // --- accessors ---

    @Test
    void accessorsExposeNamingAndActor() {
        LearnerOutboxEvent event = event(Map.of());

        assertThat(event.eventName()).isEqualTo(EVENT_TYPE);
        assertThat(event.schema()).isEqualTo(SCHEMA);
        assertThat(event.version()).isEqualTo(1);
        assertThat(event.actorId()).isEqualTo("prn_learner00000001");
        assertThat(event.scope()).isEqualTo(SCOPE);
        assertThat(event.occurredAt()).isEqualTo(NOW);
    }
}
