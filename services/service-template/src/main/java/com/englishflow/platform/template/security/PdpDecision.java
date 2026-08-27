package com.englishflow.platform.template.security;

import java.util.Objects;

/** Bounded result returned by a trusted PDP adapter; PEP re-validates every safety field. */
public record PdpDecision(
        DecisionEffect effect,
        DecisionReason reason,
        PolicyVersion policyVersion,
        RevocationStatus revocationStatus,
        boolean completed,
        String requestFingerprint
) {

    /** Compatibility constructor; a completed decision without a context binding is rejected by the PEP. */
    public PdpDecision(
            DecisionEffect effect,
            DecisionReason reason,
            PolicyVersion policyVersion,
            RevocationStatus revocationStatus,
            boolean completed) {
        this(effect, reason, policyVersion, revocationStatus, completed, null);
    }

    public PdpDecision {
        Objects.requireNonNull(effect, "PDP effect is required");
        Objects.requireNonNull(reason, "PDP reason is required");
        if (requestFingerprint != null && requestFingerprint.isBlank()) {
            throw new IllegalArgumentException("PDP request fingerprint cannot be blank");
        }
        if (!completed && effect != DecisionEffect.DENY) {
            throw new IllegalArgumentException("an incomplete PDP decision must deny");
        }
    }

    public static PdpDecision allow(PolicyVersion policyVersion) {
        return allow(null, policyVersion);
    }

    public static PdpDecision allow(AuthorizationContext context, PolicyVersion policyVersion) {
        return new PdpDecision(
                DecisionEffect.ALLOW,
                DecisionReason.ALLOWED,
                policyVersion,
                RevocationStatus.CONFIRMED_ACTIVE,
                true,
                fingerprint(context));
    }

    public static PdpDecision deny(DecisionReason reason, PolicyVersion policyVersion) {
        return deny(null, reason, policyVersion);
    }

    public static PdpDecision deny(
            AuthorizationContext context,
            DecisionReason reason,
            PolicyVersion policyVersion) {
        if (reason == null || reason == DecisionReason.ALLOWED) {
            throw new IllegalArgumentException("PDP deny requires a deny reason");
        }
        return new PdpDecision(
                DecisionEffect.DENY,
                reason,
                policyVersion,
                RevocationStatus.CONFIRMED_ACTIVE,
                true,
                fingerprint(context));
    }

    public static PdpDecision unavailable() {
        return unavailable(null);
    }

    public static PdpDecision unavailable(AuthorizationContext context) {
        return new PdpDecision(
                DecisionEffect.DENY,
                DecisionReason.PDP_UNAVAILABLE,
                null,
                RevocationStatus.UNKNOWN,
                false,
                fingerprint(context));
    }

    public boolean isBoundTo(AuthorizationContext context) {
        return context != null
                && requestFingerprint != null
                && requestFingerprint.equals(context.requestFingerprint());
    }

    private static String fingerprint(AuthorizationContext context) {
        return context == null ? null : context.requestFingerprint();
    }
}
