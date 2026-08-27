package com.englishflow.iam.domain;

import com.englishflow.iam.oidc.VerifiedOidcIdentity;

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

    public PrincipalMapping mapVerifiedIdentity(VerifiedOidcIdentity verifiedIdentity) {
        Objects.requireNonNull(verifiedIdentity, "verifiedIdentity");
        if (verifiedIdentity.verifiedAt().isAfter(Instant.now(clock))) {
            throw new IamPolicyException(IamDecisionCode.OIDC_IDENTITY_INVALID, "iam.oidc.identity_invalid");
        }
        ExternalIdentity identity = verifiedIdentity.externalIdentity();
        return mappings.findByExternalIdentity(identity)
                .orElseGet(() -> mappings.createIfAbsent(
                        new PrincipalMapping(identity, PrincipalId.random(), Instant.now(clock))));
    }
}
