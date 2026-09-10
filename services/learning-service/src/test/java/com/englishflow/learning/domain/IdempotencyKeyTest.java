package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Client write key validation and tenant-scoped namespacing. */
class IdempotencyKeyTest {

    private static final LearningTenantScope SCOPE =
            LearningTenantScope.forPhaseOne("prn_learningtest0001", 7001);

    @Test
    void validKeyIsAccepted() {
        assertThat(new IdempotencyKey("review-20260822-0001").value())
                .isEqualTo("review-20260822-0001");
    }

    @Test
    void keyMustBe16To128SafeCharacters() {
        assertThatThrownBy(() -> new IdempotencyKey("short-key"))
                .isInstanceOf(IllegalArgumentException.class); // 9 chars < 16
        assertThatThrownBy(() -> new IdempotencyKey(null))
                .isInstanceOf(NullPointerException.class);
        String tooLong = "a".repeat(129);
        assertThatThrownBy(() -> new IdempotencyKey(tooLong))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new IdempotencyKey("has spaces not allowed!!"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void namespacedCombinesTenantPrincipalOperationAndKey() {
        IdempotencyKey key = new IdempotencyKey("review-20260822-0001");
        String namespaced = key.namespaced(SCOPE, "review.submit");
        assertThat(namespaced)
                .isEqualTo("platform:prn_learningtest0001:review.submit:review-20260822-0001");
    }

    @Test
    void namespacedRejectsNullScopeAndUnsafeOperation() {
        IdempotencyKey key = new IdempotencyKey("review-20260822-0001");
        assertThatThrownBy(() -> key.namespaced(null, "review.submit"))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> key.namespaced(SCOPE, "REVIEW/SUBMIT"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
