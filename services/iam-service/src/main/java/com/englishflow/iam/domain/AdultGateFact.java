package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

/** Durable, server-owned adult Gate projection used by IAM reads and policy checks. */
public record AdultGateFact(
        String status,
        String policyVersion,
        Instant evaluatedAt,
        boolean retryAllowed) {

    public AdultGateFact {
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(policyVersion, "policyVersion");
        Objects.requireNonNull(evaluatedAt, "evaluatedAt");
    }

    public static AdultGateFact pending(Instant evaluatedAt) {
        return new AdultGateFact("PENDING", "b30-adult-v1", evaluatedAt, true);
    }
}
