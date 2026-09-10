package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Server-derived tenant/owner/user identity and cross-service guard. */
class LearningTenantScopeTest {

    @Test
    void phaseOneScopeUsesPlatformTenant() {
        LearningTenantScope scope = LearningTenantScope.forPhaseOne("prn_learningtest0001", 7001);
        assertThat(scope.tenantId()).isEqualTo(LearningTenantScope.PLATFORM_TENANT);
        assertThat(scope.principalId()).isEqualTo("prn_learningtest0001");
        assertThat(scope.userId()).isEqualTo(7001);
        assertThat(scope.ownerId()).isEqualTo("prn_learningtest0001");
        assertThat(scope.storageKey()).isEqualTo("platform:prn_learningtest0001");
    }

    @Test
    void constructorRejectsUnsafeIds() {
        assertThatThrownBy(() -> new LearningTenantScope("", "prn_learningtest0001", 7001))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new LearningTenantScope("platform", "short", 7001))
                .isInstanceOf(IllegalArgumentException.class); // principalId not prn_ format/length
        assertThatThrownBy(() -> new LearningTenantScope("platform", "prn_learningtest0001", 0))
                .isInstanceOf(IllegalArgumentException.class); // userId<1
    }

    @Test
    void assertResourceRejectsTenantAndOwnerMismatch() {
        LearningTenantScope scope = LearningTenantScope.forPhaseOne("prn_learningtest0001", 7001);
        scope.assertResource("platform", "prn_learningtest0001"); // ok

        assertThatThrownBy(() -> scope.assertResource("other-tenant", "prn_learningtest0001"))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.TENANT_MISMATCH));
        assertThatThrownBy(() -> scope.assertResource("platform", "prn_other0000000002"))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.OWNER_MISMATCH));
        assertThatThrownBy(() -> scope.assertResource(null, "prn_learningtest0001"))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.MISSING_TENANT));
    }

    @Test
    void rejectClientAuthorityWhenClaimsArePresent() {
        LearningTenantScope scope = LearningTenantScope.forPhaseOne("prn_learningtest0001", 7001);
        ClientAuthorityClaims claims = new ClientAuthorityClaims("other-tenant", null, null);
        assertThatThrownBy(() -> scope.rejectClientAuthority(claims))
                .isInstanceOf(LearningDomainException.class)
                .satisfies(e -> assertThat(((LearningDomainException) e).code())
                        .isEqualTo(LearningDecisionCode.CLIENT_AUTHORITY_REJECTED));

        scope.rejectClientAuthority(ClientAuthorityClaims.none()); // no-op
    }
}
