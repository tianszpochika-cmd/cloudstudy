package com.englishflow.iam.domain;

import java.util.Optional;

/** Persistence port for an IAM-owned immutable principal mapping. */
public interface PrincipalMappingPort {

    Optional<PrincipalMapping> findByExternalIdentity(ExternalIdentity identity);

    /**
     * Creates a mapping once. An existing identical mapping is idempotent; any remap fails.
     */
    PrincipalMapping createIfAbsent(PrincipalMapping mapping);
}
