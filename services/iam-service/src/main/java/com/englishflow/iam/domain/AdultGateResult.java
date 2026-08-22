package com.englishflow.iam.domain;

import java.util.Objects;

/** Structured adult gate outcome. No child, guardian, K12 or payment fact is created here. */
public record AdultGateResult(
        boolean allowed,
        IamDecisionCode code,
        String messageKey,
        TenantScope scope,
        AuditDecision auditDecision) {

    public AdultGateResult {
        Objects.requireNonNull(code, "code");
        Objects.requireNonNull(messageKey, "messageKey");
        Objects.requireNonNull(scope, "scope");
        Objects.requireNonNull(auditDecision, "auditDecision");
        if (allowed != auditDecision.allowed() || code != auditDecision.code()) {
            throw new IllegalArgumentException("audit decision must describe the result");
        }
    }
}
