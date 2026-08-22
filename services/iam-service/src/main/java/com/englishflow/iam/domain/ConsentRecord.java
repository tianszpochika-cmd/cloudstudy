package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

/** Immutable consent event snapshot. Withdrawal creates a new record and never erases history. */
public record ConsentRecord(
        PrincipalId principalId,
        TenantScope scope,
        ConsentType type,
        ConsentVersion version,
        boolean accepted,
        Instant recordedAt) {

    public ConsentRecord {
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(scope, "scope");
        if (!principalId.equals(scope.subject())) {
            throw new IllegalArgumentException("consent principal must match scope subject");
        }
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(version, "version");
        Objects.requireNonNull(recordedAt, "recordedAt");
    }
}
