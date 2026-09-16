package com.englishflow.assessment.domain;

import java.util.Objects;

/**
 * Authenticated principal supplied by the IAM/Gateway adapter.
 *
 * <p>There is deliberately no constructor accepting a client supplied owner or tenant header.
 * The application service uses this object for every access decision and defaults to deny.</p>
 */
public record AssessmentPrincipal(String subjectId, String tenantId, boolean authenticated) {
    public AssessmentPrincipal {
        // Local IAM mints bare-UUID subjects; the prn_-only pattern rejected
        // every real producer (same widening as the B10 event principalId).
        subjectId = required(subjectId, "subjectId", "(prn_[A-Za-z0-9._:-]{15,127}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})");
        tenantId = required(tenantId, "tenantId", "[A-Za-z0-9._:-]{2,64}");
    }

    public static AssessmentPrincipal authenticated(String subjectId, String tenantId) {
        return new AssessmentPrincipal(subjectId, tenantId, true);
    }

    public static AssessmentPrincipal anonymous() {
        return new AssessmentPrincipal("prn_anonymous000000", "platform", false);
    }

    public void requireAuthenticated() {
        if (!authenticated) throw AssessmentDomainException.forbidden("authenticated principal is required");
    }

    private static String required(String value, String field, String pattern) {
        Objects.requireNonNull(value, field + " is required");
        if (!value.matches(pattern)) throw AssessmentDomainException.invalid("ASM_PRINCIPAL_INVALID", field + " is invalid");
        return value;
    }
}
