package com.englishflow.platform.template.security;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

/**
 * Pure Java RBAC + ABAC evaluator. It has no Spring, HTTP, database or remote PDP dependency,
 * which makes the deny matrix executable in unit tests and safe to copy into a service.
 */
public final class LocalPolicyEvaluator {

    private final Clock clock;

    public LocalPolicyEvaluator(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public Decision evaluate(AuthorizationContext context, PolicySnapshot policy) {
        Instant now = clock.instant();
        Decision factsDecision = validateFacts(context, now);
        if (!factsDecision.allowed()) {
            return factsDecision;
        }
        if (policy == null) {
            return Decision.deny(context, DecisionReason.POLICY_UNAVAILABLE, null, now);
        }
        if (!policy.signatureVerified()) {
            return Decision.deny(context, DecisionReason.POLICY_SIGNATURE_INVALID, policy.version(), now);
        }
        if (!policy.version().isFresh(now)) {
            return Decision.deny(context, DecisionReason.POLICY_STALE, policy.version(), now);
        }
        if (!policy.permits(context.principal().claims(), context.action())) {
            return Decision.deny(context, DecisionReason.RBAC_DENIED, policy.version(), now);
        }
        return Decision.allow(context, policy.version(), now);
    }

    /** Structural ABAC facts are enforced before a stale-cache/PDP fallback can run. */
    public Decision validateFacts(AuthorizationContext context) {
        return validateFacts(context, clock.instant());
    }

    private Decision validateFacts(AuthorizationContext context, Instant now) {
        if (context == null) {
            return Decision.deny(null, DecisionReason.INVALID_CONTEXT, null, now);
        }
        if (context.clientSecurityFacts().containsAuthorityAttempt()) {
            return Decision.deny(context, DecisionReason.UNTRUSTED_CLIENT_FACTS, null, now);
        }
        if (isBlank(context.action()) || isBlank(context.resourceType()) || isBlank(context.resourceId())) {
            return Decision.deny(context, DecisionReason.INVALID_CONTEXT, null, now);
        }
        if (isBlank(context.resourceTenantId())) {
            return Decision.deny(context, DecisionReason.MISSING_TENANT, null, now);
        }
        if (!context.tenantScopeId().equals(context.resourceTenantId())) {
            return Decision.deny(context, DecisionReason.TENANT_MISMATCH, null, now);
        }
        if (isBlank(context.resourceOwnerId())) {
            return Decision.deny(context, DecisionReason.MISSING_OWNER, null, now);
        }
        if (!context.subjectId().equals(context.resourceOwnerId())) {
            return Decision.deny(context, DecisionReason.OWNER_MISMATCH, null, now);
        }
        if (isBlank(context.resourcePhase()) || !context.principal().claims().hasUsablePhase()) {
            return Decision.deny(context, DecisionReason.MISSING_PHASE, null, now);
        }
        if (!context.resourcePhase().equals(context.principal().claims().phase())) {
            return Decision.deny(context, DecisionReason.PHASE_MISMATCH, null, now);
        }
        if (context.requiredContentRights().isEmpty()) {
            return Decision.deny(context, DecisionReason.MISSING_CONTENT_RIGHTS, null, now);
        }
        if (!context.principal().claims().contentRights().containsAll(context.requiredContentRights())) {
            return Decision.deny(context, DecisionReason.CONTENT_RIGHTS_DENIED, null, now);
        }
        if (context.resourceConsent() == ConsentState.UNKNOWN
                || context.principal().claims().consent() == ConsentState.UNKNOWN) {
            return Decision.deny(context, DecisionReason.MISSING_CONSENT, null, now);
        }
        if (context.resourceConsent() != ConsentState.GRANTED
                || context.principal().claims().consent() != ConsentState.GRANTED) {
            return Decision.deny(context, DecisionReason.CONSENT_DENIED, null, now);
        }
        return switch (context.principal().claims().revocationStatus()) {
            case CONFIRMED_ACTIVE -> Decision.allow(context, new PolicyVersion("facts-only", now.plusSeconds(1)), now);
            case REVOKED -> Decision.deny(context, DecisionReason.REVOKED, null, now);
            case UNKNOWN -> Decision.deny(context, DecisionReason.REVOCATION_UNKNOWN, null, now);
        };
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
