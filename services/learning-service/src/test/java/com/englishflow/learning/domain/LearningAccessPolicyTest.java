package com.englishflow.learning.domain;

import com.englishflow.learning.LearningTestPrincipals;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Pure server-side RBAC+ABAC guard; default deny with no Spring/IAM runtime. */
class LearningAccessPolicyTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String PRINCIPAL = "prn_learningtest0001";

    private static LearningPrincipalContext allowed() {
        return LearningTestPrincipals.phaseOne(PRINCIPAL, 7001);
    }

    private static LearningAccessPolicy policy() {
        return new LearningAccessPolicy(CLOCK);
    }

    private static AuthorizationDecision decide(LearningPrincipalContext ctx, String permission) {
        return policy().authorize(ctx, permission, "srs_state", "70001",
                ctx.scope().tenantId(), ctx.scope().principalId());
    }

    @Test
    void allowedContextGrantsPermission() {
        AuthorizationDecision decision = decide(allowed(), "learning.review.write");
        assertThat(decision.allowed()).isTrue();
        assertThat(decision.code()).isEqualTo(LearningDecisionCode.ALLOWED);
    }

    @Test
    void missingPrincipalIsDenied() {
        AuthorizationDecision decision = policy().authorize(null, "learning.review.write",
                "srs_state", "70001", "platform", PRINCIPAL);
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.code()).isEqualTo(LearningDecisionCode.MISSING_PRINCIPAL);
    }

    @Test
    void clientAuthorityAttemptIsDenied() {
        LearningPrincipalContext ctx = new LearningPrincipalContext(
                LearningTenantScope.forPhaseOne(PRINCIPAL, 7001), "phase-1", Set.of("learner"),
                Set.of("learning.review.write"), ConsentState.GRANTED, false,
                new ClientAuthorityClaims("other-tenant", null, null));
        assertThat(decide(ctx, "learning.review.write").code())
                .isEqualTo(LearningDecisionCode.CLIENT_AUTHORITY_REJECTED);
    }

    @Test
    void tenantAndOwnerMismatchAreDenied() {
        assertThat(policy().authorize(allowed(), "learning.review.write", "srs_state", "70001",
                "other-tenant", PRINCIPAL).code())
                .isEqualTo(LearningDecisionCode.TENANT_MISMATCH);
        assertThat(policy().authorize(allowed(), "learning.review.write", "srs_state", "70001",
                "platform", "prn_other0000000002").code())
                .isEqualTo(LearningDecisionCode.OWNER_MISMATCH);
        assertThat(policy().authorize(allowed(), "learning.review.write", "srs_state", "70001",
                null, PRINCIPAL).code())
                .isEqualTo(LearningDecisionCode.MISSING_TENANT);
    }

    @Test
    void wrongPhaseRevokedConsentMissingRoleOrPermissionAreDenied() {
        LearningPrincipalContext notPhaseOne = new LearningPrincipalContext(
                LearningTenantScope.forPhaseOne(PRINCIPAL, 7001), "phase-2", Set.of("learner"),
                Set.of("learning.review.write"), ConsentState.GRANTED, false,
                ClientAuthorityClaims.none());
        assertThat(decide(notPhaseOne, "learning.review.write").code())
                .isEqualTo(LearningDecisionCode.PHASE_DENIED);

        LearningPrincipalContext revoked = new LearningPrincipalContext(
                LearningTenantScope.forPhaseOne(PRINCIPAL, 7001), "phase-1", Set.of("learner"),
                Set.of("learning.review.write"), ConsentState.GRANTED, true,
                ClientAuthorityClaims.none());
        assertThat(decide(revoked, "learning.review.write").code())
                .isEqualTo(LearningDecisionCode.REVOKED);

        LearningPrincipalContext noConsent = new LearningPrincipalContext(
                LearningTenantScope.forPhaseOne(PRINCIPAL, 7001), "phase-1", Set.of("learner"),
                Set.of("learning.review.write"), ConsentState.UNKNOWN, false,
                ClientAuthorityClaims.none());
        assertThat(decide(noConsent, "learning.review.write").code())
                .isEqualTo(LearningDecisionCode.CONSENT_REQUIRED);

        LearningPrincipalContext noRole = new LearningPrincipalContext(
                LearningTenantScope.forPhaseOne(PRINCIPAL, 7001), "phase-1", Set.of("admin"),
                Set.of("learning.review.write"), ConsentState.GRANTED, false,
                ClientAuthorityClaims.none());
        assertThat(decide(noRole, "learning.review.write").code())
                .isEqualTo(LearningDecisionCode.ROLE_DENIED);

        assertThat(decide(allowed(), "learning.nonexistent.write").code())
                .isEqualTo(LearningDecisionCode.PERMISSION_DENIED);
    }

    @Test
    void requireAllowedPropagatesDeniedDecisionAsException() {
        AuthorizationDecision denied = decide(allowed(), "learning.nonexistent.write");
        assertThat(denied.allowed()).isFalse();
        assertThatThrownBy(denied::requireAllowed)
                .isInstanceOf(LearningAuthorizationException.class)
                .satisfies(e -> assertThat(((LearningAuthorizationException) e).code())
                        .isEqualTo(LearningDecisionCode.PERMISSION_DENIED));
    }

    @Test
    void missingContextFieldsAreDenied() {
        assertThat(policy().authorize(allowed(), "", "srs_state", "70001",
                "platform", PRINCIPAL).code())
                .isEqualTo(LearningDecisionCode.INVALID_CONTEXT);
    }
}
