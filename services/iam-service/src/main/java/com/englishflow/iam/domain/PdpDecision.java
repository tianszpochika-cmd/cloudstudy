package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Fail-closed decision data returned by the canonical internal PDP endpoint. */
public record PdpDecision(UUID decisionId, String decision, String reasonCode, String policyVersion,
                          Instant evaluatedAt, Instant cacheUntil, PolicyAuditRecord audit) {
    public PdpDecision {
        Objects.requireNonNull(decisionId, "decisionId");
        if (!"ALLOW".equals(decision) && !"DENY".equals(decision)) {
            throw new IllegalArgumentException("PDP decision is invalid");
        }
        Objects.requireNonNull(reasonCode, "reasonCode");
        Objects.requireNonNull(policyVersion, "policyVersion");
        Objects.requireNonNull(evaluatedAt, "evaluatedAt");
        Objects.requireNonNull(audit, "audit");
    }

    public boolean allowed() { return "ALLOW".equals(decision); }
}
