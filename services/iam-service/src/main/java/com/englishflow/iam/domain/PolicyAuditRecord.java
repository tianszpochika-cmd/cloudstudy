package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Append-only, non-sensitive audit fact for an IAM policy control-plane mutation. */
public record PolicyAuditRecord(
        UUID auditId,
        UUID policyVersionId,
        int revision,
        String eventType,
        PrincipalId actor,
        String tenantId,
        String requestId,
        String traceId,
        String reasonDigest,
        Instant recordedAt) {

    public PolicyAuditRecord {
        Objects.requireNonNull(auditId, "auditId");
        Objects.requireNonNull(policyVersionId, "policyVersionId");
        if (revision < 1) throw new IllegalArgumentException("policy audit revision is invalid");
        requireSafe(eventType, "eventType");
        Objects.requireNonNull(actor, "actor");
        if (!TenantScope.PLATFORM_TENANT.equals(tenantId)) {
            throw new IllegalArgumentException("policy audit tenant is invalid");
        }
        requireSafe(requestId, "requestId");
        requireSafe(traceId, "traceId");
        if (reasonDigest == null || !reasonDigest.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("policy reason digest is invalid");
        }
        Objects.requireNonNull(recordedAt, "recordedAt");
    }

    private static void requireSafe(String value, String name) {
        if (value == null || value.isBlank() || value.length() > 128
                || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException(name + " is invalid");
        }
    }
}
