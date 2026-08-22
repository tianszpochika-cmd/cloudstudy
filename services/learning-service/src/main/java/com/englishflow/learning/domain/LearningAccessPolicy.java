package com.englishflow.learning.domain;

import java.time.Clock;
import java.util.Objects;

/** Pure service-side RBAC + ABAC guard; default deny is tested without Spring or an IdP. */
public final class LearningAccessPolicy {

    private final Clock clock;

    public LearningAccessPolicy(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public AuthorizationDecision authorize(
            LearningPrincipalContext context,
            String requiredPermission,
            String resourceType,
            String resourceId,
            String resourceTenantId,
            String resourceOwnerId) {
        if (context == null) {
            return deny(LearningDecisionCode.MISSING_PRINCIPAL);
        }
        if (context.clientAuthorityClaims().containsAuthorityAttempt()) {
            return deny(LearningDecisionCode.CLIENT_AUTHORITY_REJECTED);
        }
        if (blank(requiredPermission) || blank(resourceType) || blank(resourceId)) {
            return deny(LearningDecisionCode.INVALID_CONTEXT);
        }
        if (blank(resourceTenantId)) {
            return deny(LearningDecisionCode.MISSING_TENANT);
        }
        if (!context.scope().tenantId().equals(resourceTenantId)) {
            return deny(LearningDecisionCode.TENANT_MISMATCH);
        }
        if (blank(resourceOwnerId)) {
            return deny(LearningDecisionCode.MISSING_OWNER);
        }
        if (!context.scope().principalId().equals(resourceOwnerId)) {
            return deny(LearningDecisionCode.OWNER_MISMATCH);
        }
        if (!"phase-1".equals(context.phase())) {
            return deny(LearningDecisionCode.PHASE_DENIED);
        }
        if (context.revoked()) {
            return deny(LearningDecisionCode.REVOKED);
        }
        if (context.consent() != ConsentState.GRANTED) {
            return deny(LearningDecisionCode.CONSENT_REQUIRED);
        }
        if (!context.hasRole("learner")) {
            return deny(LearningDecisionCode.ROLE_DENIED);
        }
        if (!context.hasPermission(requiredPermission)) {
            return deny(LearningDecisionCode.PERMISSION_DENIED);
        }
        return AuthorizationDecision.allow(clock.instant());
    }

    private AuthorizationDecision deny(LearningDecisionCode code) {
        return AuthorizationDecision.deny(code, clock.instant());
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
