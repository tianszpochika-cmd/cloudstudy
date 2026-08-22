package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

/** Immutable external identity mapping fact. It cannot be updated in place. */
public record PrincipalMapping(
        ExternalIdentity externalIdentity,
        PrincipalId principalId,
        Instant createdAt) {

    public PrincipalMapping {
        Objects.requireNonNull(externalIdentity, "externalIdentity");
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(createdAt, "createdAt");
    }
}
