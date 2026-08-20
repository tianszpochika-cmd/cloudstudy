package com.englishflow.modules.auth;

import java.time.Instant;
import java.util.Optional;

/** Persistence boundary for identities; production can replace the memory adapter. */
public interface IdentityRepository {
    Optional<AuthIdentity> findByPhoneLookupHash(String phoneLookupHash);

    Optional<AuthIdentity> findByUserId(long userId);

    AuthIdentity create(
            String phoneLookupHash,
            Instant adultConfirmedAt,
            String privacyPolicyVersion,
            Instant privacyConsentedAt,
            Instant now
    );

    void recordLogin(AuthIdentity identity, Instant at);
}
