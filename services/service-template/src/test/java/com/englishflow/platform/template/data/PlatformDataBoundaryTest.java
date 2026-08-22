package com.englishflow.platform.template.data;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class PlatformDataBoundaryTest {

    @Test
    void tenantScopeIsServerDerivedAndFailsClosed() {
        TenantScope scope = TenantScope.platform("usr_b7_subject_001");

        assertThat(scope.owns("platform", "usr_b7_subject_001")).isTrue();
        assertThat(scope.owns("other", "usr_b7_subject_001")).isFalse();
        assertThatThrownBy(() -> scope.rejectClientTenant("other")).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> scope.assertTenant("other")).isInstanceOf(SecurityException.class);
    }

    @Test
    void idempotencyAndRedisKeysAreNamespaced() {
        TenantScope scope = TenantScope.platform("usr_b7_subject_001");
        IdempotencyKey key = new IdempotencyKey("idem_b7_request_0001");
        assertThat(key.namespaced(scope, "profile.update"))
                .isEqualTo("platform:usr_b7_subject_001:profile.update:idem_b7_request_0001");
        assertThat(new RedisNamespace("learner").key("srs", "usr_b7_subject_001"))
                .isEqualTo("learner:srs:usr_b7_subject_001");
        assertThatThrownBy(() -> new RedisNamespace("learner").key("access-token"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void outboxEnvelopeRequiresVersionedEventAndObjectPayload() {
        OutboxEvent event = OutboxEvent.create(
                "learner-service", "profile", "profile_b7_001", "learner.profile.updated.v1", "1.0.0",
                "learner:profile_b7_001:updated:1", "{\"status\":\"updated\"}", "req_b7_001", "trace_b7_001");

        assertThat(event.eventId()).isNotNull();
        assertThat(event.eventType()).isEqualTo("learner.profile.updated.v1");
        assertThatThrownBy(() -> OutboxEvent.create(
                "learner-service", "profile", "profile_b7_001", "profile.updated", "1.0.0",
                "learner:profile_b7_001:updated:2", "[]", null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

