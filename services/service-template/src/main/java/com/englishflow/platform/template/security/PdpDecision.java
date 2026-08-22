package com.englishflow.platform.template.security;

import java.util.Objects;

/** Bounded result returned by a trusted PDP adapter; PEP re-validates every safety field. */
public record PdpDecision(
        DecisionEffect effect,
        DecisionReason reason,
        PolicyVersion policyVersion,
        RevocationStatus revocationStatus,
        boolean completed
) {

    public PdpDecision {
        Objects.requireNonNull(effect, "PDP effect is required");
        Objects.requireNonNull(reason, "PDP reason is required");
    }

    public static PdpDecision allow(PolicyVersion policyVersion) {
        return new PdpDecision(
                DecisionEffect.ALLOW,
                DecisionReason.ALLOWED,
                policyVersion,
                RevocationStatus.CONFIRMED_ACTIVE,
                true);
    }

    public static PdpDecision deny(DecisionReason reason, PolicyVersion policyVersion) {
        if (reason == null || reason == DecisionReason.ALLOWED) {
            throw new IllegalArgumentException("PDP deny requires a deny reason");
        }
        return new PdpDecision(
                DecisionEffect.DENY,
                reason,
                policyVersion,
                RevocationStatus.CONFIRMED_ACTIVE,
                true);
    }

    public static PdpDecision unavailable() {
        return new PdpDecision(
                DecisionEffect.DENY,
                DecisionReason.PDP_UNAVAILABLE,
                null,
                RevocationStatus.UNKNOWN,
                false);
    }
}
