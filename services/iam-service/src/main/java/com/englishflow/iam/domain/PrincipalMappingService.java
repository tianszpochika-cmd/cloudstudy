package com.englishflow.iam.domain;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

/** Maps a verified provider identity to a platform principal without mutable reassignment. */
public final class PrincipalMappingService {

    private final PrincipalMappingPort mappings;
    private final Clock clock;

    public PrincipalMappingService(PrincipalMappingPort mappings, Clock clock) {
        this.mappings = Objects.requireNonNull(mappings, "mappings");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public PrincipalMapping mapVerifiedIdentity(ExternalIdentity identity) {
        Objects.requireNonNull(identity, "identity");
        return mappings.findByExternalIdentity(identity)
                .orElseGet(() -> mappings.createIfAbsent(
                        new PrincipalMapping(identity, PrincipalId.random(), Instant.now(clock))));
    }
}
