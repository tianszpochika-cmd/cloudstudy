package com.englishflow.learner.domain;

import java.time.Clock;
import java.util.Objects;

/**
 * Pure service-side RBAC + ABAC guard. It is deliberately independent of Spring, HTTP and the
 * database so the deny matrix can be tested before IAM JWT or PDP runtime facts are available.
 */
public final class LearnerAccessPolicy {

    private final Clock clock;

    public LearnerAccessPolicy(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public AuthorizationDecision authorize(
            LearnerPrincipalContext context,
            String requiredPermission,
            String resourceType,
            String resourceId,
            String resourceTenantId,
            String resourceOwnerId) {
        if (context == null) {
            return deny(LearnerDecisionCode.MISSING_PRINCIPAL);
        }
        if (context.clientAuthorityClaims().containsAuthorityAttempt()) {
            return deny(LearnerDecisionCode.CLIENT_AUTHORITY_REJECTED);
        }
        if (blank(requiredPermission) || blank(resourceType) || blank(resourceId)) {
            return deny(LearnerDecisionCode.INVALID_CONTEXT);
        }
        if (blank(resourceTenantId)) {
            return deny(LearnerDecisionCode.MISSING_TENANT);
        }
        if (!context.scope().tenantId().equals(resourceTenantId)) {
            return deny(LearnerDecisionCode.TENANT_MISMATCH);
        }
        if (blank(resourceOwnerId)) {
            return deny(LearnerDecisionCode.MISSING_OWNER);
        }
        if (!context.scope().subjectId().equals(resourceOwnerId)) {
            return deny(LearnerDecisionCode.OWNER_MISMATCH);
        }
        if (!"phase-1".equals(context.phase())) {
            return deny(LearnerDecisionCode.PHASE_DENIED);
        }
        if (context.revoked()) {
            return deny(LearnerDecisionCode.REVOKED);
        }
        if (context.consent() != ConsentState.GRANTED) {
            return deny(LearnerDecisionCode.CONSENT_REQUIRED);
        }
        if (!context.hasRole("learner")) {
            return deny(LearnerDecisionCode.ROLE_DENIED);
        }
        if (!context.hasPermission(requiredPermission)) {
            return deny(LearnerDecisionCode.PERMISSION_DENIED);
        }
        return AuthorizationDecision.allow(clock.instant());
    }

    private AuthorizationDecision deny(LearnerDecisionCode code) {
        return AuthorizationDecision.deny(code, clock.instant());
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
