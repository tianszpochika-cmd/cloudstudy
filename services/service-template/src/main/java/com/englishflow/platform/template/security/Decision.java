package com.englishflow.platform.template.security;

import java.time.Instant;
import java.util.Objects;

/** Immutable authorization result with a server-derived replay/audit identifier. */
public final class Decision {

    private final DecisionEffect effect;
    private final DecisionReason reason;
    private final String decisionId;
    private final PolicyVersion policyVersion;
    private final Instant evaluatedAt;

    private Decision(
            DecisionEffect effect,
            DecisionReason reason,
            String decisionId,
            PolicyVersion policyVersion,
            Instant evaluatedAt) {
        this.effect = effect;
        this.reason = reason;
        this.decisionId = decisionId;
        this.policyVersion = policyVersion;
        this.evaluatedAt = evaluatedAt;
    }

    static Decision allow(AuthorizationContext context, PolicyVersion policyVersion, Instant evaluatedAt) {
        return create(context, DecisionEffect.ALLOW, DecisionReason.ALLOWED, policyVersion, evaluatedAt);
    }

    static Decision deny(
            AuthorizationContext context,
            DecisionReason reason,
            PolicyVersion policyVersion,
            Instant evaluatedAt) {
        if (reason == null || reason == DecisionReason.ALLOWED) {
            throw new IllegalArgumentException("a deny decision requires a deny reason");
        }
        return create(context, DecisionEffect.DENY, reason, policyVersion, evaluatedAt);
    }

    private static Decision create(
            AuthorizationContext context,
            DecisionEffect effect,
            DecisionReason reason,
            PolicyVersion policyVersion,
            Instant evaluatedAt) {
        Objects.requireNonNull(effect, "decision effect is required");
        Objects.requireNonNull(reason, "decision reason is required");
        Objects.requireNonNull(evaluatedAt, "evaluatedAt is required");
        String decisionId = DecisionId.derive(context, policyVersion, effect, reason, evaluatedAt);
        return new Decision(effect, reason, decisionId, policyVersion, evaluatedAt);
    }

    public DecisionEffect effect() {
        return effect;
    }

    public DecisionReason reason() {
        return reason;
    }

    public String decisionId() {
        return decisionId;
    }

    public PolicyVersion policyVersion() {
        return policyVersion;
    }

    public Instant evaluatedAt() {
        return evaluatedAt;
    }

    public boolean allowed() {
        return effect == DecisionEffect.ALLOW;
    }

    public int httpStatus() {
        return allowed() ? 200 : 403;
    }
}
